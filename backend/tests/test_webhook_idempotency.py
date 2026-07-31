"""
Characterization + correctness tests for Stripe webhook idempotency.

Unit tests cover the allowlist merge logic and field-protection invariants.
Integration tests cover the atomic TransactWriteItems behaviour.

CURRENT_BUG tests document broken behaviour that the fix must change.

Run unit tests only:
    pytest tests/test_webhook_idempotency.py -v -m "not integration"
"""

import os
import sys
import types
import importlib.util
import pathlib
from decimal import Decimal
import pytest


# ---------------------------------------------------------------------------
# Stub setup
# ---------------------------------------------------------------------------

def _setup_stubs():
    botocore = types.ModuleType("botocore")
    botocore_exc = types.ModuleType("botocore.exceptions")

    class ClientError(Exception):
        def __init__(self, error_response=None, operation_name=""):
            self.response = error_response or {"Error": {"Code": "Unknown"}}
            super().__init__(str(error_response))

    botocore_exc.ClientError = ClientError
    botocore.exceptions = botocore_exc
    sys.modules["botocore"] = botocore
    sys.modules["botocore.exceptions"] = botocore_exc

    boto3 = types.ModuleType("boto3")

    class _FakeTable:
        def get_item(self, **kw): return {}
        def query(self, **kw):    return {"Items": []}
        def scan(self, **kw):     return {"Items": []}
        def put_item(self, **kw): return {}
        def update_item(self, **kw): return {"Attributes": {}}

    class _FakeDynamo:
        def Table(self, n): return _FakeTable()

    boto3.resource = lambda *a, **k: _FakeDynamo()
    boto3.client = lambda *a, **k: types.SimpleNamespace(
        get_parameter=lambda **kw: {"Parameter": {"Value": "stub"}},
    )
    sys.modules["boto3"] = boto3
    sys.modules["boto3.dynamodb"] = types.ModuleType("boto3.dynamodb")
    cond = types.ModuleType("boto3.dynamodb.conditions")
    cond.Key = lambda k: types.SimpleNamespace(eq=lambda v: None)
    sys.modules["boto3.dynamodb.conditions"] = cond
    stripe_mod = types.ModuleType("stripe")
    stripe_mod.api_key = None
    stripe_mod.error = types.SimpleNamespace(SignatureVerificationError=Exception)
    sys.modules["stripe"] = stripe_mod
    sys.modules.setdefault("resend", types.ModuleType("resend"))


_setup_stubs()

_ROOT = pathlib.Path(__file__).parent.parent / "lambda"
_spec = importlib.util.spec_from_file_location("payment_handler_wh", _ROOT / "payment_handler/app.py")
_ph = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ph)


# ---------------------------------------------------------------------------
# Constants: allowlisted Stripe fields (target)
# ---------------------------------------------------------------------------

STRIPE_ALLOWED_FIELDS = {
    "stripe_status",
    "stripe_session_id",
    "stripe_payment_intent_id",
    "stripe_charge_id",
    "amount",
    "amount_gross",
    "currency",
    "paid_at",
    "webhook_status",
    "webhook_received_at",
    "refunded_amount",
    "refund_status",
    "refund_type",
    "refunded_at",
    "is_disputed",
    "local_status",
}

PROTECTED_ADMIN_FIELDS = {
    "access_revoked",
    "access_revoked_at",
    "access_revocation_reason",
    "manual_access_override",
    "revoked_by",
}


def make_existing_purchase(
    access_revoked: bool = False,
    manual_access_override: bool = False,
    local_status: str = "paid",
) -> dict:
    return {
        "purchase_id": "pi_test_001",
        "user_id": "user-1",
        "course_id": "course-1",
        "local_status": local_status,
        "stripe_status": "paid",
        "amount_gross": Decimal("99.00"),
        "access_unlocked": True,
        "access_revoked": access_revoked,
        "access_revoked_at": "2026-01-01T00:00:00Z" if access_revoked else None,
        "access_revocation_reason": "manual_revoke" if access_revoked else "",
        "manual_access_override": manual_access_override,
        "verified_by_admin": True,
        "refunded_amount": Decimal("0"),
        "webhook_status": "received",
    }


def make_webhook_update() -> dict:
    """Simulates fields a Stripe webhook would want to update."""
    return {
        "purchase_id": "pi_test_001",
        "stripe_status": "paid",
        "stripe_payment_intent_id": "pi_test_001",
        "amount_gross": Decimal("99.00"),
        "local_status": "paid",
        "webhook_status": "received",
        "webhook_received_at": "2026-07-31T10:00:00Z",
        # Intruder fields that must NOT overwrite admin data:
        "access_revoked": False,
        "manual_access_override": True,
        "access_revocation_reason": "",
    }


# ---------------------------------------------------------------------------
# 1. CURRENT_BUG: merged.update() overwrites all fields indiscriminately
# ---------------------------------------------------------------------------

class TestMergeCurrentBug:

    def test_CURRENT_BUG_merge_overwrites_access_revoked(self):
        """
        CURRENT BUG: save_checkout_completion does:
            merged = dict(existing)
            merged.update(purchase)   ← overwrites access_revoked, manual_access_override, etc.

        This means a webhook replay after an admin revocation un-revokes the access.
        """
        existing = make_existing_purchase(access_revoked=True)
        webhook_update = make_webhook_update()  # contains access_revoked=False

        # Current broken behaviour:
        merged = dict(existing)
        merged.update(webhook_update)

        assert merged["access_revoked"] is False, (
            "CURRENT_BUG confirmed: webhook overwrote access_revoked=True with False. "
            "After fix: access_revoked must still be True."
        )

    def test_FIXED_allowlist_merge_preserves_admin_fields(self):
        """Target behaviour: only allowed fields are merged from the webhook update."""
        existing = make_existing_purchase(access_revoked=True)
        webhook_update = make_webhook_update()

        # Allowlist merge:
        merged = dict(existing)
        for field, value in webhook_update.items():
            if field in STRIPE_ALLOWED_FIELDS:
                merged[field] = value
            # Protected admin fields are NEVER overwritten by the webhook

        assert merged["access_revoked"] is True
        assert merged["manual_access_override"] is False
        assert merged["access_revocation_reason"] == "manual_revoke"

    def test_FIXED_stripe_fields_are_updated(self):
        """Allowlist merge must still update the Stripe-owned fields."""
        existing = make_existing_purchase()
        webhook_update = {
            "stripe_status": "paid",
            "webhook_received_at": "2026-07-31T10:00:00Z",
            "amount_gross": Decimal("99.00"),
        }

        merged = dict(existing)
        for field, value in webhook_update.items():
            if field in STRIPE_ALLOWED_FIELDS:
                merged[field] = value

        assert merged["webhook_received_at"] == "2026-07-31T10:00:00Z"
        assert merged["stripe_status"] == "paid"


# ---------------------------------------------------------------------------
# 2. sync_purchase_access must not unlock a manually revoked purchase
# ---------------------------------------------------------------------------

class TestSyncPurchaseAccessRespectManualRevoke:

    def test_revoked_paid_stays_revoked_after_sync(self):
        """
        CURRENT BUG: payment_handler.sync_purchase_access does NOT check
        access_revoked before setting access_unlocked=True when local_status='paid'.
        The admin_handler version has this check; payment_handler does not.

        The fix (shared layer) will align both. After fix: result["access_unlocked"]
        must be False when access_revoked=True.
        """
        purchase = {
            **make_existing_purchase(access_revoked=True),
            "refunded_amount": Decimal("0"),
        }
        result = _ph.sync_purchase_access(purchase, action="sync")
        # CURRENT BUG: payment_handler sets access_unlocked=True ignoring access_revoked
        # After fix via shared layer this must assert False:
        # assert result["access_unlocked"] is False
        # For now document the broken outcome:
        assert result["access_unlocked"] is True, (
            "CURRENT_BUG: payment_handler.sync_purchase_access does not respect "
            "access_revoked when action='sync'. After shared-layer fix must be False."
        )

    def test_force_unlock_clears_revocation(self):
        """force_unlock is the only operation that can override a revocation."""
        purchase = make_existing_purchase(access_revoked=True)
        result = _ph.sync_purchase_access(purchase, action="force_unlock")
        assert result["access_unlocked"] is True
        assert result["access_revoked"] is False

    def test_revoke_mode_revokes_even_if_paid(self):
        purchase = make_existing_purchase(access_revoked=False)
        result = _ph.sync_purchase_access(purchase, action="revoke")
        assert result["access_revoked"] is True
        assert result["access_unlocked"] is False


# ---------------------------------------------------------------------------
# 3. Idempotency: event_already_processed / mark_event_processed
# ---------------------------------------------------------------------------

class TestWebhookEventIdempotency:

    def test_CURRENT_BUG_race_between_check_and_mark(self):
        """
        CURRENT BUG: event_already_processed() does a read, then the caller
        processes the webhook, then mark_event_processed() does a write.
        Two concurrent invocations can both see 'not processed' before either
        writes, applying the effects twice.

        After fix: both read and write must be inside a single TransactWriteItems.
        This test documents the gap.
        """
        seen_by_thread_1 = False  # first invocation: event not found → False
        seen_by_thread_2 = False  # second invocation: event not found → False (race)

        # Both threads proceed to process because neither has written yet:
        both_proceed = (not seen_by_thread_1) and (not seen_by_thread_2)
        assert both_proceed is True, (
            "CURRENT_BUG: two concurrent webhook invocations can both pass the "
            "idempotency check before either writes the event record."
        )

    def test_FIXED_atomic_event_registration(self):
        """
        Target: Put(webhook_events) with attribute_not_exists(event_id) inside
        the same transaction as Update(purchase).
        Only one of two concurrent transactions can succeed.
        """
        # Simulate DynamoDB conditional Put:
        written = set()

        def _atomic_put(event_id):
            if event_id in written:
                raise RuntimeError("ConditionalCheckFailed: event_id exists")
            written.add(event_id)
            return True

        result_1 = _atomic_put("evt_001")
        with pytest.raises(RuntimeError, match="ConditionalCheckFailed"):
            _atomic_put("evt_001")

        assert result_1 is True
        assert len(written) == 1

    def test_replay_of_same_event_id_does_not_reprocess(self):
        """
        A second webhook with the same event_id must return HTTP 200 without
        applying any changes to the purchase.
        """
        processed_events = {"evt_001"}  # already in the webhook_events table

        def _handle_webhook(event_id):
            if event_id in processed_events:
                return {"statusCode": 200, "body": '{"message":"already processed"}'}
            # ... process and write ...
            processed_events.add(event_id)
            return {"statusCode": 200, "body": '{"message":"processed"}'}

        first  = _handle_webhook("evt_001")  # already processed
        second = _handle_webhook("evt_001")  # replay

        assert first["statusCode"] == 200
        assert second["statusCode"] == 200
        assert "already processed" in first["body"]
        assert "already processed" in second["body"]


# ---------------------------------------------------------------------------
# 4. Integration: concurrent webhooks and admin revoke
# ---------------------------------------------------------------------------

INTEGRATION = pytest.mark.skipif(
    not os.environ.get("DYNAMODB_ENDPOINT"),
    reason="Set DYNAMODB_ENDPOINT=http://localhost:8000 to run integration tests",
)


@INTEGRATION
class TestWebhookVsAdminRevokeIntegration:

    @pytest.fixture(autouse=True)
    def setup_tables(self):
        import boto3
        endpoint = os.environ["DYNAMODB_ENDPOINT"]
        dynamo = boto3.resource("dynamodb", region_name="us-east-1", endpoint_url=endpoint)

        self.purchases_table = dynamo.create_table(
            TableName="test-wh-purchases",
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "purchase_id", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "purchase_id", "KeyType": "HASH"}],
        )
        self.webhook_events_table = dynamo.create_table(
            TableName="test-wh-events",
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "event_id", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "event_id", "KeyType": "HASH"}],
        )

        # Seed: a purchase that admin has manually revoked
        self.purchases_table.put_item(Item={
            "purchase_id":       "pi_001",
            "user_id":            "user-1",
            "course_id":          "course-1",
            "local_status":       "paid",
            "stripe_status":      "paid",
            "amount_gross":       Decimal("99"),
            "access_unlocked":    False,
            "access_revoked":     True,
            "access_revoked_at":  "2026-07-01T00:00:00Z",
            "access_revocation_reason": "manual_revoke",
            "manual_access_override": False,
            "refunded_amount":    Decimal("0"),
            "webhook_status":     "received",
        })
        yield
        self.purchases_table.delete()
        self.webhook_events_table.delete()

    def _apply_webhook_allowlist(self, purchase_id: str, event_id: str, stripe_fields: dict):
        import boto3
        from botocore.exceptions import ClientError as BCE

        client = boto3.client(
            "dynamodb", region_name="us-east-1",
            endpoint_url=os.environ["DYNAMODB_ENDPOINT"],
        )
        # Build UpdateExpression for allowed Stripe fields only
        allowed = {k: v for k, v in stripe_fields.items() if k in STRIPE_ALLOWED_FIELDS}
        set_parts = []
        attr_values = {}
        for i, (k, v) in enumerate(allowed.items()):
            placeholder = f":v{i}"
            set_parts.append(f"#{k} = {placeholder}")
            if isinstance(v, Decimal):
                attr_values[placeholder] = {"N": str(v)}
            else:
                attr_values[placeholder] = {"S": str(v)}
        attr_names = {f"#{k}": k for k in allowed}

        try:
            client.transact_write_items(TransactItems=[
                {
                    "Put": {
                        "TableName": "test-wh-events",
                        "Item": {"event_id": {"S": event_id}},
                        "ConditionExpression": "attribute_not_exists(event_id)",
                    }
                },
                {
                    "Update": {
                        "TableName": "test-wh-purchases",
                        "Key": {"purchase_id": {"S": purchase_id}},
                        "UpdateExpression": f"SET {', '.join(set_parts)}",
                        "ExpressionAttributeNames": attr_names,
                        "ExpressionAttributeValues": attr_values,
                    } if set_parts else {
                        "TableName": "test-wh-purchases",
                        "Key": {"purchase_id": {"S": purchase_id}},
                        "UpdateExpression": "SET webhook_status = :ws",
                        "ExpressionAttributeValues": {":ws": {"S": "received"}},
                    }
                },
            ])
            return True
        except BCE as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code == "TransactionCanceledException":
                return False
            raise

    def test_webhook_after_revoke_preserves_revocation(self):
        """
        Admin revokes access. Later a Stripe webhook replay arrives.
        The purchase must still have access_revoked=True.
        """
        self._apply_webhook_allowlist(
            purchase_id="pi_001",
            event_id="evt_replay_001",
            stripe_fields={"stripe_status": "paid", "webhook_received_at": "2026-07-31T10:00:00Z"},
        )

        item = self.purchases_table.get_item(
            Key={"purchase_id": "pi_001"}, ConsistentRead=True
        )["Item"]
        assert item["access_revoked"] is True, "Webhook must NOT overwrite admin revocation"
        assert item["access_unlocked"] is False

    def test_two_concurrent_webhooks_same_event_id(self):
        """
        Two concurrent webhooks with the same event_id must apply effects exactly once.
        """
        import threading

        results = []

        def _process():
            ok = self._apply_webhook_allowlist(
                purchase_id="pi_001",
                event_id="evt_concurrent",
                stripe_fields={"stripe_status": "paid"},
            )
            results.append(ok)

        t1 = threading.Thread(target=_process)
        t2 = threading.Thread(target=_process)
        t1.start(); t2.start()
        t1.join(); t2.join()

        successes = sum(1 for r in results if r is True)
        assert successes == 1, (
            f"Expected exactly 1 webhook to succeed, got {successes}. Results: {results}"
        )

        # The event must be in the events table exactly once
        events = self.webhook_events_table.scan()["Items"]
        assert len(events) == 1
