import json
import os
import time
import uuid
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
from shared.purchase_access import purchase_grants_access


LEGACY_COURSE_ID = 'legacy-default-course'


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj: Any):
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super().default(obj)


def create_response(status_code: int, body: Any):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def get_user_id(event) -> Optional[str]:
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except KeyError:
        return None


def is_admin(event) -> bool:
    try:
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims') or {}
        groups = claims.get('cognito:groups', '')
        if isinstance(groups, str):
            return 'admin' in groups.split(',') if groups else False
        if isinstance(groups, list):
            return 'admin' in groups
    except (KeyError, AttributeError):
        pass
    return False


def query_all(table, **kwargs):
    items = []
    last_key = None
    while True:
        current_kwargs = dict(kwargs)
        if last_key:
            current_kwargs['ExclusiveStartKey'] = last_key
        response = table.query(**current_kwargs)
        items.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
    return items


def normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {'true', '1', 'yes', 'on'}
    return bool(value)


def is_external_video_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(('http://', 'https://'))


# Explicit fallback chain per requested quality. If the exact rendition is
# missing (still transcoding, or an older video), we try the closest
# available quality in the same direction (lower first) before reaching for
# a higher one, and only fall back to the legacy single "_1080p" output as
# the last resort for videos transcoded before multi-quality support existed.
FALLBACK_CHAINS = {
    'high': ['720p', '480p', '360p', '1080p'],
    'medium': ['480p', '360p', '720p', '1080p'],
    'low': ['360p', '480p', '720p', '1080p'],
}
DEFAULT_QUALITY_ORDER = ['720p', '480p', '360p', '1080p']
_rendition_cache: dict[str, tuple[float, dict[str, str]]] = {}
_RENDITION_CACHE_TTL_SECONDS = 30


def get_optimized_video_key(video_s3_key: str, suffix: str) -> str:
    parts = video_s3_key.strip('/').split('/')
    if len(parts) >= 4 and parts[0] == 'videos' and parts[-1].startswith('source.'):
        return f"streaming/{'/'.join(parts[1:-1])}/source_{suffix}.mp4"
    source_name = video_s3_key.rsplit('/', 1)[-1]
    source_stem = source_name.rsplit('.', 1)[0]
    return f'streaming/{source_stem}/{source_stem}_{suffix}.mp4'


def get_available_renditions(video_s3_key: str) -> dict[str, str]:
    """Checks each known rendition once and returns {suffix: s3_key} for the ones that exist."""
    cached = _rendition_cache.get(video_s3_key)
    now = time.monotonic()
    if cached and cached[0] > now:
        return dict(cached[1])
    available = {}
    for suffix in DEFAULT_QUALITY_ORDER:
        key = get_optimized_video_key(video_s3_key, suffix)
        try:
            s3_client.head_object(Bucket=video_bucket_name, Key=key)
            available[suffix] = key
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code', '') in {'404', 'NoSuchKey', 'NotFound'}:
                continue
            raise
    _rendition_cache[video_s3_key] = (now + _RENDITION_CACHE_TTL_SECONDS, dict(available))
    return available


def resolve_served_video_key(
    video_s3_key: str,
    requested_quality: Optional[str],
    available_renditions: dict[str, str],
) -> tuple[str, Optional[str]]:
    """Returns (s3_key_to_serve, quality_label_or_None_for_source)."""
    normalized_quality = (requested_quality or 'high').lower()
    suffix_order = FALLBACK_CHAINS.get(normalized_quality, FALLBACK_CHAINS['high'])

    for suffix in suffix_order:
        if suffix in available_renditions:
            return available_renditions[suffix], suffix

    # Nothing transcoded yet (e.g. MediaConvert still running) - serve the
    # original upload so the lesson isn't blocked.
    return video_s3_key, None


def get_user_item(user_id: str) -> dict[str, Any]:
    response = users_table.get_item(Key={'user_id': user_id})
    return response.get('Item') or {}


def get_user_purchases(user_id: str) -> list[dict[str, Any]]:
    return query_all(
        purchases_table,
        IndexName='UserIndex',
        KeyConditionExpression=Key('user_id').eq(user_id),
    )


def user_has_global_access(user_item: dict[str, Any]) -> bool:
    # Course purchases must never become access to the whole catalogue merely
    # because the account is active. Global access is an explicit entitlement.
    return normalize_bool(user_item.get('global_access', False))


def normalize_purchase_course_id(purchase: dict[str, Any]) -> str:
    return purchase.get('course_id') or LEGACY_COURSE_ID


def find_access_purchase(user_id: str, course_id: str) -> Optional[dict[str, Any]]:
    """Return the matching active purchase, if the entitlement is a purchase."""
    for purchase in get_user_purchases(user_id):
        if normalize_purchase_course_id(purchase) == course_id and purchase_grants_access(purchase):
            return purchase
    return None


def get_course_access(user_id: str, course_id: str) -> tuple[bool, Optional[dict[str, Any]]]:
    """Return whether access is granted and the purchase to audit, when present.

    Global access is an explicit entitlement and deliberately has no purchase
    record.  Keep that distinction so callers do not mistake ``None`` for a
    denied request.
    """
    if user_has_global_access(get_user_item(user_id)):
        return True, None

    purchase = find_access_purchase(user_id, course_id)
    return purchase is not None, purchase



def can_access_course(user_id: str, course_id: str) -> bool:
    return get_course_access(user_id, course_id)[0]


def request_value_hash(value: Any) -> Optional[str]:
    """Store a non-raw network/browser fingerprint for dispute evidence."""
    if value in (None, ''):
        return None
    return hashlib.sha256(str(value).strip().encode('utf-8')).hexdigest()


def record_video_access_issued(event: dict[str, Any], user_id: str, course_id: str,
                               lesson_id: str, purchase: Optional[dict[str, Any]]) -> None:
    """Append an evidence record when an authorised video URL is issued.

    Logging failure never prevents a legitimate student from viewing a lesson.
    Raw IP address and User-Agent are deliberately not stored.
    """
    if not video_access_logs_table:
        return
    try:
        request_context = event.get('requestContext') or {}
        identity = request_context.get('identity') or {}
        headers = {str(key).lower(): value for key, value in (event.get('headers') or {}).items()}
        source_ip = identity.get('sourceIp') or headers.get('x-forwarded-for')
        now = datetime.utcnow()
        item = {
            'access_id': str(uuid.uuid4()),
            'user_id': user_id,
            'course_id': course_id,
            'lesson_id': lesson_id,
            'purchase_id': (purchase or {}).get('purchase_id') or 'global_access',
            'event_type': 'video_url_issued',
            'issued_at': now.isoformat() + 'Z',
            # Two years is deliberately longer than the usual card-dispute
            # window while avoiding an indefinite behavioural log.
            'ttl_expires_at': int((now + timedelta(days=730)).timestamp()),
        }
        source_ip_hash = request_value_hash(source_ip)
        user_agent_hash = request_value_hash(headers.get('user-agent'))
        if source_ip_hash:
            item['source_ip_hash'] = source_ip_hash
        if user_agent_hash:
            item['user_agent_hash'] = user_agent_hash
        video_access_logs_table.put_item(Item=item)
    except Exception as exc:
        print(f'video access evidence log failed: {exc}')


def get_video_url(user_id: str, lesson_id: str, admin_bypass: bool = False, requested_quality: Optional[str] = None,
                  request_event: Optional[dict[str, Any]] = None):
    lesson_response = lessons_table.get_item(Key={'lesson_id': lesson_id})
    lesson = lesson_response.get('Item')
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})

    chapter_response = chapters_table.get_item(Key={'chapter_id': lesson.get('chapter_id')})
    chapter = chapter_response.get('Item')
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})

    course_id = chapter.get('course_id')
    is_free_preview = normalize_bool(lesson.get('is_free_preview', False))
    access_purchase = None
    if not is_free_preview and not admin_bypass:
        access_granted, access_purchase = get_course_access(user_id, course_id)
        if not access_granted:
            return create_response(403, {'error': 'Course access required'})

    video_s3_key = lesson.get('video_s3_key')
    if not video_s3_key:
        return create_response(404, {'error': 'No video found for this lesson'})

    if is_external_video_url(video_s3_key):
        return create_response(200, {
            'video_url': video_s3_key,
            'expires_at': None,
            'course_id': course_id,
        })

    available_renditions = get_available_renditions(video_s3_key)
    served_video_key, served_quality = resolve_served_video_key(video_s3_key, requested_quality, available_renditions)

    try:
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': video_bucket_name, 'Key': served_video_key},
            ExpiresIn=600,
        )
    except ClientError as exc:
        print(f'generate_presigned_url error: {exc}')
        return create_response(500, {'error': 'Failed to generate video URL'})

    available_qualities = [suffix for suffix in DEFAULT_QUALITY_ORDER if suffix in available_renditions]
    if not is_free_preview and not admin_bypass and request_event:
        record_video_access_issued(request_event, user_id, course_id, lesson_id, access_purchase)

    return create_response(200, {
        'video_url': presigned_url,
        'expires_at': (datetime.utcnow() + timedelta(minutes=10)).isoformat() + 'Z',
        'course_id': course_id,
        'video_quality': served_quality or 'source',
        'available_qualities': available_qualities,
    })


dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

lessons_table = dynamodb.Table(os.environ.get('LESSONS_TABLE'))
chapters_table = dynamodb.Table(os.environ.get('CHAPTERS_TABLE'))
purchases_table = dynamodb.Table(os.environ.get('PURCHASES_TABLE'))
users_table = dynamodb.Table(os.environ.get('USERS_TABLE'))
video_bucket_name = os.environ.get('VIDEO_BUCKET')
video_access_logs_table = (
    dynamodb.Table(os.environ['VIDEO_ACCESS_LOGS_TABLE'])
    if os.environ.get('VIDEO_ACCESS_LOGS_TABLE') else None
)


def lambda_handler(event, context):
    del context
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}
    user_id = get_user_id(event)
    admin_bypass = is_admin(event)

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if not user_id:
        return create_response(401, {'error': 'Unauthorized'})

    try:
        if path.startswith('/course/video/') and http_method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            return get_video_url(
                user_id,
                path_parameters.get('lesson_id'),
                admin_bypass=admin_bypass,
                requested_quality=query_params.get('quality'),
                request_event=event,
            )

        return create_response(404, {'error': 'Not found'})
    except Exception as exc:  # noqa: BLE001 - last-resort guard, see below
        # Without this, any unexpected error (e.g. an S3/DynamoDB throttling
        # exception not already caught locally) becomes a raw Lambda failure
        # instead of a controlled JSON response. Log server-side, keep the
        # client-facing message generic.
        print(f'Unhandled error in video_handler: {exc}')
        return create_response(500, {'error': 'Internal server error'})
