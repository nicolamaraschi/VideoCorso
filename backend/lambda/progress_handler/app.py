import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key


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
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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


def normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {'true', '1', 'yes', 'on'}
    return bool(value)


def get_user_item(user_id: str) -> dict[str, Any]:
    response = users_table.get_item(Key={'user_id': user_id})
    return response.get('Item') or {}


def get_user_purchases(user_id: str) -> list[dict[str, Any]]:
    return query_all(
        purchases_table,
        IndexName='UserIndex',
        KeyConditionExpression=Key('user_id').eq(user_id),
    )


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


def can_access_course(user_id: str, course_id: str, admin_status: bool = False) -> bool:
    if admin_status:
        return True
    user_item = get_user_item(user_id)
    if user_has_global_access(user_item):
        return True

    for purchase in get_user_purchases(user_id):
        if normalize_purchase_course_id(purchase) == course_id and purchase_grants_access(purchase):
            return True

    return False


def get_course(course_id: str) -> Optional[dict[str, Any]]:
    response = courses_table.get_item(Key={'course_id': course_id})
    return response.get('Item')


def get_chapters_for_course(course_id: str) -> list[dict[str, Any]]:
    chapters = query_all(
        chapters_table,
        IndexName='CourseIndex',
        KeyConditionExpression=Key('course_id').eq(course_id),
    )
    return sorted(chapters, key=lambda item: int(item.get('order_number', 0)))


def get_lessons_for_chapter(chapter_id: str) -> list[dict[str, Any]]:
    lessons = query_all(
        lessons_table,
        IndexName='ChapterIndex',
        KeyConditionExpression=Key('chapter_id').eq(chapter_id),
    )
    return sorted(lessons, key=lambda item: int(item.get('order_number', 0)))


def get_lesson(lesson_id: str) -> Optional[dict[str, Any]]:
    response = lessons_table.get_item(Key={'lesson_id': lesson_id})
    return response.get('Item')


def get_chapter(chapter_id: str) -> Optional[dict[str, Any]]:
    response = chapters_table.get_item(Key={'chapter_id': chapter_id})
    return response.get('Item')


def get_course_id_for_lesson(lesson_id: str) -> Optional[str]:
    lesson = get_lesson(lesson_id)
    if not lesson:
        return None
    chapter = get_chapter(lesson.get('chapter_id'))
    if not chapter:
        return None
    return chapter.get('course_id')


def get_course_lessons(course_id: str) -> list[dict[str, Any]]:
    lessons = []
    for chapter in get_chapters_for_course(course_id):
        lessons.extend(get_lessons_for_chapter(chapter['chapter_id']))
    return lessons


def find_progress_item(user_id: str, lesson_id: str) -> Optional[dict[str, Any]]:
    items = query_all(
        progress_table,
        IndexName='UserIndex',
        KeyConditionExpression=Key('user_id').eq(user_id),
    )
    for item in items:
        if item.get('lesson_id') == lesson_id:
            return item
    return None


def get_progress_items(user_id: str) -> list[dict[str, Any]]:
    return query_all(
        progress_table,
        IndexName='UserIndex',
        KeyConditionExpression=Key('user_id').eq(user_id),
    )


def build_course_progress(user_id: str, course_id: str, admin_status: bool = False):
    if not can_access_course(user_id, course_id, admin_status):
        return create_response(403, {'error': 'Course access required'})

    lessons = get_course_lessons(course_id)
    lesson_map = {lesson['lesson_id']: lesson for lesson in lessons}
    lesson_progress_map = {}
    completed_lessons = 0
    total_watch_time = 0
    last_watched_lesson = None
    last_watched_value = None
    chapter_summaries = []

    progress_items = get_progress_items(user_id)
    progress_by_lesson = {
        item['lesson_id']: item
        for item in progress_items
        if item.get('lesson_id') in lesson_map
    }

    for chapter in get_chapters_for_course(course_id):
        chapter_lessons = get_lessons_for_chapter(chapter['chapter_id'])
        chapter_completed = 0

        for lesson in chapter_lessons:
            progress_item = progress_by_lesson.get(lesson['lesson_id'])
            if not progress_item:
                continue

            lesson_progress_map[lesson['lesson_id']] = progress_item
            total_watch_time += int(progress_item.get('watched_seconds', 0))
            if progress_item.get('completed'):
                completed_lessons += 1
                chapter_completed += 1

            last_watched = progress_item.get('last_watched')
            if last_watched and (not last_watched_value or last_watched > last_watched_value):
                last_watched_value = last_watched
                last_watched_lesson = lesson

        total_chapter_lessons = len(chapter_lessons)
        chapter_summaries.append({
            'chapter_id': chapter['chapter_id'],
            'total_lessons': total_chapter_lessons,
            'completed_lessons': chapter_completed,
            'percentage': (chapter_completed / total_chapter_lessons * 100) if total_chapter_lessons else 0,
        })

    total_lessons = len(lessons)
    percentage = (completed_lessons / total_lessons * 100) if total_lessons else 0

    return create_response(200, {
        'course_id': course_id,
        'total_lessons': total_lessons,
        'completed_lessons': completed_lessons,
        'percentage': percentage,
        'chapters': chapter_summaries,
        'lesson_progress': lesson_progress_map,
        'total_watch_time': total_watch_time,
        'last_watched_lesson': last_watched_lesson,
    })


def get_user_progress(user_id: str, admin_status: bool = False):
    accessible_course_ids = [
        course['course_id']
        for course in list_all_items(courses_table)
        if can_access_course(user_id, course['course_id'], admin_status)
    ]

    lesson_ids = set()
    lessons_by_id = {}
    for course_id in accessible_course_ids:
        for lesson in get_course_lessons(course_id):
            lesson_ids.add(lesson['lesson_id'])
            lessons_by_id[lesson['lesson_id']] = lesson

    progress_items = [item for item in get_progress_items(user_id) if item.get('lesson_id') in lesson_ids]

    completed_lessons = 0
    total_watch_time = 0
    lesson_progress_map = {}
    last_watched_lesson = None
    last_watched_value = None

    for item in progress_items:
        lesson_progress_map[item['lesson_id']] = item
        total_watch_time += int(item.get('watched_seconds', 0))
        if item.get('completed'):
            completed_lessons += 1

        last_watched = item.get('last_watched')
        if last_watched and (not last_watched_value or last_watched > last_watched_value):
            last_watched_value = last_watched
            last_watched_lesson = lessons_by_id.get(item['lesson_id'])

    total_lessons = len(lesson_ids)
    percentage = (completed_lessons / total_lessons * 100) if total_lessons else 0

    return create_response(200, {
        'total_lessons': total_lessons,
        'completed_lessons': completed_lessons,
        'percentage': percentage,
        'chapters': [],
        'lesson_progress': lesson_progress_map,
        'total_watch_time': total_watch_time,
        'last_watched_lesson': last_watched_lesson,
    })


def update_progress(user_id: str, body: dict[str, Any], admin_status: bool = False):
    lesson_id = body.get('lesson_id')
    watched_seconds = body.get('watched_seconds')
    total_seconds = body.get('total_seconds', 0)
    completed = normalize_bool(body.get('completed', False))

    if not lesson_id or watched_seconds is None:
        return create_response(400, {'error': 'lesson_id and watched_seconds are required'})

    lesson = get_lesson(lesson_id)
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})

    chapter = get_chapter(lesson.get('chapter_id'))
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})

    course_id = chapter.get('course_id')
    if not lesson.get('is_free_preview') and not can_access_course(user_id, course_id, admin_status):
        return create_response(403, {'error': 'Course access required'})

    progress_percent = 0
    if total_seconds > 0:
        progress_percent = min(int((watched_seconds / total_seconds) * 100), 100)
    if completed:
        progress_percent = 100

    existing = find_progress_item(user_id, lesson_id)
    if existing and existing.get('completed'):
        completed = True
        progress_percent = 100

    now = now_iso()
    payload = {
        ':ws': Decimal(str(watched_seconds)),
        ':ts': Decimal(str(total_seconds)),
        ':pp': Decimal(str(progress_percent)),
        ':c': completed,
        ':lw': now,
    }

    if existing:
        updated = progress_table.update_item(
            Key={'progress_id': existing['progress_id']},
            UpdateExpression=(
                'SET watched_seconds = :ws, total_seconds = :ts, '
                'progress_percent = :pp, completed = :c, last_watched = :lw'
            ),
            ExpressionAttributeValues=payload,
            ReturnValues='ALL_NEW',
        )
        return create_response(200, {'success': True, 'data': updated.get('Attributes')})

    item = {
        'progress_id': str(uuid.uuid4()),
        'user_id': user_id,
        'lesson_id': lesson_id,
        'watched_seconds': Decimal(str(watched_seconds)),
        'total_seconds': Decimal(str(total_seconds)),
        'progress_percent': Decimal(str(progress_percent)),
        'completed': completed,
        'last_watched': now,
    }
    progress_table.put_item(Item=item)
    return create_response(201, {'success': True, 'data': item})


def get_lesson_progress(user_id: str, lesson_id: str, admin_status: bool = False):
    lesson = get_lesson(lesson_id)
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})

    chapter = get_chapter(lesson.get('chapter_id'))
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})

    if not lesson.get('is_free_preview') and not can_access_course(user_id, chapter.get('course_id'), admin_status):
        return create_response(403, {'error': 'Course access required'})

    progress_item = find_progress_item(user_id, lesson_id)
    if progress_item:
        return create_response(200, progress_item)

    return create_response(200, {
        'progress_id': None,
        'user_id': user_id,
        'lesson_id': lesson_id,
        'watched_seconds': 0,
        'total_seconds': 0,
        'completed': False,
        'last_watched': None,
    })


def get_subscription(user_id: str, admin_status: bool = False):
    user_item = get_user_item(user_id)
    purchases = get_user_purchases(user_id)

    accessible_courses = []
    for course in list_all_items(courses_table):
        if can_access_course(user_id, course['course_id'], admin_status):
            accessible_courses.append({
                'course_id': course['course_id'],
                'title': course.get('title', ''),
            })

    latest_purchase = None
    if purchases:
        latest_purchase = sorted(purchases, key=lambda item: item.get('purchase_date', ''), reverse=True)[0]

    primary_course = accessible_courses[0] if accessible_courses else None

    return create_response(200, {
        'is_active': bool(accessible_courses or user_has_global_access(user_item) or admin_status),
        'days_remaining': None,
        'purchase': latest_purchase,
        'course': primary_course,
        'accessible_courses': accessible_courses,
        'global_access': user_has_global_access(user_item) or admin_status,
    })


dynamodb = boto3.resource('dynamodb')

progress_table = dynamodb.Table(os.environ.get('PROGRESS_TABLE'))
purchases_table = dynamodb.Table(os.environ.get('PURCHASES_TABLE'))
lessons_table = dynamodb.Table(os.environ.get('LESSONS_TABLE'))
chapters_table = dynamodb.Table(os.environ.get('CHAPTERS_TABLE'))
users_table = dynamodb.Table(os.environ.get('USERS_TABLE'))
courses_table = dynamodb.Table(os.environ.get('COURSES_TABLE'))


def lambda_handler(event, context):
    del context
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}
    user_id = get_user_id(event)

    try:
        groups = event['requestContext']['authorizer']['claims'].get('cognito:groups', '')
        if isinstance(groups, str):
            admin_status = 'admin' in (groups.split(',') if groups else [])
        elif isinstance(groups, list):
            admin_status = 'admin' in groups
        else:
            admin_status = False
    except KeyError:
        admin_status = False

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if not user_id:
        return create_response(401, {'error': 'Unauthorized'})

    if path == '/progress/update' and http_method == 'POST':
        return update_progress(user_id, json.loads(event.get('body') or '{}'), admin_status)

    if path == '/progress/user' and http_method == 'GET':
        return get_user_progress(user_id, admin_status)

    if path.startswith('/progress/lesson/') and http_method == 'GET':
        return get_lesson_progress(user_id, path_parameters.get('lessonId'), admin_status)

    if path == '/progress/complete' and http_method == 'POST':
        body = json.loads(event.get('body') or '{}')
        body['completed'] = True
        body['watched_seconds'] = body.get('watched_seconds', body.get('total_seconds', 0))
        return update_progress(user_id, body, admin_status)

    if path == '/user/subscription' and http_method == 'GET':
        return get_subscription(user_id, admin_status)

    if path.startswith('/me/courses/') and path.endswith('/progress') and http_method == 'GET':
        return build_course_progress(user_id, path_parameters.get('courseId'), admin_status)

    return create_response(404, {'error': 'Not found'})
