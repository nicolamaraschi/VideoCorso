import json
import math
import os
import secrets
import string
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Optional
from urllib.parse import unquote, urlparse

import boto3
import stripe
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Shared access-control module. It is mandatory: a missing Layer must fail
# closed instead of restoring the historical needs_review policy.
# ---------------------------------------------------------------------------
from shared.purchase_access import (  # type: ignore[import]
    purchase_grants_access as _shared_purchase_grants_access,
    sync_purchase_access as _shared_sync_purchase_access,
)


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


def is_external_video_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(('http://', 'https://'))


def extract_asset_version(video_s3_key: Any, lesson_id: str) -> Optional[str]:
    """Return the immutable asset version only for the owning lesson key."""
    if not video_s3_key or is_external_video_url(video_s3_key):
        return None
    parts = str(video_s3_key).strip('/').split('/')
    if len(parts) != 4 or parts[0] != 'videos' or parts[1] != lesson_id:
        return None
    if not parts[2] or not parts[3].startswith('source.'):
        return None
    return parts[2]


def get_optimized_video_keys(video_s3_key: Any) -> list[str]:
    if not video_s3_key or is_external_video_url(video_s3_key):
        return []
    key = str(video_s3_key).strip('/')
    parts = key.split('/')
    # New assets are immutable/versioned: videos/<lesson>/<version>/source.ext.
    # Keeping the legacy branch makes cleanup safe for existing uploads.
    if len(parts) >= 4 and parts[0] == 'videos' and parts[-1].startswith('source.'):
        prefix = '/'.join(parts[1:-1])
        return [f'streaming/{prefix}/source_{quality}.mp4'
                for quality in ('720p', '480p', '360p', '1080p')]
    source_name = key.rsplit('/', 1)[-1]
    source_stem = source_name.rsplit('.', 1)[0]
    if not source_stem:
        return []
    return [f'streaming/{source_stem}/{source_stem}_{quality}.mp4'
            for quality in ('720p', '480p', '360p', '1080p')]


def delete_lesson_assets(lesson: dict[str, Any]) -> None:
    delete_s3_object_safely(VIDEO_BUCKET, lesson.get('video_s3_key'))
    for optimized_key in get_optimized_video_keys(lesson.get('video_s3_key')):
        delete_s3_object_safely(VIDEO_BUCKET, optimized_key)
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


def record_audit_log(action: str, target_type: str, target_id: str, details: Optional[dict[str, Any]] = None):
    table = TABLES.get('AUDIT_LOGS')
    if not table:
        return
    table.put_item(Item={
        'audit_id': str(uuid.uuid4()),
        'created_at': now_iso(),
        'admin_email': current_admin_email or 'admin',
        'action': action,
        'target_type': target_type,
        'target_id': str(target_id),
        'details': details or {},
    })


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


def normalize_package(package: dict[str, Any]) -> dict[str, Any]:
    """Mirror of course_handler.normalize_package. A package is a commercial
    tier (Basic/Intermedio/Avanzato); every package of a course grants access
    to the exact same lessons and differs only in price and benefits."""
    normalized = dict(package)
    normalized['package_id'] = str(normalized.get('package_id') or '')
    normalized['name'] = str(normalized.get('name') or '')
    normalized['price'] = Decimal(str(normalized.get('price', 0) or 0))
    normalized['discounted_price'] = (
        Decimal(str(normalized['discounted_price']))
        if normalized.get('discounted_price') not in (None, '') else None
    )
    normalized['display_order'] = int(normalized.get('display_order', 999))
    normalized['benefits'] = [str(item) for item in (normalized.get('benefits') or [])]
    normalized['includes_kit'] = normalize_bool(normalized.get('includes_kit', False))
    normalized['includes_ebook'] = normalize_bool(normalized.get('includes_ebook', False))
    normalized['includes_whatsapp_support'] = normalize_bool(normalized.get('includes_whatsapp_support', False))
    normalized['whatsapp_support_months'] = normalized.get('whatsapp_support_months')
    normalized['includes_community'] = normalize_bool(normalized.get('includes_community', False))
    normalized['live_meetings_count'] = int(normalized.get('live_meetings_count', 0) or 0)
    return normalized


def validate_package_payload(package: dict[str, Any]) -> Optional[str]:
    if not str(package.get('package_id') or '').strip():
        return 'package_id is required for every package'
    if not str(package.get('name') or '').strip():
        return 'package name is required for every package'
    try:
        price = Decimal(str(package.get('price', 0)))
    except Exception:
        return 'package price must be numeric'
    if price < 0:
        return 'package price cannot be negative'
    discounted_price = package.get('discounted_price')
    if discounted_price not in (None, ''):
        try:
            discounted = Decimal(str(discounted_price))
        except Exception:
            return 'package discounted_price must be numeric'
        if discounted < 0 or discounted > price:
            return 'package discounted_price must be between zero and the full price'
    months = package.get('whatsapp_support_months')
    if months not in (None, '') :
        try:
            if int(months) < 0:
                return 'whatsapp_support_months cannot be negative'
        except (TypeError, ValueError):
            return 'whatsapp_support_months must be an integer'
    return None


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
    normalized['packages'] = sorted(
        (normalize_package(item) for item in (normalized.get('packages') or [])),
        key=lambda item: item['display_order'],
    )
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
    normalized['manual_access_override'] = normalize_bool(normalized.get('manual_access_override', False))
    normalized['refund_status'] = normalized.get('refund_status') or ('refunded' if Decimal(str(normalized.get('refunded_amount', 0) or 0)) > 0 else 'not_refunded')
    normalized['refunded_amount'] = Decimal(str(normalized.get('refunded_amount', 0) or 0))
    normalized['is_disputed'] = normalize_bool(normalized.get('is_disputed', False))
    normalized['verified_by_admin'] = normalize_bool(normalized.get('verified_by_admin', False))
    normalized['purchase_origin'] = normalized.get('purchase_origin') or 'public_checkout'
    normalized['webhook_status'] = normalized.get('webhook_status') or 'not_received'
    normalized['created_at'] = normalized.get('created_at') or normalized.get('purchase_date') or now_iso()
    normalized['updated_at'] = normalized.get('updated_at') or normalized['created_at']
    normalized['is_stripe_test_purchase'] = str(normalized.get('stripe_session_id') or '').startswith('cs_test_')
    normalized['version'] = int(normalized.get('version', 0) or 0)
    return normalized


def put_purchase(purchase: dict[str, Any]) -> dict[str, Any]:
    """Persist a purchase without invalid null values for sparse GSI keys."""
    stored = dict(purchase)
    # DynamoDB GSIs accept an omitted key for records outside the index, but
    # reject NULL/empty values for a key declared as String. Manual and coupon
    # purchases legitimately have no Stripe Checkout session.
    if not stored.get('stripe_session_id'):
        stored.pop('stripe_session_id', None)
    TABLES['PURCHASES'].put_item(Item=stored)
    return stored


def remove_legacy_null_stripe_session_id(purchase: dict[str, Any]) -> dict[str, Any]:
    """Repair legacy purchases created before StripeSessionIndex was sparse."""
    if purchase.get('stripe_session_id') is None and 'stripe_session_id' in purchase:
        TABLES['PURCHASES'].update_item(
            Key={'purchase_id': purchase['purchase_id']},
            UpdateExpression='REMOVE stripe_session_id',
        )
        purchase = dict(purchase)
        purchase.pop('stripe_session_id', None)
    return purchase


class PurchaseVersionConflict(ValueError):
    """Raised only for the optimistic-locking CAS conflict in
    update_purchase_with_version, so the top-level handler can map it to a
    409 'stale_version' response without also mapping unrelated ValueErrors
    (e.g. input validation, business-rule violations) to the same code."""


def update_purchase_with_version(purchase_id: str, expected_version: int, fields: dict[str, Any]) -> dict[str, Any]:
    """Narrow compare-and-swap update for admin-owned purchase fields."""
    names = {'#version': 'version', '#updated_at': 'updated_at'}
    values: dict[str, Any] = {
        ':expected_version': int(expected_version), ':zero': 0, ':one': 1,
        ':updated_at': now_iso(),
    }
    assignments = ['#version = if_not_exists(#version, :zero) + :one', '#updated_at = :updated_at']
    for index, (field, value) in enumerate(fields.items()):
        name = f'#field{index}'
        value_name = f':field{index}'
        names[name] = field
        values[value_name] = value
        assignments.append(f'{name} = {value_name}')
    try:
        response = TABLES['PURCHASES'].update_item(
            Key={'purchase_id': purchase_id}, UpdateExpression='SET ' + ', '.join(assignments),
            ConditionExpression=(
                'attribute_exists(purchase_id) AND '
                '((attribute_not_exists(#version) AND :expected_version = :zero) OR #version = :expected_version)'
            ),
            ExpressionAttributeNames=names, ExpressionAttributeValues=values, ReturnValues='ALL_NEW',
        )
        return response.get('Attributes') or {}
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
            raise PurchaseVersionConflict('Purchase was changed by another administrator; reload and retry') from exc
        raise


def purchase_grants_access(purchase: dict[str, Any]) -> bool:
    return _shared_purchase_grants_access(purchase)


def sync_purchase_access(purchase: dict[str, Any], mode: str = 'sync') -> dict[str, Any]:
    return _shared_sync_purchase_access(purchase, mode=mode)


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


def get_purchase_video_access_events(purchase_id: str) -> list[dict[str, Any]]:
    """Return recent append-only video URL issuance evidence for one sale."""
    table = TABLES.get('VIDEO_ACCESS_LOGS')
    if not table or not purchase_id:
        return []
    response = table.query(
        IndexName='PurchaseIndex',
        KeyConditionExpression=Key('purchase_id').eq(purchase_id),
        ScanIndexForward=False,
        Limit=50,
    )
    return response.get('Items') or []


def user_has_global_access(user_item: dict[str, Any]) -> bool:
    return normalize_bool(user_item.get('global_access', False))


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


def validate_course_payload(course: dict[str, Any], current_course_id: Optional[str] = None) -> Optional[str]:
    """Keep catalog data coherent before it can be displayed or sold."""
    if not str(course.get('title') or '').strip():
        return 'title is required'
    status = str(course.get('status') or 'draft')
    if status not in {'draft', 'published', 'hidden', 'archived'}:
        return 'status is invalid'
    try:
        price = Decimal(str(course.get('price', 0)))
    except Exception:
        return 'price must be numeric'
    if price < 0:
        return 'price cannot be negative'
    discounted_price = course.get('discounted_price')
    if discounted_price not in (None, ''):
        try:
            discounted = Decimal(str(discounted_price))
        except Exception:
            return 'discounted_price must be numeric'
        if discounted < 0 or discounted > price:
            return 'discounted_price must be between zero and the full price'
    try:
        if int(course.get('display_order', 999)) < 0:
            return 'display_order cannot be negative'
    except (TypeError, ValueError):
        return 'display_order must be an integer'
    slug = str(course.get('public_slug') or '').strip()
    if not slug or not all(char.isalnum() or char == '-' for char in slug):
        return 'public_slug can contain only lowercase letters, numbers and hyphens'
    if slug != slug.lower():
        return 'public_slug must be lowercase'
    for existing in list_all_items(TABLES['COURSES']):
        if existing.get('course_id') != current_course_id and str(existing.get('public_slug') or '') == slug:
            return 'Esiste già un corso con questo URL pubblico'
    return None


def create_course(body):
    title = (body.get('title') or '').strip()
    description = body.get('description', '')
    subtitle = body.get('subtitle', '')
    short_description = body.get('short_description') or description
    long_description = body.get('long_description') or description
    price = body.get('price', '0')
    discounted_price = body.get('discounted_price')
    status = body.get('status') or ('published' if normalize_bool(body.get('is_active', True)) else 'hidden')
    is_purchasable = normalize_bool(body.get('is_purchasable', True))
    public_slug = (body.get('public_slug') or title.lower().strip().replace(' ', '-').replace('/', '-')).strip('-')
    badge = body.get('badge') or ''
    cover_image_url = body.get('cover_image_url', '')
    display_order = body.get('display_order', 999)
    raw_packages = body.get('packages') or []

    for raw_package in raw_packages:
        package_error = validate_package_payload(raw_package)
        if package_error:
            return create_response(400, {'error': package_error})

    item = {
        'course_id': str(uuid.uuid4()),
        'title': title,
        'description': description,
        'subtitle': subtitle,
        'short_description': short_description,
        'long_description': long_description,
        'price': price,
        'discounted_price': discounted_price,
        'cover_image_url': cover_image_url,
        'status': status,
        'is_purchasable': is_purchasable,
        'public_slug': public_slug,
        'display_order': display_order,
        'badge': badge,
        'is_active': status == 'published',
        'packages': raw_packages,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    validation_error = validate_course_payload(item)
    if validation_error:
        return create_response(400, {'error': validation_error})
    item['price'] = Decimal(str(price))
    item['discounted_price'] = Decimal(str(discounted_price)) if discounted_price not in (None, '') else None
    item['display_order'] = int(display_order)
    item['packages'] = [normalize_package(package) for package in raw_packages]
    TABLES['COURSES'].put_item(Item=item)
    return create_response(201, {'success': True, 'data': normalize_course(item)})


def update_course(course_id, body):
    course = get_course(course_id)
    if not course:
        return create_response(404, {'error': 'Course not found'})

    prospective = {**course, **body}
    if 'is_active' in body and 'status' not in body:
        prospective['status'] = 'published' if normalize_bool(body['is_active']) else 'hidden'
    validation_error = validate_course_payload(prospective, current_course_id=course_id)
    if validation_error:
        return create_response(400, {'error': validation_error})

    if 'packages' in body:
        for raw_package in (body.get('packages') or []):
            package_error = validate_package_payload(raw_package)
            if package_error:
                return create_response(400, {'error': package_error})

    expression_parts = []
    expression_values = {}
    expression_names = {}
    for key in [
        'title', 'description', 'subtitle', 'short_description', 'long_description',
        'price', 'discounted_price', 'cover_image_url', 'status', 'is_purchasable',
        'public_slug', 'display_order', 'badge', 'packages'
    ]:
        if key not in body:
            continue
        expression_names[f'#{key}'] = key
        if key in {'price', 'discounted_price'}:
          expression_values[f':{key}'] = None if body[key] in (None, '') else Decimal(str(body[key]))
        elif key == 'display_order':
          expression_values[f':{key}'] = int(body[key])
        elif key == 'packages':
          expression_values[f':{key}'] = [normalize_package(package) for package in (body[key] or [])]
        else:
          expression_values[f':{key}'] = body[key]
        expression_parts.append(f'#{key} = :{key}')

    effective_status = body.get('status', course.get('status', 'hidden'))
    if 'is_active' in body and 'status' not in body:
        effective_status = 'published' if normalize_bool(body['is_active']) else 'hidden'
        expression_names['#status'] = 'status'
        expression_values[':status'] = effective_status
        expression_parts.append('#status = :status')

    expression_names['#is_active'] = 'is_active'
    expression_values[':is_active'] = effective_status == 'published'
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
    normalized = [normalize_course(course) for course in courses]
    normalized.sort(key=lambda item: (int(item.get('display_order', 999)), item.get('created_at', '')))
    return create_response(200, {'items': normalized})


def delete_course(course_id):
    course = get_course(course_id)
    if not course:
        return create_response(404, {'error': 'Course not found'})
    
    # Archive instead of deleting: purchases and learning progress are legal and
    # operational records, and enrolled students must not lose paid content.
    TABLES['COURSES'].update_item(
        Key={'course_id': course_id},
        UpdateExpression='SET #status = :status, is_purchasable = :purchasable, is_active = :active, updated_at = :updated',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': 'archived', ':purchasable': False, ':active': False, ':updated': now_iso(),
        },
    )
    record_audit_log('archive_course', 'course', course_id, {'title': course.get('title', '')})
    return create_response(200, {'success': True, 'message': 'Corso archiviato: non è più acquistabile, ma i contenuti restano disponibili alle iscritte.'})


def create_chapter(body):
    course_id = body.get('course_id')
    if not get_course(course_id):
        return create_response(404, {'error': 'Course not found'})
    if not str(body.get('title') or '').strip():
        return create_response(400, {'error': 'Chapter title is required'})

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
    if 'title' in body and not str(body.get('title') or '').strip():
        return create_response(400, {'error': 'Chapter title is required'})

    fields = []
    values = {}
    for key in ('title', 'description', 'image_url'):
        if key not in body:
            continue
        value = body[key]
        fields.append(f'{key} = :{key}')
        values[f':{key}'] = value
    if not fields:
        return create_response(400, {'error': 'No editable chapter fields supplied'})
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
    if not str(body.get('title') or '').strip():
        return create_response(400, {'error': 'Lesson title is required'})
    try:
        if int(body.get('duration_seconds', 0) or 0) < 0:
            return create_response(400, {'error': 'Lesson duration cannot be negative'})
    except (TypeError, ValueError):
        return create_response(400, {'error': 'Lesson duration must be numeric'})

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
        'asset_version': body.get('asset_version') or None,
        'transcode_job_id': None,
        'created_at': now_iso(),
    }
    TABLES['LESSONS'].put_item(Item=item)
    return create_response(201, {'success': True, 'data': item})


def update_lesson(lesson_id, body):
    lesson = TABLES['LESSONS'].get_item(Key={'lesson_id': lesson_id}).get('Item')
    if not lesson:
        return create_response(404, {'error': 'Lesson not found'})
    if 'title' in body and not str(body.get('title') or '').strip():
        return create_response(400, {'error': 'Lesson title is required'})
    if 'duration_seconds' in body:
        try:
            if int(body.get('duration_seconds') or 0) < 0:
                return create_response(400, {'error': 'Lesson duration cannot be negative'})
        except (TypeError, ValueError):
            return create_response(400, {'error': 'Lesson duration must be numeric'})

    fields = []
    values = {}
    expression_names = {}
    replacing_video = body.get('video_s3_key') and body.get('video_s3_key') != lesson.get('video_s3_key')
    pending_replacement = False
    for key in ('title', 'description', 'duration_seconds', 'thumbnail_url', 'is_free_preview'):
        if key not in body:
            continue
        value = body[key]
        expression_names[f'#{key}'] = key
        fields.append(f'#{key} = :{key}')
        values[f':{key}'] = value
    if replacing_video:
        asset_version = extract_asset_version(body['video_s3_key'], lesson_id)
        if not asset_version:
            return create_response(400, {'error': 'Replacement video must use videos/<lesson_id>/<asset_version>/source.ext'})
        # The upload URL endpoint records the pending asset before the browser
        # uploads it. The following lesson PUT normally arrives afterwards;
        # preserve its in-flight transcode rather than resetting its job state.
        pending_replacement = (
            lesson.get('pending_video_s3_key') == body['video_s3_key']
            and lesson.get('pending_asset_version') == asset_version
        )
        if asset_version and not pending_replacement:
            expression_names['#asset_version'] = 'pending_asset_version'
            expression_names['#video_s3_key'] = 'pending_video_s3_key'
            expression_names['#transcode_job_id'] = 'transcode_job_id'
            expression_names['#transcode_status'] = 'transcode_status'
            values[':asset_version'] = asset_version
            values[':video_s3_key'] = body['video_s3_key']
            values[':transcode_job_id'] = None
            values[':transcode_status'] = 'PENDING_UPLOAD'
            fields.extend([
                '#asset_version = :asset_version', '#video_s3_key = :video_s3_key', '#transcode_job_id = :transcode_job_id',
                '#transcode_status = :transcode_status',
            ])
    if not fields:
        if pending_replacement:
            return create_response(200, {'success': True, 'data': lesson})
        return create_response(400, {'error': 'No editable lesson fields supplied'})
    updated = TABLES['LESSONS'].update_item(
        Key={'lesson_id': lesson_id},
        UpdateExpression=f"SET {', '.join(fields)}",
        ExpressionAttributeNames=expression_names,
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    # The old active asset remains available until MediaConvert atomically
    # promotes the pending version on COMPLETE.
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


def validate_reorder_items(items: Any, table, entity_name: str, parent_field: str) -> tuple[Optional[list[dict[str, Any]]], Optional[str]]:
    """Reject malformed or cross-parent reorder requests before mutating data."""
    if not isinstance(items, list) or not items:
        return None, f'items is required to reorder {entity_name}'
    seen_ids: set[str] = set()
    parent_ids: set[str] = set()
    resolved: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict) or not item.get('id'):
            return None, f'Every {entity_name} reorder item needs an id'
        item_id = str(item['id'])
        if item_id in seen_ids:
            return None, f'Duplicate {entity_name} id in reorder request'
        try:
            order_number = int(item.get('order_number'))
        except (TypeError, ValueError):
            return None, f'Every {entity_name} order_number must be a positive integer'
        if order_number < 1:
            return None, f'Every {entity_name} order_number must be a positive integer'
        stored = table.get_item(Key={f'{entity_name}_id': item_id}).get('Item')
        if not stored:
            return None, f'{entity_name.title()} not found'
        seen_ids.add(item_id)
        parent_ids.add(str(stored.get(parent_field) or ''))
        resolved.append({'id': item_id, 'order_number': order_number})
    if len(parent_ids) != 1:
        return None, f'Cannot reorder {entity_name} from different {parent_field.replace("_id", "")}s together'
    if sorted(item['order_number'] for item in resolved) != list(range(1, len(resolved) + 1)):
        return None, f'{entity_name.title()} order numbers must be contiguous starting at 1'
    return resolved, None


def reorder_chapters(body):
    items, error = validate_reorder_items(body.get('items'), TABLES['CHAPTERS'], 'chapter', 'course_id')
    if error:
        return create_response(400, {'error': error})
    for item in items:
        TABLES['CHAPTERS'].update_item(
            Key={'chapter_id': item['id']},
            UpdateExpression='SET order_number = :order',
            ExpressionAttributeValues={':order': item['order_number']},
        )
    return create_response(200, {'success': True, 'message': 'Chapters reordered'})


def reorder_lessons(body):
    items, error = validate_reorder_items(body.get('items'), TABLES['LESSONS'], 'lesson', 'chapter_id')
    if error:
        return create_response(400, {'error': error})
    for item in items:
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
    allowed_video_types = {'video/mp4', 'video/quicktime', 'video/x-quicktime'}
    if file_type not in allowed_video_types:
        return create_response(400, {'error': 'Formato video non supportato'})

    safe_name = os.path.basename(str(file_name)).replace(' ', '-')
    lesson_id = str(body.get('lesson_id') or '').strip()
    if lesson_id:
        lesson = TABLES['LESSONS'].get_item(Key={'lesson_id': lesson_id}).get('Item')
        if not lesson:
            return create_response(404, {'error': 'Lesson not found'})
        extension = os.path.splitext(safe_name)[1].lower() or '.mp4'
        asset_version = uuid.uuid4().hex
        s3_key = f"videos/{lesson_id}/{asset_version}/source{extension}"
        TABLES['LESSONS'].update_item(Key={'lesson_id':lesson_id},
            UpdateExpression='SET pending_asset_version=:version, pending_video_s3_key=:key, pending_transcode_status=:status REMOVE transcode_job_id',
            ExpressionAttributeValues={':version':asset_version, ':key':s3_key, ':status':'PENDING_UPLOAD'})
    else:
        # Backward compatible for the create-lesson form.  Existing callers
        # remain supported, while edits use the immutable versioned layout.
        asset_version = None
        s3_key = f"videos/{uuid.uuid4()}-{safe_name}"
    url = s3_client.generate_presigned_url(
        'put_object',
        Params={'Bucket': VIDEO_BUCKET, 'Key': s3_key, 'ContentType': file_type},
        ExpiresIn=3600,
    )
    return create_response(200, {
        'upload_url': url,
        'video_s3_key': s3_key,
        'asset_version': asset_version,
        'expires_at': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat().replace('+00:00', 'Z'),
    })


def get_presigned_image_upload_url(body):
    file_name = body.get('file_name')
    file_type = body.get('file_type')
    folder = (body.get('folder') or 'images').strip('/')
    if not file_name or not file_type:
        return create_response(400, {'error': 'file_name and file_type are required'})
    if file_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        return create_response(400, {'error': 'Only image uploads are allowed'})
    if folder not in {'courses', 'chapters', 'lessons'}:
        return create_response(400, {'error': 'Cartella immagine non valida'})

    safe_name = os.path.basename(str(file_name)).replace(' ', '-')
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
        # Raw ClientError messages can include the bucket name/key; log it
        # server-side only.
        print(f'delete_video error: {exc}')
        return create_response(500, {'error': 'Failed to delete video'})


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
    email = (body.get('email') or '').strip().lower()
    full_name = (body.get('full_name') or '').strip()
    if not email or not full_name:
        return create_response(400, {'error': 'email and full_name are required'})
    if not is_valid_email(email.lower()):
        return create_response(400, {'error': 'Inserisci un indirizzo email valido'})

    user_id, _, _ = ensure_cognito_student(email, full_name)
    item = {
        'user_id': user_id,
        'email': email,
        'full_name': full_name,
        'subscription_status': 'active',
        'global_access': False,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    existing = get_user_item(user_id)
    if existing:
        item['created_at'] = existing.get('created_at', item['created_at'])
        item['global_access'] = normalize_bool(existing.get('global_access', False))
    TABLES['USERS'].put_item(Item=item)
    record_audit_log('create_student', 'student', user_id, {'email': email, 'global_access': item['global_access']})
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
    if any(
        normalize_purchase_course_id(purchase) == course_id and purchase_grants_access(purchase)
        for purchase in get_user_purchases(student_id)
    ):
        return create_response(409, {'error': 'La studentessa ha già accesso attivo a questo corso'})
    
    purchase_id = f"MANUAL_{uuid.uuid4().hex[:16]}"
    purchase_item = {
        'purchase_id': purchase_id,
        'user_id': user_item['user_id'],
        'email': user_item.get('email', ''),
        'course_id': course_id,
        'course_title': course.get('title', course_id),
        'amount': Decimal('0.00'),
        'currency': 'eur',
        'status': 'paid',
        'local_status': 'paid',
        'stripe_status': 'manual_grant',
        'access_unlocked': True,
        'access_revoked': False,
        'manual_access_override': True,
        'purchase_origin': 'admin_manual',
        'webhook_status': 'not_required',
        'purchase_date': now_iso(),
        'manual_grant': True,
        # This was never a Stripe checkout, so it must not enter the
        # Stripe-session reconciliation index.
    }
    purchase_item = put_purchase(purchase_item)
    record_audit_log('grant_course', 'student', student_id, {'course_id': course_id, 'purchase_id': purchase_id})
    return create_response(200, {'success': True, 'purchase': purchase_item})


def delete_student(student_id):
    user_item = resolve_student_record(student_id)
    if not user_item:
        return create_response(404, {'error': 'Student not found'})

    # A paid/enrolled student must never lose access because an administrator
    # clicked a destructive cleanup action. Revoke or archive the relevant
    # purchase explicitly first, so the operation remains auditable.
    active_purchases = [
        purchase for purchase in get_user_purchases(user_item.get('user_id', student_id))
        if purchase_grants_access(purchase)
    ]
    if active_purchases:
        return create_response(409, {
            'error': 'Impossibile eliminare una studentessa con accessi attivi. Revoca prima gli accessi dagli ordini interessati.'
        })

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
    record_audit_log('delete_student', 'student', user_item.get('user_id', student_id), {'email': email or ''})
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
    record_audit_log('update_student', 'student', student_id, {
        'global_access': global_access,
        'subscription_status': subscription_status,
    })
    return create_response(200, {'success': True, 'data': updated_item})


def get_students(params: dict[str, Any] | None = None):
    params = params or {}
    try:
        page = max(1, int(params.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = max(1, min(200, int(params.get('per_page', 50))))
    except (TypeError, ValueError):
        per_page = 50

    users = sorted(list_student_records(), key=lambda item: item.get('created_at', ''), reverse=True)
    total = len(users)
    total_pages = max(1, math.ceil(total / per_page))
    start = (page - 1) * per_page
    page_users = users[start:start + per_page]
    items = [summarize_student(user) for user in page_users]

    return create_response(200, {
        'items': items,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
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
        course = normalize_course(courses[normalized_course_id]) if normalized_course_id in courses else None
        record = {
            **normalized,
            'course_id': normalized_course_id,
            'course_title': normalized.get('course_title') or (course.get('title', '') if course else 'Corso eliminato'),
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


def build_purchase_customer_view(purchase: dict[str, Any], user_item: dict[str, Any]) -> dict[str, Any]:
    """Describe what the paying customer can actually see right now.

    This deliberately reports the app-side access gate rather than mirroring a
    Stripe label.  It gives support one authoritative answer when a customer
    says "I paid, but I cannot see the course".
    """
    account_ready = bool(user_item)
    has_course_access = account_ready and purchase_grants_access(purchase)
    return {
        'account_ready': account_ready,
        'course_access_active': has_course_access,
        'course_access_reason': (
            'active' if has_course_access else
            'account_provisioning' if not account_ready and purchase.get('local_status') == 'paid' else
            'payment_or_access_not_active'
        ),
        'student_id': user_item.get('user_id') if account_ready else None,
    }


def get_purchase_detail(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})

    normalized = normalize_purchase(purchase)
    user_item = get_user_item(normalized.get('user_id')) if normalized.get('user_id') else {}
    course = get_course(normalized.get('course_id'))

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
    video_access_events = get_purchase_video_access_events(normalized.get('purchase_id', ''))

    return create_response(200, {
        'purchase': {
            **normalized,
            'user_email': normalized.get('customer_email') or user_item.get('email', ''),
            'user_name': user_item.get('full_name', ''),
            'course_title': normalized.get('course_title') or (course.get('title', '') if course else 'Corso eliminato'),
        },
        'customer_view': build_purchase_customer_view(normalized, user_item),
        'timeline': [entry for entry in timeline if entry.get('at')],
        'video_access_events': video_access_events,
    })


def delete_stripe_test_purchase(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})

    # Stripe Checkout IDs explicitly distinguish test and live transactions.
    # This keeps real sales immutable in the application database.
    if not str(purchase.get('stripe_session_id') or '').startswith('cs_test_'):
        return create_response(403, {'error': 'Only Stripe test purchases can be deleted'})

    TABLES['PURCHASES'].delete_item(Key={'purchase_id': purchase_id})
    return create_response(200, {'success': True, 'deleted_purchase_id': purchase_id})


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


def refund_purchase(purchase_id: str, body: dict[str, Any]):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Ordine non trovato'})

    normalized = normalize_purchase(purchase)
    if normalized['is_disputed']:
        return create_response(400, {'error': 'Non è possibile emettere un rimborso mentre il pagamento è contestato'})
    if not normalized.get('stripe_payment_intent_id'):
        return create_response(400, {'error': 'Questo ordine non è associato a un pagamento Stripe rimborsabile'})

    payment_intent = stripe.PaymentIntent.retrieve(
        normalized['stripe_payment_intent_id'], expand=['latest_charge', 'charges'],
    )
    charges = (((payment_intent or {}).get('charges') or {}).get('data')) or []
    charge_id = normalized.get('stripe_charge_id')
    charge_amount = 0
    refunded_cents = 0
    for charge in charges:
        if not charge_id or charge.get('id') == charge_id:
            charge_id = charge_id or charge.get('id')
            charge_amount = int(charge.get('amount') or 0)
            refunded_cents = max(refunded_cents, int(charge.get('amount_refunded') or 0))
    latest_charge = payment_intent.get('latest_charge') if payment_intent else None
    if not charge_id and isinstance(latest_charge, dict):
        charge_id = latest_charge.get('id')
        charge_amount = int(latest_charge.get('amount') or 0)
        refunded_cents = int(latest_charge.get('amount_refunded') or 0)
    if not charge_id:
        return create_response(400, {'error': 'Stripe non ha ancora reso disponibile l’addebito da rimborsare'})

    remaining_cents = charge_amount - refunded_cents
    if remaining_cents <= 0:
        # Stripe is the source of truth for refunds. If the local purchase is
        # stale, reconcile it before reporting the conflict so the admin UI
        # immediately stops offering a refund that cannot be issued.
        normalized.update(fetch_stripe_purchase_state(normalized))
        normalized = sync_purchase_access(normalized)
        normalized = put_purchase(normalized)
        record_audit_log('resync_refunded_purchase', 'purchase', purchase_id, {
            'refunded_amount': normalized.get('refunded_amount'),
        })
        return create_response(409, {
            'error': 'Questo pagamento è già stato rimborsato interamente',
            'already_refunded': True,
            'data': normalized,
        })

    requested_amount = body.get('amount')
    refund_args: dict[str, Any] = {
        'charge': charge_id,
        'reason': 'requested_by_customer',
        'metadata': {'purchase_id': purchase_id},
    }
    if requested_amount not in (None, ''):
        try:
            amount_cents = int((Decimal(str(requested_amount)).quantize(Decimal('0.01')) * 100))
        except Exception:
            return create_response(400, {'error': 'Inserisci un importo di rimborso valido'})
        if amount_cents <= 0 or amount_cents > remaining_cents:
            return create_response(400, {'error': 'L’importo deve essere maggiore di zero e non può superare il residuo rimborsabile'})
        if amount_cents != remaining_cents:
            refund_args['amount'] = amount_cents

    refund = stripe.Refund.create(**refund_args)
    normalized.update(fetch_stripe_purchase_state(normalized))
    normalized['refund_note'] = str(body.get('reason') or '').strip()[:500]
    normalized['refunded_by_admin'] = current_admin_email or 'admin'
    normalized['refund_id'] = refund.get('id')
    normalized = sync_purchase_access(normalized)
    normalized = put_purchase(normalized)
    record_audit_log('refund_purchase', 'purchase', purchase_id, {
        'refund_id': refund.get('id'), 'amount': refund_args.get('amount', remaining_cents) / 100,
        'note': normalized['refund_note'],
    })
    return create_response(200, {'success': True, 'data': normalized, 'refund_id': refund.get('id')})


def resync_purchase(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    purchase = remove_legacy_null_stripe_session_id(purchase)
    normalized = normalize_purchase(purchase)
    normalized.update(fetch_stripe_purchase_state(normalized))
    normalized = sync_purchase_access(normalized)
    normalized = put_purchase(normalized)
    record_audit_log('resync_purchase', 'purchase', purchase_id)
    return create_response(200, {'success': True, 'data': normalized})


def force_unlock_purchase(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    try:
        normalized = sync_purchase_access(purchase, mode='force_unlock')
    except ValueError as exc:
        return create_response(400, {'error': str(exc)})
    updated = update_purchase_with_version(purchase_id, normalized.get('version', 0), {
        'manual_access_override': normalized['manual_access_override'],
        'access_revoked': normalized['access_revoked'],
        'access_revoked_at': normalized.get('access_revoked_at'),
        'access_revocation_reason': normalized.get('access_revocation_reason', ''),
        'access_unlocked': normalized['access_unlocked'],
    })
    record_audit_log('grant_manual_access', 'purchase', purchase_id)
    return create_response(200, {'success': True, 'data': normalize_purchase(updated)})


def revoke_purchase_access(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    normalized = sync_purchase_access(purchase, mode='revoke')
    updated = update_purchase_with_version(purchase_id, normalized.get('version', 0), {
        'manual_access_override': normalized['manual_access_override'],
        'access_revoked': normalized['access_revoked'],
        'access_revoked_at': normalized.get('access_revoked_at'),
        'access_revocation_reason': normalized.get('access_revocation_reason', ''),
        'access_unlocked': normalized['access_unlocked'],
    })
    record_audit_log('revoke_access', 'purchase', purchase_id)
    return create_response(200, {'success': True, 'data': normalize_purchase(updated)})


def mark_purchase_verified(purchase_id):
    purchase = TABLES['PURCHASES'].get_item(Key={'purchase_id': purchase_id}).get('Item')
    if not purchase:
        return create_response(404, {'error': 'Purchase not found'})
    normalized = normalize_purchase(purchase)
    normalized['verified_by_admin'] = True
    updated = update_purchase_with_version(purchase_id, normalized.get('version', 0), {
        'verified_by_admin': True,
    })
    record_audit_log('verify_purchase', 'purchase', purchase_id)
    return create_response(200, {'success': True, 'data': normalize_purchase(updated)})


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
    normalized = put_purchase(normalized)
    record_audit_log('correct_purchase_email', 'purchase', purchase_id, {'from_email': previous_email, 'to_email': new_email})
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


def validate_coupon_payload(body: dict[str, Any]) -> Optional[str]:
    """Validate discount rules at write time, before they can affect checkout."""
    code = str(body.get('code') or '').strip().upper()
    if not code:
        return 'code is required'
    if not all(char.isalnum() or char in {'-', '_'} for char in code):
        return 'Il codice coupon può contenere solo lettere, numeri, trattini e underscore'
    discount_type = str(body.get('discount_type', 'percent'))
    if discount_type not in {'percent', 'fixed'}:
        return 'discount_type must be percent or fixed'
    try:
        discount_value = Decimal(str(body.get('discount_value', 0)))
    except Exception:
        return 'discount_value must be numeric'
    if discount_value < 0:
        return 'discount_value cannot be negative'
    if discount_type == 'percent' and discount_value > 100:
        return 'A percentage discount cannot exceed 100'
    max_redemptions = body.get('max_redemptions')
    if max_redemptions not in (None, ''):
        try:
            if int(max_redemptions) < 1:
                return 'max_redemptions must be at least 1'
        except (TypeError, ValueError):
            return 'max_redemptions must be an integer'
    starts_at = parse_iso_datetime(body.get('starts_at'))
    expires_at = parse_iso_datetime(body.get('expires_at'))
    if body.get('starts_at') and not starts_at:
        return 'starts_at is not a valid date'
    if body.get('expires_at') and not expires_at:
        return 'expires_at is not a valid date'
    if starts_at and expires_at and expires_at <= starts_at:
        return 'expires_at must be after starts_at'
    emails = body.get('allowed_user_emails') or []
    if not isinstance(emails, list) or any(not is_valid_email(str(email).strip().lower()) for email in emails):
        return 'allowed_user_emails must contain valid email addresses'
    scope = body.get('course_scope') or []
    if not isinstance(scope, list):
        return 'course_scope must be a list'
    return None


def create_coupon(body):
    code = (body.get('code') or '').strip().upper()
    validation_error = validate_coupon_payload(body)
    if validation_error:
        return create_response(400, {'error': validation_error})
    if get_coupon(code):
        return create_response(409, {'error': 'Esiste già un coupon con questo codice'})

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
    try:
        TABLES['COUPONS'].put_item(Item=item, ConditionExpression='attribute_not_exists(coupon_id)')
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
            return create_response(409, {'error': 'Esiste già un coupon con questo codice'})
        raise
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

    validation_error = validate_coupon_payload(updated)
    if validation_error:
        return create_response(400, {'error': validation_error})
    if updated['coupon_id'] != coupon_id and get_coupon(updated['coupon_id']):
        return create_response(409, {'error': 'Esiste già un coupon con questo codice'})

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
    if not is_valid_email(email):
        return create_response(400, {'error': 'Inserisci un indirizzo email valido'})

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
    courses = {course['course_id']: normalize_course(course) for course in list_all_items(TABLES['COURSES'])}
    chapters = {chapter['chapter_id']: chapter for chapter in list_all_items(TABLES['CHAPTERS'])}
    lessons = {lesson['lesson_id']: lesson for lesson in list_all_items(TABLES['LESSONS'])}
    now = datetime.now(timezone.utc)
    today = now.date()
    week_ago = today - timedelta(days=6)
    month_ago = today - timedelta(days=29)

    total_revenue = Decimal('0')
    revenue_last_30_days = Decimal('0')
    new_purchases_today = 0
    new_purchases_week = 0
    new_purchases_month = 0
    recent_purchases = []
    attention_items = []
    enrolled_by_course = {}
    for purchase in sorted(purchases, key=lambda item: item.get('purchase_date', ''), reverse=True):
        normalized = normalize_purchase(purchase)
        normalized_amount = normalize_amount(normalized.get('amount_gross', normalized.get('amount', 0)))
        net_amount = max(Decimal('0'), normalized_amount - normalized['refunded_amount'])
        purchase_date = parse_iso_datetime(normalized.get('purchase_date') or normalized.get('created_at'))
        if normalized['local_status'] == 'paid':
            total_revenue += net_amount
            if purchase_date and purchase_date.date() >= month_ago:
                revenue_last_30_days += net_amount
        if purchase_date:
            if purchase_date.date() == today:
                new_purchases_today += 1
            if purchase_date.date() >= week_ago:
                new_purchases_week += 1
            if purchase_date.date() >= month_ago:
                new_purchases_month += 1

        course_id = normalize_purchase_course_id(normalized)
        if purchase_grants_access(normalized) and normalized.get('user_id'):
            enrolled_by_course.setdefault(course_id, set()).add(normalized['user_id'])

        if normalized['local_status'] == 'paid' and not purchase_grants_access(normalized):
            attention_items.append({
                'id': f"access-{normalized.get('purchase_id')}", 'severity': 'urgent',
                'title': 'Pagamento ricevuto, ma accesso non attivo',
                'description': f"{normalized.get('customer_email') or 'Cliente'} ha pagato ma non può accedere al corso.",
                'action_label': 'Apri ordine', 'action_url': f"/admin/purchases/{normalized.get('purchase_id')}",
            })
        elif normalized['local_status'] in {'pending', 'failed', 'needs_review', 'disputed'}:
            labels = {
                'pending': 'Pagamento in attesa', 'failed': 'Pagamento non riuscito',
                'needs_review': 'Pagamento da verificare', 'disputed': 'Pagamento contestato',
            }
            attention_items.append({
                'id': f"payment-{normalized.get('purchase_id')}", 'severity': 'urgent' if normalized['local_status'] == 'disputed' else 'attention',
                'title': labels[normalized['local_status']],
                'description': f"Controlla l’ordine di {normalized.get('customer_email') or 'una cliente'} prima di intervenire sull’accesso.",
                'action_label': 'Controlla ordine', 'action_url': f"/admin/purchases/{normalized.get('purchase_id')}",
            })
        elif normalized['webhook_status'] == 'not_received':
            attention_items.append({
                'id': f"webhook-{normalized.get('purchase_id')}", 'severity': 'attention',
                'title': 'Ordine senza conferma automatica',
                'description': f"Non è arrivata la conferma automatica per {normalized.get('customer_email') or 'questa cliente'}.",
                'action_label': 'Controlla ordine', 'action_url': f"/admin/purchases/{normalized.get('purchase_id')}",
            })

        if len(recent_purchases) < 5:
            recent_purchases.append({
                'purchase_id': normalized.get('purchase_id'),
                'user_email': normalized.get('customer_email', ''),
                'amount': net_amount,
                'purchase_date': normalized.get('purchase_date', ''),
                'status': normalized['local_status'],
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

    valid_views = {lid: views for lid, views in views_by_lesson.items() if lid in lessons}
    most_viewed_lessons = []
    for lesson_id, views in sorted(valid_views.items(), key=lambda item: item[1], reverse=True)[:5]:
        lesson = lessons.get(lesson_id)
        most_viewed_lessons.append({
            'lesson_id': lesson_id,
            'title': lesson.get('title', 'Unknown lesson'),
            'views': views,
        })

    daily_access_chart = []
    for offset in range(6, -1, -1):
        day = (today.fromordinal(today.toordinal() - offset)).isoformat()
        daily_access_chart.append({
            'date': day,
            'active_users': len(activity_by_day.get(day, set())),
        })

    active_students = set()
    for user in users:
        if user_has_global_access(user):
            active_students.add(user.get('user_id'))
    for enrolled in enrolled_by_course.values():
        active_students.update(enrolled)

    lesson_course_ids = {
        lesson_id: chapters.get(lesson.get('chapter_id'), {}).get('course_id')
        for lesson_id, lesson in lessons.items()
    }
    course_progress = {}
    active_users_by_course = {}
    active_user_ids_last_7_days = set()
    orphaned_progress = 0
    for item in progress_items:
        lesson_id = item.get('lesson_id')
        course_id = lesson_course_ids.get(lesson_id)
        if not course_id:
            if lesson_id:
                orphaned_progress += 1
            continue
        percent = 100 if item.get('completed') else int(item.get('progress_percent', 0) or 0)
        course_progress.setdefault(course_id, []).append(percent)
        watched_at = parse_iso_datetime(item.get('last_watched'))
        if watched_at and watched_at.date() >= week_ago and item.get('user_id'):
            active_user_ids_last_7_days.add(item['user_id'])
            active_users_by_course.setdefault(course_id, set()).add(item['user_id'])

    if orphaned_progress:
        attention_items.append({
            'id': 'orphaned-progress', 'severity': 'attention',
            'title': 'Attività collegate a lezioni non più presenti',
            'description': f"Ci sono {orphaned_progress} registrazioni da verificare: alcune lezioni potrebbero essere state rimosse o modificate.",
            'action_label': 'Apri catalogo corsi', 'action_url': '/admin/course',
        })

    course_health = []
    for course_id, course in courses.items():
        progress = course_progress.get(course_id, [])
        course_health.append({
            'course_id': course_id,
            'title': course.get('title') or 'Corso senza titolo',
            'enrolled_students': len(enrolled_by_course.get(course_id, set())),
            'active_students_last_7_days': len(active_users_by_course.get(course_id, set())),
            'average_completion_rate': round(sum(progress) / len(progress), 1) if progress else 0,
        })
    course_health.sort(key=lambda course: (course['enrolled_students'], course['active_students_last_7_days']), reverse=True)

    return create_response(200, {
        'total_students': len(users),
        'active_students': len(active_students),
        'total_revenue': total_revenue,
        'revenue_last_30_days': revenue_last_30_days,
        'new_purchases_today': new_purchases_today,
        'new_purchases_week': new_purchases_week,
        'new_purchases_month': new_purchases_month,
        'active_students_last_7_days': len(active_user_ids_last_7_days),
        'total_video_views': total_video_views,
        'average_completion_rate': round(total_completion_percent / total_video_views, 1) if total_video_views else 0,
        'most_viewed_lessons': most_viewed_lessons,
        'recent_purchases': recent_purchases,
        'daily_access_chart': daily_access_chart,
        'attention_items': attention_items[:6],
        'course_health': course_health,
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
    'AUDIT_LOGS': os.environ.get('AUDIT_LOGS_TABLE'),
    'VIDEO_ACCESS_LOGS': os.environ.get('VIDEO_ACCESS_LOGS_TABLE'),
}
TABLES = {name: dynamodb.Table(table_name) for name, table_name in TABLE_NAMES.items() if table_name}

VIDEO_BUCKET = os.environ.get('VIDEO_BUCKET')
THUMBNAIL_BUCKET = os.environ.get('THUMBNAIL_BUCKET')
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
current_params = {}
current_admin_email = ''


def lambda_handler(event, context):
    del context
    global current_params, current_admin_email
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if not is_admin(event):
        return create_response(403, {'error': 'Admin privileges required'})

    body = json.loads(event.get('body') or '{}')
    current_admin_email = get_current_admin_email(event)
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
        # These static routes must be checked before the generic
        # /admin/course/{courseId} route below. Otherwise API Gateway sends no
        # courseId for "reorder-lessons" and it is incorrectly treated as a
        # course update, yielding the misleading "Course not found" response.
        if path == '/admin/course/reorder-chapters' and http_method == 'PUT':
            return reorder_chapters(body)
        if path == '/admin/course/reorder-lessons' and http_method == 'PUT':
            return reorder_lessons(body)
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
            return get_students(params)
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
        if path.startswith('/admin/purchase/') and path.endswith('/refund') and http_method == 'POST':
            return refund_purchase(path_parameters.get('purchaseId'), body)
        if path.startswith('/admin/purchase/') and path.endswith('/mark-verified') and http_method == 'POST':
            return mark_purchase_verified(path_parameters.get('purchaseId'))
        if path.startswith('/admin/purchase/') and path.endswith('/correct-email') and http_method == 'POST':
            return correct_purchase_email(
                path_parameters.get('purchaseId'),
                body,
                get_current_admin_email(event),
            )
        if path.startswith('/admin/purchase/') and http_method == 'DELETE':
            return delete_stripe_test_purchase(path_parameters.get('purchaseId'))
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
    except PurchaseVersionConflict as exc:
        return create_response(409, {'error': str(exc), 'code': 'stale_version'})
    except ValueError as exc:
        # A plain ValueError is normal input/business-rule validation
        # (e.g. "Cannot grant access to a refunded purchase") raised by any
        # handler function - it must not be mislabeled as a version conflict.
        return create_response(400, {'error': str(exc)})
    except Exception as exc:
        # Never leak the raw exception text: it can be a boto3 ClientError or
        # a Cognito error carrying internal AWS resource identifiers.
        print(f'admin handler error: {exc}')
        return create_response(500, {'error': 'Internal server error'})
