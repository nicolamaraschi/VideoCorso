import json
import os
import secrets
import string
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from urllib.parse import unquote, urlparse

import boto3
import stripe
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


LEGACY_COURSE_ID = 'legacy-default-course'
PUBLIC_COURSE_STATUSES = {'published'}
VALID_LOCAL_STATUSES = {'pending', 'paid', 'failed', 'refunded', 'disputed', 'cancelled', 'needs_review'}

ssm_client = boto3.client('ssm')


def load_secret(parameter_env_name: str, legacy_env_name: str) -> Optional[str]:
    parameter_name = os.environ.get(parameter_env_name)
    if parameter_name:
        return ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)['Parameter']['Value']
    return os.environ.get(legacy_env_name)


stripe.api_key = load_secret('STRIPE_SECRET_KEY_PARAMETER', 'STRIPE_SECRET_KEY')


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
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def build_public_s3_url(bucket: str, key: str) -> str:
    return f'https://{bucket}.s3.amazonaws.com/{key}'


def get_owned_s3_key(url: Any, bucket: Optional[str]) -> Optional[str]:
    if not url or not bucket:
        return None
    try:
        parsed = urlparse(str(url))
        if parsed.hostname != f'{bucket}.s3.amazonaws.com':
            return None
        return unquote(parsed.path.lstrip('/')) or None
    except ValueError:
        return None


def delete_s3_object_safely(bucket: Optional[str], key: Optional[str]) -> None:
    if not bucket or not key or str(key).startswith(('http://', 'https://')):
        return
    try:
        s3_client.delete_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        print(f'Unable to delete S3 object {key}: {exc}')


def delete_lesson_assets(lesson: dict[str, Any]) -> None:
    delete_s3_object_safely(VIDEO_BUCKET, lesson.get('video_s3_key'))
    delete_s3_object_safely(
        THUMBNAIL_BUCKET,
        get_owned_s3_key(lesson.get('thumbnail_url'), THUMBNAIL_BUCKET),
    )


def delete_chapter_assets(chapter: dict[str, Any]) -> None:
    delete_s3_object_safely(
        THUMBNAIL_BUCKET,
        get_owned_s3_key(chapter.get('image_url'), THUMBNAIL_BUCKET),
    )


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {'true', '1', 'yes', 'on'}
    return bool(value)


def normalize_amount(value: Any) -> Decimal:
    amount = Decimal(str(value or 0))
    if amount >= Decimal('1000') and amount == amount.to_integral():
        return amount / Decimal('100')
    return amount


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


def get_user_groups(event):
    try:
        groups = event['requestContext']['authorizer']['claims'].get('cognito:groups', '')
        if isinstance(groups, str):
            return groups.split(',') if groups else []
        if isinstance(groups, list):
            return groups
    except KeyError:
        pass
    return []


def is_admin(event) -> bool:
    return 'admin' in get_user_groups(event)


def get_claims(event) -> dict[str, Any]:
    try:
        return event['requestContext']['authorizer']['claims']
    except KeyError:
        return {}


def get_current_admin_email(event) -> str:
    claims = get_claims(event)
    return str(claims.get('email', '')).strip().lower()


def get_current_admin_username(event) -> str:
    claims = get_claims(event)
    return str(claims.get('cognito:username', '')).strip()


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    return ''.join(secrets.choice(alphabet) for _ in range(length)) + 'A1!'


def send_welcome_email(email: str, temp_password: str, password_reset: bool = False):
    if not resend or not getattr(resend, 'api_key', None):
        print('Welcome email skipped: Resend not configured.')
        return

    try:
        resend.Emails.send({
            'from': 'Team VideoCorso <onboarding@resend.dev>',
            'to': email,
            'subject': (
                'Password reimpostata - Chiara Morocutti Academy'
                if password_reset else 'Accesso piattaforma corsi - Chiara Morocutti Academy'
            ),
            'html': (
                '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">'
                f'<h2 style="color: #c2697b; text-align: center;">{("Password reimpostata" if password_reset else "Benvenuta in Chiara Morocutti Academy!")}</h2>'
                f'<p style="font-size: 16px; color: #333;">{("Ti è stata assegnata una nuova password temporanea per accedere alla piattaforma." if password_reset else "Il tuo account per accedere alla piattaforma corsi è stato creato con successo.")}</p>'
                '<div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">'
                f'<p style="margin: 0; font-size: 15px;"><strong>Email:</strong> {email}</p>'
                f'<p style="margin: 10px 0 0 0; font-size: 15px;"><strong>Password temporanea:</strong> <span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 4px;">{temp_password}</span></p>'
                '</div>'
                '<p style="font-size: 14px; color: #666;">Al tuo primo accesso ti verrà richiesto di impostare una nuova password personalizzata in modo da mantenere il tuo account sicuro.</p>'
                '<p style="font-size: 14px; color: #666; margin-top: 30px;">A presto,<br>Il Team di Chiara Morocutti</p>'
                '</div>'
            ),
        })
    except Exception as exc:
        print(f'Email send failed: {exc}')


def send_admin_welcome_email(email: str, temp_password: str):
    if not resend or not getattr(resend, 'api_key', None):
        print('Admin welcome email skipped: Resend not configured.')
        return

    try:
        resend.Emails.send({
            'from': 'Team VideoCorso <onboarding@resend.dev>',
            'to': email,
            'subject': 'Accesso amministratore piattaforma',
            'html': (
                '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">'
                '<h2 style="color: #333; text-align: center;">Accesso Admin Attivato</h2>'
                '<p style="font-size: 16px; color: #333;">Il tuo account amministratore è stato creato con successo.</p>'
                '<div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">'
                f'<p style="margin: 0; font-size: 15px;"><strong>Email:</strong> {email}</p>'
                f'<p style="margin: 10px 0 0 0; font-size: 15px;"><strong>Password temporanea:</strong> <span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 4px;">{temp_password}</span></p>'
                '</div>'
                '<p style="font-size: 14px; color: #666;">Al tuo primo accesso ti verrà richiesto di cambiare password.</p>'
                '</div>'
            ),
        })
    except Exception as exc:
        print(f'Admin email send failed: {exc}')


def list_admin_accounts():
    items = []
    next_token = None

    while True:
        kwargs = {
            'UserPoolId': COGNITO_USER_POOL_ID,
            'GroupName': 'admin',
            'Limit': 60,
        }
        if next_token:
            kwargs['NextToken'] = next_token

        response = cognito_client.list_users_in_group(**kwargs)
        for user in response.get('Users', []):
            attributes = {item['Name']: item['Value'] for item in user.get('Attributes', [])}
            items.append({
                'email': attributes.get('email', user.get('Username', '')),
                'full_name': attributes.get('custom:full_name', ''),
                'enabled': bool(user.get('Enabled', True)),
                'status': user.get('UserStatus', ''),
                'created_at': user.get('UserCreateDate').astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
                if user.get('UserCreateDate') else '',
                'updated_at': user.get('UserLastModifiedDate').astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
                if user.get('UserLastModifiedDate') else '',
                'username': user.get('Username', ''),
            })

        next_token = response.get('NextToken')
        if not next_token:
            break

    return sorted(items, key=lambda item: item.get('created_at', ''), reverse=True)


def list_cognito_pool_users():
    items = []
    pagination_token = None

    while True:
        kwargs = {
            'UserPoolId': COGNITO_USER_POOL_ID,
            'Limit': 60,
        }
        if pagination_token:
            kwargs['PaginationToken'] = pagination_token

        response = cognito_client.list_users(**kwargs)
        items.extend(response.get('Users', []))
        pagination_token = response.get('PaginationToken')
        if not pagination_token:
            break

    return items


def get_cognito_attributes_map(user: dict[str, Any]) -> dict[str, Any]:
    return {item['Name']: item['Value'] for item in user.get('Attributes', [])}


def build_user_record_from_cognito(user: dict[str, Any]) -> dict[str, Any]:
    attributes = get_cognito_attributes_map(user)
    email = str(attributes.get('email', '')).strip().lower()
    user_id = str(attributes.get('sub', '')).strip()
    if not email or not user_id:
        return {}

    created_at = (
        user.get('UserCreateDate').astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        if user.get('UserCreateDate') else now_iso()
    )
    updated_at = (
        user.get('UserLastModifiedDate').astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        if user.get('UserLastModifiedDate') else created_at
    )

    return {
        'user_id': user_id,
        'email': email,
        'full_name': attributes.get('custom:full_name') or attributes.get('name') or '',
        'subscription_status': attributes.get('custom:subscription_status') or 'inactive',
        'sub_end_date': attributes.get('custom:sub_end_date') or '',
        'created_at': created_at,
        'updated_at': updated_at,
        'global_access': False,
    }


def merge_user_sources(table_item: Optional[dict[str, Any]], cognito_item: Optional[dict[str, Any]]) -> dict[str, Any]:
    merged = dict(cognito_item or {})
    if table_item:
        merged.update(table_item)

    if cognito_item:
        merged['email'] = table_item.get('email') if table_item and table_item.get('email') else cognito_item.get('email', '')
        merged['full_name'] = table_item.get('full_name') if table_item and table_item.get('full_name') else cognito_item.get('full_name', '')
        merged['subscription_status'] = (
            table_item.get('subscription_status')
            if table_item and table_item.get('subscription_status')
            else cognito_item.get('subscription_status', 'inactive')
        )
        merged['sub_end_date'] = (
            table_item.get('sub_end_date')
            if table_item and table_item.get('sub_end_date')
            else cognito_item.get('sub_end_date', '')
        )
        merged['created_at'] = table_item.get('created_at') if table_item and table_item.get('created_at') else cognito_item.get('created_at', now_iso())
        merged['updated_at'] = table_item.get('updated_at') if table_item and table_item.get('updated_at') else cognito_item.get('updated_at', merged['created_at'])

    merged['global_access'] = normalize_bool(merged.get('global_access', False))
    return merged


def list_student_records() -> list[dict[str, Any]]:
    table_items = {item['user_id']: item for item in list_all_items(TABLES['USERS']) if item.get('user_id')}
    admin_emails = {str(item.get('email', '')).strip().lower() for item in list_admin_accounts()}
    merged_items: dict[str, dict[str, Any]] = {}

    for cognito_user in list_cognito_pool_users():
        cognito_item = build_user_record_from_cognito(cognito_user)
        if not cognito_item:
            continue
        if cognito_item['email'] in admin_emails:
            continue

        existing = table_items.pop(cognito_item['user_id'], None)
        merged_items[cognito_item['user_id']] = merge_user_sources(existing, cognito_item)

    for user_id, table_item in table_items.items():
        email = str(table_item.get('email', '')).strip().lower()
        if email and email in admin_emails:
            continue
        merged_items[user_id] = merge_user_sources(table_item, None)

    return sorted(merged_items.values(), key=lambda item: item.get('created_at', ''), reverse=True)


def resolve_student_record(student_id: str) -> dict[str, Any]:
    user_item = get_user_item(student_id)
    if user_item:
        return user_item

    for student in list_student_records():
        if student.get('user_id') == student_id:
            return student
    return {}


def parse_iso_datetime(value: Optional[str]):
    if not value:
        return None
    normalized = str(value).replace('Z', '+00:00')
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


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
    normalized['badge'] = normalized.get('badge', '')
    normalized['display_order'] = int(normalized.get('display_order', 999))
    if 'discounted_price' in normalized and normalized.get('discounted_price') not in (None, ''):
        normalized['discounted_price'] = Decimal(str(normalized['discounted_price']))
    return normalized


def normalize_chapter(chapter: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(chapter)
    normalized['image_url'] = normalized.get('image_url', '')
    return normalized


def get_course_display_price(course: dict[str, Any]) -> Decimal:
    if course.get('discounted_price') not in (None, ''):
        return Decimal(str(course['discounted_price']))
    return Decimal(str(course.get('price', 0)))


def normalize_purchase(purchase: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(purchase)
    local_status = str(normalized.get('local_status') or normalized.get('status') or 'needs_review')
    if local_status not in VALID_LOCAL_STATUSES:
        local_status = 'needs_review'
    normalized['local_status'] = local_status
    normalized['stripe_status'] = str(normalized.get('stripe_status') or normalized.get('status') or 'unknown')
    normalized['amount_gross'] = Decimal(str(normalized.get('amount_gross', normalized.get('amount', 0) or 0)))
    normalized['amount'] = normalized['amount_gross']
    normalized['currency'] = normalized.get('currency') or 'eur'
    normalized['access_unlocked'] = normalize_bool(normalized.get('access_unlocked', local_status == 'paid'))
    normalized['access_revoked'] = normalize_bool(normalized.get('access_revoked', False))
    normalized['refund_status'] = normalized.get('refund_status') or ('refunded' if Decimal(str(normalized.get('refunded_amount', 0) or 0)) > 0 else 'not_refunded')
    normalized['refunded_amount'] = Decimal(str(normalized.get('refunded_amount', 0) or 0))
    normalized['is_disputed'] = normalize_bool(normalized.get('is_disputed', False))
    normalized['verified_by_admin'] = normalize_bool(normalized.get('verified_by_admin', False))
    normalized['purchase_origin'] = normalized.get('purchase_origin') or 'public_checkout'
    normalized['webhook_status'] = normalized.get('webhook_status') or 'not_received'
    normalized['created_at'] = normalized.get('created_at') or normalized.get('purchase_date') or now_iso()
    normalized['updated_at'] = normalized.get('updated_at') or normalized['created_at']
    return normalized


def purchase_grants_access(purchase: dict[str, Any]) -> bool:
    normalized = normalize_purchase(purchase)
    return (
        normalized['local_status'] in {'paid', 'needs_review'}
        and normalized['access_unlocked']
        and not normalized['access_revoked']
        and normalized['refunded_amount'] <= 0
    )


def sync_purchase_access(purchase: dict[str, Any], mode: str = 'sync') -> dict[str, Any]:
    normalized = normalize_purchase(purchase)
    if mode == 'force_unlock':
        normalized['access_unlocked'] = True
        normalized['access_revoked'] = False
        normalized['access_revoked_at'] = None
        normalized['access_revocation_reason'] = ''
        normalized['updated_at'] = now_iso()
        return normalized

    if mode == 'revoke':
        normalized['access_unlocked'] = False
        normalized['access_revoked'] = True
        normalized['access_revoked_at'] = now_iso()
        normalized['access_revocation_reason'] = normalized.get('access_revocation_reason') or 'manual_revoke'
        normalized['updated_at'] = now_iso()
        return normalized

    if normalized['local_status'] == 'paid' and normalized['refunded_amount'] <= 0 and not normalized['access_revoked']:
        normalized['access_unlocked'] = True
        normalized['access_revoked'] = False
        normalized['access_revoked_at'] = None
        normalized['access_revocation_reason'] = ''
    elif normalized['local_status'] == 'refunded':
        normalized['access_unlocked'] = False
        normalized['access_revoked'] = True
        normalized['access_revoked_at'] = normalized.get('access_revoked_at') or now_iso()
        normalized['access_revocation_reason'] = normalized.get('access_revocation_reason') or 'refund_total'
    elif normalized['local_status'] in {'failed', 'cancelled'}:
        normalized['access_unlocked'] = False
    normalized['updated_at'] = now_iso()
    return normalized


def get_coupon(coupon_ref: Optional[str]):
    if not coupon_ref:
        return None
    normalized_ref = str(coupon_ref).strip().upper()
    direct = TABLES['COUPONS'].get_item(Key={'coupon_id': normalized_ref}).get('Item')
    if direct:
        return direct
    for item in list_all_items(TABLES['COUPONS']):
        if str(item.get('code', '')).upper() == normalized_ref:
            return item
    return None


def coupon_is_valid(coupon: dict[str, Any], course_ref: Optional[str], email: Optional[str]):
    if not coupon:
        return False, 'Coupon not found'
    if not normalize_bool(coupon.get('is_active', False)):
        return False, 'Coupon not active'
    now = datetime.now(timezone.utc)
    starts_at = parse_iso_datetime(coupon.get('starts_at'))
    expires_at = parse_iso_datetime(coupon.get('expires_at'))
    if starts_at and starts_at > now:
        return False, 'Coupon not active yet'
    if expires_at and expires_at < now:
        return False, 'Coupon expired'
    max_redemptions = coupon.get('max_redemptions')
    current_redemptions = int(coupon.get('current_redemptions', 0))
    if max_redemptions not in (None, '') and current_redemptions >= int(max_redemptions):
        return False, 'Coupon redemption limit reached'
    scope = coupon.get('course_scope') or []
    if scope and course_ref:
        valid_refs = {str(value) for value in (scope if isinstance(scope, list) else [scope])}
        if course_ref not in valid_refs:
            course = get_course(course_ref)
            if not course or course.get('public_slug') not in valid_refs or course.get('course_id') not in valid_refs:
                return False, 'Coupon not valid for this course'
    allowed_emails = coupon.get('allowed_user_emails') or []
    if allowed_emails:
        normalized_email = (email or '').strip().lower()
        valid_emails = {str(value).strip().lower() for value in allowed_emails}
        if normalized_email not in valid_emails:
            return False, 'Coupon not valid for this user'
    return True, ''


def compute_coupon_total(course: dict[str, Any], coupon: Optional[dict[str, Any]]) -> Decimal:
    total = get_course_display_price(normalize_course(course))
    if not coupon:
        return total
    if normalize_bool(coupon.get('is_free_access', False)):
        return Decimal('0')
    discount_type = str(coupon.get('discount_type', 'percent'))
    discount_value = Decimal(str(coupon.get('discount_value', 0)))
    if discount_type == 'fixed':
        return max(total - discount_value, Decimal('0'))
    percentage = max(min(discount_value, Decimal('100')), Decimal('0'))
    return max(total - ((total * percentage) / Decimal('100')), Decimal('0'))


def get_course(course_id: Optional[str]):
    if not course_id:
        return None
    response = TABLES['COURSES'].get_item(Key={'course_id': course_id})
    item = response.get('Item')
    if item:
        return normalize_course(item)

    for course in list_all_items(TABLES['COURSES']):
        normalized = normalize_course(course)
        if normalized.get('public_slug') == course_id:
            return normalized
    return None


def ensure_legacy_course():
    course = get_course(LEGACY_COURSE_ID)
    if course:
        return course

    item = {
        'course_id': LEGACY_COURSE_ID,
        'title': 'Corso principale',
        'description': 'Corso legacy migrato automaticamente al catalogo multi-corso.',
        'short_description': 'Corso legacy migrato automaticamente al catalogo multi-corso.',
        'long_description': 'Corso legacy migrato automaticamente al catalogo multi-corso.',
        'price': Decimal('99.99'),
        'status': 'published',
        'is_purchasable': True,
        'public_slug': LEGACY_COURSE_ID,
        'display_order': 999,
        'is_active': True,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    TABLES['COURSES'].put_item(Item=item)
    return normalize_course(item)


def normalize_purchase_course_id(purchase: dict[str, Any]) -> str:
    return purchase.get('course_id') or LEGACY_COURSE_ID


def get_user_item(user_id: str) -> dict[str, Any]:
    response = TABLES['USERS'].get_item(Key={'user_id': user_id})
    return response.get('Item') or {}


def get_user_purchases(user_id: str) -> list[dict[str, Any]]:
    return query_all(
        TABLES['PURCHASES'],
        IndexName='UserIndex',
        KeyConditionExpression=Key('user_id').eq(user_id),
    )


def get_user_progress_items(user_id: str) -> list[dict[str, Any]]:
    return query_all(
        TABLES['PROGRESS'],
        IndexName='UserIndex',
        KeyConditionExpression=Key('user_id').eq(user_id),
    )


def user_has_global_access(user_item: dict[str, Any]) -> bool:
    if normalize_bool(user_item.get('global_access', False)):
        return True
    return str(user_item.get('subscription_status', '')).lower() == 'active' and not user_item.get('sub_end_date')


def can_access_course(user_item: dict[str, Any], purchases: list[dict[str, Any]], course_id: str) -> bool:
    if user_has_global_access(user_item):
        return True

    for purchase in purchases:
        if normalize_purchase_course_id(purchase) == course_id and purchase_grants_access(purchase):
            return True
    return False


def get_course_chapters(course_id: str) -> list[dict[str, Any]]:
    chapters = query_all(
        TABLES['CHAPTERS'],
        IndexName='CourseIndex',
        KeyConditionExpression=Key('course_id').eq(course_id),
    )
    return sorted((normalize_chapter(item) for item in chapters), key=lambda item: int(item.get('order_number', 0)))


def get_chapter_lessons(chapter_id: str) -> list[dict[str, Any]]:
    lessons = query_all(
        TABLES['LESSONS'],
        IndexName='ChapterIndex',
        KeyConditionExpression=Key('chapter_id').eq(chapter_id),
    )
    return sorted(lessons, key=lambda item: int(item.get('order_number', 0)))


def get_course_lessons(course_id: str) -> list[dict[str, Any]]:
    lessons = []
    for chapter in get_course_chapters(course_id):
        lessons.extend(get_chapter_lessons(chapter['chapter_id']))
    return lessons


def summarize_student(user_item: dict[str, Any]) -> dict[str, Any]:
    purchases = get_user_purchases(user_item['user_id'])
    progress_items = get_user_progress_items(user_item['user_id'])
    all_courses = list_all_items(TABLES['COURSES'])
    if not all_courses:
        all_courses = [ensure_legacy_course()]

    accessible_courses = [course for course in all_courses if can_access_course(user_item, purchases, course['course_id'])]
    course_lessons = set()
    lessons_by_id = {}
    for course in accessible_courses:
        for lesson in get_course_lessons(course['course_id']):
            course_lessons.add(lesson['lesson_id'])
            lessons_by_id[lesson['lesson_id']] = lesson

    completed = 0
    total_watch_time = 0
    last_watched = None
    for item in progress_items:
        if item.get('lesson_id') in course_lessons and item.get('completed'):
            completed += 1
        total_watch_time += int(item.get('watched_seconds', 0))
        watched_at = item.get('last_watched')
        if watched_at and (not last_watched or watched_at > last_watched):
            last_watched = watched_at

    total_lessons = len(course_lessons)
    completion_percentage = int((completed / total_lessons) * 100) if total_lessons else 0
    latest_purchase = None
    if purchases:
        latest_purchase = sorted(purchases, key=lambda item: item.get('purchase_date', ''), reverse=True)[0]

    return {
        'user_id': user_item['user_id'],
        'email': user_item.get('email', ''),
        'full_name': user_item.get('full_name', ''),
        'subscription_status': user_item.get('subscription_status', 'inactive'),
        'subscription_end_date': user_item.get('sub_end_date') or user_item.get('subscription_end_date') or '',
        'global_access': user_has_global_access(user_item),
        'total_watch_time': total_watch_time,
        'last_login': user_item.get('updated_at') or user_item.get('created_at') or '',
        'purchase_date': latest_purchase.get('purchase_date', '') if latest_purchase else user_item.get('created_at', ''),
        'completion_percentage': completion_percentage,
        'accessible_courses_count': len(accessible_courses),
        'purchased_courses_count': len({normalize_purchase_course_id(p) for p in purchases}),
    }


def sync_cognito_user(username: str, full_name=None, subscription_status=None, subscription_end_date=None):
    attributes = []
    if full_name is not None:
        attributes.append({'Name': 'custom:full_name', 'Value': full_name})
    if subscription_status is not None:
        attributes.append({'Name': 'custom:subscription_status', 'Value': subscription_status})
    if subscription_end_date is not None:
        attributes.append({'Name': 'custom:sub_end_date', 'Value': subscription_end_date})

    if not attributes:
        return

    cognito_client.admin_update_user_attributes(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=username,
        UserAttributes=attributes,
    )


def create_course(body):
    title = (body.get('title') or '').strip()
    description = body.get('description', '')
    subtitle = body.get('subtitle', '')
    short_description = body.get('short_description') or description
    long_description = body.get('long_description') or description
    price = Decimal(str(body.get('price', '0')))
    discounted_price = body.get('discounted_price')
    status = body.get('status') or ('published' if normalize_bool(body.get('is_active', True)) else 'hidden')
    is_purchasable = normalize_bool(body.get('is_purchasable', True))
    public_slug = (body.get('public_slug') or title.lower().strip().replace(' ', '-').replace('/', '-')).strip('-')
    badge = body.get('badge') or ''
    cover_image_url = body.get('cover_image_url', '')
    display_order = int(body.get('display_order', 999))

    if not title:
        return create_response(400, {'error': 'title is required'})

    item = {
        'course_id': str(uuid.uuid4()),
        'title': title,
        'description': description,
        'subtitle': subtitle,
        'short_description': short_description,
        'long_description': long_description,
        'price': price,
        'discounted_price': Decimal(str(discounted_price)) if discounted_price not in (None, '') else None,
        'cover_image_url': cover_image_url,
        'status': status,
        'is_purchasable': is_purchasable,
        'public_slug': public_slug,
        'display_order': display_order,
        'badge': badge,
        'is_active': status == 'published',
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    TABLES['COURSES'].put_item(Item=item)
    return create_response(201, {'success': True, 'data': normalize_course(item)})


def update_course(course_id, body):
    course = get_course(course_id)
    if not course:
        return create_response(404, {'error': 'Course not found'})

    expression_parts = []
    expression_values = {}
    expression_names = {}
    for key in [
        'title', 'description', 'subtitle', 'short_description', 'long_description',
        'price', 'discounted_price', 'cover_image_url', 'status', 'is_purchasable',
        'public_slug', 'display_order', 'badge'
    ]:
        if key not in body:
            continue
        expression_names[f'#{key}'] = key
        if key in {'price', 'discounted_price'}:
          expression_values[f':{key}'] = None if body[key] in (None, '') else Decimal(str(body[key]))
        elif key == 'display_order':
          expression_values[f':{key}'] = int(body[key])
        else:
          expression_values[f':{key}'] = body[key]
        expression_parts.append(f'#{key} = :{key}')

    if 'is_active' in body and 'status' not in body:
        expression_names['#status'] = 'status'
        expression_values[':status'] = 'published' if normalize_bool(body['is_active']) else 'hidden'
        expression_parts.append('#status = :status')

    expression_names['#is_active'] = 'is_active'
    expression_values[':is_active'] = (body.get('status') or course.get('status', 'hidden')) == 'published'
    expression_parts.append('#is_active = :is_active')

    expression_names['#updated_at'] = 'updated_at'
    expression_values[':updated_at'] = now_iso()
    expression_parts.append('#updated_at = :updated_at')

    updated = TABLES['COURSES'].update_item(
        Key={'course_id': course_id},
        UpdateExpression=f"SET {', '.join(expression_parts)}",
        ExpressionAttributeNames=expression_names,
        ExpressionAttributeValues=expression_values,
        ReturnValues='ALL_NEW',
    )
    if body.get('cover_image_url') and body.get('cover_image_url') != course.get('cover_image_url'):
        delete_s3_object_safely(
            THUMBNAIL_BUCKET,
            get_owned_s3_key(course.get('cover_image_url'), THUMBNAIL_BUCKET),
        )
    return create_response(200, {'success': True, 'data': normalize_course(updated.get('Attributes'))})


def get_courses():
    courses = list_all_items(TABLES['COURSES'])
    if not courses:
        courses = [ensure_legacy_course()]
    normalized = [normalize_course(course) for course in courses]
    normalized.sort(key=lambda item: (int(item.get('display_order', 999)), item.get('created_at', '')))
    return create_response(200, {'items': normalized})


def delete_course(course_id):
    course = get_course(course_id)
    if not course:
        return create_response(404, {'error': 'Course not found'})
    
    chapters = query_all(
        TABLES['CHAPTERS'],
        IndexName='CourseIndex',
        KeyConditionExpression='course_id = :cid',
        ExpressionAttributeValues={':cid': course_id}
    )
    for chapter in chapters:
        chapter_id = chapter['chapter_id']
        lessons = query_all(
            TABLES['LESSONS'],
            IndexName='ChapterIndex',
            KeyConditionExpression='chapter_id = :chid',
            ExpressionAttributeValues={':chid': chapter_id}
        )
        if lessons:
            with TABLES['LESSONS'].batch_writer() as batch:
                for lesson in lessons:
                    delete_lesson_assets(lesson)
                    batch.delete_item(Key={'lesson_id': lesson['lesson_id']})
        delete_chapter_assets(chapter)
        TABLES['CHAPTERS'].delete_item(Key={'chapter_id': chapter_id})
            
    delete_s3_object_safely(
        THUMBNAIL_BUCKET,
        get_owned_s3_key(course.get('cover_image_url'), THUMBNAIL_BUCKET),
    )
    TABLES['COURSES'].delete_item(Key={'course_id': course_id})
    return create_response(200, {'success': True, 'message': 'Course deleted'})


def create_chapter(body):
    course_id = body.get('course_id')
    if not get_course(course_id):
        return create_response(404, {'error': 'Course not found'})

    existing = get_course_chapters(course_id)
    item = {
        'chapter_id': str(uuid.uuid4()),
        'course_id': course_id,
        'title': body.get('title', ''),
        'description': body.get('description', ''),
        'image_url': body.get('image_url', ''),
        'order_number': len(existing) + 1,
        'created_at': now_iso(),
    }
    TABLES['CHAPTERS'].put_item(Item=item)
    return create_response(201, {'success': True, 'data': normalize_chapter(item)})


def update_chapter(chapter_id, body):
    chapter = TABLES['CHAPTERS'].get_item(Key={'chapter_id': chapter_id}).get('Item')
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})

    fields = []
    values = {}
    for key, value in body.items():
        if key == 'chapter_id':
            continue
        fields.append(f'{key} = :{key}')
        values[f':{key}'] = value
    updated = TABLES['CHAPTERS'].update_item(
        Key={'chapter_id': chapter_id},
        UpdateExpression=f"SET {', '.join(fields)}",
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    if body.get('image_url') and body.get('image_url') != chapter.get('image_url'):
        delete_s3_object_safely(
            THUMBNAIL_BUCKET,
            get_owned_s3_key(chapter.get('image_url'), THUMBNAIL_BUCKET),
        )
    return create_response(200, {'success': True, 'data': normalize_chapter(updated.get('Attributes'))})


def renormalize_chapters(course_id):
    chapters = get_course_chapters(course_id)
    for index, chapter in enumerate(chapters, start=1):
        if int(chapter.get('order_number', 0)) == index:
            continue
        TABLES['CHAPTERS'].update_item(
            Key={'chapter_id': chapter['chapter_id']},
            UpdateExpression='SET order_number = :order',
            ExpressionAttributeValues={':order': index},
        )


def delete_chapter(chapter_id):
    chapter = TABLES['CHAPTERS'].get_item(Key={'chapter_id': chapter_id}).get('Item')
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})

    lessons = get_chapter_lessons(chapter_id)
    with TABLES['LESSONS'].batch_writer() as batch:
        for lesson in lessons:
            delete_lesson_assets(lesson)
            batch.delete_item(Key={'lesson_id': lesson['lesson_id']})
    delete_chapter_assets(chapter)
    TABLES['CHAPTERS'].delete_item(Key={'chapter_id': chapter_id})
    renormalize_chapters(chapter['course_id'])
    return create_response(200, {'success': True, 'message': 'Chapter deleted'})


def create_lesson(body):
    chapter_id = body.get('chapter_id')
    chapter = TABLES['CHAPTERS'].get_item(Key={'chapter_id': chapter_id}).get('Item')
    if not chapter:
        return create_response(404, {'error': 'Chapter not found'})

    existing = get_chapter_lessons(chapter_id)
    item = {
        'lesson_id': str(uuid.uuid4()),
        'chapter_id': chapter_id,
        'title': body.get('title', ''),
        'description': body.get('description', ''),
        'order_number': len(existing) + 1,
        'duration_seconds': body.get('duration_seconds', 0),
        'video_s3_key': body.get('video_s3_key', ''),
        'thumbnail_url': body.get('thumbnail_url', ''),
        'is_free_preview': normalize_bool(body.get('is_free_preview', False)),
        'created_at': now_iso(),
    }
    TABLES['LESSONS'].put_item(Item=item)
    return create_response(201, {'success': True, 'data': item})


def update_lesson(lesson_id, body):
    lesson = TABLES['LESSONS'].get_item(Key={'lesson_id': lesson_id}).get('Item')
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})

    fields = []
    values = {}
    for key, value in body.items():
        if key == 'lesson_id':
            continue
        fields.append(f'{key} = :{key}')
        values[f':{key}'] = value
    updated = TABLES['LESSONS'].update_item(
        Key={'lesson_id': lesson_id},
        UpdateExpression=f"SET {', '.join(fields)}",
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    if body.get('video_s3_key') and body.get('video_s3_key') != lesson.get('video_s3_key'):
        delete_s3_object_safely(VIDEO_BUCKET, lesson.get('video_s3_key'))
    if body.get('thumbnail_url') and body.get('thumbnail_url') != lesson.get('thumbnail_url'):
        delete_s3_object_safely(
            THUMBNAIL_BUCKET,
            get_owned_s3_key(lesson.get('thumbnail_url'), THUMBNAIL_BUCKET),
        )
    return create_response(200, {'success': True, 'data': updated.get('Attributes')})


def renormalize_lessons(chapter_id):
    lessons = get_chapter_lessons(chapter_id)
    for index, lesson in enumerate(lessons, start=1):
        if int(lesson.get('order_number', 0)) == index:
            continue
        TABLES['LESSONS'].update_item(
            Key={'lesson_id': lesson['lesson_id']},
            UpdateExpression='SET order_number = :order',
            ExpressionAttributeValues={':order': index},
        )


def delete_lesson(lesson_id):
    lesson = TABLES['LESSONS'].get_item(Key={'lesson_id': lesson_id}).get('Item')
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})
    delete_lesson_assets(lesson)
    TABLES['LESSONS'].delete_item(Key={'lesson_id': lesson_id})
    renormalize_lessons(lesson['chapter_id'])
    return create_response(200, {'success': True, 'message': 'Lesson deleted'})


def reorder_chapters(body):
    for item in body.get('items', []):
        TABLES['CHAPTERS'].update_item(
            Key={'chapter_id': item['id']},
            UpdateExpression='SET order_number = :order',
            ExpressionAttributeValues={':order': item['order_number']},
        )
    return create_response(200, {'success': True, 'message': 'Chapters reordered'})


def reorder_lessons(body):
    for item in body.get('items', []):
        TABLES['LESSONS'].update_item(
            Key={'lesson_id': item['id']},
            UpdateExpression='SET order_number = :order',
            ExpressionAttributeValues={':order': item['order_number']},
        )
    return create_response(200, {'success': True, 'message': 'Lessons reordered'})


def get_presigned_upload_url(body):
    file_name = body.get('file_name')
    file_type = body.get('file_type')
    if not file_name or not file_type:
        return create_response(400, {'error': 'file_name and file_type are required'})

    s3_key = f"videos/{uuid.uuid4()}-{file_name}"
    url = s3_client.generate_presigned_url(
        'put_object',
        Params={'Bucket': VIDEO_BUCKET, 'Key': s3_key, 'ContentType': file_type},
        ExpiresIn=3600,
    )
    return create_response(200, {
        'upload_url': url,
        'video_s3_key': s3_key,
        'expires_at': now_iso(),
    })


def get_presigned_image_upload_url(body):
    file_name = body.get('file_name')
    file_type = body.get('file_type')
    folder = (body.get('folder') or 'images').strip('/')
    if not file_name or not file_type:
        return create_response(400, {'error': 'file_name and file_type are required'})
    if not str(file_type).startswith('image/'):
        return create_response(400, {'error': 'Only image uploads are allowed'})

    safe_name = str(file_name).replace(' ', '-')
    s3_key = f"{folder}/{uuid.uuid4()}-{safe_name}"
    url = s3_client.generate_presigned_url(
        'put_object',
        Params={'Bucket': THUMBNAIL_BUCKET, 'Key': s3_key, 'ContentType': file_type},
        ExpiresIn=3600,
    )
    return create_response(200, {
        'upload_url': url,
        'image_s3_key': s3_key,
        'image_url': build_public_s3_url(THUMBNAIL_BUCKET, s3_key),
        'expires_at': now_iso(),
    })


def delete_video(video_id):
    if not video_id:
        return create_response(400, {'error': 'videoId is required'})
    try:
        s3_client.delete_object(Bucket=VIDEO_BUCKET, Key=video_id)
        return create_response(200, {'success': True, 'message': 'Video deleted'})
    except ClientError as exc:
        return create_response(500, {'error': str(exc)})


def generate_thumbnail(body):
    video_s3_key = body.get('video_s3_key')
    if not video_s3_key:
        return create_response(400, {'error': 'video_s3_key is required'})
    return create_response(200, {
        'thumbnail_url': '',
        'message': 'Thumbnail generation is not configured yet, but the endpoint is available.',
    })


def ensure_cognito_student(email: str, full_name: str):
    try:
        existing = cognito_client.admin_get_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
        )
        attributes = {item['Name']: item['Value'] for item in existing.get('UserAttributes', [])}
        sync_cognito_user(email, full_name=full_name, subscription_status='active')
        return attributes.get('sub'), False, None
    except cognito_client.exceptions.UserNotFoundException:
        temp_password = generate_temp_password()
        created = cognito_client.admin_create_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
            TemporaryPassword=temp_password,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'custom:full_name', 'Value': full_name},
                {'Name': 'custom:subscription_status', 'Value': 'active'},
            ],
            DesiredDeliveryMediums=['EMAIL'],
            MessageAction='SUPPRESS',
        )
        try:
            cognito_client.admin_add_user_to_group(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email,
                GroupName='students',
            )
        except Exception as exc:
            print(f'Add to students group warning: {exc}')

        user_id = next(item['Value'] for item in created['User']['Attributes'] if item['Name'] == 'sub')
        send_welcome_email(email, temp_password)
        return user_id, True, temp_password


def create_manual_student(body):
    email = (body.get('email') or '').strip()
    full_name = (body.get('full_name') or '').strip()
    if not email or not full_name:
        return create_response(400, {'error': 'email and full_name are required'})

    user_id, _, _ = ensure_cognito_student(email, full_name)
    item = {
        'user_id': user_id,
        'email': email,
        'full_name': full_name,
        'subscription_status': 'active',
        'global_access': True,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    existing = get_user_item(user_id)
    if existing:
        item['created_at'] = existing.get('created_at', item['created_at'])
    TABLES['USERS'].put_item(Item=item)
    return create_response(201, {'success': True, 'data': item})


def grant_course_to_student(student_id, body):
    course_id = body.get('course_id')
    if not course_id:
        return create_response(400, {'error': 'course_id is required'})
    
    user_item = get_user_item(student_id)
    if not user_item:
        return create_response(404, {'error': 'Student not found'})
        
    course = get_course(course_id)
    if not course:
        return create_response(404, {'error': 'Course not found'})
    
    purchase_id = f"MANUAL_{uuid.uuid4().hex[:16]}"
    purchase_item = {
        'purchase_id': purchase_id,
        'user_id': user_item['user_id'],
        'email': user_item.get('email', ''),
        'course_id': course_id,
        'course_title': course.get('title', course_id),
        'amount': Decimal('0.00'),
        'currency': 'eur',
        'status': 'completed',
        'purchase_date': now_iso(),
        'manual_grant': True,
        'stripe_session_id': 'manual_grant',
    }
    TABLES['PURCHASES'].put_item(Item=purchase_item)
    return create_response(200, {'success': True, 'purchase': purchase_item})


def delete_student(student_id):
    user_item = resolve_student_record(student_id)
    if not user_item:
        return create_response(404, {'error': 'Student not found'})

    email = user_item.get('email')
    if email:
        try:
            cognito_client.admin_delete_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email
            )
        except ClientError as e:
            if e.response['Error']['Code'] != 'UserNotFoundException':
                print(f"Error deleting user from Cognito: {e}")

    TABLES['USERS'].delete_item(Key={'user_id': user_item.get('user_id', student_id)})
    return create_response(200, {'success': True, 'message': 'Student deleted successfully'})


def update_student(student_id, body):
    user_item = resolve_student_record(student_id)
    if not user_item:
        return create_response(404, {'error': 'Student not found'})

    full_name = body.get('full_name', user_item.get('full_name', ''))
    subscription_status = body.get('subscription_status', user_item.get('subscription_status', 'active'))
    global_access = normalize_bool(body.get('global_access', user_item.get('global_access', False)))
    subscription_end_date = body.get('subscription_end_date', user_item.get('sub_end_date') or '')

    updated_item = {
        **user_item,
        'full_name': full_name,
        'subscription_status': subscription_status,
        'global_access': global_access,
        'updated_at': now_iso(),
    }
    if subscription_end_date:
        updated_item['sub_end_date'] = subscription_end_date
    elif 'sub_end_date' in updated_item:
        updated_item.pop('sub_end_date')

    TABLES['USERS'].put_item(Item=updated_item)
    sync_cognito_user(
        user_item['email'],
        full_name=full_name,
        subscription_status=subscription_status,
        subscription_end_date=subscription_end_date if subscription_end_date else None,
    )
    return create_response(200, {'success': True, 'data': updated_item})


def get_students():
    users = list_student_records()
    items = [summarize_student(user) for user in sorted(users, key=lambda item: item.get('created_at', ''), reverse=True)]
    return create_response(200, {
        'items': items,
        'total': len(items),
        'page': 1,
        'per_page': len(items),
        'total_pages': 1,
    })


def search_students(params):
    query = (params.get('q') or '').strip().lower()
    if not query:
        return create_response(200, [])

    users = list_student_records()
    matches = []
    for user in users:
        email = str(user.get('email', '')).lower()
        full_name = str(user.get('full_name', '')).lower()
        if query in email or query in full_name:
            matches.append(summarize_student(user))
    return create_response(200, matches[:25])


def get_student_detail(student_id):
    user_item = resolve_student_record(student_id)
    if not user_item:
        return create_response(404, {'error': 'Student not found'})

    purchases = sorted(get_user_purchases(student_id), key=lambda item: item.get('purchase_date', ''), reverse=True)
    progress_items = get_user_progress_items(student_id)
    courses = list_all_items(TABLES['COURSES'])
    if not courses:
        courses = [ensure_legacy_course()]

    progress_by_course = []
    accessible_courses = []
    for course in courses:
        has_access = can_access_course(user_item, purchases, course['course_id'])
        if has_access:
            accessible_courses.append({
                'course_id': course['course_id'],
                'title': course.get('title', ''),
            })

        lessons = get_course_lessons(course['course_id'])
        lesson_ids = {lesson['lesson_id'] for lesson in lessons}
        relevant = [item for item in progress_items if item.get('lesson_id') in lesson_ids]
        completed = sum(1 for item in relevant if item.get('completed'))
        last_watched = max((item.get('last_watched') or '' for item in relevant), default='')
        progress_by_course.append({
            'course_id': course['course_id'],
            'title': course.get('title', ''),
            'has_access': has_access,
            'completed_lessons': completed,
            'total_lessons': len(lesson_ids),
            'percentage': (completed / len(lesson_ids) * 100) if lesson_ids else 0,
            'last_watched': last_watched,
        })

    return create_response(200, {
        'student': summarize_student(user_item),
        'purchases': purchases,
        'accessible_courses': accessible_courses,
        'progress_by_course': progress_by_course,
    })


def get_purchases():
    purchases = list_all_items(TABLES['PURCHASES'])
    courses = {course['course_id']: course for course in list_all_items(TABLES['COURSES'])}
    users = {user['user_id']: user for user in list_all_items(TABLES['USERS'])}
    items = []
    params = current_params or {}
    filter_status = params.get('status')
    filter_course = params.get('course_id')
    filter_email = (params.get('email') or '').strip().lower()
    filter_origin = params.get('origin')

    for purchase in sorted(purchases, key=lambda item: item.get('purchase_date', item.get('created_at', '')), reverse=True):
        normalized = normalize_purchase(purchase)
        normalized_course_id = normalize_purchase_course_id(normalized)
        user_item = users.get(normalized.get('user_id'), {})
        course = normalize_course(courses.get(normalized_course_id) or ensure_legacy_course())
        record = {
            **normalized,
            'course_id': normalized_course_id,
            'course_title': normalized.get('course_title') or course.get('title', ''),
            'user_email': normalized.get('customer_email') or user_item.get('email', ''),
            'user_name': user_item.get('full_name', ''),
            'amount': normalized['amount_gross'],
        }

        if filter_status and record.get('local_status') != filter_status:
            continue
        if filter_course and record.get('course_id') != filter_course:
            continue
        if filter_origin and record.get('purchase_origin') != filter_origin:
            continue
        if filter_email and filter_email not in str(record.get('user_email', '')).lower():
            continue

        items.append(record)

    return create_response(200, {'items': items})


def get_purchase_detail(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})

    normalized = normalize_purchase(purchase)
    user_item = get_user_item(normalized.get('user_id')) if normalized.get('user_id') else {}
    course = get_course(normalized.get('course_id')) or ensure_legacy_course()

    timeline = [
        {'label': 'Creato', 'at': normalized.get('created_at') or normalized.get('purchase_date')},
        {'label': 'Webhook ricevuto', 'at': normalized.get('webhook_received_at')},
        {'label': 'Rimborsato', 'at': normalized.get('refunded_at')},
        {'label': 'Accesso revocato', 'at': normalized.get('access_revoked_at')},
    ]
    timeline.extend({
        'label': f"Email corretta: {entry.get('from_email') or '—'} → {entry.get('to_email') or '—'}",
        'at': entry.get('corrected_at'),
    } for entry in normalized.get('email_correction_history') or [])

    return create_response(200, {
        'purchase': {
            **normalized,
            'user_email': normalized.get('customer_email') or user_item.get('email', ''),
            'user_name': user_item.get('full_name', ''),
            'course_title': normalized.get('course_title') or course.get('title', ''),
        },
        'timeline': [entry for entry in timeline if entry.get('at')],
    })


def fetch_stripe_purchase_state(purchase: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_purchase(purchase)
    payment_intent_id = normalized.get('stripe_payment_intent_id')
    session_id = normalized.get('stripe_session_id')
    payment_intent = None
    session = None

    if session_id:
        try:
            session = stripe.checkout.Session.retrieve(session_id, expand=['payment_intent'])
        except Exception as exc:
            print(f'Stripe session retrieve warning: {exc}')
    if payment_intent_id:
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id, expand=['latest_charge', 'charges'])
        except Exception as exc:
            print(f'Stripe payment intent retrieve warning: {exc}')
    elif session and isinstance(session.get('payment_intent'), dict):
        payment_intent = session.get('payment_intent')
    elif session and session.get('payment_intent'):
        payment_intent = stripe.PaymentIntent.retrieve(session.get('payment_intent'), expand=['latest_charge', 'charges'])

    charges = (((payment_intent or {}).get('charges') or {}).get('data')) or []
    amount_refunded = 0
    is_disputed = False
    charge_id = normalized.get('stripe_charge_id')
    for charge in charges:
        amount_refunded = max(amount_refunded, int(charge.get('amount_refunded') or 0))
        is_disputed = is_disputed or normalize_bool(charge.get('disputed', False))
        charge_id = charge_id or charge.get('id')

    stripe_status = (
        session.get('payment_status') if session else None
    ) or (
        payment_intent.get('status') if payment_intent else None
    ) or normalized.get('stripe_status', 'unknown')

    local_status = normalized.get('local_status', 'needs_review')
    if is_disputed:
        local_status = 'disputed'
    elif amount_refunded > 0:
        local_status = 'refunded'
    elif stripe_status in {'paid', 'succeeded'}:
        local_status = 'paid'
    elif stripe_status in {'requires_payment_method', 'requires_action', 'failed'}:
        local_status = 'failed'
    elif stripe_status in {'open', 'unpaid', 'pending'}:
        local_status = 'pending'

    return {
        'stripe_status': stripe_status,
        'local_status': local_status,
        'stripe_charge_id': charge_id,
        'refunded_amount': Decimal(str(amount_refunded / 100)),
        'refund_status': 'refunded' if amount_refunded > 0 else 'not_refunded',
        'refund_type': 'full' if amount_refunded > 0 and amount_refunded >= int(normalized['amount_gross'] * 100) else ('partial' if amount_refunded > 0 else None),
        'refunded_at': now_iso() if amount_refunded > 0 else None,
        'is_disputed': is_disputed,
        'webhook_status': normalized.get('webhook_status') or 'received',
        'webhook_received_at': normalized.get('webhook_received_at') or now_iso(),
    }


def resync_purchase(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    normalized = normalize_purchase(purchase)
    normalized.update(fetch_stripe_purchase_state(normalized))
    normalized = sync_purchase_access(normalized)
    TABLES['PURCHASES'].put_item(Item=normalized)
    return create_response(200, {'success': True, 'data': normalized})


def force_unlock_purchase(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    normalized = sync_purchase_access(purchase, mode='force_unlock')
    TABLES['PURCHASES'].put_item(Item=normalized)
    return create_response(200, {'success': True, 'data': normalized})


def revoke_purchase_access(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    normalized = sync_purchase_access(purchase, mode='revoke')
    TABLES['PURCHASES'].put_item(Item=normalized)
    return create_response(200, {'success': True, 'data': normalized})


def mark_purchase_verified(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    normalized = normalize_purchase(purchase)
    normalized['verified_by_admin'] = True
    normalized['updated_at'] = now_iso()
    TABLES['PURCHASES'].put_item(Item=normalized)
    return create_response(200, {'success': True, 'data': normalized})


def is_valid_email(email: str) -> bool:
    return '@' in email and '.' in email.rsplit('@', 1)[-1] and ' ' not in email


def ensure_student_record(user_id: str, email: str, full_name: str) -> dict[str, Any]:
    existing = get_user_item(user_id)
    if existing:
        return existing

    item = {
        'user_id': user_id,
        'email': email,
        'full_name': full_name or '',
        'subscription_status': 'active',
        'global_access': False,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    TABLES['USERS'].put_item(Item=item)
    return item


def correct_purchase_email(purchase_id: str, body: dict[str, Any], admin_email: str):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})

    normalized = normalize_purchase(purchase)
    previous_email = str(normalized.get('customer_email') or '').strip().lower()
    new_email = str(body.get('email') or '').strip().lower()
    if not is_valid_email(new_email):
        return create_response(400, {'error': 'Inserisci un indirizzo email valido'})
    if new_email == previous_email:
        return create_response(400, {'error': 'La nuova email coincide con quella già associata all’acquisto'})

    current_user = get_user_item(normalized.get('user_id')) if normalized.get('user_id') else {}
    full_name = str(
        body.get('full_name')
        or current_user.get('full_name')
        or normalized.get('user_name')
        or new_email.split('@', 1)[0]
    ).strip()
    user_id, created_account, _ = ensure_cognito_student(new_email, full_name)
    ensure_student_record(user_id, new_email, full_name)

    correction = {
        'from_email': previous_email,
        'to_email': new_email,
        'corrected_at': now_iso(),
        'corrected_by': admin_email or 'admin',
        'reason': str(body.get('reason') or '').strip(),
    }
    history = list(normalized.get('email_correction_history') or [])
    history.append(correction)
    normalized.update({
        'user_id': user_id,
        'customer_email': new_email,
        'email_correction_history': history,
        'email_corrected_at': correction['corrected_at'],
        'email_corrected_by': correction['corrected_by'],
        'updated_at': correction['corrected_at'],
    })
    TABLES['PURCHASES'].put_item(Item=normalized)
    return create_response(200, {
        'success': True,
        'data': normalized,
        'message': (
            'Email corretta. Il nuovo account ha ricevuto le credenziali di accesso.'
            if created_account else
            'Email corretta. L’accesso è ora associato all’account già esistente.'
        ),
        'account_created': created_account,
    })


def get_coupons():
    items = sorted(list_all_items(TABLES['COUPONS']), key=lambda item: item.get('created_at', ''), reverse=True)
    return create_response(200, {'items': items})


def create_coupon(body):
    code = (body.get('code') or '').strip().upper()
    if not code:
        return create_response(400, {'error': 'code is required'})

    item = {
        'coupon_id': code,
        'code': code,
        'course_scope': body.get('course_scope') or [],
        'discount_type': body.get('discount_type', 'percent'),
        'discount_value': Decimal(str(body.get('discount_value', 0))),
        'starts_at': body.get('starts_at'),
        'expires_at': body.get('expires_at'),
        'max_redemptions': body.get('max_redemptions'),
        'current_redemptions': 0,
        'allowed_user_emails': body.get('allowed_user_emails') or [],
        'is_active': normalize_bool(body.get('is_active', True)),
        'is_free_access': normalize_bool(body.get('is_free_access', False)),
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    TABLES['COUPONS'].put_item(Item=item)
    return create_response(201, {'success': True, 'data': item})


def update_coupon(coupon_id, body):
    coupon = get_coupon(coupon_id)
    if not coupon:
        return create_response(404, {'error': 'Coupon not found'})

    updated = dict(coupon)
    for key in ['course_scope', 'discount_type', 'starts_at', 'expires_at', 'max_redemptions', 'allowed_user_emails', 'code']:
        if key in body:
            updated[key] = body[key]
    for key in ['discount_value']:
        if key in body:
            updated[key] = Decimal(str(body[key]))
    for key in ['is_active', 'is_free_access']:
        if key in body:
            updated[key] = normalize_bool(body[key])
    updated['coupon_id'] = (updated.get('code') or coupon_id).strip().upper()
    updated['code'] = updated['coupon_id']
    updated['updated_at'] = now_iso()

    if updated['coupon_id'] != coupon_id:
        TABLES['COUPONS'].delete_item(Key={'coupon_id': coupon_id})
    TABLES['COUPONS'].put_item(Item=updated)
    return create_response(200, {'success': True, 'data': updated})


def delete_coupon(coupon_id):
    coupon = get_coupon(coupon_id)
    if not coupon:
        return create_response(404, {'error': 'Coupon not found'})
    TABLES['COUPONS'].delete_item(Key={'coupon_id': coupon['coupon_id']})
    return create_response(200, {'success': True})


def test_coupon(body):
    coupon = get_coupon(body.get('code'))
    course_ref = body.get('course_id')
    email = body.get('email')
    if not coupon:
        return create_response(404, {'valid': False, 'reason': 'Coupon not found'})
    valid, reason = coupon_is_valid(coupon, course_ref, email)
    course = get_course(course_ref) if course_ref else None
    total = compute_coupon_total(course, coupon) if valid and course else None
    return create_response(200, {
        'valid': valid,
        'reason': reason,
        'final_total': total,
    })


def get_admin_accounts():
    return create_response(200, {'items': list_admin_accounts()})


def create_admin_account(body):
    email = (body.get('email') or '').strip().lower()
    full_name = (body.get('full_name') or '').strip()

    if not email or not full_name:
        return create_response(400, {'error': 'email and full_name are required'})

    temp_password = generate_temp_password()
    try:
        cognito_client.admin_create_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
            TemporaryPassword=temp_password,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'custom:full_name', 'Value': full_name},
            ],
            DesiredDeliveryMediums=['EMAIL'],
            MessageAction='SUPPRESS',
        )
        cognito_client.admin_add_user_to_group(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
            GroupName='admin',
        )
        send_admin_welcome_email(email, temp_password)
        return create_response(201, {
            'success': True,
            'data': {
                'email': email,
                'full_name': full_name,
                'enabled': True,
            },
        })
    except cognito_client.exceptions.UsernameExistsException:
        return create_response(409, {'error': 'Admin account already exists'})


def update_admin_account(event, email, body):
    current_admin_username = get_current_admin_username(event)
    username = (email or '').strip().lower()
    if not username:
        return create_response(400, {'error': 'Admin username is required'})

    full_name = body.get('full_name')
    enabled = body.get('enabled')

    attributes = []
    if full_name is not None:
        attributes.append({'Name': 'custom:full_name', 'Value': str(full_name).strip()})

    if attributes:
        cognito_client.admin_update_user_attributes(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=username,
            UserAttributes=attributes,
        )

    if enabled is not None:
        normalized_enabled = normalize_bool(enabled)
        if not normalized_enabled and username == current_admin_username:
            return create_response(400, {'error': 'Non puoi disattivare il tuo stesso account admin'})
        if normalized_enabled:
            cognito_client.admin_enable_user(UserPoolId=COGNITO_USER_POOL_ID, Username=username)
        else:
            cognito_client.admin_disable_user(UserPoolId=COGNITO_USER_POOL_ID, Username=username)

    return create_response(200, {'success': True})


def delete_admin_account(event, email):
    current_admin_username = get_current_admin_username(event)
    username = (email or '').strip().lower()
    if not username:
        return create_response(400, {'error': 'Admin username is required'})

    if username == current_admin_username:
        return create_response(400, {'error': 'Non puoi eliminare il tuo stesso account admin'})

    cognito_client.admin_delete_user(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=username,
    )
    return create_response(200, {'success': True, 'message': 'Admin account deleted'})


def resend_admin_invite(email):
    username = (email or '').strip().lower()
    if not username:
        return create_response(400, {'error': 'Admin username is required'})

    response = cognito_client.admin_get_user(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=username,
    )
    attributes = {item['Name']: item['Value'] for item in response.get('UserAttributes', [])}
    temp_password = generate_temp_password()

    cognito_client.admin_set_user_password(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=username,
        Password=temp_password,
        Permanent=False,
    )
    send_admin_welcome_email(attributes.get('email', username), temp_password)
    return create_response(200, {'success': True, 'message': 'Admin invite resent'})


def get_stats():
    users = list_all_items(TABLES['USERS'])
    purchases = list_all_items(TABLES['PURCHASES'])
    progress_items = list_all_items(TABLES['PROGRESS'])
    lessons = {lesson['lesson_id']: lesson for lesson in list_all_items(TABLES['LESSONS'])}

    total_revenue = Decimal('0')
    recent_purchases = []
    for purchase in sorted(purchases, key=lambda item: item.get('purchase_date', ''), reverse=True):
        normalized_amount = normalize_amount(purchase.get('amount', 0))
        total_revenue += normalized_amount
        if len(recent_purchases) < 5:
            recent_purchases.append({
                'purchase_id': purchase.get('purchase_id'),
                'user_email': purchase.get('customer_email', ''),
                'amount': normalized_amount,
                'purchase_date': purchase.get('purchase_date', ''),
            })

    views_by_lesson = {}
    total_video_views = 0
    total_completion_percent = 0
    activity_by_day = {}
    for item in progress_items:
        watched_seconds = int(item.get('watched_seconds', 0))
        percent = int(item.get('progress_percent', 0))
        if item.get('completed') and percent < 100:
            percent = 100

        if watched_seconds > 0 or percent > 0:
            total_video_views += 1
            total_completion_percent += percent
            lesson_id = item.get('lesson_id')
            if lesson_id:
                views_by_lesson[lesson_id] = views_by_lesson.get(lesson_id, 0) + 1

        last_watched = item.get('last_watched')
        if last_watched:
            day = str(last_watched).split('T')[0]
            activity_by_day.setdefault(day, set()).add(item.get('user_id'))

    most_viewed_lessons = []
    for lesson_id, views in sorted(views_by_lesson.items(), key=lambda item: item[1], reverse=True)[:5]:
        lesson = lessons.get(lesson_id) or {}
        most_viewed_lessons.append({
            'lesson_id': lesson_id,
            'title': lesson.get('title', 'Unknown lesson'),
            'views': views,
        })

    today = datetime.now(timezone.utc).date()
    daily_access_chart = []
    for offset in range(6, -1, -1):
        day = (today.fromordinal(today.toordinal() - offset)).isoformat()
        daily_access_chart.append({
            'date': day,
            'active_users': len(activity_by_day.get(day, set())),
        })

    active_students = 0
    for user in users:
        summary = summarize_student(user)
        if summary['global_access'] or summary['accessible_courses_count'] > 0:
            active_students += 1

    return create_response(200, {
        'total_students': len(users),
        'active_students': active_students,
        'total_revenue': total_revenue,
        'new_purchases_today': 0,
        'new_purchases_week': 0,
        'new_purchases_month': len(purchases),
        'total_video_views': total_video_views,
        'average_completion_rate': round(total_completion_percent / total_video_views, 1) if total_video_views else 0,
        'most_viewed_lessons': most_viewed_lessons,
        'recent_purchases': recent_purchases,
        'daily_access_chart': daily_access_chart,
    })


try:
    import resend

    resend.api_key = load_secret('RESEND_API_KEY_PARAMETER', 'RESEND_API_KEY')
except ImportError:
    resend = None

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
cognito_client = boto3.client('cognito-idp')

TABLE_NAMES = {
    'COURSES': os.environ.get('COURSES_TABLE'),
    'CHAPTERS': os.environ.get('CHAPTERS_TABLE'),
    'LESSONS': os.environ.get('LESSONS_TABLE'),
    'PURCHASES': os.environ.get('PURCHASES_TABLE'),
    'PROGRESS': os.environ.get('PROGRESS_TABLE'),
    'USERS': os.environ.get('USERS_TABLE'),
    'COUPONS': os.environ.get('COUPONS_TABLE'),
    'WEBHOOK_EVENTS': os.environ.get('WEBHOOK_EVENTS_TABLE'),
}
TABLES = {name: dynamodb.Table(table_name) for name, table_name in TABLE_NAMES.items() if table_name}

VIDEO_BUCKET = os.environ.get('VIDEO_BUCKET')
THUMBNAIL_BUCKET = os.environ.get('THUMBNAIL_BUCKET')
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
current_params = {}


def lambda_handler(event, context):
    del context
    global current_params
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if not is_admin(event):
        return create_response(403, {'error': 'Admin privileges required'})

    body = json.loads(event.get('body') or '{}')
    params = event.get('queryStringParameters') or {}
    current_params = params

    try:
        if path == '/admin/accounts' and http_method == 'GET':
            return get_admin_accounts()
        if path == '/admin/account' and http_method == 'POST':
            return create_admin_account(body)
        if path.startswith('/admin/account/') and path.endswith('/resend-invite') and http_method == 'POST':
            email = unquote(path_parameters.get('email', ''))
            return resend_admin_invite(email)
        if path.startswith('/admin/account/') and http_method == 'PATCH':
            email = unquote(path_parameters.get('email', ''))
            return update_admin_account(event, email, body)
        if path.startswith('/admin/account/') and http_method == 'DELETE':
            email = unquote(path_parameters.get('email', ''))
            return delete_admin_account(event, email)

        if path == '/admin/courses' and http_method == 'GET':
            return get_courses()
        if path == '/admin/course' and http_method == 'POST':
            return create_course(body)
        if (
            path.startswith('/admin/course/')
            and not path.startswith('/admin/course/chapter/')
            and not path.startswith('/admin/course/lesson/')
            and http_method == 'PUT'
        ):
            return update_course(path_parameters.get('courseId'), body)
        if (
            path.startswith('/admin/course/')
            and not path.startswith('/admin/course/chapter/')
            and not path.startswith('/admin/course/lesson/')
            and http_method == 'DELETE'
        ):
            return delete_course(path_parameters.get('courseId'))
        if path == '/admin/coupons' and http_method == 'GET':
            return get_coupons()
        if path == '/admin/coupon' and http_method == 'POST':
            return create_coupon(body)
        if path.startswith('/admin/coupon/') and http_method == 'PUT':
            return update_coupon(path_parameters.get('couponId'), body)
        if path.startswith('/admin/coupon/') and http_method == 'DELETE':
            return delete_coupon(path_parameters.get('couponId'))
        if path == '/admin/coupon/test' and http_method == 'POST':
            return test_coupon(body)

        if path == '/admin/course/chapter' and http_method == 'POST':
            return create_chapter(body)
        if path.startswith('/admin/course/chapter/') and http_method == 'PUT':
            return update_chapter(path_parameters.get('chapterId'), body)
        if path.startswith('/admin/course/chapter/') and http_method == 'DELETE':
            return delete_chapter(path_parameters.get('chapterId'))

        if path == '/admin/course/lesson' and http_method == 'POST':
            return create_lesson(body)
        if path.startswith('/admin/course/lesson/') and http_method == 'PUT':
            return update_lesson(path_parameters.get('lessonId'), body)
        if path.startswith('/admin/course/lesson/') and http_method == 'DELETE':
            return delete_lesson(path_parameters.get('lessonId'))

        if path == '/admin/course/reorder-chapters' and http_method == 'PUT':
            return reorder_chapters(body)
        if path == '/admin/course/reorder-lessons' and http_method == 'PUT':
            return reorder_lessons(body)

        if path == '/admin/student/create' and http_method == 'POST':
            return create_manual_student(body)
        if path.startswith('/admin/student/') and path.endswith('/resend-invite') and http_method == 'POST':
            student = get_user_item(path_parameters.get('studentId'))
            if not student:
                return create_response(404, {'error': 'Student not found'})
            temp_password = generate_temp_password()
            cognito_client.admin_set_user_password(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=student['email'],
                Password=temp_password,
                Permanent=False,
            )
            send_welcome_email(student['email'], temp_password)
            return create_response(200, {'success': True, 'message': 'Invite resent'})
        if path.startswith('/admin/student/') and path.endswith('/grant-course') and http_method == 'POST':
            return grant_course_to_student(path_parameters.get('studentId'), body)
        if path.startswith('/admin/student/') and path.endswith('/reset-password') and http_method == 'POST':
            student = resolve_student_record(path_parameters.get('studentId'))
            if not student:
                return create_response(404, {'error': 'Student not found'})

            try:
                # AdminResetUserPassword cannot be used while a manually-created
                # account is still in FORCE_CHANGE_PASSWORD. Setting a new
                # temporary password works for both pending and confirmed users.
                temp_password = generate_temp_password()
                cognito_client.admin_set_user_password(
                    UserPoolId=COGNITO_USER_POOL_ID,
                    Username=student['email'],
                    Password=temp_password,
                    Permanent=False,
                )
                send_welcome_email(student['email'], temp_password, password_reset=True)
                return create_response(200, {'success': True, 'message': 'Nuova password temporanea inviata via email'})
            except Exception as e:
                print(f"Reset password failed: {e}")
                return create_response(500, {'error': 'Si è verificato un errore durante il reset della password.'})
        if path.startswith('/admin/student/') and http_method == 'GET':
            return get_student_detail(path_parameters.get('studentId'))
        if path.startswith('/admin/student/') and http_method == 'PATCH':
            return update_student(path_parameters.get('studentId'), body)
        if path.startswith('/admin/student/') and http_method == 'DELETE':
            return delete_student(path_parameters.get('studentId'))

        if path == '/admin/students' and http_method == 'GET':
            return get_students()
        if path == '/admin/students/search' and http_method == 'GET':
            return search_students(params)

        if path == '/admin/purchases' and http_method == 'GET':
            return get_purchases()
        if path.startswith('/admin/purchase/') and path.endswith('/resync') and http_method == 'POST':
            return resync_purchase(path_parameters.get('purchaseId'))
        if path.startswith('/admin/purchase/') and path.endswith('/unlock') and http_method == 'POST':
            return force_unlock_purchase(path_parameters.get('purchaseId'))
        if path.startswith('/admin/purchase/') and path.endswith('/revoke') and http_method == 'POST':
            return revoke_purchase_access(path_parameters.get('purchaseId'))
        if path.startswith('/admin/purchase/') and path.endswith('/mark-verified') and http_method == 'POST':
            return mark_purchase_verified(path_parameters.get('purchaseId'))
        if path.startswith('/admin/purchase/') and path.endswith('/correct-email') and http_method == 'POST':
            return correct_purchase_email(
                path_parameters.get('purchaseId'),
                body,
                get_current_admin_email(event),
            )
        if path.startswith('/admin/purchase/') and http_method == 'GET':
            return get_purchase_detail(path_parameters.get('purchaseId'))
        if path == '/admin/stats' and http_method == 'GET':
            return get_stats()

        if path == '/admin/video/upload' and http_method == 'POST':
            return get_presigned_upload_url(body)
        if path == '/admin/image/upload' and http_method == 'POST':
            return get_presigned_image_upload_url(body)
        if path.startswith('/admin/video/') and http_method == 'DELETE':
            return delete_video(path_parameters.get('videoId'))
        if path == '/admin/video/thumbnail' and http_method == 'POST':
            return generate_thumbnail(body)

        return create_response(404, {'error': f'Route not implemented: {http_method} {path}'})
    except Exception as exc:
        print(f'admin handler error: {exc}')
        return create_response(500, {'error': str(exc)})
