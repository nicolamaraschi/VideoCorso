import json
import os
import secrets
import hashlib
import string
import time
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Optional
from urllib.parse import urlparse

import boto3
import stripe
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Shared layer (fail-closed access policy)
# ---------------------------------------------------------------------------
from shared.purchase_access import (
    purchase_grants_access as _shared_purchase_grants_access,
    sync_purchase_access as _shared_sync_purchase_access,
)

# ---------------------------------------------------------------------------
# Fields that a Stripe webhook is allowed to update on an existing purchase.
# Admin-set fields (access_revoked, manual_access_override, etc.) are NEVER
# touched by an incoming webhook, even on a replay.
# ---------------------------------------------------------------------------
_STRIPE_ALLOWLIST: frozenset[str] = frozenset({
    'stripe_status',
    'stripe_session_id',
    'stripe_payment_intent_id',
    'stripe_charge_id',
    'amount',
    'amount_gross',
    'currency',
    'paid_at',
    'webhook_status',
    'webhook_received_at',
    'refunded_amount',
    'refund_status',
    'refund_type',
    'refunded_at',
    'is_disputed',
    'local_status',
    'updated_at',
    'payment_intent_event_at',
    'charge_event_at',
    'refund_event_at',
    'dispute_event_at',
    'dispute_event_at_by_id',
    'active_dispute_ids',
    'lost_dispute_ids',
    'dispute_id',
    'dispute_status',
})

_TERMINAL_STRIPE_STATUSES = frozenset({'refunded', 'disputed'})


LEGACY_COURSE_ID = 'legacy-default-course'
ALLOWED_LOCAL_STATUSES = {'pending', 'paid', 'failed', 'refunded', 'disputed', 'cancelled', 'needs_review'}
# Bump this only together with the published terms/policy.  The value is
# stored both locally and in Stripe Checkout metadata as dispute evidence.
TERMS_VERSION = '2026-08-10'


class CouponValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class PurchaseVersionConflict(RuntimeError):
    """A concurrent webhook changed the purchase after it was read.

    This is deliberately distinct from a duplicate Stripe event.  The caller
    must re-read, re-evaluate stream freshness and re-merge before retrying.
    """

ssm_client = boto3.client('ssm')
_secret_cache: dict[str, str] = {}


def get_secure_parameter(name: str) -> str:
    """Read and cache one SecureString without ever logging its value."""
    if name in _secret_cache:
        return _secret_cache[name]
    try:
        response = ssm_client.get_parameter(Name=name, WithDecryption=True)
    except ClientError as exc:
        print(f'Required secure parameter unavailable: {name}')
        raise RuntimeError(f'Required secure parameter unavailable: {name}') from exc
    value = response['Parameter']['Value']
    _secret_cache[name] = value
    return value


def get_configured_secret(parameter_env_name: str, legacy_env_name: str) -> str:
    parameter_name = os.environ.get(parameter_env_name)
    if parameter_name:
        return get_secure_parameter(parameter_name)
    legacy_value = os.environ.get(legacy_env_name)
    if legacy_value:
        return legacy_value
    print(f'Required secure parameter unavailable: {parameter_env_name}')
    raise RuntimeError(f'Required secure parameter unavailable: {parameter_env_name}')


def configure_stripe() -> None:
    stripe.api_key = get_configured_secret('STRIPE_SECRET_KEY_PARAMETER', 'STRIPE_SECRET_KEY')


def get_webhook_secret() -> str:
    return get_configured_secret('STRIPE_WEBHOOK_SECRET_PARAMETER', 'STRIPE_WEBHOOK_SECRET')

dynamodb = boto3.resource('dynamodb')
dynamodb_client = boto3.client('dynamodb')
_serializer = TypeSerializer()
cognito_client = boto3.client('cognito-idp')

users_table = dynamodb.Table(os.environ.get('USERS_TABLE'))
purchases_table = dynamodb.Table(os.environ.get('PURCHASES_TABLE'))
courses_table = dynamodb.Table(os.environ.get('COURSES_TABLE'))
coupons_table = dynamodb.Table(os.environ.get('COUPONS_TABLE'))
webhook_events_table = dynamodb.Table(os.environ.get('WEBHOOK_EVENTS_TABLE'))
checkout_requests_table = dynamodb.Table(os.environ.get('CHECKOUT_REQUESTS_TABLE'))
coupon_reservations_table = dynamodb.Table(os.environ.get('COUPON_RESERVATIONS_TABLE'))
provisioning_outbox_table = dynamodb.Table(os.environ.get('PROVISIONING_OUTBOX_TABLE'))

COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
ALLOWED_CHECKOUT_ORIGINS = {
    origin.strip().rstrip('/')
    for origin in os.environ.get('ALLOWED_CHECKOUT_ORIGINS', '').split(',')
    if origin.strip()
}

try:
    import resend
except ImportError:
    resend = None


def create_response(status_code: int, body: Any):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps(body),
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def ttl_epoch(days: int) -> int:
    """DynamoDB TTL values are epoch seconds, never ISO timestamps."""
    return int((datetime.now(timezone.utc) + timedelta(days=days)).timestamp())


def coupon_reservation_id(checkout_request_id: str) -> str:
    return f"reservation-{hashlib.sha256(checkout_request_id.encode('utf-8')).hexdigest()[:32]}"


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


def checkout_acceptance(body: dict[str, Any]) -> dict[str, Any]:
    """Validate and timestamp the explicit acknowledgements required to buy.

    The browser checkbox is only UX; this server-side check prevents callers
    from creating a Checkout Session without the same recorded evidence.
    """
    if not normalize_bool(body.get('terms_accepted')):
        raise ValueError('Terms acceptance is required')
    if not normalize_bool(body.get('digital_content_consent')):
        raise ValueError('Digital content consent is required')
    if str(body.get('terms_version') or '') != TERMS_VERSION:
        raise ValueError('Terms version is missing or out of date; refresh the checkout page')
    accepted_at = now_iso()
    return {
        'terms_accepted': True,
        'terms_version': TERMS_VERSION,
        'terms_accepted_at': accepted_at,
        'digital_content_consent': True,
        'digital_content_consent_at': accepted_at,
    }


def decimal_to_number(value: Any) -> float:
    if value is None:
        return 0.0
    return float(Decimal(str(value)))


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return f'{password}A1!'


def send_welcome_email(email: str, temp_password: str, course_title: str):
    allowed_recipients = {
        recipient.strip().lower()
        for recipient in os.environ.get('RESEND_TEST_RECIPIENTS', '').split(',')
        if recipient.strip()
    }
    if email.strip().lower() not in allowed_recipients:
        print('Welcome email skipped: recipient is not in the pre-live test allowlist.')
        return False
    if not resend:
        print('Welcome email skipped: Resend library unavailable.')
        return False
    try:
        resend.api_key = get_configured_secret('RESEND_API_KEY_PARAMETER', 'RESEND_API_KEY')
    except RuntimeError:
        # Account creation is already complete; an absent email secret must
        # not make payment or webhook processing unavailable.
        print('Welcome email skipped: Resend credential unavailable.')
        return False

    try:
        resend.Emails.send({
            'from': 'Team VideoCorso <onboarding@resend.dev>',
            'to': email,
            'subject': f'Accesso attivato: {course_title}',
            'html': (
                '<h1>Benvenuto!</h1>'
                f'<p>Il tuo acquisto per <strong>{course_title}</strong> e stato confermato.</p>'
                '<p>Ecco le tue credenziali temporanee:</p>'
                f'<p>Email: {email}<br />Password temporanea: {temp_password}</p>'
                '<p>Ti verra chiesto di cambiare password al primo accesso.</p>'
            ),
        })
        return True
    except Exception as exc:
        print(f'Email send failed: {exc}')
        return False


def ensure_legacy_course():
    response = courses_table.get_item(Key={'course_id': LEGACY_COURSE_ID})
    item = response.get('Item')
    if item:
        return item

    course = {
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
    courses_table.put_item(Item=course)
    return course


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
    if 'discounted_price' in normalized and normalized.get('discounted_price') not in (None, ''):
        normalized['discounted_price'] = Decimal(str(normalized['discounted_price']))
    return normalized


def get_course(course_ref: Optional[str]):
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


def is_publicly_visible(course: dict[str, Any]) -> bool:
    status = str(course.get('status', 'hidden'))
    return status == 'published'


def is_purchasable_course(course: dict[str, Any]) -> bool:
    return is_publicly_visible(course) and normalize_bool(course.get('is_purchasable', False))


def get_checkout_course(course_ref: Optional[str]):
    return get_course(course_ref)


def get_course_effective_price(course: dict[str, Any]) -> Decimal:
    if course.get('discounted_price') not in (None, ''):
        return Decimal(str(course['discounted_price']))
    return Decimal(str(course.get('price', 0)))


def normalize_price_to_cents(price_value: Any) -> int:
    price = Decimal(str(price_value or 0))
    return max(int((price * 100).quantize(Decimal('1'))), 0)


def get_existing_user_from_cognito(email: str):
    try:
        response = cognito_client.admin_get_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
        )
        attributes = {item['Name']: item['Value'] for item in response.get('UserAttributes', [])}
        return {
            'user_id': attributes.get('sub'),
            'email': email,
            'full_name': attributes.get('custom:full_name', ''),
        }
    except cognito_client.exceptions.UserNotFoundException:
        return None


def ensure_cognito_user(email: str, full_name: str, course_title: str):
    existing = get_existing_user_from_cognito(email)
    if existing:
        attributes = [{'Name': 'custom:subscription_status', 'Value': 'active'}]
        if full_name:
            attributes.append({'Name': 'custom:full_name', 'Value': full_name})
        cognito_client.admin_update_user_attributes(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
            UserAttributes=attributes,
        )
        return existing['user_id'], False

    temp_password = generate_temp_password()
    response = cognito_client.admin_create_user(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        TemporaryPassword=temp_password,
        UserAttributes=[
            {'Name': 'email', 'Value': email},
            {'Name': 'custom:subscription_status', 'Value': 'active'},
            *([{'Name': 'custom:full_name', 'Value': full_name}] if full_name else []),
        ],
        DesiredDeliveryMediums=['EMAIL'],
        MessageAction='SUPPRESS',
    )
    cognito_client.admin_add_user_to_group(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        GroupName='students',
    )
    user_id = next(item['Value'] for item in response['User']['Attributes'] if item['Name'] == 'sub')
    send_welcome_email(email, temp_password, course_title)
    return user_id, True


def upsert_user_record(user_id: str, email: str, full_name: str):
    existing = users_table.get_item(Key={'user_id': user_id}).get('Item') or {}
    item = {
        'user_id': user_id,
        'email': email,
        'full_name': full_name or existing.get('full_name', ''),
        'subscription_status': existing.get('subscription_status', 'active'),
        'global_access': existing.get('global_access', False),
        'created_at': existing.get('created_at', now_iso()),
        'updated_at': now_iso(),
    }
    users_table.put_item(Item=item)
    return item


def get_coupon(code: Optional[str]):
    if not code:
        return None
    normalized_code = str(code).strip().upper()
    if not normalized_code:
        return None

    response = coupons_table.get_item(Key={'coupon_id': normalized_code})
    item = response.get('Item')
    if item:
        return item

    for coupon in list_all_items(coupons_table):
        if str(coupon.get('code', '')).upper() == normalized_code:
            return coupon
    return None


def coupon_is_valid_for_checkout(coupon: dict[str, Any], course: dict[str, Any], email: Optional[str]):
    if not coupon:
        return False, 'coupon_not_found'

    if not normalize_bool(coupon.get('is_active', False)):
        return False, 'coupon_disabled'

    starts_at = parse_iso_datetime(coupon.get('starts_at'))
    expires_at = parse_iso_datetime(coupon.get('expires_at'))
    now = datetime.now(timezone.utc)
    if starts_at and starts_at > now:
        return False, 'coupon_not_active_yet'
    if expires_at and expires_at < now:
        return False, 'coupon_expired'

    current_redemptions = int(coupon.get('current_redemptions', 0))
    max_redemptions = coupon.get('max_redemptions')
    if max_redemptions not in (None, '') and current_redemptions >= int(max_redemptions):
        return False, 'coupon_exhausted'

    course_scope = coupon.get('course_scope') or []
    if course_scope:
        if isinstance(course_scope, str):
            scope_values = [course_scope]
        else:
            scope_values = [str(value) for value in course_scope]
        if course.get('course_id') not in scope_values and course.get('public_slug') not in scope_values:
            return False, 'coupon_not_applicable'

    allowed_emails = coupon.get('allowed_user_emails') or []
    if allowed_emails:
        normalized_email = (email or '').strip().lower()
        scope_emails = [str(value).strip().lower() for value in allowed_emails]
        if normalized_email not in scope_emails:
            return False, 'coupon_not_applicable'

    return True, ''


def compute_discounted_total(course: dict[str, Any], coupon: Optional[dict[str, Any]]):
    base_price = get_course_effective_price(course)
    if not coupon:
        return base_price

    discount_type = str(coupon.get('discount_type', 'percent'))
    discount_value = Decimal(str(coupon.get('discount_value', 0)))
    if normalize_bool(coupon.get('is_free_access', False)):
        return Decimal('0')
    if discount_type == 'fixed':
        return max(base_price - discount_value, Decimal('0'))
    percentage = max(min(discount_value, Decimal('100')), Decimal('0'))
    return max(base_price - ((base_price * percentage) / Decimal('100')), Decimal('0'))


def build_coupon_snapshot(coupon: Optional[dict[str, Any]]):
    if not coupon:
        return None
    return {
        'code': coupon.get('code') or coupon.get('coupon_id'),
        'discount_type': coupon.get('discount_type'),
        'discount_value': decimal_to_number(coupon.get('discount_value', 0)),
        'is_free_access': normalize_bool(coupon.get('is_free_access', False)),
    }


def increment_coupon_redemption(coupon: Optional[dict[str, Any]]) -> bool:
    if not coupon:
        return True
    coupon_id = coupon.get('coupon_id') or coupon.get('code')
    names = {'#count': 'current_redemptions'}
    values = {':one': 1, ':updated': now_iso()}
    update_kwargs = {
        'Key': {'coupon_id': coupon_id},
        'UpdateExpression': 'ADD #count :one SET updated_at = :updated',
        'ExpressionAttributeNames': names,
        'ExpressionAttributeValues': values,
    }
    max_redemptions = coupon.get('max_redemptions')
    if max_redemptions not in (None, ''):
        values[':max'] = int(max_redemptions)
        update_kwargs['ConditionExpression'] = 'attribute_not_exists(#count) OR #count < :max'
    try:
        coupons_table.update_item(**update_kwargs)
        return True
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
            return False
        raise


def redeem_free_coupon_atomically(purchase: dict[str, Any], coupon: dict[str, Any],
                                  provisioning_outbox: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Create one deterministic free purchase and consume one coupon redemption.

    The coupon Update owns all coupon conditions; the purchase Put owns retry
    idempotency. A retry returns the already-created purchase without another
    increment.
    """
    # coupon_id is the DynamoDB key and must retain its stored case; the code
    # itself is normalized separately for deterministic purchase IDs.
    coupon_id = str(coupon.get('coupon_id') or coupon.get('code') or '')
    if not coupon_id:
        raise ValueError('Coupon non trovato')
    purchase_id = purchase['purchase_id']
    existing = purchases_table.get_item(Key={'purchase_id': purchase_id}, ConsistentRead=True).get('Item')
    if existing:
        return normalize_purchase_defaults(existing)

    now = now_iso()
    names = {
        '#count': 'current_redemptions', '#active': 'is_active', '#starts': 'starts_at',
        '#expires': 'expires_at', '#scope': 'course_scope', '#emails': 'allowed_user_emails',
        '#updated': 'updated_at', '#slots': 'redemption_slots_used',
    }
    values = {
        ':one': 1, ':now': now, ':true': True, ':course': purchase['course_id'],
        ':email': str(purchase['customer_email']).lower(), ':slug': str(purchase.get('course_slug') or purchase['course_id']),
        ':zero': 0, ':initial_slots': int(coupon.get('current_redemptions', 0) or 0),
    }
    conditions = [
        'attribute_exists(coupon_id)', '#active = :true',
        '(attribute_not_exists(#starts) OR #starts <= :now)',
        '(attribute_not_exists(#expires) OR #expires >= :now)',
        '(attribute_not_exists(#scope) OR size(#scope) = :zero OR contains(#scope, :course) OR contains(#scope, :slug))',
        '(attribute_not_exists(#emails) OR size(#emails) = :zero OR contains(#emails, :email))',
    ]
    if coupon.get('max_redemptions') not in (None, ''):
        values[':max'] = int(coupon['max_redemptions'])
        conditions.append('(attribute_not_exists(#slots) OR #slots < :max)')
    transaction = [
        {'Update': {
            'TableName': coupons_table.name,
            'Key': serialize_item({'coupon_id': coupon_id}),
            'UpdateExpression': 'ADD #count :one SET #slots = if_not_exists(#slots, :initial_slots) + :one, #updated = :now',
            'ConditionExpression': ' AND '.join(conditions),
            'ExpressionAttributeNames': names,
            'ExpressionAttributeValues': serialize_item(values),
        }},
        {'Put': {
            'TableName': purchases_table.name,
            'Item': serialize_item(normalize_purchase_defaults(purchase)),
            'ConditionExpression': 'attribute_not_exists(purchase_id)',
        }},
    ]
    if provisioning_outbox:
        transaction.append({'Put': {
            'TableName': provisioning_outbox_table.name,
            'Item': serialize_item(provisioning_outbox),
            'ConditionExpression': 'attribute_not_exists(outbox_id)',
        }})
    try:
        dynamodb_client.transact_write_items(TransactItems=transaction)
        return purchase
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'TransactionCanceledException':
            # A peer can win the transaction just after this invocation's
            # cancellation is decided.  A bounded consistent-read retry turns
            # that narrow window into the intended idempotent success.
            for attempt in range(3):
                existing = purchases_table.get_item(Key={'purchase_id': purchase_id}, ConsistentRead=True).get('Item')
                if existing:
                    return normalize_purchase_defaults(existing)
                if attempt < 2:
                    time.sleep(0.025)
            raise ValueError('Coupon non più utilizzabile') from exc
        raise


def reserve_coupon_for_paid_checkout(checkout_request_id: str, fingerprint: str, coupon: dict[str, Any],
                                     course: dict[str, Any], email: str, total: Decimal,
                                     acceptance: dict[str, Any]) -> dict[str, Any]:
    """Atomically reserve a coupon before the Stripe Checkout Session exists.

    A reservation consumes a separate capacity slot, never
    ``current_redemptions``.  Stripe completion consumes it; expiry/recovery
    releases it.  The request row remains the durable browser idempotency key.
    """
    existing = checkout_requests_table.get_item(
        Key={'checkout_request_id': checkout_request_id}, ConsistentRead=True,
    ).get('Item')
    if existing:
        if existing.get('fingerprint') != fingerprint:
            raise ValueError('checkout_request_id already belongs to a different checkout')
        return existing

    coupon_id = str(coupon.get('coupon_id') or coupon.get('code') or '')
    now = now_iso()
    reservation_id = coupon_reservation_id(checkout_request_id)
    reservation_expires_epoch = int(time.time()) + 30 * 60
    names = {
        '#active': 'is_active', '#starts': 'starts_at',
        '#expires': 'expires_at', '#scope': 'course_scope', '#emails': 'allowed_user_emails', '#updated': 'updated_at',
        '#slots': 'redemption_slots_used', '#pending': 'pending_redemptions',
    }
    values = {
        ':one': 1, ':now': now, ':true': True, ':course': course['course_id'],
        ':slug': str(course.get('public_slug') or course['course_id']), ':email': email.lower(), ':zero': 0,
        ':initial_slots': int(coupon.get('current_redemptions', 0) or 0),
    }
    conditions = [
        'attribute_exists(coupon_id)', '#active = :true',
        '(attribute_not_exists(#starts) OR #starts <= :now)',
        '(attribute_not_exists(#expires) OR #expires >= :now)',
        '(attribute_not_exists(#scope) OR size(#scope) = :zero OR contains(#scope, :course) OR contains(#scope, :slug))',
        '(attribute_not_exists(#emails) OR size(#emails) = :zero OR contains(#emails, :email))',
    ]
    if coupon.get('max_redemptions') not in (None, ''):
        values[':max'] = int(coupon['max_redemptions'])
        conditions.append('(attribute_not_exists(#slots) OR #slots < :max)')
    request = {
        'checkout_request_id': checkout_request_id, 'fingerprint': fingerprint,
        'course_id': course['course_id'], 'customer_email': email.lower(),
        'coupon_code': coupon_id, 'coupon_reserved': True, 'reservation_id': reservation_id,
        'amount_gross': Decimal(str(total)), 'status': 'RESERVED', 'created_at': now,
        'ttl_expires_at': ttl_epoch(7),
        **acceptance,
    }
    reservation = {
        'reservation_id': reservation_id, 'checkout_request_id': checkout_request_id,
        'coupon_id': coupon_id, 'course_id': course['course_id'], 'customer_email': email.lower(),
        'status': 'RESERVED', 'reserved_at': now, 'expires_at_epoch': reservation_expires_epoch,
        # Keep the record long enough for the scheduled recovery to release
        # capacity even if EventBridge is delayed.
        'ttl_expires_at': reservation_expires_epoch + 7 * 24 * 60 * 60,
    }
    try:
        dynamodb_client.transact_write_items(TransactItems=[
            {'Update': {
                'TableName': coupons_table.name, 'Key': serialize_item({'coupon_id': coupon_id}),
                'UpdateExpression': (
                    'SET #slots = if_not_exists(#slots, :initial_slots) + :one, '
                    '#pending = if_not_exists(#pending, :zero) + :one, #updated = :now'
                ),
                'ConditionExpression': ' AND '.join(conditions),
                'ExpressionAttributeNames': names, 'ExpressionAttributeValues': serialize_item(values),
            }},
            {'Put': {
                'TableName': checkout_requests_table.name, 'Item': serialize_item(request),
                'ConditionExpression': 'attribute_not_exists(checkout_request_id)',
            }},
            {'Put': {
                'TableName': coupon_reservations_table.name, 'Item': serialize_item(reservation),
                'ConditionExpression': 'attribute_not_exists(reservation_id)',
            }},
        ])
        return request
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'TransactionCanceledException':
            existing = checkout_requests_table.get_item(
                Key={'checkout_request_id': checkout_request_id}, ConsistentRead=True,
            ).get('Item')
            if existing and existing.get('fingerprint') == fingerprint:
                return existing
            raise CouponValidationError('coupon_unavailable', 'Coupon non più disponibile') from exc
        raise


def claim_checkout_session_creation(checkout_request_id: str, fingerprint: str, request_fields: dict[str, Any]) -> dict[str, Any]:
    """Acquire the short lease that permits one Stripe Session.create call.

    Stripe's idempotency key remains a second line of defence, but requests
    sharing a browser checkout_request_id converge in DynamoDB first:
    RESERVED -> CREATING_SESSION -> SESSION_CREATED.
    """
    claim_token = hashlib.sha256(f'{checkout_request_id}:{fingerprint}'.encode('utf-8')).hexdigest()
    for _attempt in range(3):
        now = now_iso()
        lease_expires_at = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat().replace('+00:00', 'Z')
        existing = checkout_requests_table.get_item(
            Key={'checkout_request_id': checkout_request_id}, ConsistentRead=True,
        ).get('Item')
        if not existing:
            reserved = {
                'checkout_request_id': checkout_request_id,
                'fingerprint': fingerprint,
                'status': 'RESERVED',
                'created_at': now,
                **request_fields,
            }
            try:
                checkout_requests_table.put_item(
                    Item=reserved,
                    ConditionExpression='attribute_not_exists(checkout_request_id)',
                )
            except ClientError as exc:
                if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
                    raise
            continue
        if existing.get('fingerprint') != fingerprint:
            raise ValueError('checkout_request_id already belongs to a different checkout')
        if existing.get('status') == 'SESSION_CREATED' and existing.get('stripe_session_id'):
            return {'state': 'SESSION_CREATED', 'request': existing}
        status = existing.get('status') or 'RESERVED'
        lease = parse_iso_datetime(existing.get('session_lease_expires_at'))
        lease_expired = lease is None or lease <= datetime.now(timezone.utc)
        if status == 'RESERVED' or (status == 'CREATING_SESSION' and lease_expired):
            try:
                checkout_requests_table.update_item(
                    Key={'checkout_request_id': checkout_request_id},
                    UpdateExpression=(
                        'SET #status = :creating, session_claim_token = :token, '
                        'session_lease_expires_at = :lease, session_claimed_at = :now'
                    ),
                    ConditionExpression=(
                        'fingerprint = :fingerprint AND '
                        '(#status = :reserved OR (#status = :creating AND session_lease_expires_at <= :now))'
                    ),
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={
                        ':fingerprint': fingerprint, ':reserved': 'RESERVED', ':creating': 'CREATING_SESSION',
                        ':token': claim_token, ':lease': lease_expires_at, ':now': now,
                    },
                )
                return {'state': 'CLAIMED', 'claim_token': claim_token}
            except ClientError as exc:
                if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
                    raise
                continue
        return {'state': 'CREATING_SESSION', 'request': existing}
    return {'state': 'CREATING_SESSION'}


def finish_checkout_session_claim(checkout_request_id: str, fingerprint: str, claim_token: str, session: Any) -> dict[str, Any]:
    """Publish the Stripe session only if this invocation still owns its lease."""
    try:
        checkout_requests_table.update_item(
            Key={'checkout_request_id': checkout_request_id},
            UpdateExpression=(
                'SET stripe_session_id = :session, checkout_url = :url, #status = :completed, '
                'session_completed_at = :now REMOVE session_lease_expires_at'
            ),
            ConditionExpression='fingerprint = :fingerprint AND #status = :creating AND session_claim_token = :token',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':session': session.id, ':url': session.url, ':completed': 'SESSION_CREATED',
                ':now': now_iso(), ':fingerprint': fingerprint, ':creating': 'CREATING_SESSION', ':token': claim_token,
            },
        )
        return {'stripe_session_id': session.id, 'checkout_url': session.url}
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
            raise
        existing = checkout_requests_table.get_item(
            Key={'checkout_request_id': checkout_request_id}, ConsistentRead=True,
        ).get('Item')
        if existing and existing.get('fingerprint') == fingerprint and existing.get('stripe_session_id'):
            return existing
        raise RuntimeError('Checkout Session claim was lost before it could be completed') from exc


def release_checkout_session_claim(checkout_request_id: str, fingerprint: str, claim_token: str) -> None:
    """Make a failed Stripe call retryable without releasing another worker's lease."""
    try:
        checkout_requests_table.update_item(
            Key={'checkout_request_id': checkout_request_id},
            UpdateExpression='SET #status = :reserved REMOVE session_lease_expires_at',
            ConditionExpression='fingerprint = :fingerprint AND #status = :creating AND session_claim_token = :token',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':reserved': 'RESERVED', ':creating': 'CREATING_SESSION',
                ':fingerprint': fingerprint, ':token': claim_token,
            },
        )
    except ClientError:
        # The lease may have passed to a retrier; never overwrite its state.
        pass


def validate_checkout_redirect_url(value: Any, field_name: str) -> str:
    parsed = None
    try:
        parsed = urlparse(str(value))
        origin = f'{parsed.scheme}://{parsed.netloc}'.rstrip('/')
    except (TypeError, ValueError):
        origin = ''
    if not parsed or not parsed.scheme or not parsed.netloc or origin not in ALLOWED_CHECKOUT_ORIGINS:
        raise ValueError(f'{field_name} must use an approved application domain')
    return str(value)


def purchase_status_from_stripe(status: str, payment_status: Optional[str], refunded_amount: Decimal, is_disputed: bool):
    if is_disputed:
        return 'disputed'
    if refunded_amount > 0:
        return 'refunded'
    if payment_status == 'paid':
        return 'paid'
    if status in {'expired', 'canceled'}:
        return 'cancelled'
    if payment_status in {'unpaid', 'no_payment_required'} or status in {'open', 'complete'}:
        return 'pending'
    return 'needs_review'


def _merge_stripe_fields(existing: dict[str, Any], stripe_update: dict[str, Any]) -> dict[str, Any]:
    """
    Return a copy of *existing* with only the allowlisted Stripe fields updated.

    Admin-set fields (access_revoked, manual_access_override, revoked_at, etc.)
    are NEVER overwritten — even when the webhook carries them in stripe_update.
    """
    merged = dict(existing)
    for field, value in stripe_update.items():
        if field in _STRIPE_ALLOWLIST:
            merged[field] = value
    return merged


_STREAM_TIMESTAMP_FIELDS = {
    'payment_intent': 'payment_intent_event_at',
    'charge': 'charge_event_at',
    'refund': 'refund_event_at',
    'dispute': 'dispute_event_at',
}


def webhook_stream(event_type: str) -> str:
    """Return the independent Stripe stream which owns an event."""
    if event_type.startswith('checkout.session.') or event_type.startswith('payment_intent.'):
        return 'payment_intent'
    if event_type.startswith('charge.dispute.'):
        return 'dispute'
    if event_type.startswith('charge.refund') or event_type.startswith('charge.refunded'):
        return 'refund'
    if event_type.startswith('charge.'):
        return 'charge'
    return 'payment_intent'


def _event_timestamp(value: Any) -> Optional[Decimal]:
    try:
        return Decimal(str(value))
    except (TypeError, ValueError, ArithmeticError):
        return None


def stream_event_is_fresh(existing: dict[str, Any], incoming: dict[str, Any], stream: str) -> bool:
    """Check freshness *before* merging fields from a Stripe stream.

    Stripe supplies ``event.created``.  Missing timestamps are accepted for
    backwards-compatible/manual invocations, but normal webhook events with a
    timestamp equal to or older than the one already handled are event-only
    idempotent writes.
    """
    timestamp_field = _STREAM_TIMESTAMP_FIELDS[stream]
    candidate = _event_timestamp(incoming.get(timestamp_field))
    if candidate is None:
        return True

    if stream == 'dispute' and incoming.get('dispute_id'):
        processed = (existing.get('dispute_event_at_by_id') or {}).get(str(incoming['dispute_id']))
    else:
        processed = existing.get(timestamp_field)
    previous = _event_timestamp(processed)
    return previous is None or candidate > previous


def _merge_dispute_clock(existing: dict[str, Any], incoming: dict[str, Any], merged: dict[str, Any]) -> None:
    """Keep an independent monotone clock for every dispute ID.

    A payment can have more than one dispute.  A global dispute timestamp alone
    would incorrectly discard a valid event for dispute B after a newer event
    for dispute A.
    """
    dispute_id = incoming.get('dispute_id')
    timestamp = incoming.get('dispute_event_at')
    if not dispute_id or _event_timestamp(timestamp) is None:
        return
    clocks = dict(existing.get('dispute_event_at_by_id') or {})
    clocks[str(dispute_id)] = int(_event_timestamp(timestamp))
    merged['dispute_event_at_by_id'] = clocks


def merge_stripe_state(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Merge Stripe data without allowing terminal payment states to regress.

    Stripe delivers independent PaymentIntent, Charge, Refund and Dispute
    streams out of order.  Their clocks are stored separately; no decision is
    based on one global event.created value.
    """
    stream = str(incoming.get('_stripe_stream') or '')
    if stream and not stream_event_is_fresh(existing, incoming, stream):
        # Callers normally handle this branch by recording only the event.  It
        # is retained here too so this public helper cannot be misused.
        return dict(existing)

    merged = _merge_stripe_fields(existing, incoming)
    if stream == 'dispute':
        _merge_dispute_clock(existing, incoming, merged)
    previous_status = str(existing.get('local_status') or '')
    incoming_status = str(incoming.get('local_status') or '')
    previous_refunded = Decimal(str(existing.get('refunded_amount', 0) or 0))
    incoming_refunded = Decimal(str(incoming.get('refunded_amount', 0) or 0))
    merged['refunded_amount'] = max(previous_refunded, incoming_refunded)
    if (previous_status in _TERMINAL_STRIPE_STATUSES and incoming_status == 'paid'
            and not (previous_status == 'disputed' and merged.get('dispute_status') in {'won', 'warning_closed'})):
        merged['local_status'] = previous_status
    elif previous_status == 'disputed' and merged.get('dispute_status') not in {'won', 'warning_closed'}:
        merged['local_status'] = 'disputed'
    elif previous_status == 'refunded' and merged['refunded_amount'] > 0:
        merged['local_status'] = 'refunded'
    if merged['refunded_amount'] > 0 and merged.get('local_status') == 'paid':
        merged['local_status'] = 'refunded'
    for timestamp_field in (
        'payment_intent_event_at', 'charge_event_at', 'refund_event_at', 'dispute_event_at',
    ):
        previous = existing.get(timestamp_field)
        candidate = incoming.get(timestamp_field)
        if previous is not None and (candidate is None or Decimal(str(candidate)) < Decimal(str(previous))):
            merged[timestamp_field] = previous
    return merged


def stripe_stream_timestamps(event_type: str, event_created: Any) -> dict[str, int]:
    """Attach a timestamp to the Stripe object stream that produced it."""
    try:
        timestamp = int(event_created)
    except (TypeError, ValueError):
        return {}
    if event_type.startswith('payment_intent.') or event_type.startswith('checkout.session.'):
        return {'payment_intent_event_at': timestamp}
    if event_type.startswith('charge.refunded'):
        return {'charge_event_at': timestamp, 'refund_event_at': timestamp}
    if event_type.startswith('charge.dispute'):
        return {'charge_event_at': timestamp, 'dispute_event_at': timestamp}
    return {}


def coupon_purchase_id(coupon_id: str, course_id: str, user_id: str) -> str:
    raw = f'{coupon_id}:{course_id}:{user_id}'.encode('utf-8')
    return f"coupon-{hashlib.sha256(raw).hexdigest()[:32]}"


def checkout_fingerprint(user_id: str, course_id: str, coupon_code: Optional[str], amount: Decimal,
                         terms_version: str = TERMS_VERSION) -> str:
    raw = f'{user_id}:{course_id}:{coupon_code or ""}:{Decimal(str(amount))}:{terms_version}'.encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def pending_user_id(email: str) -> str:
    """Stable placeholder until the outbox worker resolves the Cognito sub."""
    return f"pending-{hashlib.sha256(email.strip().lower().encode('utf-8')).hexdigest()[:32]}"


def sync_purchase_access(purchase: dict[str, Any], action: str = 'sync') -> dict[str, Any]:
    """Compatibility wrapper around the mandatory, fail-closed shared policy."""
    return _shared_sync_purchase_access(purchase, mode=action)


def normalize_purchase_defaults(purchase: dict[str, Any]):
    normalized = dict(purchase)
    normalized['local_status'] = normalized.get('local_status') or (
        'paid' if str(normalized.get('status', '')).lower() in {'active', 'paid'} else 'needs_review'
    )
    if normalized['local_status'] not in ALLOWED_LOCAL_STATUSES:
        normalized['local_status'] = 'needs_review'
    normalized['stripe_status'] = normalized.get('stripe_status') or normalized.get('status') or 'unknown'
    normalized['webhook_status'] = normalized.get('webhook_status') or 'not_received'
    normalized['amount_gross'] = Decimal(str(normalized.get('amount_gross', normalized.get('amount', 0) or 0)))
    normalized['currency'] = normalized.get('currency') or 'eur'
    normalized['purchase_origin'] = normalized.get('purchase_origin') or 'public_checkout'
    normalized['access_unlocked'] = normalize_bool(normalized.get('access_unlocked', str(normalized['local_status']) == 'paid'))
    normalized['access_revoked'] = normalize_bool(normalized.get('access_revoked', False))
    normalized['manual_access_override'] = normalize_bool(normalized.get('manual_access_override', False))
    normalized['refund_status'] = normalized.get('refund_status') or ('refunded' if Decimal(str(normalized.get('refunded_amount', 0) or 0)) > 0 else 'not_refunded')
    normalized['refunded_amount'] = Decimal(str(normalized.get('refunded_amount', 0) or 0))
    normalized['verified_by_admin'] = normalize_bool(normalized.get('verified_by_admin', False))
    normalized['is_disputed'] = normalize_bool(normalized.get('is_disputed', False))
    normalized['created_at'] = normalized.get('created_at') or normalized.get('purchase_date') or now_iso()
    normalized['updated_at'] = normalized.get('updated_at') or normalized['created_at']
    normalized['version'] = int(normalized.get('version', 0) or 0)
    return normalized


def store_purchase(purchase: dict[str, Any]):
    normalized = normalize_purchase_defaults(purchase)
    purchases_table.put_item(Item=normalized)
    return normalized


def build_purchase_item(*, user_id: str, customer_email: str, course: dict[str, Any], amount_gross: Decimal,
                        local_status: str, stripe_status: str, stripe_session_id: Optional[str], stripe_payment_intent_id: Optional[str],
                        stripe_charge_id: Optional[str], webhook_status: str, purchase_origin: str, coupon: Optional[dict[str, Any]],
                        refunded_amount: Decimal = Decimal('0'), is_disputed: bool = False, webhook_received_at: Optional[str] = None,
                        verified_by_admin: bool = False, acceptance: Optional[dict[str, Any]] = None):
    coupon_code = coupon.get('code') if coupon else None
    purchase = {
        'purchase_id': stripe_payment_intent_id or stripe_session_id or str(secrets.token_hex(12)),
        'payment_id': stripe_payment_intent_id or stripe_session_id,
        'user_id': user_id,
        'course_id': course['course_id'],
        'course_title': course.get('title', ''),
        'customer_email': customer_email,
        'amount_gross': amount_gross,
        'currency': 'eur',
        'local_status': local_status,
        'stripe_status': stripe_status,
        'stripe_session_id': stripe_session_id,
        'stripe_payment_intent_id': stripe_payment_intent_id,
        'stripe_charge_id': stripe_charge_id,
        'webhook_status': webhook_status,
        'webhook_received_at': webhook_received_at,
        'access_unlocked': local_status == 'paid' and refunded_amount <= 0,
        'access_revoked': False,
        'access_revoked_at': None,
        'access_revocation_reason': '',
        'manual_access_override': False,
        'revoked_by': None,
        'admin_notes': '',
        'access_expires_at': None,
        'purchase_origin': purchase_origin,
        'coupon_code': coupon_code,
        'coupon_snapshot': build_coupon_snapshot(coupon),
        'refunded_amount': refunded_amount,
        'refunded_at': None,
        'refund_status': 'not_refunded',
        'refund_type': None,
        'is_disputed': is_disputed,
        'verified_by_admin': verified_by_admin,
        'status': local_status,
        'access_type': 'lifetime',
        'amount': amount_gross,
        'purchase_date': now_iso(),
        'created_at': now_iso(),
        'updated_at': now_iso(),
    }
    if acceptance:
        purchase.update({
            key: acceptance[key]
            for key in ('terms_accepted', 'terms_version', 'terms_accepted_at',
                        'digital_content_consent', 'digital_content_consent_at')
            if key in acceptance
        })
    return sync_purchase_access(purchase)


def _prepare_dynamodb_value(value: Any) -> Any:
    """Convert JSON-style floats before passing values to TypeSerializer."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _prepare_dynamodb_value(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_prepare_dynamodb_value(nested) for nested in value]
    return value


def serialize_item(item: dict[str, Any]) -> dict[str, Any]:
    return {key: _serializer.serialize(_prepare_dynamodb_value(value)) for key, value in item.items()}


def event_already_processed(event_id: str) -> bool:
    response = webhook_events_table.get_item(Key={'event_id': event_id})
    return 'Item' in response


def _transactional_webhook_write(event_id: str, event_type: str, purchase: Optional[dict[str, Any]] = None,
                                 coupon: Optional[dict[str, Any]] = None,
                                 provisioning_outbox: Optional[dict[str, Any]] = None,
                                 expected_purchase_version: Optional[int] = None,
                                 event_purchase_id: Optional[str] = None,
                                 coupon_reservation: Optional[dict[str, Any]] = None,
                                 release_coupon_reservation: Optional[dict[str, Any]] = None) -> bool:
    """Atomically claim a Stripe event and apply its allowed side effects.

    The conditional Put is the idempotency guarantee.  A duplicate event
    cancels the entire transaction, including the purchase/coupon updates.
    """
    event_item = {
        'event_id': event_id,
        'event_type': event_type,
        'purchase_id': (purchase or {}).get('purchase_id', '') or event_purchase_id or '',
        'processed_at': now_iso(),
        'ttl_expires_at': ttl_epoch(30),
    }
    transact_items: list[dict[str, Any]] = [{
        'Put': {
            'TableName': webhook_events_table.name,
            'Item': serialize_item(event_item),
            'ConditionExpression': 'attribute_not_exists(event_id)',
        }
    }]

    if purchase:
        normalized = normalize_purchase_defaults(purchase)
        names: dict[str, str] = {}
        values: dict[str, Any] = {}
        assignments: list[str] = []
        for index, (field, value) in enumerate(normalized.items()):
            if field in {'purchase_id', 'version', '_stripe_stream'}:
                continue
            name = f'#f{index}'
            value_name = f':v{index}'
            names[name] = field
            values[value_name] = value
            if field in _STRIPE_ALLOWLIST:
                assignments.append(f'{name} = {value_name}')
            else:
                # Creation defaults only: webhook data cannot overwrite admin
                # decisions or notes on an existing purchase.
                assignments.append(f'{name} = if_not_exists({name}, {value_name})')
        names['#version'] = 'version'
        names['#purchase_id'] = 'purchase_id'
        if expected_purchase_version is None:
            # A newly-created checkout purchase must not overwrite a purchase
            # created by a concurrent webhook for the same PaymentIntent.
            assignments.append('#version = :next_version')
            values[':next_version'] = 1
            purchase_condition = 'attribute_not_exists(#purchase_id)'
        else:
            expected_version = int(expected_purchase_version)
            assignments.append('#version = :next_version')
            values[':expected_version'] = expected_version
            values[':zero_version'] = 0
            values[':next_version'] = expected_version + 1
            purchase_condition = (
                '(attribute_not_exists(#version) AND :expected_version = :zero_version) '
                'OR #version = :expected_version'
            )
        transact_items.append({
            'Update': {
                'TableName': purchases_table.name,
                'Key': serialize_item({'purchase_id': normalized['purchase_id']}),
                'UpdateExpression': 'SET ' + ', '.join(assignments),
                'ConditionExpression': purchase_condition,
                'ExpressionAttributeNames': names,
                'ExpressionAttributeValues': serialize_item(values),
            }
        })

    if coupon:
        coupon_id = coupon.get('coupon_id') or coupon.get('code')
        if coupon_id:
            names = {'#count': 'current_redemptions', '#updated': 'updated_at'}
            values: dict[str, Any] = {':one': 1, ':updated': now_iso()}
            update: dict[str, Any] = {
                'TableName': coupons_table.name,
                'Key': serialize_item({'coupon_id': coupon_id}),
                'UpdateExpression': 'ADD #count :one SET #updated = :updated',
                'ExpressionAttributeNames': names,
                'ExpressionAttributeValues': serialize_item(values),
            }
            max_redemptions = coupon.get('max_redemptions')
            if max_redemptions not in (None, ''):
                values[':max'] = int(max_redemptions)
                update['ConditionExpression'] = 'attribute_not_exists(#count) OR #count < :max'
                update['ExpressionAttributeValues'] = serialize_item(values)
            transact_items.append({'Update': update})

    if coupon_reservation:
        reservation_id = coupon_reservation['reservation_id']
        coupon_id = coupon_reservation['coupon_id']
        transact_items.extend([
            {'Update': {
                'TableName': coupon_reservations_table.name,
                'Key': serialize_item({'reservation_id': reservation_id}),
                'UpdateExpression': 'SET #status = :consumed, consumed_at = :now',
                'ConditionExpression': '#status = :reserved AND checkout_request_id = :checkout_request_id',
                'ExpressionAttributeNames': {'#status': 'status'},
                'ExpressionAttributeValues': serialize_item({
                    ':consumed': 'CONSUMED', ':reserved': 'RESERVED', ':now': now_iso(),
                    ':checkout_request_id': coupon_reservation['checkout_request_id'],
                }),
            }},
            {'Update': {
                'TableName': coupons_table.name,
                'Key': serialize_item({'coupon_id': coupon_id}),
                'UpdateExpression': 'ADD current_redemptions :one, pending_redemptions :minus_one SET updated_at = :now',
                'ExpressionAttributeValues': serialize_item({':one': 1, ':minus_one': -1, ':now': now_iso()}),
            }},
        ])

    if release_coupon_reservation:
        reservation_id = release_coupon_reservation['reservation_id']
        coupon_id = release_coupon_reservation['coupon_id']
        transact_items.extend([
            {'Update': {
                'TableName': coupon_reservations_table.name,
                'Key': serialize_item({'reservation_id': reservation_id}),
                'UpdateExpression': 'SET #status = :released, released_at = :now',
                'ConditionExpression': '#status = :reserved',
                'ExpressionAttributeNames': {'#status': 'status'},
                'ExpressionAttributeValues': serialize_item({
                    ':released': 'RELEASED', ':reserved': 'RESERVED', ':now': now_iso(),
                }),
            }},
            {'Update': {
                'TableName': coupons_table.name,
                'Key': serialize_item({'coupon_id': coupon_id}),
                'UpdateExpression': 'ADD redemption_slots_used :minus_one, pending_redemptions :minus_one SET updated_at = :now',
                'ExpressionAttributeValues': serialize_item({':minus_one': -1, ':now': now_iso()}),
            }},
        ])

    if provisioning_outbox:
        provisioning_outbox = dict(provisioning_outbox)
        provisioning_outbox.setdefault('ttl_expires_at', ttl_epoch(30))
        transact_items.append({'Put': {
            'TableName': provisioning_outbox_table.name,
            'Item': serialize_item(provisioning_outbox),
            'ConditionExpression': 'attribute_not_exists(outbox_id)',
        }})

    try:
        dynamodb_client.transact_write_items(TransactItems=transact_items)
        return True
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'TransactionCanceledException':
            reasons = exc.response.get('CancellationReasons') or []
            if reasons and reasons[0].get('Code') == 'ConditionalCheckFailed':
                return False
            # Only the first item is the conditional event Put.  A failed
            # purchase CAS is a concurrent state change, never a duplicate
            # event; the caller must re-read and re-merge it.
            if purchase and len(reasons) > 1 and reasons[1].get('Code') == 'ConditionalCheckFailed':
                raise PurchaseVersionConflict('purchase changed concurrently') from exc
        raise


def extract_charge_id_from_payment_intent(payment_intent: Optional[dict[str, Any]]):
    if not payment_intent:
        return None
    charges = (((payment_intent.get('charges') or {}).get('data')) or [])
    if charges:
        return charges[0].get('id')
    latest_charge = payment_intent.get('latest_charge')
    if isinstance(latest_charge, str):
        return latest_charge
    if isinstance(latest_charge, dict):
        return latest_charge.get('id')
    return None


def extract_refunded_amount(payment_intent: Optional[dict[str, Any]]):
    if not payment_intent:
        return Decimal('0')
    charges = (((payment_intent.get('charges') or {}).get('data')) or [])
    refunded = 0
    for charge in charges:
        refunded = max(refunded, int(charge.get('amount_refunded') or 0))
    latest_charge = payment_intent.get('latest_charge')
    if isinstance(latest_charge, dict):
        refunded = max(refunded, int(latest_charge.get('amount_refunded') or 0))
    return Decimal(str(refunded / 100))


def extract_is_disputed(payment_intent: Optional[dict[str, Any]]):
    if not payment_intent:
        return False
    charges = (((payment_intent.get('charges') or {}).get('data')) or [])
    for charge in charges:
        if charge.get('disputed'):
            return True
    latest_charge = payment_intent.get('latest_charge')
    if isinstance(latest_charge, dict):
        return normalize_bool(latest_charge.get('disputed', False))
    return False


def read_purchase_consistently(purchase_id: str, attempts: int = 1) -> Optional[dict[str, Any]]:
    """Read a purchase strongly consistently, allowing a short creation race."""
    for attempt in range(attempts):
        item = purchases_table.get_item(
            Key={'purchase_id': purchase_id}, ConsistentRead=True,
        ).get('Item')
        if item:
            return item
        if attempt < attempts - 1:
            time.sleep(0.025)
    return None


def _record_stale_webhook(event_id: str, event_type: str, purchase_id: str):
    """Claim an out-of-order event without changing the already-newer state."""
    if not _transactional_webhook_write(
        event_id, event_type, event_purchase_id=purchase_id,
    ):
        return create_response(200, {'message': 'Webhook already processed', 'purchase_id': purchase_id})
    return create_response(200, {'message': 'Webhook recorded as stale', 'purchase_id': purchase_id})


def save_checkout_completion(session: dict[str, Any], event_type: str = 'checkout.session.completed', event_id: Optional[str] = None,
                             event_created: Any = None):
    customer_email = session.get('customer_details', {}).get('email') or session.get('customer_email')
    course_ref = session.get('metadata', {}).get('course_id')
    stripe_session_id = session.get('id')
    stripe_payment_intent_id = session.get('payment_intent')

    if not customer_email or not stripe_payment_intent_id:
        return create_response(400, {'error': 'Missing customer email or payment intent'})

    course = get_checkout_course(course_ref)
    if not course:
        return create_response(400, {'error': 'Course not found'})

    full_name = session.get('customer_details', {}).get('name') or session.get('metadata', {}).get('full_name') or ''
    user_id = pending_user_id(customer_email)

    coupon = get_coupon(session.get('metadata', {}).get('coupon_code'))
    checkout_request_id = session.get('metadata', {}).get('checkout_request_id')
    checkout_request = None
    if checkout_request_id:
        checkout_request = checkout_requests_table.get_item(
            Key={'checkout_request_id': checkout_request_id}, ConsistentRead=True,
        ).get('Item')
    checkout_reservation = None
    if (checkout_request or {}).get('reservation_id'):
        checkout_reservation = coupon_reservations_table.get_item(
            Key={'reservation_id': checkout_request['reservation_id']}, ConsistentRead=True,
        ).get('Item')
    acceptance = {
        key: checkout_request[key]
        for key in ('terms_accepted', 'terms_version', 'terms_accepted_at',
                    'digital_content_consent', 'digital_content_consent_at')
        if checkout_request and key in checkout_request
    }
    # The Checkout metadata is a second, independent record kept by Stripe.
    # It is used only as fallback for a request row that has expired.
    metadata = session.get('metadata') or {}
    if not acceptance and metadata.get('terms_version') == TERMS_VERSION:
        acceptance = {
            'terms_accepted': True,
            'terms_version': TERMS_VERSION,
            'terms_accepted_at': metadata.get('terms_accepted_at'),
            'digital_content_consent': True,
            'digital_content_consent_at': metadata.get('digital_content_consent_at'),
        }
    amount_gross = Decimal(str((int(session.get('amount_total') or 0)) / 100))
    payment_intent = None
    if stripe_payment_intent_id:
        try:
            configure_stripe()
            payment_intent = stripe.PaymentIntent.retrieve(stripe_payment_intent_id, expand=['latest_charge', 'charges'])
        except Exception as exc:
            print(f'PaymentIntent retrieve warning: {exc}')

    refunded_amount = extract_refunded_amount(payment_intent)
    is_disputed = extract_is_disputed(payment_intent)
    stripe_status = session.get('payment_status') or session.get('status') or 'unknown'
    local_status = purchase_status_from_stripe(session.get('status', ''), session.get('payment_status'), refunded_amount, is_disputed)
    purchase = build_purchase_item(
        user_id=user_id,
        customer_email=customer_email,
        course=course,
        amount_gross=amount_gross,
        local_status=local_status,
        stripe_status=stripe_status,
        stripe_session_id=stripe_session_id,
        stripe_payment_intent_id=stripe_payment_intent_id,
        stripe_charge_id=extract_charge_id_from_payment_intent(payment_intent),
        webhook_status='received',
        purchase_origin='coupon_100' if amount_gross == 0 else 'public_checkout',
        coupon=coupon,
        refunded_amount=refunded_amount,
        is_disputed=is_disputed,
        webhook_received_at=now_iso(),
        acceptance=acceptance,
    )
    purchase['purchase_id'] = stripe_payment_intent_id
    purchase.update(stripe_stream_timestamps(event_type, event_created))

    if not event_id:
        return create_response(400, {'error': 'Stripe event id missing'})
    purchase['_stripe_stream'] = webhook_stream(event_type)
    for attempt in range(3):
        existing = read_purchase_consistently(stripe_payment_intent_id)
        if existing:
            existing = normalize_purchase_defaults(existing)
            if not stream_event_is_fresh(existing, purchase, purchase['_stripe_stream']):
                return _record_stale_webhook(event_id, event_type, stripe_payment_intent_id)
            # Only Stripe-owned fields are merged; protected admin fields stay
            # on the resource and the transaction CAS protects this snapshot.
            candidate = sync_purchase_access(normalize_purchase_defaults(merge_stripe_state(existing, purchase)))
            expected_version: Optional[int] = existing['version']
            outbox = None
        else:
            candidate = purchase
            expected_version = None
            outbox = {
                'outbox_id': f"provision:{candidate['purchase_id']}",
                'purchase_id': candidate['purchase_id'], 'pending_user_id': user_id,
                'customer_email': customer_email, 'full_name': full_name,
                'course_title': course.get('title', 'VideoCorso'), 'status': 'PENDING',
                'created_at': now_iso(),
            }
        # A paid checkout coupon was consumed by the reservation transaction;
        # free coupons are consumed here with their deterministic purchase.
        coupon_to_consume = coupon if not existing and not (checkout_request or {}).get('coupon_reserved') else None
        try:
            if not _transactional_webhook_write(
                event_id, event_type, candidate, coupon_to_consume, outbox,
                expected_purchase_version=expected_version,
                coupon_reservation=checkout_reservation if not existing else None,
            ):
                return create_response(200, {'message': 'Webhook already processed', 'purchase_id': candidate['purchase_id']})
            return create_response(200, {'message': 'Webhook processed', 'purchase_id': candidate['purchase_id']})
        except PurchaseVersionConflict:
            if attempt == 2:
                raise RuntimeError('purchase changed repeatedly while applying webhook')
    raise RuntimeError('unreachable webhook retry state')


def update_purchase_from_payment_intent(payment_intent: dict[str, Any], event_type: str, event_id: str,
                                        event_created: Any = None):
    payment_intent_id = payment_intent.get('id')
    if not payment_intent_id:
        return create_response(400, {'error': 'Payment intent id missing'})

    purchase = read_purchase_consistently(payment_intent_id, attempts=3)
    if not purchase:
        # Do not claim the event: a checkout completion may still be committing
        # its purchase.  Returning 5xx lets Stripe replay it after visibility.
        return create_response(503, {'error': 'Linked purchase not visible yet', 'retryable': True})

    for attempt in range(3):
        purchase = normalize_purchase_defaults(purchase)
        refunded_amount = extract_refunded_amount(payment_intent)
        is_disputed = extract_is_disputed(payment_intent)
        stripe_status = payment_intent.get('status', 'unknown')
        local_status = purchase_status_from_stripe(
            stripe_status, 'paid' if stripe_status == 'succeeded' else stripe_status,
            refunded_amount, is_disputed,
        )
        stripe_update = {
            'stripe_status': stripe_status,
            'local_status': local_status,
            'stripe_payment_intent_id': payment_intent_id,
            'stripe_charge_id': extract_charge_id_from_payment_intent(payment_intent),
            'webhook_status': 'received', 'webhook_received_at': now_iso(),
            'refunded_amount': refunded_amount,
            'refund_status': 'refunded' if refunded_amount > 0 else 'not_refunded',
            'is_disputed': is_disputed, 'updated_at': now_iso(),
            '_stripe_stream': webhook_stream(event_type),
        }
        stripe_update.update(stripe_stream_timestamps(event_type, event_created))
        if not stream_event_is_fresh(purchase, stripe_update, stripe_update['_stripe_stream']):
            return _record_stale_webhook(event_id, event_type, payment_intent_id)
        if refunded_amount > 0:
            stripe_update['refunded_at'] = purchase.get('refunded_at') or now_iso()
            stripe_update['refund_type'] = 'full' if refunded_amount >= Decimal(str(purchase.get('amount_gross', 0))) else 'partial'
        candidate = sync_purchase_access(normalize_purchase_defaults(merge_stripe_state(purchase, stripe_update)))
        try:
            if not _transactional_webhook_write(
                event_id, event_type, candidate, expected_purchase_version=purchase['version'],
            ):
                return create_response(200, {'message': 'Webhook already processed'})
            return create_response(200, {'message': 'Payment intent synced'})
        except PurchaseVersionConflict:
            if attempt == 2:
                raise RuntimeError('purchase changed repeatedly while applying webhook')
            purchase = read_purchase_consistently(payment_intent_id)
            if not purchase:
                return create_response(503, {'error': 'Linked purchase not visible yet', 'retryable': True})
    raise RuntimeError('unreachable webhook retry state')


def handle_checkout_expired(session: dict[str, Any], event_id: str, event_type: str = 'checkout.session.expired'):
    """Release a paid-coupon capacity slot when Stripe expires its Session."""
    checkout_request_id = (session.get('metadata') or {}).get('checkout_request_id')
    if not checkout_request_id:
        if not _transactional_webhook_write(event_id, event_type):
            return create_response(200, {'message': 'Webhook already processed'})
        return create_response(200, {'message': 'Checkout expiry recorded without reservation'})
    request = checkout_requests_table.get_item(
        Key={'checkout_request_id': checkout_request_id}, ConsistentRead=True,
    ).get('Item')
    reservation_id = (request or {}).get('reservation_id')
    if not reservation_id:
        if not _transactional_webhook_write(event_id, event_type):
            return create_response(200, {'message': 'Webhook already processed'})
        return create_response(200, {'message': 'Checkout expiry recorded without reservation'})
    reservation = coupon_reservations_table.get_item(
        Key={'reservation_id': reservation_id}, ConsistentRead=True,
    ).get('Item')
    if not reservation or reservation.get('status') != 'RESERVED':
        if not _transactional_webhook_write(event_id, event_type):
            return create_response(200, {'message': 'Webhook already processed'})
        return create_response(200, {'message': 'Coupon reservation already settled'})
    if not _transactional_webhook_write(
        event_id, event_type, event_purchase_id=str(request.get('stripe_payment_intent_id') or ''),
        release_coupon_reservation=reservation,
    ):
        return create_response(200, {'message': 'Webhook already processed'})
    return create_response(200, {'message': 'Coupon reservation released'})


def handle_charge_event(charge: dict[str, Any], event_type: str, event_id: str, event_created: Any = None):
    payment_intent_id = charge.get('payment_intent')
    if not payment_intent_id:
        # A Charge webhook without its PaymentIntent cannot safely be linked
        # to a purchase.  Do not consume its event id; Stripe must retry it.
        return create_response(503, {'error': 'Charge has no linked PaymentIntent', 'retryable': True})
    configure_stripe()
    payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id, expand=['latest_charge', 'charges'])
    return update_purchase_from_payment_intent(payment_intent, event_type, event_id, event_created)


def _dispute_payment_intent_id(dispute: dict[str, Any]) -> Optional[str]:
    """Resolve a Dispute payload to its PaymentIntent without guessing.

    ``charge.dispute.*`` delivers a Dispute, not a Charge.  Recent Stripe
    objects normally contain ``payment_intent``; older/expanded payloads may
    require a Charge lookup.
    """
    payment_intent = dispute.get('payment_intent')
    if isinstance(payment_intent, dict):
        return payment_intent.get('id')
    if payment_intent:
        return str(payment_intent)
    charge = dispute.get('charge')
    if isinstance(charge, dict):
        resolved = charge.get('payment_intent')
        return resolved.get('id') if isinstance(resolved, dict) else resolved
    if not charge:
        return None
    configure_stripe()
    charge_object = stripe.Charge.retrieve(str(charge))
    resolved = charge_object.get('payment_intent')
    return resolved.get('id') if isinstance(resolved, dict) else resolved


def _dispute_update(purchase: dict[str, Any], dispute: dict[str, Any], event_type: str, event_created: Any,
                    payment_intent: dict[str, Any]) -> dict[str, Any]:
    """Produce one explicit, reconcilable state transition for a Dispute."""
    dispute_id = str(dispute.get('id') or '')
    if not dispute_id:
        raise ValueError('Stripe dispute id missing')
    status = str(dispute.get('status') or '').lower()
    open_statuses = {'needs_response', 'under_review', 'warning_needs_response', 'warning_under_review'}
    closed_without_loss = {'won', 'warning_closed'}
    if status not in open_statuses | closed_without_loss | {'lost'}:
        raise ValueError(f'Unsupported Stripe dispute status: {status or "missing"}')

    active = {str(value) for value in (purchase.get('active_dispute_ids') or [])}
    lost = {str(value) for value in (purchase.get('lost_dispute_ids') or [])}
    if status in open_statuses:
        active.add(dispute_id)
    elif status in closed_without_loss:
        active.discard(dispute_id)
        lost.discard(dispute_id)
    else:  # lost: keep the loss as a terminal financial/access signal.
        active.discard(dispute_id)
        lost.add(dispute_id)

    refunded_amount = extract_refunded_amount(payment_intent)
    # The expanded PaymentIntent is the reconciliation source for disputes
    # not yet represented by a webhook row in this purchase.  In particular a
    # ``won`` event must not restore paid while another dispute is open.
    unresolved = bool(active or lost or extract_is_disputed(payment_intent))
    if unresolved:
        local_status = 'disputed'
    elif refunded_amount > 0:
        local_status = 'refunded'
    else:
        # This is reached only after the closing Dispute is reconciled with
        # every other known open/lost dispute on this purchase.
        local_status = 'paid' if payment_intent.get('status') == 'succeeded' else purchase.get('local_status', 'needs_review')
    update = {
        'stripe_status': payment_intent.get('status', purchase.get('stripe_status', 'unknown')),
        'stripe_payment_intent_id': payment_intent.get('id') or purchase.get('stripe_payment_intent_id'),
        'stripe_charge_id': dispute.get('charge') if isinstance(dispute.get('charge'), str) else purchase.get('stripe_charge_id'),
        'local_status': local_status,
        'is_disputed': unresolved,
        'active_dispute_ids': sorted(active),
        'lost_dispute_ids': sorted(lost),
        'dispute_id': dispute_id,
        'dispute_status': status,
        'webhook_status': 'received',
        'webhook_received_at': now_iso(),
        'updated_at': now_iso(),
        '_stripe_stream': 'dispute',
    }
    update.update(stripe_stream_timestamps(event_type, event_created))
    if refunded_amount > 0:
        update['refunded_amount'] = refunded_amount
        update['refund_status'] = 'refunded'
        update['refunded_at'] = purchase.get('refunded_at') or now_iso()
        update['refund_type'] = 'full' if refunded_amount >= Decimal(str(purchase.get('amount_gross', 0))) else 'partial'
    return update


def handle_dispute_event(dispute: dict[str, Any], event_type: str, event_id: str, event_created: Any = None):
    payment_intent_id = _dispute_payment_intent_id(dispute)
    if not payment_intent_id:
        # A malformed/transiently incomplete object must be retried, not
        # committed as an ignored event.
        return create_response(503, {'error': 'Dispute has no linked PaymentIntent', 'retryable': True})
    configure_stripe()
    payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id, expand=['latest_charge', 'charges'])
    purchase = read_purchase_consistently(payment_intent_id, attempts=3)
    if not purchase:
        return create_response(503, {'error': 'Linked purchase not visible yet', 'retryable': True})
    for attempt in range(3):
        purchase = normalize_purchase_defaults(purchase)
        update = _dispute_update(purchase, dispute, event_type, event_created, payment_intent)
        if not stream_event_is_fresh(purchase, update, 'dispute'):
            return _record_stale_webhook(event_id, event_type, payment_intent_id)
        candidate = sync_purchase_access(normalize_purchase_defaults(merge_stripe_state(purchase, update)))
        try:
            if not _transactional_webhook_write(
                event_id, event_type, candidate, expected_purchase_version=purchase['version'],
            ):
                return create_response(200, {'message': 'Webhook already processed'})
            return create_response(200, {'message': 'Dispute synced'})
        except PurchaseVersionConflict:
            if attempt == 2:
                raise RuntimeError('purchase changed repeatedly while applying dispute')
            purchase = read_purchase_consistently(payment_intent_id)
            if not purchase:
                return create_response(503, {'error': 'Linked purchase not visible yet', 'retryable': True})
    raise RuntimeError('unreachable dispute retry state')


def validate_coupon_for_checkout(course: dict[str, Any], coupon_code: Optional[str], email: Optional[str]):
    coupon = get_coupon(coupon_code) if coupon_code else None
    if coupon_code and not coupon:
        raise CouponValidationError('coupon_not_found', 'Coupon non trovato')
    if coupon:
        is_valid, reason = coupon_is_valid_for_checkout(coupon, course, email)
        if not is_valid:
            messages = {
                'coupon_disabled': 'Coupon disabilitato',
                'coupon_not_active_yet': 'Coupon non ancora attivo',
                'coupon_expired': 'Coupon scaduto',
                'coupon_exhausted': 'Coupon esaurito',
                'coupon_not_applicable': 'Coupon non applicabile a questo acquisto',
            }
            raise CouponValidationError(reason, messages.get(reason, 'Coupon non valido'))
    return coupon


def create_coupon_purchase_without_stripe(course: dict[str, Any], coupon: dict[str, Any], email: Optional[str],
                                          acceptance: dict[str, Any]):
    customer_email = (email or '').strip().lower()
    if not customer_email:
        raise ValueError('Email is required for free coupon access')

    full_name = ''
    user_id = pending_user_id(customer_email)

    purchase = build_purchase_item(
        user_id=user_id,
        customer_email=customer_email,
        course=course,
        amount_gross=Decimal('0'),
        local_status='paid',
        stripe_status='free_coupon',
        stripe_session_id=None,
        stripe_payment_intent_id=coupon_purchase_id(
            str(coupon.get('coupon_id') or coupon.get('code')).upper(), course['course_id'], user_id,
        ),
        stripe_charge_id=None,
        webhook_status='not_required',
        purchase_origin='coupon_100',
        coupon=coupon,
        verified_by_admin=False,
        acceptance=acceptance,
    )
    purchase['verified_by_admin'] = True
    purchase = sync_purchase_access(purchase)
    outbox = {
        'outbox_id': f"provision:{purchase['purchase_id']}",
        'purchase_id': purchase['purchase_id'], 'pending_user_id': user_id,
        'customer_email': customer_email, 'full_name': full_name,
        'course_title': course.get('title', 'VideoCorso'), 'status': 'PENDING',
        'created_at': now_iso(),
    }
    return redeem_free_coupon_atomically(purchase, coupon, outbox)


def quote_checkout(body: dict[str, Any]):
    course_ref = body.get('course_id')
    email = body.get('email')
    coupon_code = body.get('coupon_code')

    course = get_checkout_course(course_ref)
    if not course:
        return create_response(404, {'error': 'Course not found'})
    if not is_purchasable_course(course):
        return create_response(400, {'error': 'Course is not available for purchase'})

    coupon = validate_coupon_for_checkout(course, coupon_code, email)
    total = compute_discounted_total(course, coupon)
    return create_response(200, {
        'base_total': float(get_course_effective_price(course)),
        'final_total': float(total),
        'coupon_code': coupon.get('code') if coupon else None,
        'is_free_access': total <= 0,
    })


def create_checkout_session(event):
    body = json.loads(event.get('body') or '{}')
    course_ref = body.get('course_id')
    success_url = body.get('success_url')
    cancel_url = body.get('cancel_url')
    email = body.get('email')
    coupon_code = body.get('coupon_code')
    checkout_request_id = str(body.get('checkout_request_id') or '').strip()

    if not course_ref or not success_url or not cancel_url:
        return create_response(400, {'error': 'course_id, success_url and cancel_url are required'})

    success_url = validate_checkout_redirect_url(success_url, 'success_url')
    cancel_url = validate_checkout_redirect_url(cancel_url, 'cancel_url')
    acceptance = checkout_acceptance(body)

    course = get_checkout_course(course_ref)
    if not course:
        return create_response(404, {'error': 'Course not found'})
    if not is_purchasable_course(course):
        return create_response(400, {'error': 'Course is not available for purchase'})

    # Retry of an already-granted free coupon must succeed even though the
    # coupon is now exhausted/disabled. Check the deterministic purchase
    # before re-validating the mutable coupon inventory.
    raw_coupon = get_coupon(coupon_code) if coupon_code else None
    if raw_coupon and normalize_bool(raw_coupon.get('is_free_access', False)) and email:
        existing_free_id = coupon_purchase_id(
            str(raw_coupon.get('coupon_id') or raw_coupon.get('code') or '').upper(),
            course['course_id'], pending_user_id(str(email).strip().lower()),
        )
        existing_free = purchases_table.get_item(
            Key={'purchase_id': existing_free_id}, ConsistentRead=True,
        ).get('Item')
        if existing_free:
            return create_response(200, {
                'session_id': existing_free_id, 'checkout_url': success_url,
                'purchase_id': existing_free_id, 'is_free_access': True,
            })

    coupon = validate_coupon_for_checkout(course, coupon_code, email)
    total = compute_discounted_total(course, coupon)
    if total <= 0:
        purchase = create_coupon_purchase_without_stripe(course, coupon, email, acceptance)
        return create_response(200, {
            'session_id': purchase['purchase_id'],
            'checkout_url': success_url,
            'purchase_id': purchase['purchase_id'],
            'is_free_access': True,
        })

    if not checkout_request_id:
        return create_response(400, {'error': 'checkout_request_id is required'})
    fingerprint = checkout_fingerprint(
        (email or '').strip().lower(), course['course_id'], coupon.get('code') if coupon else None,
        total, acceptance['terms_version'],
    )
    existing_request = checkout_requests_table.get_item(
        Key={'checkout_request_id': checkout_request_id}, ConsistentRead=True,
    ).get('Item')
    if existing_request:
        if existing_request.get('fingerprint') != fingerprint:
            return create_response(409, {'error': 'checkout_request_id already belongs to a different checkout'})
        if existing_request.get('stripe_session_id'):
            return create_response(200, {
                'session_id': existing_request['stripe_session_id'],
                'checkout_url': existing_request['checkout_url'],
                'is_free_access': False,
            })

    if coupon:
        existing_request = reserve_coupon_for_paid_checkout(
            checkout_request_id, fingerprint, coupon, course, (email or '').strip().lower(), total, acceptance,
        )
        if existing_request.get('stripe_session_id'):
            return create_response(200, {
                'session_id': existing_request['stripe_session_id'],
                'checkout_url': existing_request['checkout_url'], 'is_free_access': False,
            })

    claim = claim_checkout_session_creation(
        checkout_request_id, fingerprint,
        {
            'course_id': course['course_id'],
            'customer_email': (email or '').strip().lower(),
            'amount_gross': Decimal(str(total)),
            'coupon_code': str(coupon.get('coupon_id') or coupon.get('code')) if coupon else None,
            'coupon_reserved': bool(coupon),
            **acceptance,
        },
    )
    if claim['state'] == 'SESSION_CREATED':
        request = claim['request']
        return create_response(200, {
            'session_id': request['stripe_session_id'], 'checkout_url': request['checkout_url'],
            'is_free_access': False,
        })
    if claim['state'] != 'CLAIMED':
        # A peer owns an unexpired lease.  The client may retry its exact same
        # checkout_request_id; it must not create a parallel Session locally.
        return create_response(202, {'status': 'CREATING_SESSION', 'retryable': True})

    product_data = {
        'name': course.get('title', 'VideoCorso'),
        'description': course.get('short_description') or course.get('description', ''),
    }
    if course.get('cover_image_url'):
        product_data['images'] = [course['cover_image_url']]

    try:
        configure_stripe()
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur', 'product_data': product_data,
                    'unit_amount': normalize_price_to_cents(total),
                },
                'quantity': 1,
            }],
            mode='payment', success_url=success_url, cancel_url=cancel_url,
            customer_email=email,
            metadata={
                'course_id': course['course_id'],
                'course_slug': str(course.get('public_slug', course['course_id'])),
                'course_title': str(course.get('title', '')),
                'coupon_code': str(coupon.get('code')) if coupon else '',
                'base_price': str(get_course_effective_price(course)),
                'final_price': str(total), 'checkout_request_id': checkout_request_id,
                'terms_version': acceptance['terms_version'],
                'terms_accepted_at': acceptance['terms_accepted_at'],
                'digital_content_consent_at': acceptance['digital_content_consent_at'],
            },
            payment_intent_data={
                'metadata': {
                    'course_id': course['course_id'],
                    'checkout_request_id': checkout_request_id,
                    'terms_version': acceptance['terms_version'],
                    'terms_accepted_at': acceptance['terms_accepted_at'],
                    'digital_content_consent_at': acceptance['digital_content_consent_at'],
                },
            },
            idempotency_key=checkout_request_id,
        )
    except Exception:
        try:
            release_checkout_session_claim(checkout_request_id, fingerprint, claim['claim_token'])
        except Exception as release_exc:
            # Preserve the Stripe/configuration failure; recovery is best
            # effort and the lease itself will expire.
            print(f'checkout session lease release warning: {release_exc}')
        raise
    stored = finish_checkout_session_claim(checkout_request_id, fingerprint, claim['claim_token'], session)
    return create_response(200, {'session_id': stored['stripe_session_id'], 'checkout_url': stored['checkout_url']})


def find_purchase_by_stripe_session(session_id: str) -> Optional[dict[str, Any]]:
    """Find the local sale corresponding to one Stripe Checkout session.

    The index is intentionally used instead of a table scan: this endpoint is
    public because Stripe redirects an unauthenticated customer to it, so it
    must stay bounded even as the order history grows.
    """
    try:
        response = purchases_table.query(
            IndexName='StripeSessionIndex',
            KeyConditionExpression=Key('stripe_session_id').eq(session_id),
            Limit=1,
        )
        items = response.get('Items') or []
        return items[0] if items else None
    except Exception as exc:
        # Stripe remains the source of truth for the payment.  If the local
        # projection is temporarily unavailable, tell the UI that activation
        # is still processing instead of declaring an unverified success.
        print(f'checkout verification purchase lookup warning: {exc}')
        return None


def payment_verification_data(session: dict[str, Any]) -> dict[str, Any]:
    """Return customer-safe payment and access states for a Checkout return."""
    payment_status = str(session.get('payment_status') or '').lower()
    checkout_status = str(session.get('status') or '').lower()
    metadata = session.get('metadata') or {}
    purchase = find_purchase_by_stripe_session(str(session.get('id') or ''))

    if payment_status == 'paid':
        payment_state = 'paid'
    elif checkout_status == 'expired':
        payment_state = 'expired'
    else:
        payment_state = 'pending'

    access_state = 'not_available'
    local_status = None
    if payment_state == 'paid':
        if not purchase:
            access_state = 'processing'
        else:
            normalized = normalize_purchase_defaults(purchase)
            local_status = normalized.get('local_status')
            access_state = 'active' if _shared_purchase_grants_access(normalized) else (
                'processing' if local_status in {'pending', 'needs_review'} else 'not_available'
            )

    return {
        'session_id': session.get('id'),
        'payment_state': payment_state,
        'payment_status': payment_status or 'unknown',
        'checkout_status': checkout_status or 'unknown',
        'access_state': access_state,
        'local_status': local_status,
        'course_id': metadata.get('course_id'),
        'course_title': metadata.get('course_title'),
    }


def verify_payment(session_id: str):
    configure_stripe()
    session = stripe.checkout.Session.retrieve(session_id, expand=['payment_intent'])
    return create_response(200, {
        'success': True,
        'data': payment_verification_data(session),
    })


def handle_webhook(event):
    raw_body = event.get('body')
    stripe_signature = event.get('headers', {}).get('Stripe-Signature') or event.get('headers', {}).get('stripe-signature')
    if not raw_body or not stripe_signature:
        return create_response(400, {'error': 'Missing webhook payload or signature'})

    try:
        event_data = stripe.Webhook.construct_event(
            payload=raw_body,
            sig_header=stripe_signature,
            secret=get_webhook_secret(),
        )
    except ValueError as exc:
        return create_response(400, {'error': f'Invalid payload: {exc}'})
    except stripe.error.SignatureVerificationError as exc:
        return create_response(400, {'error': f'Invalid signature: {exc}'})

    event_id = event_data.get('id')
    event_type = event_data.get('type', 'unknown')
    if not event_id:
        return create_response(400, {'error': 'Stripe event id missing'})
    # Fast-path only. Correctness comes from the conditional Put in the
    # transaction below, which also covers concurrent invocations.
    if event_already_processed(event_id):
        return create_response(200, {'message': 'Webhook already processed'})

    payload = event_data['data']['object']
    if event_type == 'checkout.session.completed':
        return save_checkout_completion(payload, event_type=event_type, event_id=event_id,
                                        event_created=event_data.get('created'))
    if event_type == 'checkout.session.expired':
        return handle_checkout_expired(payload, event_id=event_id, event_type=event_type)
    if event_type in {'payment_intent.succeeded', 'payment_intent.payment_failed'}:
        return update_purchase_from_payment_intent(payload, event_type, event_id, event_data.get('created'))
    if event_type == 'charge.refunded':
        return handle_charge_event(payload, event_type, event_id, event_data.get('created'))
    if event_type in {'charge.dispute.created', 'charge.dispute.closed', 'charge.dispute.updated'}:
        return handle_dispute_event(payload, event_type, event_id, event_data.get('created'))

    if not _transactional_webhook_write(event_id, event_type):
        return create_response(200, {'message': 'Webhook already processed'})
    return create_response(200, {'received': True})


def lambda_handler(event, context):
    del context
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if path == '/payment/create-checkout' and http_method == 'POST':
        try:
            return create_checkout_session(event)
        except CouponValidationError as exc:
            return create_response(409, {'error': str(exc), 'code': exc.code, 'quote_invalidated': True})
        except ValueError as exc:
            return create_response(400, {'error': str(exc)})
        except Exception as exc:
            print(f'create-checkout error: {exc}')
            return create_response(500, {'error': str(exc)})

    if path == '/payment/quote' and http_method == 'POST':
        try:
            return quote_checkout(json.loads(event.get('body') or '{}'))
        except CouponValidationError as exc:
            return create_response(409, {'error': str(exc), 'code': exc.code, 'quote_invalidated': True})
        except ValueError as exc:
            return create_response(400, {'error': str(exc)})
        except Exception as exc:
            print(f'payment quote error: {exc}')
            return create_response(500, {'error': 'Unable to calculate checkout total'})

    if path.startswith('/payment/verify/') and http_method == 'GET':
        try:
            return verify_payment(path_parameters.get('sessionId'))
        except Exception as exc:
            print(f'verify-payment error: {exc}')
            return create_response(500, {'error': str(exc)})

    if path == '/payment/webhook' and http_method == 'POST':
        try:
            return handle_webhook(event)
        except Exception as exc:
            print(f'webhook error: {exc}')
            return create_response(500, {'error': str(exc)})

    return create_response(404, {'error': 'Not found'})
