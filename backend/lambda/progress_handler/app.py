import json
import os
import hashlib
from datetime import datetime, timezone
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
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def progress_id_for(user_id: str, lesson_id: str) -> str:
    return hashlib.sha256(f'{user_id}:{lesson_id}'.encode('utf-8')).hexdigest()


def build_monotonic_progress_update(current: dict[str, Any], watched_seconds: Any,
                                    total_seconds: Any, completed: bool) -> dict[str, Any]:
    current_watched = Decimal(str(current.get('watched_seconds', 0) or 0))
    next_watched = max(current_watched, Decimal(str(watched_seconds or 0)))
    current_completed = normalize_bool(current.get('completed', False))
    return {
        'watched_seconds': next_watched,
        'total_seconds': max(Decimal(str(current.get('total_seconds', 0) or 0)), Decimal(str(total_seconds or 0))),
        'completed': current_completed or completed,
    }


def progress_version(current: dict[str, Any]) -> int:
    """Return the optimistic-lock version, treating legacy rows as version 0."""
    return int(current.get('version', 0) or 0)


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

    if not lesson_id or watched_seconds is None:
        return create_response(400, {'error': 'lesson_id and watched_seconds are required'})

    # watched_seconds flows straight into Decimal(str(...)) below; a
    # non-numeric value (string, list, dict) or a NaN/Infinity float raises
    # decimal.InvalidOperation, and this handler has no top-level try/except,
    # so an unvalidated value here would surface as a raw Lambda failure
    # instead of a clean 400.
    if isinstance(watched_seconds, bool) or not isinstance(watched_seconds, (int, float)):
        return create_response(400, {'error': 'watched_seconds must be a number'})
    if not (watched_seconds == watched_seconds) or watched_seconds in (float('inf'), float('-inf')):
        return create_response(400, {'error': 'watched_seconds must be a finite number'})
    if watched_seconds < 0 or watched_seconds > 86400:
        return create_response(400, {'error': 'watched_seconds is out of range'})

    lesson = get_lesson(lesson_id)
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})

    chapter = get_chapter(lesson.get('chapter_id'))
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})

    course_id = chapter.get('course_id')
    if not lesson.get('is_free_preview') and not can_access_course(user_id, course_id, admin_status):
        return create_response(403, {'error': 'Course access required'})

    # Completion is server-derived from the lesson metadata.  The player may
    # report position but never authorise completed=True by itself.
    lesson_duration = Decimal(str(lesson.get('duration_seconds', 0) or 0))
    watched_value = Decimal(str(watched_seconds or 0))
    total_seconds = lesson_duration
    completed = bool(lesson_duration > 0 and watched_value / lesson_duration >= Decimal('0.90'))

    progress_percent = 0
    if total_seconds > 0:
        progress_percent = min(int((watched_seconds / total_seconds) * 100), 100)
    if completed:
        progress_percent = 100

    progress_id = progress_id_for(user_id, lesson_id)
    existing = progress_table.get_item(Key={'progress_id': progress_id}, ConsistentRead=True).get('Item')
    legacy_items = []
    if not existing:
        legacy_items = [item for item in get_progress_items(user_id)
                        if item.get('lesson_id') == lesson_id and item.get('progress_id') != progress_id]
        if legacy_items:
            existing = {}
            for legacy in legacy_items:
                existing = build_monotonic_progress_update(
                    existing, legacy.get('watched_seconds', 0), legacy.get('total_seconds', 0),
                    normalize_bool(legacy.get('completed', False)),
                )
    existing = existing or {}
    # Every write is a read/merge/conditional-write cycle.  This is deliberate:
    # DynamoDB expressions have no max() primitive, while this preserves both
    # monotone watched_seconds and a concurrent completed=True transition.
    for _attempt in range(4):
        if _attempt:
            existing = progress_table.get_item(
                Key={'progress_id': progress_id}, ConsistentRead=True,
            ).get('Item') or {}
        update = build_monotonic_progress_update(existing, watched_seconds, total_seconds, completed)
        if update['completed']:
            progress_percent = 100
        else:
            progress_percent = (
                min(int((update['watched_seconds'] / update['total_seconds']) * 100), 100)
                if update['total_seconds'] > 0 else 0
            )
        now = now_iso()
        expected_version = progress_version(existing)
        payload = {
            ':ws': update['watched_seconds'], ':ts': update['total_seconds'],
            ':pp': Decimal(str(progress_percent)), ':c': update['completed'], ':lw': now,
            ':uid': user_id, ':lesson': lesson_id, ':expected_version': expected_version,
            ':zero': 0, ':one': 1,
        }
        expression = (
            'SET user_id = if_not_exists(user_id, :uid), lesson_id = if_not_exists(lesson_id, :lesson), '
            'watched_seconds = :ws, total_seconds = :ts, progress_percent = :pp, '
            'completed = :c, last_watched = :lw, version = if_not_exists(version, :zero) + :one'
        )
        if update['completed']:
            expression += ', completed_at = if_not_exists(completed_at, :lw)'
        try:
            updated = progress_table.update_item(
                Key={'progress_id': progress_id}, UpdateExpression=expression,
                # Legacy rows have no version and are accepted only as version 0.
                ConditionExpression='(attribute_not_exists(version) AND :expected_version = :zero) OR version = :expected_version',
                ExpressionAttributeValues=payload, ReturnValues='ALL_NEW',
            )
            # Write the deterministic row first, then remove only legacy rows
            # observed for this user+lesson. A failed delete leaves harmless
            # duplicates which are merged on the next update, never data loss.
            for legacy in legacy_items:
                progress_table.delete_item(Key={'progress_id': legacy['progress_id']})
            return create_response(200, {'success': True, 'data': updated.get('Attributes')})
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
                raise

    # Do not turn a temporarily contended write into a regression or a false
    # success.  The client can retry safely with the same monotone payload.
    return create_response(409, {'error': 'Progress update conflicted; retry safely'})


def reset_progress(user_id: str, body: dict[str, Any], admin_status: bool = False):
    """The sole endpoint allowed to clear a progress record."""
    lesson_id = body.get('lesson_id')
    if not lesson_id:
        return create_response(400, {'error': 'lesson_id is required'})
    lesson = get_lesson(lesson_id)
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})
    chapter = get_chapter(lesson.get('chapter_id'))
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})
    if not lesson.get('is_free_preview') and not can_access_course(user_id, chapter.get('course_id'), admin_status):
        return create_response(403, {'error': 'Course access required'})
    progress_id = progress_id_for(user_id, lesson_id)
    existing = progress_table.get_item(Key={'progress_id': progress_id}, ConsistentRead=True).get('Item')
    if not existing:
        return create_response(404, {'error': 'Progress not found'})
    now = now_iso()
    updated = progress_table.update_item(
        Key={'progress_id': progress_id},
        UpdateExpression=(
            'SET user_id = if_not_exists(user_id, :uid), lesson_id = if_not_exists(lesson_id, :lesson), '
            'watched_seconds = :zero, progress_percent = :zero, '
            'completed = :false, last_watched = :now, version = if_not_exists(version, :zero) + :one '
            'REMOVE completed_at'
        ),
        ExpressionAttributeValues={
            ':uid': user_id, ':lesson': lesson_id, ':zero': 0, ':false': False,
            ':now': now, ':one': 1,
            ':expected_version': progress_version(existing),
        },
        ConditionExpression='(attribute_not_exists(version) AND :expected_version = :zero) OR version = :expected_version',
        ReturnValues='ALL_NEW',
    )
    return create_response(200, {'success': True, 'data': updated.get('Attributes')})


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

    try:
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

        if path == '/progress/reset' and http_method == 'POST':
            return reset_progress(user_id, json.loads(event.get('body') or '{}'), admin_status)

        if path == '/user/subscription' and http_method == 'GET':
            return get_subscription(user_id, admin_status)

        if path.startswith('/me/courses/') and path.endswith('/progress') and http_method == 'GET':
            return build_course_progress(user_id, path_parameters.get('courseId'), admin_status)

        return create_response(404, {'error': 'Not found'})
    except json.JSONDecodeError:
        return create_response(400, {'error': 'Invalid JSON body'})
    except Exception as exc:  # noqa: BLE001 - last-resort guard, see below
        # Never let an unexpected error (bad input shape, transient AWS
        # error, etc.) surface as a raw Lambda failure / API Gateway 502.
        # Log the real exception server-side, return a generic 500 to the
        # client so no internal detail (table names, stack traces) leaks.
        print(f'Unhandled error in progress_handler: {exc}')
        return create_response(500, {'error': 'Internal server error'})
