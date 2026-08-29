"""Centralized audit and operational incident logger for VideoCorso Lambdas."""

import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

import boto3

_dynamodb_resource = None
_audit_table = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def _get_table():
    global _dynamodb_resource, _audit_table
    if _audit_table is not None:
        return _audit_table
    table_name = os.environ.get('AUDIT_LOGS_TABLE')
    if not table_name:
        return None
    try:
        if _dynamodb_resource is None:
            _dynamodb_resource = boto3.resource('dynamodb')
        _audit_table = _dynamodb_resource.Table(table_name)
        return _audit_table
    except Exception as exc:
        print(f'[audit_logger] Warning: Could not initialize table {table_name}: {exc}')
        return None


def record_audit_log(
    action: str,
    target_type: str = 'system',
    target_id: str = '',
    details: Optional[dict[str, Any]] = None,
    level: str = 'INFO',
    source: str = 'system',
    actor: Optional[str] = None,
    error_message: Optional[str] = None,
    stack_trace: Optional[str] = None,
) -> Optional[str]:
    """Safely records an audit / operational incident log into DynamoDB.

    This function never raises an exception to ensure it never disrupts the primary business flow.
    """
    table = _get_table()
    if not table:
        return None

    safe_details = {}
    if details:
        try:
            safe_details = json.loads(json.dumps(details, default=str), parse_float=Decimal)
        except Exception:
            safe_details = {str(k): str(v) for k, v in details.items()}

    admin_actor = str(actor or 'system')
    audit_id = str(uuid.uuid4())
    item: dict[str, Any] = {
        'audit_id': audit_id,
        'created_at': now_iso(),
        'level': str(level).upper(),
        'source': str(source),
        'admin_email': admin_actor,
        'actor': admin_actor,
        'action': str(action),
        'target_type': str(target_type),
        'target_id': str(target_id or ''),
        'details': safe_details,
    }
    if error_message:
        item['error_message'] = str(error_message)
    if stack_trace:
        item['stack_trace'] = str(stack_trace)

    try:
        table.put_item(Item=item)
        return audit_id
    except Exception as exc:
        print(f'[audit_logger] Error recording log ({action}): {exc}')
        return None
