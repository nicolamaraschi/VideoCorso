"""Release expired paid-checkout coupon reservations idempotently."""

import os
import time
import traceback

import boto3
from boto3.dynamodb.types import TypeSerializer
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

try:
    from shared.audit_logger import record_audit_log
except Exception:
    def record_audit_log(*args, **kwargs):
        pass


dynamodb = boto3.resource('dynamodb')
client = boto3.client('dynamodb')
reservations = dynamodb.Table(os.environ['COUPON_RESERVATIONS_TABLE'])
coupons = dynamodb.Table(os.environ['COUPONS_TABLE'])
serializer = TypeSerializer()


def serialize(values):
    return {key: serializer.serialize(value) for key, value in values.items()}


def release(reservation: dict, now_epoch: int) -> bool:
    """Release exactly one slot; a concurrent webhook can win safely."""
    try:
        client.transact_write_items(TransactItems=[
            {'Update': {
                'TableName': reservations.name,
                'Key': serialize({'reservation_id': reservation['reservation_id']}),
                'UpdateExpression': 'SET #status = :released, released_at_epoch = :now',
                'ConditionExpression': '#status = :reserved AND expires_at_epoch <= :now',
                'ExpressionAttributeNames': {'#status': 'status'},
                'ExpressionAttributeValues': serialize({':released': 'RELEASED', ':reserved': 'RESERVED', ':now': now_epoch}),
            }},
            {'Update': {
                'TableName': coupons.name,
                'Key': serialize({'coupon_id': reservation['coupon_id']}),
                'UpdateExpression': 'ADD redemption_slots_used :minus_one, pending_redemptions :minus_one SET updated_at_epoch = :now',
                'ExpressionAttributeValues': serialize({':minus_one': -1, ':now': now_epoch}),
            }},
        ])
        return True
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') == 'TransactionCanceledException':
            return False
        raise


def lambda_handler(event, context):
    del event, context
    now_epoch = int(time.time())
    try:
        response = reservations.query(
            IndexName='StatusExpiryIndex',
            KeyConditionExpression=Key('status').eq('RESERVED') & Key('expires_at_epoch').lte(now_epoch),
        )
        released = sum(1 for reservation in response.get('Items', []) if release(reservation, now_epoch))
        if released > 0:
            record_audit_log(
                action='coupon_reservations_recovered',
                target_type='cron',
                target_id='coupon_recovery',
                details={'released_count': released},
                level='INFO',
                source='coupon_recovery_cron',
            )
        return {'released': released}
    except Exception as exc:
        trace = traceback.format_exc()
        print(f'coupon recovery cron error: {exc}')
        record_audit_log(
            action='coupon_recovery_error',
            target_type='cron',
            target_id='coupon_recovery',
            details={'error': str(exc)},
            level='ERROR',
            source='coupon_recovery_cron',
            error_message=str(exc),
            stack_trace=trace,
        )
        raise
