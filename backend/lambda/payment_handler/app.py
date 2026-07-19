import json
import os
import secrets
import string
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

import boto3
import stripe


LEGACY_COURSE_ID = 'legacy-default-course'
ALLOWED_LOCAL_STATUSES = {'pending', 'paid', 'failed', 'refunded', 'disputed', 'cancelled', 'needs_review'}

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')

dynamodb = boto3.resource('dynamodb')
cognito_client = boto3.client('cognito-idp')

users_table = dynamodb.Table(os.environ.get('USERS_TABLE'))
purchases_table = dynamodb.Table(os.environ.get('PURCHASES_TABLE'))
courses_table = dynamodb.Table(os.environ.get('COURSES_TABLE'))
coupons_table = dynamodb.Table(os.environ.get('COUPONS_TABLE'))
webhook_events_table = dynamodb.Table(os.environ.get('WEBHOOK_EVENTS_TABLE'))

COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')

try:
    import resend

    resend.api_key = os.environ.get('RESEND_API_KEY')
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


def decimal_to_number(value: Any) -> float:
    if value is None:
        return 0.0
    return float(Decimal(str(value)))


def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return f'{password}A1!'


def send_welcome_email(email: str, temp_password: str, course_title: str):
    if not resend or not getattr(resend, 'api_key', None):
        print('Welcome email skipped: Resend not configured.')
        return

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
    except Exception as exc:
        print(f'Email send failed: {exc}')


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

    if course_ref == LEGACY_COURSE_ID:
        return normalize_course(ensure_legacy_course())
    return None


def is_publicly_visible(course: dict[str, Any]) -> bool:
    status = str(course.get('status', 'hidden'))
    return status == 'published'


def is_purchasable_course(course: dict[str, Any]) -> bool:
    return is_publicly_visible(course) and normalize_bool(course.get('is_purchasable', False))


def get_checkout_course(course_ref: Optional[str]):
    course = get_course(course_ref)
    if course:
        return course

    if course_ref in {None, '', LEGACY_COURSE_ID}:
        return normalize_course(ensure_legacy_course())

    return None


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
        return False, 'Coupon not found'

    if not normalize_bool(coupon.get('is_active', False)):
        return False, 'Coupon is not active'

    starts_at = parse_iso_datetime(coupon.get('starts_at'))
    expires_at = parse_iso_datetime(coupon.get('expires_at'))
    now = datetime.now(timezone.utc)
    if starts_at and starts_at > now:
        return False, 'Coupon is not active yet'
    if expires_at and expires_at < now:
        return False, 'Coupon has expired'

    current_redemptions = int(coupon.get('current_redemptions', 0))
    max_redemptions = coupon.get('max_redemptions')
    if max_redemptions not in (None, '') and current_redemptions >= int(max_redemptions):
        return False, 'Coupon redemption limit reached'

    course_scope = coupon.get('course_scope') or []
    if course_scope:
        if isinstance(course_scope, str):
            scope_values = [course_scope]
        else:
            scope_values = [str(value) for value in course_scope]
        if course.get('course_id') not in scope_values and course.get('public_slug') not in scope_values:
            return False, 'Coupon does not apply to this course'

    allowed_emails = coupon.get('allowed_user_emails') or []
    if allowed_emails:
        normalized_email = (email or '').strip().lower()
        scope_emails = [str(value).strip().lower() for value in allowed_emails]
        if normalized_email not in scope_emails:
            return False, 'Coupon not valid for this email'

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


def increment_coupon_redemption(coupon: Optional[dict[str, Any]]):
    if not coupon:
        return
    coupon_id = coupon.get('coupon_id') or coupon.get('code')
    coupons_table.update_item(
        Key={'coupon_id': coupon_id},
        UpdateExpression='SET current_redemptions = :current, updated_at = :updated',
        ExpressionAttributeValues={
            ':current': int(coupon.get('current_redemptions', 0)) + 1,
            ':updated': now_iso(),
        },
    )


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


def sync_purchase_access(purchase: dict[str, Any], action: str = 'sync'):
    local_status = str(purchase.get('local_status', 'needs_review'))
    refunded_amount = Decimal(str(purchase.get('refunded_amount', 0) or 0))
    access_unlocked = normalize_bool(purchase.get('access_unlocked', False))
    access_revoked = normalize_bool(purchase.get('access_revoked', False))

    if action == 'force_unlock':
        purchase['access_unlocked'] = True
        purchase['access_revoked'] = False
        purchase['access_revoked_at'] = None
        purchase['access_revocation_reason'] = ''
        purchase['updated_at'] = now_iso()
        return purchase

    if action == 'revoke':
        purchase['access_unlocked'] = False
        purchase['access_revoked'] = True
        purchase['access_revoked_at'] = now_iso()
        purchase['access_revocation_reason'] = purchase.get('access_revocation_reason') or 'manual_revoke'
        purchase['updated_at'] = now_iso()
        return purchase

    if local_status == 'paid' and refunded_amount <= 0 and not access_revoked:
        purchase['access_unlocked'] = True
        purchase['access_revoked'] = False
        purchase['access_revoked_at'] = None
        purchase['access_revocation_reason'] = ''
    elif local_status == 'refunded':
        purchase['access_unlocked'] = False
        purchase['access_revoked'] = True
        purchase['access_revoked_at'] = purchase.get('access_revoked_at') or now_iso()
        purchase['access_revocation_reason'] = purchase.get('access_revocation_reason') or 'refund_total'
    elif local_status == 'disputed':
        purchase['access_unlocked'] = access_unlocked
        purchase['access_revoked'] = access_revoked
    elif local_status in {'failed', 'cancelled'}:
        purchase['access_unlocked'] = False
    purchase['updated_at'] = now_iso()
    return purchase


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
    normalized['refund_status'] = normalized.get('refund_status') or ('refunded' if Decimal(str(normalized.get('refunded_amount', 0) or 0)) > 0 else 'not_refunded')
    normalized['refunded_amount'] = Decimal(str(normalized.get('refunded_amount', 0) or 0))
    normalized['verified_by_admin'] = normalize_bool(normalized.get('verified_by_admin', False))
    normalized['is_disputed'] = normalize_bool(normalized.get('is_disputed', False))
    normalized['created_at'] = normalized.get('created_at') or normalized.get('purchase_date') or now_iso()
    normalized['updated_at'] = normalized.get('updated_at') or normalized['created_at']
    return normalized


def store_purchase(purchase: dict[str, Any]):
    normalized = normalize_purchase_defaults(purchase)
    purchases_table.put_item(Item=normalized)
    return normalized


def build_purchase_item(*, user_id: str, customer_email: str, course: dict[str, Any], amount_gross: Decimal,
                        local_status: str, stripe_status: str, stripe_session_id: Optional[str], stripe_payment_intent_id: Optional[str],
                        stripe_charge_id: Optional[str], webhook_status: str, purchase_origin: str, coupon: Optional[dict[str, Any]],
                        refunded_amount: Decimal = Decimal('0'), is_disputed: bool = False, webhook_received_at: Optional[str] = None,
                        verified_by_admin: bool = False):
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
    return sync_purchase_access(purchase)


def event_already_processed(event_id: str) -> bool:
    response = webhook_events_table.get_item(Key={'event_id': event_id})
    return 'Item' in response


def mark_event_processed(event_id: str, event_type: str, purchase_id: Optional[str] = None):
    webhook_events_table.put_item(Item={
        'event_id': event_id,
        'event_type': event_type,
        'purchase_id': purchase_id or '',
        'processed_at': now_iso(),
    })


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


def save_checkout_completion(session: dict[str, Any], event_type: str = 'checkout.session.completed', event_id: Optional[str] = None):
    customer_email = session.get('customer_details', {}).get('email') or session.get('customer_email')
    course_ref = session.get('metadata', {}).get('course_id') or LEGACY_COURSE_ID
    stripe_session_id = session.get('id')
    stripe_payment_intent_id = session.get('payment_intent')

    if not customer_email or not stripe_payment_intent_id:
        return create_response(400, {'error': 'Missing customer email or payment intent'})

    course = get_checkout_course(course_ref)
    if not course:
        return create_response(400, {'error': 'Course not found'})

    full_name = session.get('customer_details', {}).get('name') or session.get('metadata', {}).get('full_name') or ''
    user_id, _ = ensure_cognito_user(customer_email, full_name, course.get('title', 'VideoCorso'))
    upsert_user_record(user_id, customer_email, full_name)

    coupon = get_coupon(session.get('metadata', {}).get('coupon_code'))
    amount_gross = Decimal(str((int(session.get('amount_total') or 0)) / 100))
    payment_intent = None
    if stripe_payment_intent_id:
        try:
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
    )
    purchase['purchase_id'] = stripe_payment_intent_id

    existing = purchases_table.get_item(Key={'purchase_id': stripe_payment_intent_id}).get('Item')
    if existing:
        merged = dict(existing)
        merged.update(purchase)
        purchase = sync_purchase_access(normalize_purchase_defaults(merged))
    store_purchase(purchase)
    increment_coupon_redemption(coupon)

    if event_id:
        mark_event_processed(event_id, event_type, purchase['purchase_id'])
    return create_response(200, {'message': 'Webhook processed', 'purchase_id': purchase['purchase_id']})


def update_purchase_from_payment_intent(payment_intent: dict[str, Any], event_type: str, event_id: str):
    payment_intent_id = payment_intent.get('id')
    if not payment_intent_id:
        return create_response(400, {'error': 'Payment intent id missing'})

    purchase = purchases_table.get_item(Key={'purchase_id': payment_intent_id}).get('Item')
    if not purchase:
        pending_purchase = build_purchase_item(
            user_id='',
            customer_email='',
            course=normalize_course(ensure_legacy_course()),
            amount_gross=Decimal(str((int(payment_intent.get('amount_received') or payment_intent.get('amount') or 0)) / 100)),
            local_status='needs_review',
            stripe_status=payment_intent.get('status', 'unknown'),
            stripe_session_id=None,
            stripe_payment_intent_id=payment_intent_id,
            stripe_charge_id=extract_charge_id_from_payment_intent(payment_intent),
            webhook_status='received',
            purchase_origin='public_checkout',
            coupon=None,
            refunded_amount=extract_refunded_amount(payment_intent),
            is_disputed=extract_is_disputed(payment_intent),
            webhook_received_at=now_iso(),
        )
        pending_purchase['purchase_id'] = payment_intent_id
        purchase = pending_purchase
    else:
        purchase = normalize_purchase_defaults(purchase)

    refunded_amount = extract_refunded_amount(payment_intent)
    is_disputed = extract_is_disputed(payment_intent)
    stripe_status = payment_intent.get('status', 'unknown')
    local_status = purchase_status_from_stripe(stripe_status, 'paid' if stripe_status == 'succeeded' else stripe_status, refunded_amount, is_disputed)

    purchase.update({
        'stripe_status': stripe_status,
        'local_status': local_status,
        'stripe_payment_intent_id': payment_intent_id,
        'stripe_charge_id': extract_charge_id_from_payment_intent(payment_intent),
        'webhook_status': 'received',
        'webhook_received_at': now_iso(),
        'refunded_amount': refunded_amount,
        'refund_status': 'refunded' if refunded_amount > 0 else 'not_refunded',
        'is_disputed': is_disputed,
        'updated_at': now_iso(),
    })

    if refunded_amount > 0:
        purchase['refunded_at'] = purchase.get('refunded_at') or now_iso()
        purchase['refund_type'] = 'full' if refunded_amount >= Decimal(str(purchase.get('amount_gross', 0))) else 'partial'
    purchase = sync_purchase_access(purchase)
    store_purchase(purchase)
    mark_event_processed(event_id, event_type, purchase.get('purchase_id'))
    return create_response(200, {'message': 'Payment intent synced'})


def handle_charge_event(charge: dict[str, Any], event_type: str, event_id: str):
    payment_intent_id = charge.get('payment_intent')
    if not payment_intent_id:
        mark_event_processed(event_id, event_type, '')
        return create_response(200, {'message': 'Charge event ignored'})
    payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id, expand=['latest_charge', 'charges'])
    return update_purchase_from_payment_intent(payment_intent, event_type, event_id)


def validate_coupon_for_checkout(course: dict[str, Any], coupon_code: Optional[str], email: Optional[str]):
    coupon = get_coupon(coupon_code) if coupon_code else None
    if coupon_code and not coupon:
        raise ValueError('Coupon non trovato')
    if coupon:
        is_valid, reason = coupon_is_valid_for_checkout(coupon, course, email)
        if not is_valid:
            raise ValueError(reason)
    return coupon


def create_coupon_purchase_without_stripe(course: dict[str, Any], coupon: dict[str, Any], email: Optional[str]):
    customer_email = (email or '').strip().lower()
    if not customer_email:
        raise ValueError('Email is required for free coupon access')

    full_name = ''
    user_id, _ = ensure_cognito_user(customer_email, full_name, course.get('title', 'VideoCorso'))
    upsert_user_record(user_id, customer_email, full_name)

    purchase = build_purchase_item(
        user_id=user_id,
        customer_email=customer_email,
        course=course,
        amount_gross=Decimal('0'),
        local_status='paid',
        stripe_status='free_coupon',
        stripe_session_id=None,
        stripe_payment_intent_id=f"coupon-{secrets.token_hex(12)}",
        stripe_charge_id=None,
        webhook_status='not_required',
        purchase_origin='coupon_100',
        coupon=coupon,
        verified_by_admin=False,
    )
    purchase['verified_by_admin'] = True
    purchase = sync_purchase_access(purchase)
    store_purchase(purchase)
    increment_coupon_redemption(coupon)
    return purchase


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

    if not course_ref or not success_url or not cancel_url:
        return create_response(400, {'error': 'course_id, success_url and cancel_url are required'})

    course = get_checkout_course(course_ref)
    if not course:
        return create_response(404, {'error': 'Course not found'})
    if not is_purchasable_course(course):
        return create_response(400, {'error': 'Course is not available for purchase'})

    coupon = validate_coupon_for_checkout(course, coupon_code, email)
    total = compute_discounted_total(course, coupon)
    if total <= 0:
        purchase = create_coupon_purchase_without_stripe(course, coupon, email)
        return create_response(200, {
            'session_id': purchase['purchase_id'],
            'checkout_url': success_url,
            'purchase_id': purchase['purchase_id'],
            'is_free_access': True,
        })

    product_data = {
        'name': course.get('title', 'VideoCorso'),
        'description': course.get('short_description') or course.get('description', ''),
    }
    if course.get('cover_image_url'):
        product_data['images'] = [course['cover_image_url']]

    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'eur',
                'product_data': product_data,
                'unit_amount': normalize_price_to_cents(total),
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=email,
        metadata={
            'course_id': course['course_id'],
            'course_slug': str(course.get('public_slug', course['course_id'])),
            'course_title': str(course.get('title', '')),
            'coupon_code': str(coupon.get('code')) if coupon else '',
            'base_price': str(get_course_effective_price(course)),
            'final_price': str(total),
        },
    )
    return create_response(200, {'session_id': session.id, 'checkout_url': session.url})


def verify_payment(session_id: str):
    session = stripe.checkout.Session.retrieve(session_id, expand=['payment_intent'])
    payment_intent = session.get('payment_intent')
    return create_response(200, {
        'success': True,
        'data': {
            'session_id': session.get('id'),
            'payment_status': session.get('payment_status'),
            'status': session.get('status'),
            'payment_intent_id': payment_intent.get('id') if isinstance(payment_intent, dict) else payment_intent,
        },
    })


def handle_webhook(event):
    raw_body = event.get('body')
    stripe_signature = event.get('headers', {}).get('Stripe-Signature') or event.get('headers', {}).get('stripe-signature')
    if not raw_body or not stripe_signature:
        return create_response(400, {'error': 'Missing webhook payload or signature'})

    try:
        event_data = stripe.Webhook.construct_event(payload=raw_body, sig_header=stripe_signature, secret=WEBHOOK_SECRET)
    except ValueError as exc:
        return create_response(400, {'error': f'Invalid payload: {exc}'})
    except stripe.error.SignatureVerificationError as exc:
        return create_response(400, {'error': f'Invalid signature: {exc}'})

    event_id = event_data.get('id')
    event_type = event_data.get('type', 'unknown')
    if event_id and event_already_processed(event_id):
        return create_response(200, {'message': 'Webhook already processed'})

    payload = event_data['data']['object']
    if event_type == 'checkout.session.completed':
        return save_checkout_completion(payload, event_type=event_type, event_id=event_id)
    if event_type in {'payment_intent.succeeded', 'payment_intent.payment_failed'}:
        return update_purchase_from_payment_intent(payload, event_type, event_id)
    if event_type in {'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed'}:
        return handle_charge_event(payload, event_type, event_id)

    if event_id:
        mark_event_processed(event_id, event_type, '')
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
        except Exception as exc:
            print(f'create-checkout error: {exc}')
            return create_response(500, {'error': str(exc)})

    if path == '/payment/quote' and http_method == 'POST':
        try:
            return quote_checkout(json.loads(event.get('body') or '{}'))
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
