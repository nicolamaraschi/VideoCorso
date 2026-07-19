import json
import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


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
        groups = event['requestContext']['authorizer']['claims'].get('cognito:groups', '')
        if isinstance(groups, str):
            return 'admin' in groups.split(',') if groups else False
        if isinstance(groups, list):
            return 'admin' in groups
    except KeyError:
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


def get_optimized_video_key(video_s3_key: str) -> str:
    source_name = video_s3_key.rsplit('/', 1)[-1]
    source_stem = source_name.rsplit('.', 1)[0]
    return f'streaming/{source_stem}/{source_stem}_1080p.mp4'


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
    if normalize_bool(user_item.get('global_access', False)):
        return True

    status = str(user_item.get('subscription_status', '')).lower()
    return status == 'active' and not user_item.get('sub_end_date')


def normalize_purchase_course_id(purchase: dict[str, Any]) -> str:
    return purchase.get('course_id') or LEGACY_COURSE_ID


def purchase_grants_access(purchase: dict[str, Any]) -> bool:
    local_status = str(purchase.get('local_status') or purchase.get('status') or '')
    access_unlocked = normalize_bool(purchase.get('access_unlocked', local_status in {'paid', 'active'}))
    access_revoked = normalize_bool(purchase.get('access_revoked', False))
    refunded_amount = Decimal(str(purchase.get('refunded_amount', 0) or 0))
    return local_status in {'paid', 'needs_review'} and access_unlocked and not access_revoked and refunded_amount <= 0


def can_access_course(user_id: str, course_id: str) -> bool:
    if user_has_global_access(get_user_item(user_id)):
        return True

    for purchase in get_user_purchases(user_id):
        if normalize_purchase_course_id(purchase) == course_id and purchase_grants_access(purchase):
            return True

    return False


def get_video_url(user_id: str, lesson_id: str, admin_bypass: bool = False):
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
    if not is_free_preview and not admin_bypass and not can_access_course(user_id, course_id):
        return create_response(403, {'error': 'Course access required'})

    video_s3_key = lesson.get('video_s3_key')
    if not video_s3_key:
        return create_response(404, {'error': 'No video found for this lesson'})

    if is_external_video_url(video_s3_key):
        return create_response(200, {
            'video_url': video_s3_key,
            'expires_at': (datetime.utcnow() + timedelta(hours=1)).isoformat() + 'Z',
            'course_id': course_id,
        })

    served_video_key = video_s3_key
    try:
        optimized_key = get_optimized_video_key(video_s3_key)
        s3_client.head_object(Bucket=video_bucket_name, Key=optimized_key)
        served_video_key = optimized_key
    except ClientError:
        # The original remains available while MediaConvert processes the HD version.
        pass

    try:
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': video_bucket_name, 'Key': served_video_key},
            ExpiresIn=3600,
        )
    except ClientError as exc:
        print(f'generate_presigned_url error: {exc}')
        return create_response(500, {'error': 'Failed to generate video URL'})

    return create_response(200, {
        'video_url': presigned_url,
        'expires_at': (datetime.utcnow() + timedelta(hours=1)).isoformat() + 'Z',
        'course_id': course_id,
        'video_quality': '1080p_optimized' if served_video_key != video_s3_key else 'source',
    })


dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

lessons_table = dynamodb.Table(os.environ.get('LESSONS_TABLE'))
chapters_table = dynamodb.Table(os.environ.get('CHAPTERS_TABLE'))
purchases_table = dynamodb.Table(os.environ.get('PURCHASES_TABLE'))
users_table = dynamodb.Table(os.environ.get('USERS_TABLE'))
video_bucket_name = os.environ.get('VIDEO_BUCKET')


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

    if path.startswith('/course/video/') and http_method == 'GET':
        return get_video_url(user_id, path_parameters.get('lesson_id'), admin_bypass=admin_bypass)

    return create_response(404, {'error': 'Not found'})
