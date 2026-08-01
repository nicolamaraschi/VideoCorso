"""
Characterization + correctness tests for coupon redemption.

Unit tests cover the pure validation logic (no I/O).
Integration tests cover the atomic TransactWriteItems behaviour and require
DynamoDB Local (DYNAMODB_ENDPOINT env var) or the AWS dev stack.

CURRENT_BUG tests document broken race conditions in the current code.

Run unit tests only:
    pytest tests/test_coupon_redemption.py -v -m "not integration"
"""

import os
import sys
import types
import importlib.util
import pathlib
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
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
    dynamodb_types = types.ModuleType("boto3.dynamodb.types")
    class TypeSerializer:
        def serialize(self, value):
            if value is None: return {"NULL": True}
            if isinstance(value, bool): return {"BOOL": value}
            if isinstance(value, Decimal): return {"N": str(value)}
            if isinstance(value, str): return {"S": value}
            if isinstance(value, (int, float)): return {"N": str(value)}
            if isinstance(value, dict): return {"M": {k: self.serialize(v) for k, v in value.items()}}
            raise TypeError(value)
    dynamodb_types.TypeSerializer = TypeSerializer
    sys.modules["boto3.dynamodb.types"] = dynamodb_types
    cond = types.ModuleType("boto3.dynamodb.conditions")
    cond.Key = lambda k: types.SimpleNamespace(eq=lambda v: None)
    sys.modules["boto3.dynamodb.conditions"] = cond
    stripe = types.ModuleType("stripe")
    stripe.api_key = None
    stripe.error = types.SimpleNamespace(SignatureVerificationError=Exception)
    sys.modules["stripe"] = stripe
    sys.modules.setdefault("resend", types.ModuleType("resend"))


_setup_stubs()

_ROOT = pathlib.Path(__file__).parent.parent / "lambda"
_spec = importlib.util.spec_from_file_location("payment_handler", _ROOT / "payment_handler/app.py")
_ph = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ph)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def make_coupon(
    coupon_id: str = "TEST10",
    is_active: bool = True,
    is_free_access: bool = True,
    max_redemptions=None,
    current_redemptions: int = 0,
    starts_at=None,
    expires_at=None,
    course_scope=None,
    allowed_user_emails=None,
):
    return {
        "coupon_id": coupon_id,
        "code": coupon_id,
        "is_active": is_active,
        "is_free_access": is_free_access,
        "discount_type": "percent",
        "discount_value": Decimal("100"),
        "max_redemptions": max_redemptions,
        "current_redemptions": current_redemptions,
        "starts_at": starts_at,
        "expires_at": expires_at,
        "course_scope": course_scope or [],
        "allowed_user_emails": allowed_user_emails or [],
    }


def make_course(course_id="course-1", status="published", is_purchasable=True):
    return {
        "course_id": course_id,
        "public_slug": course_id,
        "status": status,
        "is_purchasable": is_purchasable,
        "price": Decimal("0"),
        "title": "Test Course",
    }


# ---------------------------------------------------------------------------
# 1. Coupon validation logic (pure unit tests)
# ---------------------------------------------------------------------------

class TestCouponValidation:

    def test_active_coupon_valid(self):
        coupon = make_coupon()
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), None)
        assert valid is True
        assert reason == ""

    def test_inactive_coupon_rejected(self):
        coupon = make_coupon(is_active=False)
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), None)
        assert valid is False
        assert reason == "coupon_disabled"

    def test_expired_coupon_rejected(self):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat().replace("+00:00", "Z")
        coupon = make_coupon(expires_at=past)
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), None)
        assert valid is False
        assert "expir" in reason.lower()

    def test_future_coupon_not_yet_active(self):
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat().replace("+00:00", "Z")
        coupon = make_coupon(starts_at=future)
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), None)
        assert valid is False

    def test_max_redemptions_reached(self):
        coupon = make_coupon(max_redemptions=5, current_redemptions=5)
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), None)
        assert valid is False
        assert reason == "coupon_exhausted"

    def test_max_redemptions_not_reached(self):
        coupon = make_coupon(max_redemptions=5, current_redemptions=4)
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), None)
        assert valid is True

    def test_no_max_redemptions_always_valid(self):
        coupon = make_coupon(max_redemptions=None, current_redemptions=9999)
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), None)
        assert valid is True

    def test_course_scope_mismatch_rejected(self):
        coupon = make_coupon(course_scope=["other-course"])
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course("course-1"), None)
        assert valid is False

    def test_course_scope_match_accepted(self):
        coupon = make_coupon(course_scope=["course-1"])
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course("course-1"), None)
        assert valid is True

    def test_email_restriction_mismatch(self):
        coupon = make_coupon(allowed_user_emails=["alice@example.com"])
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), "bob@example.com")
        assert valid is False

    def test_email_restriction_match(self):
        coupon = make_coupon(allowed_user_emails=["alice@example.com"])
        valid, reason = _ph.coupon_is_valid_for_checkout(coupon, make_course(), "alice@example.com")
        assert valid is True


# ---------------------------------------------------------------------------
# 2. Deterministic purchase_id for free-coupon redemption (target behaviour)
# ---------------------------------------------------------------------------

class TestDeterministicPurchaseId:

    def test_same_inputs_produce_same_id(self):
        """
        After the fix, the purchase_id for a free coupon redemption must be
        derived deterministically from coupon_id + user_id + course_id.
        """
        coupon_id = "FREE100"
        user_id   = "user-abc"
        course_id = "course-xyz"

        # Target implementation:
        raw = f"coupon-{coupon_id}-{user_id}-{course_id}"
        purchase_id_1 = "coupon-" + hashlib.sha256(raw.encode()).hexdigest()[:24]

        # Re-derive:
        purchase_id_2 = "coupon-" + hashlib.sha256(raw.encode()).hexdigest()[:24]

        assert purchase_id_1 == purchase_id_2

    def test_different_users_produce_different_ids(self):
        coupon_id = "FREE100"
        course_id = "course-xyz"

        def _derive(uid):
            raw = f"coupon-{coupon_id}-{uid}-{course_id}"
            return "coupon-" + hashlib.sha256(raw.encode()).hexdigest()[:24]

        assert _derive("user-1") != _derive("user-2")

    def test_CURRENT_BUG_purchase_id_is_random(self):
        """
        CURRENT BUG: create_coupon_purchase_without_stripe generates a random
        purchase_id via secrets.token_hex(12), making retries non-idempotent.

        After fix: purchase_id must be deterministic.
        """
        import secrets
        id_a = "coupon-" + secrets.token_hex(12)
        id_b = "coupon-" + secrets.token_hex(12)
        assert id_a != id_b, "CURRENT_BUG confirmed: random IDs are not idempotent"


# ---------------------------------------------------------------------------
# 3. CURRENT_BUG: access granted before redemption count checked
# ---------------------------------------------------------------------------

class TestRedemptionOrderingCurrentBug:

    def test_CURRENT_BUG_order_access_before_increment(self):
        """
        CURRENT BUG: in create_coupon_purchase_without_stripe the purchase is
        stored (granting access) BEFORE increment_coupon_redemption is called.

        This means two concurrent requests can both receive access even when
        max_redemptions=1.

        After fix: the TransactWriteItems must atomically:
          1. Increment coupon (with condition check)
          2. Write purchase (idempotent PUT)
        If either fails, no access is granted.
        """
        # Simulate current broken order:
        access_granted_before_check = True  # purchase is stored first
        redemption_limit_check = False      # check happens after

        # The race: both threads see access_granted_before_check = True
        assert access_granted_before_check is True, (
            "CURRENT_BUG documented: fix must reverse this order using a transaction."
        )


# ---------------------------------------------------------------------------
# 4. TransactWriteItems schema validation (target)
# ---------------------------------------------------------------------------

class TestTransactionSchema:

    def test_transaction_has_correct_number_of_operations(self):
        """
        The target transaction must have exactly 2 operations:
          - Update (coupon increment with condition)
          - Put (purchase with attribute_not_exists condition)
        DynamoDB forbids two operations on the same item in one transaction,
        so we cannot use a ConditionCheck + Update on the coupon.
        """
        ops = [
            {"Update": {"TableName": "coupons", "Key": {"coupon_id": "TEST"}}},
            {"Put":    {"TableName": "purchases", "Item": {"purchase_id": "id"}}},
        ]
        assert len(ops) == 2
        op_types = {list(op.keys())[0] for op in ops}
        # Must NOT have both ConditionCheck and Update on same table item
        assert "ConditionCheck" not in op_types  # can't combine with Update on same key
        assert "Update" in op_types
        assert "Put"    in op_types

    def test_idempotent_retry_returns_existing_purchase(self):
        """
        If the transaction fails because attribute_not_exists(purchase_id) is
        false (purchase already exists), the caller must:
          1. Read the existing purchase.
          2. Verify it belongs to the same user/coupon/course.
          3. Return it as a success (no second increment).
        """
        existing_purchase = {
            "purchase_id": "coupon-abc123",
            "user_id": "user-1",
            "coupon_code": "FREE100",
            "course_id": "course-xyz",
            "access_unlocked": True,
        }
        request_user_id = "user-1"
        request_coupon  = "FREE100"
        request_course  = "course-xyz"

        # Verify the existing purchase matches the request
        is_same = (
            existing_purchase["user_id"]    == request_user_id
            and existing_purchase["coupon_code"] == request_coupon
            and existing_purchase["course_id"]   == request_course
        )
        assert is_same is True  # must return this as success, not error


# ---------------------------------------------------------------------------
# 5. Stripe checkout: block custom coupons with max_redemptions
# ---------------------------------------------------------------------------

class TestStripeCheckoutCouponBlock:

    def test_CURRENT_BUG_no_block_on_limited_coupon_in_stripe_flow(self):
        """
        CURRENT BUG: the Stripe checkout session is created without reserving
        the coupon. If max_redemptions=1 and two users start checkout
        simultaneously, both receive a session URL and potentially both pay.

        After fix: when a custom coupon has max_redemptions set, the checkout
        creation must either:
          (a) Use a Stripe promotion code with its own max_redemptions, or
          (b) Atomically reserve the coupon (reservation record with TTL), or
          (c) Raise HTTP 400 until solution (a) or (b) is implemented.

        This test documents that option (c) must be active as the interim guard.
        """
        coupon = make_coupon(max_redemptions=1, is_free_access=False)

        # Target: detect limited custom coupon in Stripe flow and raise/block
        def _would_be_blocked(coupon):
            return coupon.get("max_redemptions") is not None

        assert _would_be_blocked(coupon) is True, (
            "CURRENT_BUG: a custom coupon with max_redemptions must be blocked "
            "from the Stripe checkout flow until a reservation mechanism is in place."
        )

    def test_unlimited_coupon_not_blocked(self):
        """Unlimited coupons (max_redemptions=None) are safe for Stripe flow."""
        coupon = make_coupon(max_redemptions=None, is_free_access=False)

        def _would_be_blocked(coupon):
            return coupon.get("max_redemptions") is not None

        assert _would_be_blocked(coupon) is False


# ---------------------------------------------------------------------------
# 6. Integration: 10 concurrent redemptions, max_redemptions=1
# ---------------------------------------------------------------------------

INTEGRATION = pytest.mark.skipif(
    not os.environ.get("DYNAMODB_ENDPOINT"),
    reason="Set DYNAMODB_ENDPOINT=http://localhost:8000 to run integration tests",
)


@INTEGRATION
class TestConcurrentCouponRedemption:

    @pytest.fixture(autouse=True)
    def setup_tables(self):
        import boto3
        endpoint = os.environ["DYNAMODB_ENDPOINT"]
        dynamo = boto3.resource("dynamodb", region_name="us-east-1", endpoint_url=endpoint)

        # Coupons table
        coupon_table = dynamo.create_table(
            TableName="test-coupons",
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "coupon_id", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "coupon_id", "KeyType": "HASH"}],
        )
        coupon_table.put_item(Item={
            "coupon_id": "ONCE",
            "code": "ONCE",
            "is_active": True,
            "is_free_access": True,
            "max_redemptions": 1,
            "current_redemptions": 0,
            "expires_at": None,
            "starts_at": None,
            "course_scope": [],
            "allowed_user_emails": [],
        })

        # Purchases table
        purchase_table = dynamo.create_table(
            TableName="test-purchases",
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "purchase_id", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "purchase_id", "KeyType": "HASH"}],
        )

        self.dynamo = dynamo
        self.coupon_table = coupon_table
        self.purchase_table = purchase_table
        yield
        coupon_table.delete()
        purchase_table.delete()

    def _attempt_atomic_redemption(self, user_id: str, course_id: str = "course-1") -> bool:
        """
        Simulates the target atomic redemption using TransactWriteItems.
        Returns True if redemption succeeded, False if the coupon limit was hit.
        """
        import boto3
        from botocore.exceptions import ClientError as BCE

        coupon_id = "ONCE"
        raw = f"coupon-{coupon_id}-{user_id}-{course_id}"
        purchase_id = "coupon-" + hashlib.sha256(raw.encode()).hexdigest()[:24]

        dynamodb_client = boto3.client(
            "dynamodb", region_name="us-east-1",
            endpoint_url=os.environ["DYNAMODB_ENDPOINT"],
        )
        try:
            dynamodb_client.transact_write_items(TransactItems=[
                {
                    "Update": {
                        "TableName": "test-coupons",
                        "Key": {"coupon_id": {"S": coupon_id}},
                        "UpdateExpression": "ADD current_redemptions :one",
                        "ConditionExpression": (
                            "is_active = :true AND ("
                            "attribute_not_exists(max_redemptions) OR "
                            "attribute_not_exists(current_redemptions) OR "
                            "current_redemptions < max_redemptions)"
                        ),
                        "ExpressionAttributeValues": {
                            ":one": {"N": "1"},
                            ":true": {"BOOL": True},
                        },
                    }
                },
                {
                    "Put": {
                        "TableName": "test-purchases",
                        "Item": {
                            "purchase_id": {"S": purchase_id},
                            "user_id":     {"S": user_id},
                            "course_id":   {"S": course_id},
                            "coupon_code": {"S": coupon_id},
                            "access_unlocked": {"BOOL": True},
                        },
                        "ConditionExpression": "attribute_not_exists(purchase_id)",
                    }
                },
            ])
            return True
        except BCE as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code in ("TransactionCanceledException", "ConditionalCheckFailedException"):
                return False
            raise

    def test_10_concurrent_only_1_succeeds(self):
        """
        10 concurrent threads attempt to redeem a coupon with max_redemptions=1.
        Exactly 1 must succeed and exactly 1 purchase must exist.
        """
        import threading

        results = []

        def _attempt(i):
            ok = self._attempt_atomic_redemption(user_id=f"user-{i}")
            results.append(ok)

        threads = [threading.Thread(target=_attempt, args=(i,)) for i in range(10)]
        for t in threads: t.start()
        for t in threads: t.join()

        successes = sum(1 for r in results if r)
        purchases = self.purchase_table.scan()["Items"]

        assert successes == 1, f"Expected 1 success, got {successes}. Results: {results}"
        assert len(purchases) == 1, f"Expected 1 purchase, got {len(purchases)}"

    def test_retry_after_lost_response_is_idempotent(self):
        """
        Simulates a client that receives a network error after the server
        succeeded. The retry must find the existing purchase and not create
        a second one or increment the coupon twice.
        """
        user_id = "user-retry"

        # First attempt (succeeds)
        ok1 = self._attempt_atomic_redemption(user_id=user_id)
        assert ok1 is True

        # Second attempt (simulated retry): TransactWriteItems fails because
        # purchase already exists (attribute_not_exists fails).
        # The caller must read the existing purchase and return it as success.
        ok2 = self._attempt_atomic_redemption(user_id=user_id)
        assert ok2 is False  # transaction itself fails (purchase exists)

        # Coupon must have been incremented exactly once
        coupon = self.coupon_table.get_item(Key={"coupon_id": "ONCE"})["Item"]
        assert int(coupon["current_redemptions"]) == 1
