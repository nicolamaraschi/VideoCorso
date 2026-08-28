"""Regression tests for the transactional Stripe webhook write path."""

import importlib.util
import pathlib
import sys
import threading
import types
from decimal import Decimal

import pytest


ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "layers" / "shared" / "python"))


def install_stubs():
    botocore = types.ModuleType("botocore")
    exceptions = types.ModuleType("botocore.exceptions")

    class ClientError(Exception):
        def __init__(self, response, operation_name):
            self.response = response
            super().__init__(str(response))

    exceptions.ClientError = ClientError
    botocore.exceptions = exceptions
    sys.modules["botocore"] = botocore
    sys.modules["botocore.exceptions"] = exceptions

    boto3 = types.ModuleType("boto3")
    boto3.resource = lambda *_args, **_kwargs: types.SimpleNamespace(
        Table=lambda name: types.SimpleNamespace(name=name, get_item=lambda **_kw: {})
    )
    boto3.client = lambda *_args, **_kwargs: types.SimpleNamespace(
        get_parameter=lambda **_kw: {"Parameter": {"Value": "stub"}}
    )
    dynamodb = types.ModuleType("boto3.dynamodb")
    conditions_module = types.ModuleType("boto3.dynamodb.conditions")
    conditions_module.Key = lambda key: types.SimpleNamespace(eq=lambda value: (key, value))
    types_module = types.ModuleType("boto3.dynamodb.types")

    class TypeSerializer:
        def serialize(self, value):
            if isinstance(value, bool): return {"BOOL": value}
            if value is None: return {"NULL": True}
            if isinstance(value, Decimal): return {"N": str(value)}
            if isinstance(value, (int, float)): return {"N": str(value)}
            if isinstance(value, str): return {"S": value}
            if isinstance(value, dict): return {"M": {k: self.serialize(v) for k, v in value.items()}}
            if isinstance(value, list): return {"L": [self.serialize(v) for v in value]}
            raise TypeError(f"unsupported value: {value!r}")

    types_module.TypeSerializer = TypeSerializer
    sys.modules["boto3"] = boto3
    sys.modules["boto3.dynamodb"] = dynamodb
    sys.modules["boto3.dynamodb.conditions"] = conditions_module
    sys.modules["boto3.dynamodb.types"] = types_module
    stripe = types.ModuleType("stripe")
    stripe.error = types.SimpleNamespace(SignatureVerificationError=Exception)
    sys.modules["stripe"] = stripe
    sys.modules.setdefault("resend", types.ModuleType("resend"))
    return ClientError


ClientError = install_stubs()
spec = importlib.util.spec_from_file_location("payment_transactions", ROOT / "lambda" / "payment_handler" / "app.py")
payment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(payment)


class Table:
    def __init__(self, name): self.name = name
    def get_item(self, **_kwargs): return {}


class StripeSessionTable(Table):
    def __init__(self, items):
        super().__init__("purchases")
        self.items = items
        self.queries = []

    def query(self, **kwargs):
        self.queries.append(kwargs)
        return {"Items": self.items}


class Client:
    def __init__(self, outcome="success"):
        self.outcome, self.calls = outcome, []

    def transact_write_items(self, *, TransactItems):
        self.calls.append(TransactItems)
        if self.outcome == "duplicate":
            raise ClientError({"Error": {"Code": "TransactionCanceledException"},
                               "CancellationReasons": [{"Code": "ConditionalCheckFailed"}]}, "TransactWriteItems")
        if self.outcome == "purchase_condition":
            raise ClientError({"Error": {"Code": "TransactionCanceledException"},
                               "CancellationReasons": [{"Code": "None"}, {"Code": "ConditionalCheckFailed"}]}, "TransactWriteItems")
        if self.outcome == "other_cancel":
            raise ClientError({"Error": {"Code": "TransactionCanceledException"},
                               "CancellationReasons": [{"Code": "None"}, {"Code": "TransactionConflict"}]}, "TransactWriteItems")
        if self.outcome == "iam":
            raise ClientError({"Error": {"Code": "AccessDeniedException"}}, "TransactWriteItems")


@pytest.fixture
def configured_payment():
    payment.purchases_table = Table("purchases")
    payment.coupons_table = Table("coupons")
    payment.webhook_events_table = Table("events")
    return payment


def purchase():
    return payment.build_purchase_item(
        user_id="user-1", customer_email="student@example.test",
        course={"course_id": "course-1", "title": "Course"}, amount_gross=Decimal("99"),
        local_status="paid", stripe_status="succeeded", stripe_session_id="cs_1",
        stripe_payment_intent_id="pi_1", stripe_charge_id=None, webhook_status="received",
        purchase_origin="public_checkout", coupon=None,
    )


def test_duplicate_event_is_the_only_cancellation_returning_false(configured_payment):
    configured_payment.dynamodb_client = Client("duplicate")
    assert configured_payment._transactional_webhook_write("evt_1", "payment_intent.succeeded", purchase()) is False


def test_purchase_condition_is_a_cas_conflict_not_a_duplicate(configured_payment):
    configured_payment.dynamodb_client = Client("purchase_condition")
    with pytest.raises(configured_payment.PurchaseVersionConflict):
        configured_payment._transactional_webhook_write(
            "evt_1", "payment_intent.succeeded", purchase(), expected_purchase_version=0,
        )


@pytest.mark.parametrize("outcome", ["other_cancel", "iam"])
def test_non_duplicate_non_cas_transaction_errors_are_reraised(configured_payment, outcome):
    configured_payment.dynamodb_client = Client(outcome)
    with pytest.raises(ClientError):
        configured_payment._transactional_webhook_write("evt_1", "payment_intent.succeeded", purchase())


def test_serialization_error_is_reraised_before_transaction(configured_payment):
    client = Client()
    configured_payment.dynamodb_client = client
    invalid = purchase()
    invalid["admin_notes"] = object()
    with pytest.raises(TypeError):
        configured_payment._transactional_webhook_write("evt_1", "payment_intent.succeeded", invalid)
    assert client.calls == []


def test_float_values_are_converted_before_low_level_serialization(configured_payment):
    assert configured_payment.serialize_item({"amount": 12.5}) == {"amount": {"N": "12.5"}}


def test_new_purchase_upsert_initializes_admin_defaults(configured_payment):
    client = Client()
    configured_payment.dynamodb_client = client
    assert configured_payment._transactional_webhook_write("evt_new", "checkout.session.completed", purchase()) is True
    update = client.calls[0][1]["Update"]
    names, expression = update["ExpressionAttributeNames"], update["UpdateExpression"]
    for field in ("access_revoked", "access_revoked_at", "access_revocation_reason", "manual_access_override", "revoked_by", "admin_notes"):
        token = next(key for key, value in names.items() if value == field)
        assert f"{token} = if_not_exists({token}," in expression


def test_missing_purchase_event_is_event_only_and_idempotent(configured_payment):
    client = Client()
    configured_payment.dynamodb_client = client
    assert configured_payment._transactional_webhook_write("evt_missing", "payment_intent.succeeded") is True
    assert len(client.calls[0]) == 1
    assert client.calls[0][0]["Put"]["ConditionExpression"] == "attribute_not_exists(event_id)"


def test_checkout_webhook_outbox_is_in_the_same_transaction(configured_payment):
    configured_payment.provisioning_outbox_table = Table("outbox")
    client = Client()
    configured_payment.dynamodb_client = client
    outbox = {"outbox_id": "provision:pi_1", "purchase_id": "pi_1", "status": "PENDING"}
    assert configured_payment._transactional_webhook_write("evt_outbox", "checkout.session.completed", purchase(), provisioning_outbox=outbox)
    put = client.calls[0][-1]["Put"]
    assert put["TableName"] == "outbox"
    assert put["ConditionExpression"] == "attribute_not_exists(outbox_id)"


def test_free_coupon_purchase_and_provisioning_outbox_share_one_transaction(configured_payment):
    configured_payment.provisioning_outbox_table = Table("outbox")
    configured_payment.dynamodb_client = Client()
    free_purchase = purchase()
    free_purchase["purchase_id"] = "coupon-free-1"
    coupon = {"coupon_id": "FREE", "code": "FREE", "is_active": True, "max_redemptions": 10}
    outbox = {"outbox_id": "provision:coupon-free-1", "purchase_id": "coupon-free-1", "status": "PENDING"}
    configured_payment.redeem_free_coupon_atomically(free_purchase, coupon, outbox)
    items = configured_payment.dynamodb_client.calls[0]
    assert [next(iter(item)) for item in items] == ["Update", "Put", "Put"]


def _stripe_checkout_session(payment_status="paid", status="complete"):
    return {
        "id": "cs_test_customer_return",
        "payment_status": payment_status,
        "status": status,
        "metadata": {"course_id": "course-1", "course_title": "Course"},
    }


def test_payment_verification_confirms_payment_but_waits_for_local_activation(configured_payment, monkeypatch):
    """A paid Stripe return must not falsely promise a course before the webhook projection exists."""
    configured_payment.purchases_table = StripeSessionTable([])
    configured_payment.stripe.checkout = types.SimpleNamespace(
        Session=types.SimpleNamespace(retrieve=lambda *_args, **_kwargs: _stripe_checkout_session())
    )
    monkeypatch.setattr(configured_payment, "configure_stripe", lambda: None)

    response = configured_payment.verify_payment("cs_test_customer_return")
    payload = __import__("json").loads(response["body"])["data"]

    assert response["statusCode"] == 200
    assert payload["payment_state"] == "paid"
    assert payload["access_state"] == "processing"
    assert configured_payment.purchases_table.queries[0]["IndexName"] == "StripeSessionIndex"


def test_payment_verification_only_declares_active_when_the_access_gate_grants(configured_payment, monkeypatch):
    configured_payment.purchases_table = StripeSessionTable([{
        "purchase_id": "pi_1", "local_status": "paid", "access_unlocked": True,
        "access_revoked": False, "manual_access_override": False, "refunded_amount": Decimal("0"),
    }])
    configured_payment.stripe.checkout = types.SimpleNamespace(
        Session=types.SimpleNamespace(retrieve=lambda *_args, **_kwargs: _stripe_checkout_session())
    )
    monkeypatch.setattr(configured_payment, "configure_stripe", lambda: None)

    payload = __import__("json").loads(configured_payment.verify_payment("cs_test_customer_return")["body"])["data"]
    assert payload["payment_state"] == "paid"
    assert payload["access_state"] == "active"


def test_payment_verification_never_calls_an_unpaid_session_successful(configured_payment, monkeypatch):
    configured_payment.purchases_table = StripeSessionTable([])
    configured_payment.stripe.checkout = types.SimpleNamespace(
        Session=types.SimpleNamespace(retrieve=lambda *_args, **_kwargs: _stripe_checkout_session("unpaid", "open"))
    )
    monkeypatch.setattr(configured_payment, "configure_stripe", lambda: None)

    payload = __import__("json").loads(configured_payment.verify_payment("cs_test_customer_return")["body"])["data"]
    assert payload["payment_state"] == "pending"
    assert payload["access_state"] == "not_available"
    assert items[2]["Put"]["TableName"] == "outbox"


def test_coupon_transaction_uses_stored_key_not_normalized_display_code(configured_payment):
    configured_payment.provisioning_outbox_table = Table("outbox")
    configured_payment.dynamodb_client = Client()
    item = purchase()
    item["purchase_id"] = "coupon-mixed-case"
    configured_payment.redeem_free_coupon_atomically(
        item, {"coupon_id": "FreeMixed", "code": "FREEMIXED", "is_active": True},
    )
    assert configured_payment.dynamodb_client.calls[0][0]["Update"]["Key"] == {"coupon_id": {"S": "FreeMixed"}}


def test_free_coupon_race_retries_until_the_winning_purchase_is_visible(configured_payment, monkeypatch):
    class RaceClient:
        def transact_write_items(self, **_kwargs):
            raise ClientError({"Error": {"Code": "TransactionCanceledException"}}, "TransactWriteItems")

    class DelayedPurchaseTable(Table):
        def __init__(self): super().__init__("purchases"); self.reads = 0
        def get_item(self, **_kwargs):
            self.reads += 1
            return {} if self.reads == 1 else {"Item": purchase()}

    configured_payment.dynamodb_client = RaceClient()
    configured_payment.purchases_table = DelayedPurchaseTable()
    monkeypatch.setattr(configured_payment.time, "sleep", lambda _seconds: None)
    result = configured_payment.redeem_free_coupon_atomically(
        {**purchase(), "purchase_id": "pi_1"}, {"coupon_id": "FREE", "is_active": True},
    )
    assert result["purchase_id"] == "pi_1"


def test_secure_parameter_is_cached(configured_payment, monkeypatch):
    calls = []
    configured_payment._secret_cache.clear()
    monkeypatch.setattr(configured_payment.ssm_client, "get_parameter", lambda **kwargs: (
        calls.append(kwargs) or {"Parameter": {"Value": "whsec_cached"}}
    ))
    assert configured_payment.get_secure_parameter("/videocorso/dev/stripe/webhook-secret") == "whsec_cached"
    assert configured_payment.get_secure_parameter("/videocorso/dev/stripe/webhook-secret") == "whsec_cached"
    assert len(calls) == 1


def test_webhook_only_needs_webhook_secret(configured_payment, monkeypatch):
    configured_payment._secret_cache.clear()
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET_PARAMETER", "/videocorso/dev/stripe/webhook-secret")
    monkeypatch.delenv("STRIPE_SECRET_KEY_PARAMETER", raising=False)
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("RESEND_API_KEY_PARAMETER", raising=False)
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.setattr(configured_payment.ssm_client, "get_parameter", lambda **kwargs: {
        "Parameter": {"Value": "whsec_only"}
    })
    configured_payment.stripe.Webhook = types.SimpleNamespace(construct_event=lambda **_kwargs: {
        "id": "evt_lazy", "type": "customer.created", "data": {"object": {}}
    })
    monkeypatch.setattr(configured_payment, "event_already_processed", lambda _event_id: False)
    monkeypatch.setattr(configured_payment, "_transactional_webhook_write", lambda *_args, **_kwargs: True)
    response = configured_payment.handle_webhook({"body": "{}", "headers": {"Stripe-Signature": "sig"}})
    assert response["statusCode"] == 200
    assert getattr(configured_payment.stripe, "api_key", None) is None


def test_checkout_without_stripe_key_is_controlled_error(configured_payment, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY_PARAMETER", raising=False)
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    configured_payment.ALLOWED_CHECKOUT_ORIGINS = {"http://localhost:5173"}
    course = {"course_id": "course-1", "title": "Course", "price": Decimal("10"), "status": "published", "is_purchasable": True}
    monkeypatch.setattr(configured_payment, "get_checkout_course", lambda _course_id: course)
    monkeypatch.setattr(configured_payment, "is_purchasable_course", lambda _course: True)
    monkeypatch.setattr(configured_payment, "validate_coupon_for_checkout", lambda *_args: None)
    monkeypatch.setattr(configured_payment, "compute_discounted_total", lambda *_args: Decimal("10"))
    monkeypatch.setattr(configured_payment, "claim_checkout_session_creation", lambda *_args, **_kwargs: {
        "state": "CLAIMED", "claim_token": "test-claim",
    })
    response = configured_payment.lambda_handler({
        "path": "/payment/create-checkout", "httpMethod": "POST",
        "body": '{"course_id":"course-1","checkout_request_id":"req-test-no-stripe-key","success_url":"http://localhost:5173/ok","cancel_url":"http://localhost:5173/no","terms_accepted":true,"digital_content_consent":true,"terms_version":"2026-08-10"}',
    }, None)
    # The response must be a controlled 500 without leaking the internal
    # config/parameter name to the client; that detail is only ever printed
    # server-side.
    assert response["statusCode"] == 500
    assert "STRIPE_SECRET_KEY_PARAMETER" not in response["body"]
    assert "Unable to create checkout session" in response["body"]


def test_checkout_requires_versioned_explicit_digital_content_acceptance(configured_payment):
    with pytest.raises(ValueError, match="Terms acceptance"):
        configured_payment.checkout_acceptance({
            "digital_content_consent": True,
            "terms_version": configured_payment.TERMS_VERSION,
        })
    with pytest.raises(ValueError, match="Digital content consent"):
        configured_payment.checkout_acceptance({
            "terms_accepted": True,
            "terms_version": configured_payment.TERMS_VERSION,
        })
    acceptance = configured_payment.checkout_acceptance({
        "terms_accepted": True,
        "digital_content_consent": True,
        "terms_version": configured_payment.TERMS_VERSION,
    })
    assert acceptance["terms_accepted"] is True
    assert acceptance["digital_content_consent"] is True
    assert acceptance["terms_version"] == configured_payment.TERMS_VERSION


def test_checkout_redirects_allow_only_the_configured_amplify_origins(configured_payment):
    configured_payment.ALLOWED_CHECKOUT_ORIGINS = {
        "https://main.d26u0xz2smmxfz.amplifyapp.com",
        "https://development.d26u0xz2smmxfz.amplifyapp.com",
    }
    assert configured_payment.validate_checkout_redirect_url(
        "https://main.d26u0xz2smmxfz.amplifyapp.com/checkout?payment=success", "success_url",
    ).startswith("https://main.d26u0xz2smmxfz.amplifyapp.com")
    with pytest.raises(ValueError):
        configured_payment.validate_checkout_redirect_url("https://evil.example/checkout", "success_url")
    with pytest.raises(ValueError):
        configured_payment.validate_checkout_redirect_url("https://development.evil.example/checkout", "success_url")


def test_email_without_resend_key_is_scoped_and_never_logs_secret(configured_payment, monkeypatch, capsys):
    configured_payment._secret_cache.clear()
    monkeypatch.setenv("RESEND_API_KEY_PARAMETER", "/videocorso/dev/resend/api-key")
    monkeypatch.setenv("RESEND_TEST_RECIPIENTS", "student@example.test")
    secret = "do-not-log-this-secret"
    monkeypatch.setattr(configured_payment.ssm_client, "get_parameter", lambda **_kwargs: (_ for _ in ()).throw(
        ClientError({"Error": {"Code": "ParameterNotFound"}}, "GetParameter")
    ))
    assert configured_payment.send_welcome_email("student@example.test", "password", "Course") is False
    output = capsys.readouterr().out
    assert "/videocorso/dev/resend/api-key" in output
    assert secret not in output


def test_coupon_purchase_id_is_deterministic_and_user_scoped(configured_payment):
    first = configured_payment.coupon_purchase_id("FREE100", "course-1", "user-1")
    assert first == configured_payment.coupon_purchase_id("FREE100", "course-1", "user-1")
    assert first != configured_payment.coupon_purchase_id("FREE100", "course-1", "user-2")


def test_stripe_state_cannot_regress_after_refund_or_dispute(configured_payment):
    refunded = {"local_status": "refunded", "refunded_amount": Decimal("20"), "stripe_event_created": 200}
    succeeded = {"local_status": "paid", "refunded_amount": Decimal("0"), "stripe_event_created": 300}
    result = configured_payment.merge_stripe_state(refunded, succeeded)
    assert result["local_status"] == "refunded"
    assert result["refunded_amount"] == Decimal("20")

    disputed = {"local_status": "disputed", "refunded_amount": Decimal("0"), "stripe_event_created": 200}
    result = configured_payment.merge_stripe_state(disputed, succeeded)
    assert result["local_status"] == "disputed"


def test_stripe_streams_keep_independent_monotone_timestamps(configured_payment):
    assert configured_payment.stripe_stream_timestamps("payment_intent.succeeded", 10) == {
        "payment_intent_event_at": 10,
    }
    assert configured_payment.stripe_stream_timestamps("charge.refunded", 20) == {
        "charge_event_at": 20, "refund_event_at": 20,
    }
    result = configured_payment.merge_stripe_state(
        {"refund_event_at": 20, "local_status": "refunded", "refunded_amount": Decimal("5")},
        {"refund_event_at": 10, "local_status": "paid", "refunded_amount": Decimal("0")},
    )
    assert result["refund_event_at"] == 20
    assert result["local_status"] == "refunded"


def test_checkout_request_id_rejects_different_payload(configured_payment):
    fingerprint = configured_payment.checkout_fingerprint("user-1", "course-1", "FREE100", Decimal("0"))
    assert fingerprint == configured_payment.checkout_fingerprint("user-1", "course-1", "FREE100", Decimal("0"))
    assert fingerprint != configured_payment.checkout_fingerprint("user-1", "course-2", "FREE100", Decimal("0"))


@pytest.mark.parametrize("coupon,expected", [
    ({"is_active": False}, "coupon_disabled"),
    ({"is_active": True, "expires_at": "2000-01-01T00:00:00Z"}, "coupon_expired"),
    ({"is_active": True, "max_redemptions": 1, "current_redemptions": 1}, "coupon_exhausted"),
    ({"is_active": True, "course_scope": ["other-course"]}, "coupon_not_applicable"),
])
def test_quote_coupon_errors_are_specific(configured_payment, coupon, expected):
    valid, reason = configured_payment.coupon_is_valid_for_checkout(
        coupon, {"course_id": "course-1", "public_slug": "course-1"}, "student@example.test",
    )
    assert valid is False
    assert reason == expected


def test_existing_purchase_write_uses_version_cas_and_increments(configured_payment):
    client = Client()
    configured_payment.dynamodb_client = client
    configured_payment._transactional_webhook_write(
        "evt_cas", "payment_intent.succeeded", purchase(), expected_purchase_version=4,
    )
    update = client.calls[0][1]["Update"]
    assert update["ConditionExpression"] == (
        "(attribute_not_exists(#version) AND :expected_version = :zero_version) OR #version = :expected_version"
    )
    assert update["ExpressionAttributeValues"][":expected_version"] == {"N": "4"}
    assert update["ExpressionAttributeValues"][":next_version"] == {"N": "5"}


def test_cas_conflict_rereads_and_remerges_before_retry(configured_payment, monkeypatch):
    class ConflictThenSuccess:
        def __init__(self): self.calls = []
        def transact_write_items(self, *, TransactItems):
            self.calls.append(TransactItems)
            if len(self.calls) == 1:
                raise ClientError({"Error": {"Code": "TransactionCanceledException"}, "CancellationReasons": [
                    {"Code": "None"}, {"Code": "ConditionalCheckFailed"},
                ]}, "TransactWriteItems")

    initial = {**purchase(), "version": 0, "payment_intent_event_at": 1}
    refreshed = {**purchase(), "version": 1, "payment_intent_event_at": 1, "webhook_status": "received"}
    reads = iter([initial, refreshed])
    configured_payment.dynamodb_client = ConflictThenSuccess()
    monkeypatch.setattr(configured_payment, "read_purchase_consistently", lambda *_args, **_kwargs: next(reads))
    response = configured_payment.update_purchase_from_payment_intent(
        {"id": "pi_1", "status": "succeeded"}, "payment_intent.succeeded", "evt_cas", 2,
    )
    assert response["statusCode"] == 200
    assert len(configured_payment.dynamodb_client.calls) == 2
    second = configured_payment.dynamodb_client.calls[1][1]["Update"]
    assert second["ExpressionAttributeValues"][":expected_version"] == {"N": "1"}


def test_old_event_in_same_stream_is_recorded_without_purchase_mutation(configured_payment, monkeypatch):
    existing = {**purchase(), "version": 3, "payment_intent_event_at": 100}
    configured_payment.dynamodb_client = Client()
    monkeypatch.setattr(configured_payment, "read_purchase_consistently", lambda *_args, **_kwargs: existing)
    response = configured_payment.update_purchase_from_payment_intent(
        {"id": "pi_1", "status": "succeeded"}, "payment_intent.succeeded", "evt_old", 99,
    )
    assert response["statusCode"] == 200
    assert len(configured_payment.dynamodb_client.calls[0]) == 1


def test_purchase_not_visible_is_retryable_and_event_is_not_claimed(configured_payment, monkeypatch):
    configured_payment.dynamodb_client = Client()
    monkeypatch.setattr(configured_payment, "read_purchase_consistently", lambda *_args, **_kwargs: None)
    response = configured_payment.update_purchase_from_payment_intent(
        {"id": "pi_1", "status": "succeeded"}, "payment_intent.succeeded", "evt_missing", 10,
    )
    assert response["statusCode"] == 503
    assert configured_payment.dynamodb_client.calls == []


def test_charge_without_payment_intent_is_retryable_and_not_claimed(configured_payment):
    configured_payment.dynamodb_client = Client()
    response = configured_payment.handle_charge_event({}, "charge.refunded", "evt_unlinked", 10)
    assert response["statusCode"] == 503
    assert configured_payment.dynamodb_client.calls == []


def test_refund_remains_effective_when_later_succeeded_event_arrives(configured_payment):
    refunded = {
        "local_status": "refunded", "refunded_amount": Decimal("10"),
        "refund_event_at": 50, "version": 2,
    }
    succeeded = {
        "local_status": "paid", "refunded_amount": Decimal("0"),
        "payment_intent_event_at": 60, "_stripe_stream": "payment_intent",
    }
    result = configured_payment.merge_stripe_state(refunded, succeeded)
    assert result["local_status"] == "refunded"
    assert result["refunded_amount"] == Decimal("10")


def test_succeeded_and_refund_concurrent_remerge_to_one_monotone_purchase(configured_payment, monkeypatch):
    """Two webhook invocations read version 0; one must CAS-retry and re-merge."""
    state = {**purchase(), "version": 0}
    lock = threading.Lock()
    read_barrier = threading.Barrier(2)
    local = threading.local()

    def read(_purchase_id, **_kwargs):
        if not getattr(local, "initial_read", False):
            local.initial_read = True
            read_barrier.wait(timeout=2)
        with lock:
            return dict(state)

    def decode(attribute):
        if "S" in attribute: return attribute["S"]
        if "N" in attribute: return Decimal(attribute["N"])
        if "BOOL" in attribute: return attribute["BOOL"]
        if "NULL" in attribute: return None
        return attribute

    class AtomicClient:
        def __init__(self): self.calls = []
        def transact_write_items(self, *, TransactItems):
            update = TransactItems[1]["Update"]
            with lock:
                self.calls.append(TransactItems)
                expected = int(update["ExpressionAttributeValues"][":expected_version"]["N"])
                if expected != state["version"]:
                    raise ClientError({"Error": {"Code": "TransactionCanceledException"}, "CancellationReasons": [
                        {"Code": "None"}, {"Code": "ConditionalCheckFailed"},
                    ]}, "TransactWriteItems")
                for token, field in update["ExpressionAttributeNames"].items():
                    if not token.startswith("#f"):
                        continue
                    value = update["ExpressionAttributeValues"].get(":v" + token[2:])
                    if value is not None:
                        state[field] = decode(value)
                state["version"] = int(update["ExpressionAttributeValues"][":next_version"]["N"])

    configured_payment.dynamodb_client = AtomicClient()
    monkeypatch.setattr(configured_payment, "read_purchase_consistently", read)
    results, errors = [], []

    def succeeded():
        try:
            results.append(configured_payment.update_purchase_from_payment_intent(
                {"id": "pi_1", "status": "succeeded"}, "payment_intent.succeeded", "evt_success", 100,
            ))
        except Exception as exc: errors.append(exc)

    def refunded():
        try:
            results.append(configured_payment.update_purchase_from_payment_intent(
                {"id": "pi_1", "status": "succeeded", "latest_charge": {"amount_refunded": 1000}},
                "charge.refunded", "evt_refund", 101,
            ))
        except Exception as exc: errors.append(exc)

    first, second = threading.Thread(target=succeeded), threading.Thread(target=refunded)
    first.start(); second.start(); first.join(timeout=3); second.join(timeout=3)
    assert not errors
    assert [response["statusCode"] for response in results] == [200, 200]
    assert state["version"] == 2
    assert state["local_status"] == "refunded"
    assert state["refunded_amount"] == Decimal("10")


def test_dispute_states_are_explicit_and_reconcile_multiple_disputes(configured_payment):
    base = {**purchase(), "version": 1, "local_status": "paid", "active_dispute_ids": [], "lost_dispute_ids": []}
    intent = {"id": "pi_1", "status": "succeeded"}
    created_a = configured_payment._dispute_update(
        base, {"id": "du_a", "status": "needs_response", "charge": "ch_1"},
        "charge.dispute.created", 10, intent,
    )
    after_a = configured_payment.merge_stripe_state(base, created_a)
    created_b = configured_payment._dispute_update(
        after_a, {"id": "du_b", "status": "under_review", "charge": "ch_1"},
        "charge.dispute.created", 11, intent,
    )
    after_b = configured_payment.merge_stripe_state(after_a, created_b)
    won_a = configured_payment._dispute_update(
        after_b, {"id": "du_a", "status": "won", "charge": "ch_1"},
        "charge.dispute.closed", 12, intent,
    )
    after_won_a = configured_payment.merge_stripe_state(after_b, won_a)
    assert after_won_a["local_status"] == "disputed"
    assert after_won_a["active_dispute_ids"] == ["du_b"]
    won_b = configured_payment._dispute_update(
        after_won_a, {"id": "du_b", "status": "won", "charge": "ch_1"},
        "charge.dispute.closed", 13, intent,
    )
    assert configured_payment.merge_stripe_state(after_won_a, won_b)["local_status"] == "paid"
    lost = configured_payment._dispute_update(
        base, {"id": "du_lost", "status": "lost", "charge": "ch_1"},
        "charge.dispute.closed", 14, intent,
    )
    assert configured_payment.merge_stripe_state(base, lost)["local_status"] == "disputed"


def test_only_one_request_can_claim_checkout_session_creation(configured_payment):
    class CheckoutTable(Table):
        def __init__(self):
            super().__init__("checkout")
            self.item = {"checkout_request_id": "req_1", "fingerprint": "fp", "status": "RESERVED"}
        def get_item(self, **_kwargs): return {"Item": dict(self.item)}
        def update_item(self, **kwargs):
            values = kwargs["ExpressionAttributeValues"]
            if self.item["status"] != values[":reserved"]:
                raise ClientError({"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem")
            self.item.update({
                "status": values[":creating"], "session_claim_token": values[":token"],
                "session_lease_expires_at": values[":lease"],
            })
            return {}

    table = CheckoutTable()
    configured_payment.checkout_requests_table = table
    first = configured_payment.claim_checkout_session_creation("req_1", "fp", {})
    second = configured_payment.claim_checkout_session_creation("req_1", "fp", {})
    assert first["state"] == "CLAIMED"
    assert second["state"] == "CREATING_SESSION"
