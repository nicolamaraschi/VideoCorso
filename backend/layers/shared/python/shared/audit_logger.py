"""Centralized audit and operational incident logger with automatic PII & credential scrubbing."""

import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

import boto3

_dynamodb_resource = None
_audit_table = None

SENSITIVE_KEY_PATTERNS = {
    'password', 'pass', 'temp_password', 'secret', 'secret_key', 'api_key',
    'apikey', 'token', 'access_token', 'refresh_token', 'authorization',
    'auth_header', 'cookie', 'cvv', 'cvc', 'card_number', 'pan', 'cardholder',
    'pin', 'private_key', 'ssn', 'tax_id',
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def sanitize_payload(obj: Any) -> Any:
    """Recursively redacts passwords, tokens, API keys and card details."""
    if isinstance(obj, dict):
        sanitized = {}
        for k, v in obj.items():
            key_lower = str(k).lower().strip()
            if any(pattern in key_lower for pattern in SENSITIVE_KEY_PATTERNS):
                sanitized[k] = '[REDACTED]'
            else:
                sanitized[k] = sanitize_payload(v)
        return sanitized
    elif isinstance(obj, list):
        return [sanitize_payload(item) for item in obj]
    elif isinstance(obj, str):
        # Prevent accidental leakage of raw Stripe secret keys or Bearer tokens
        if obj.startswith('sk_live_') or obj.startswith('sk_test_') or obj.startswith('Bearer '):
            return '[REDACTED_SECRET]'
        return obj
    return obj


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
    """Safely records an audit log into DynamoDB after redacting sensitive data.

    This function never raises an exception to ensure it never disrupts business flows.
    """
    table = _get_table()
    if not table:
        return None

    cleaned_details = sanitize_payload(details or {})
    safe_details = {}
    try:
        safe_details = json.loads(json.dumps(cleaned_details, default=str), parse_float=Decimal)
    except Exception:
        safe_details = {str(k): str(v) for k, v in cleaned_details.items()}

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
        item['error_message'] = sanitize_payload(str(error_message))
    if stack_trace:
        # Stack trace contains code lines, remove any potential secrets
        item['stack_trace'] = sanitize_payload(str(stack_trace))

    try:
        table.put_item(Item=item)
        return audit_id
    except Exception as exc:
        print(f'[audit_logger] Error recording log ({action}): {exc}')
        return None
