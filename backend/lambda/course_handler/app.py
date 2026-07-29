import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key


LEGACY_COURSE_ID = 'legacy-default-course'
PUBLIC_STATUSES = {'published'}


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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def get_user_id(event) -> Optional[str]:
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except KeyError:
        return None


def list_all_items(table):
    items = []
    last_key = None
    while True:
        kwargs = {}
        if last_key:
            kwargs['ExclusiveStartKey'] = last_key
        response = table.scan(**kwargs)
        items.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
    return items


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


def normalize_course(course: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(course)
    status = str(normalized.get('status') or ('published' if normalize_bool(normalized.get('is_active', True)) else 'hidden'))
    normalized['status'] = status
    normalized['is_purchasable'] = normalize_bool(normalized.get('is_purchasable', normalize_bool(normalized.get('is_active', True))))
    normalized['public_slug'] = normalized.get('public_slug') or normalized.get('course_id')
    normalized['subtitle'] = normalized.get('subtitle', '')
    normalized['short_description'] = normalized.get('short_description') or normalized.get('description', '')
    normalized['long_description'] = normalized.get('long_description') or normalized.get('description', '')
    normalized['description'] = normalized.get('description') or normalized['short_description'] or normalized['long_description']
    normalized['cover_image_url'] = normalized.get('cover_image_url', '')
    normalized['badge'] = normalized.get('badge') or ''
    normalized['display_order'] = int(normalized.get('display_order', 999))
    return normalized


def get_legacy_course():
    response = courses_table.get_item(Key={'course_id': LEGACY_COURSE_ID})
    item = response.get('Item')
    if item:
        return normalize_course(item)

    course = {
        'course_id': LEGACY_COURSE_ID,
        'title': 'Corso principale',
        'description': 'Corso legacy migrato automaticamente al nuovo catalogo multi-corso.',
        'short_description': 'Corso legacy migrato automaticamente al nuovo catalogo multi-corso.',
        'long_description': 'Corso legacy migrato automaticamente al nuovo catalogo multi-corso.',
        'price': Decimal('99.99'),
        'status': 'published',
        'is_purchasable': True,
        'public_slug': LEGACY_COURSE_ID,
        'display_order': 999,
        'is_active': True,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    courses_table.put_item(Item=course)
    return normalize_course(course)


def ensure_catalog_seed():
    courses = list_all_items(courses_table)
    if courses:
        return normalize_course(sorted(courses, key=lambda item: item.get('created_at', ''))[0])
    return get_legacy_course()


def get_course(course_ref: Optional[str]) -> Optional[dict[str, Any]]:
    if not course_ref:
        return None

    direct = courses_table.get_item(Key={'course_id': course_ref}).get('Item')
    if direct:
        return normalize_course(direct)

    for item in list_all_items(courses_table):
        normalized = normalize_course(item)
        if normalized.get('public_slug') == course_ref:
            return normalized
    return None


def list_courses(include_non_public: bool = False):
    courses = [normalize_course(item) for item in list_all_items(courses_table)]
    if not include_non_public:
        courses = [course for course in courses if course.get('status') in PUBLIC_STATUSES]
    return sorted(courses, key=lambda item: (int(item.get('display_order', 999)), item.get('created_at', '')))


def get_user_item(user_id: Optional[str]) -> dict[str, Any]:
    if not user_id:
        return {}
    return users_table.get_item(Key={'user_id': user_id}).get('Item') or {}


def get_user_purchases(user_id: Optional[str]) -> list[dict[str, Any]]:
    if not user_id:
        return []
    return query_all(purchases_table, IndexName='UserIndex', KeyConditionExpression=Key('user_id').eq(user_id))


def normalize_purchase_course_id(purchase: dict[str, Any]) -> str:
    return purchase.get('course_id') or LEGACY_COURSE_ID


def purchase_grants_access(purchase: dict[str, Any]) -> bool:
    local_status = str(purchase.get('local_status') or purchase.get('status') or '')
    access_unlocked = normalize_bool(purchase.get('access_unlocked', local_status in {'paid', 'active'}))
    access_revoked = normalize_bool(purchase.get('access_revoked', False))
    refunded_amount = Decimal(str(purchase.get('refunded_amount', 0) or 0))
    manual_access_override = normalize_bool(purchase.get('manual_access_override', False))
    return (local_status in {'paid', 'needs_review'} or manual_access_override) and access_unlocked and not access_revoked and refunded_amount <= 0 and local_status not in {'refunded', 'disputed'}


def user_has_global_access(user_item: dict[str, Any]) -> bool:
    return normalize_bool(user_item.get('global_access', False))


def can_access_course(user_id: Optional[str], course_id: str) -> bool:
    if not user_id:
        return False
    user_item = get_user_item(user_id)
    if user_has_global_access(user_item):
        return True
    for purchase in get_user_purchases(user_id):
        if normalize_purchase_course_id(purchase) == course_id and purchase_grants_access(purchase):
            return True
    return False


def serialize_course(course: dict[str, Any], user_id: Optional[str]) -> dict[str, Any]:
    normalized = normalize_course(course)
    normalized['has_access'] = can_access_course(user_id, normalized['course_id']) if user_id else False
    return normalized


def get_course_chapters(course_id: str):
    chapters = query_all(chapters_table, IndexName='CourseIndex', KeyConditionExpression=Key('course_id').eq(course_id))
    return sorted(chapters, key=lambda item: int(item.get('order_number', 0)))


def get_chapter_lessons(chapter_id: str):
    lessons = query_all(lessons_table, IndexName='ChapterIndex', KeyConditionExpression=Key('chapter_id').eq(chapter_id))
    return sorted(lessons, key=lambda item: int(item.get('order_number', 0)))


def get_user_groups(event):
    if not event:
        return []
    try:
        groups = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('cognito:groups', '')
        if isinstance(groups, str):
            return groups.split(',') if groups else []
        if isinstance(groups, list):
            return groups
    except KeyError:
        pass
    return []

def is_admin(event):
    return 'admin' in get_user_groups(event)

def filter_lesson_for_access(lesson: dict[str, Any], has_access: bool, is_user_admin: bool = False):
    lesson_copy = dict(lesson)
    lesson_copy['is_free_preview'] = normalize_bool(lesson_copy.get('is_free_preview', False))
    lesson_copy['is_locked'] = not (has_access or lesson_copy['is_free_preview'])
    if not is_user_admin:
        lesson_copy.pop('video_s3_key', None)
    return lesson_copy


def build_course_structure(course: dict[str, Any], user_id: Optional[str]):
    has_access = can_access_course(user_id, course['course_id'])
    is_user_admin = is_admin(current_event)
    chapters = []
    for chapter in get_course_chapters(course['course_id']):
        chapter_copy = dict(chapter)
        chapter_copy['lessons'] = [
            filter_lesson_for_access(lesson, has_access, is_user_admin)
            for lesson in get_chapter_lessons(chapter['chapter_id'])
        ]
        chapters.append(chapter_copy)
    return {
        'course': {
            **serialize_course(course, user_id),
            'has_access': has_access,
        },
        'chapters': chapters,
    }


def get_accessible_courses(user_id: Optional[str]):
    if not user_id:
        return []
    courses = [normalize_course(item) for item in list_all_items(courses_table)]
    return [serialize_course(course, user_id) for course in courses if can_access_course(user_id, course['course_id'])]


def resolve_course_for_public_detail(event, course_ref: str):
    course = get_course(course_ref)
    if not course:
        return None

    user_id = get_user_id(event)
    if course.get('status') in PUBLIC_STATUSES:
        return course
    if user_id and can_access_course(user_id, course['course_id']):
        return course
    return None


def choose_legacy_structure_course(user_id: Optional[str]):
    if current_event:
        params = current_event.get('queryStringParameters') or {}
        requested = params.get('course_id')
        if requested:
            course = get_course(requested)
            if course:
                return course
    my_courses = get_accessible_courses(user_id)
    if my_courses:
        return my_courses[0]
    courses = [normalize_course(item) for item in list_all_items(courses_table)]
    if courses:
        return sorted(courses, key=lambda item: (int(item.get('display_order', 999)), item.get('created_at', '')))[0]
    return None


def get_courses_catalog(event):
    user_id = get_user_id(event)
    items = [serialize_course(course, user_id) for course in list_courses(include_non_public=False)]
    return create_response(200, {'items': items})


def get_course_details(event, course_ref: str):
    course = resolve_course_for_public_detail(event, course_ref)
    if not course:
        return create_response(404, {'error': 'Course not found'})
    return create_response(200, build_course_structure(course, get_user_id(event)))


def get_my_courses(event):
    user_id = get_user_id(event)
    if not user_id:
        return create_response(401, {'error': 'Unauthorized'})

    purchases = get_user_purchases(user_id)
    purchase_map: dict[str, dict[str, Any]] = {}
    for purchase in sorted(purchases, key=lambda item: item.get('purchase_date', ''), reverse=True):
        if not purchase_grants_access(purchase):
            continue
        normalized_course_id = normalize_purchase_course_id(purchase)
        if normalized_course_id not in purchase_map:
            purchase_map[normalized_course_id] = purchase

    items = []
    for course in [normalize_course(item) for item in list_all_items(courses_table)]:
        if not can_access_course(user_id, course['course_id']):
            continue
        items.append({
            **serialize_course(course, user_id),
            'access_granted_by': 'global_access' if user_has_global_access(get_user_item(user_id)) else 'purchase',
            'purchase': purchase_map.get(course['course_id']),
        })

    return create_response(200, {'items': sorted(items, key=lambda item: (int(item.get('display_order', 999)), item.get('created_at', '')))})


def get_course_structure_legacy(event):
    user_id = get_user_id(event)
    course = choose_legacy_structure_course(user_id)
    if not course:
        return create_response(404, {'error': 'No courses available'})
    return create_response(200, build_course_structure(course, user_id))


def get_free_previews():
    previews = []
    chapter_cache = {}
    for lesson in list_all_items(lessons_table):
        if not normalize_bool(lesson.get('is_free_preview', False)):
            continue
        chapter_id = lesson.get('chapter_id')
        chapter = chapter_cache.get(chapter_id)
        if chapter is None and chapter_id:
            chapter = chapters_table.get_item(Key={'chapter_id': chapter_id}).get('Item')
            chapter_cache[chapter_id] = chapter
        lesson_copy = dict(lesson)
        lesson_copy.pop('video_s3_key', None)
        lesson_copy['course_id'] = chapter.get('course_id') if chapter else None
        previews.append(lesson_copy)
    return create_response(200, previews)


dynamodb = boto3.resource('dynamodb')
courses_table = dynamodb.Table(os.environ.get('COURSES_TABLE'))
chapters_table = dynamodb.Table(os.environ.get('CHAPTERS_TABLE'))
lessons_table = dynamodb.Table(os.environ.get('LESSONS_TABLE'))
purchases_table = dynamodb.Table(os.environ.get('PURCHASES_TABLE'))
users_table = dynamodb.Table(os.environ.get('USERS_TABLE'))

current_event = None


def lambda_handler(event, context):
    del context
    global current_event
    current_event = event
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if path == '/course/structure' and http_method == 'GET':
        return get_course_structure_legacy(event)
    if path == '/course/previews' and http_method == 'GET':
        return get_free_previews()
    if path == '/courses' and http_method == 'GET':
        return get_courses_catalog(event)
    if path == '/me/courses' and http_method == 'GET':
        return get_my_courses(event)
    if path.startswith('/courses/') and http_method == 'GET':
        return get_course_details(event, path_parameters.get('courseId'))

    return create_response(404, {'error': 'Not found'})
