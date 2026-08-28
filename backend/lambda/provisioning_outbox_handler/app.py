"""Idempotent worker for post-payment Cognito provisioning and welcome email."""

import hashlib
import os
import secrets
import string
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.types import TypeDeserializer
from botocore.exceptions import ClientError


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def pending_user_id(email: str) -> str:
    return f"pending-{hashlib.sha256(email.strip().lower().encode('utf-8')).hexdigest()[:32]}"


def generate_temp_password() -> str:
    # Only used if Cognito requires a temporary password; native delivery is
    # enabled, and the construction satisfies the configured complexity rules.
    required = [secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase),
                secrets.choice(string.digits), secrets.choice('!@#$%')]
    alphabet = string.ascii_letters + string.digits + '!@#$%'
    return ''.join(required + [secrets.choice(alphabet) for _ in range(16)])


dynamodb = boto3.resource('dynamodb')
cognito = boto3.client('cognito-idp')
purchases_table = dynamodb.Table(os.environ['PURCHASES_TABLE'])
users_table = dynamodb.Table(os.environ['USERS_TABLE'])
outbox_table = dynamodb.Table(os.environ['PROVISIONING_OUTBOX_TABLE'])
USER_POOL_ID = os.environ['COGNITO_USER_POOL_ID']
_deserializer = TypeDeserializer()


def deserialize_image(image: dict) -> dict:
    return {key: _deserializer.deserialize(value) for key, value in image.items()}


def cognito_user(email: str):
    try:
        response = cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=email)
        attributes = {attribute['Name']: attribute['Value'] for attribute in response.get('UserAttributes', [])}
        return attributes.get('sub')
    except cognito.exceptions.UserNotFoundException:
        return None


def ensure_cognito_user(email: str, full_name: str) -> str:
    existing = cognito_user(email)
    if not existing:
        try:
            response = cognito.admin_create_user(
                UserPoolId=USER_POOL_ID, Username=email, TemporaryPassword=generate_temp_password(),
                UserAttributes=[
                    {'Name': 'email', 'Value': email},
                    {'Name': 'email_verified', 'Value': 'true'},
                    {'Name': 'custom:subscription_status', 'Value': 'active'},
                    *([{'Name': 'custom:full_name', 'Value': full_name}] if full_name else [])
                ],
                DesiredDeliveryMediums=['EMAIL'],
            )
            existing = next(attribute['Value'] for attribute in response['User']['Attributes'] if attribute['Name'] == 'sub')
        except cognito.exceptions.UsernameExistsException:
            existing = cognito_user(email)
            if not existing:
                raise
    cognito.admin_update_user_attributes(
        UserPoolId=USER_POOL_ID, Username=email,
        UserAttributes=[
            {'Name': 'email_verified', 'Value': 'true'},
            {'Name': 'custom:subscription_status', 'Value': 'active'},
            *([{'Name': 'custom:full_name', 'Value': full_name}] if full_name else [])
        ],
    )
    cognito.admin_add_user_to_group(UserPoolId=USER_POOL_ID, Username=email, GroupName='students')
    return existing


def claim_outbox(item: dict, worker_id: str) -> bool:
    now = now_iso(); lease = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace('+00:00', 'Z')
    try:
        outbox_table.update_item(Key={'outbox_id': item['outbox_id']},
            UpdateExpression='SET #status=:processing, worker_id=:worker, lease_expires_at=:lease, attempt_count=if_not_exists(attempt_count,:zero)+:one',
            ConditionExpression='#status IN (:pending,:failed) OR (#status=:processing AND lease_expires_at < :now)',
            ExpressionAttributeNames={'#status':'status'},
            ExpressionAttributeValues={':processing':'PROCESSING', ':pending':'PENDING', ':failed':'FAILED', ':worker':worker_id, ':lease':lease, ':now':now, ':zero':0, ':one':1})
        return True
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException': return False
        raise


def process_outbox(item: dict, worker_id: str) -> None:
    if item.get('status') not in {'PENDING', 'FAILED'} or not claim_outbox(item, worker_id): return
    email = item['customer_email'].strip().lower()
    if item.get('pending_user_id') != pending_user_id(email): raise ValueError('Outbox pending_user_id integrity failure')
    user_id = ensure_cognito_user(email, item.get('full_name') or '')
    now = now_iso()
    users_table.update_item(
        Key={'user_id': user_id},
        UpdateExpression=(
            'SET email = if_not_exists(email, :email), full_name = if_not_exists(full_name, :name), '
            'subscription_status = if_not_exists(subscription_status, :active), '
            'global_access = if_not_exists(global_access, :false), created_at = if_not_exists(created_at, :now), updated_at = :now'
        ),
        ExpressionAttributeValues={':email': email, ':name': item.get('full_name') or '', ':active': 'active', ':false': False, ':now': now},
    )
    try:
        purchases_table.update_item(
            Key={'purchase_id': item['purchase_id']},
            UpdateExpression='SET user_id = :user_id, provisioned_at = if_not_exists(provisioned_at, :now)',
            ConditionExpression='user_id = :pending_user_id',
            ExpressionAttributeValues={':user_id': user_id, ':pending_user_id': item['pending_user_id'], ':now': now},
        )
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
            raise
        # A previous invocation may have updated the purchase and crashed
        # before completing the outbox item.  Treat exactly that state as
        # recovered; do not claim a purchase owned by somebody else.
        purchase = purchases_table.get_item(Key={'purchase_id': item['purchase_id']}, ConsistentRead=True).get('Item')
        if not purchase or purchase.get('user_id') != user_id:
            raise
    outbox_table.update_item(
        Key={'outbox_id': item['outbox_id']},
        UpdateExpression='SET #status = :completed, completed_at = if_not_exists(completed_at, :now)',
        ExpressionAttributeNames={'#status': 'status'},
        ConditionExpression='worker_id = :worker',
        ExpressionAttributeValues={':completed': 'COMPLETED', ':now': now, ':worker': worker_id},
    )


def lambda_handler(event, context):
    worker_id = getattr(context, 'aws_request_id', None) or secrets.token_hex(12)
    for record in event.get('Records', []):
        if record.get('eventName') not in {'INSERT', 'MODIFY'}:
            continue
        image = record.get('dynamodb', {}).get('NewImage')
        if image:
            item = deserialize_image(image)
            if item.get('status') in {'PENDING', 'FAILED'}:
                process_outbox(item, worker_id)
    return {'statusCode': 200}
