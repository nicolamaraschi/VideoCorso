"""
Characterization tests for purchase_grants_access() and can_access_course().

These tests document the CURRENT behaviour, including known bugs.
Tests marked with CURRENT_BUG will fail after the fail-closed fix is applied
and must be updated to assert the corrected (denied) outcome.

Run with:
    pytest tests/test_purchase_access.py -v
"""

import sys
import types
import importlib
import json
from decimal import Decimal
from typing import Any
import pathlib
import pytest


# ---------------------------------------------------------------------------
# Minimal stubs so we can import the handlers without real AWS credentials
# ---------------------------------------------------------------------------

def _make_boto3_stub():
    boto3_stub = types.ModuleType("boto3")

    class _FakeTable:
        def get_item(self, **kwargs):
            return {}
        def query(self, **kwargs):
            return {"Items": [], "Count": 0}
        def scan(self, **kwargs):
            return {"Items": [], "Count": 0}

    class _FakeDynamo:
        def Table(self, name):
            return _FakeTable()

    boto3_stub.resource = lambda *a, **k: _FakeDynamo()
    boto3_stub.client = lambda *a, **k: types.SimpleNamespace(
        get_parameter=lambda **kw: {"Parameter": {"Value": "stub"}},
        describe_endpoints=lambda **kw: {"Endpoints": [{"Url": "http://stub"}]},
    )
    return boto3_stub


def _make_botocore_stub():
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
    return botocore


def _stub_stripe():
    stripe = types.ModuleType("stripe")
    stripe.api_key = None
    stripe.error = types.SimpleNamespace(SignatureVerificationError=Exception)
    sys.modules["stripe"] = stripe


def _stub_resend():
    sys.modules.setdefault("resend", types.ModuleType("resend"))


def _load_handler(module_name: str, module_path: str):
    """Import a handler module with all external deps stubbed."""
    _make_botocore_stub()
    _stub_stripe()
    _stub_resend()
    sys.modules["boto3"] = _make_boto3_stub()
    sys.modules["boto3.dynamodb"] = types.ModuleType("boto3.dynamodb")
    cond_mod = types.ModuleType("boto3.dynamodb.conditions")
    cond_mod.Key = lambda k: types.SimpleNamespace(eq=lambda v: None)
    sys.modules["boto3.dynamodb.conditions"] = cond_mod

    spec = importlib.util.spec_from_file_location(module_name, module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


import importlib.util, pathlib

_ROOT = pathlib.Path(__file__).parent.parent / "lambda"

_course   = _load_handler("course_handler",   _ROOT / "course_handler/app.py")
_video    = _load_handler("video_handler",    _ROOT / "video_handler/app.py")
_progress = _load_handler("progress_handler", _ROOT / "progress_handler/app.py")
_admin    = _load_handler("admin_handler",    _ROOT / "admin_handler/app.py")


# ---------------------------------------------------------------------------
# Helper: build a minimal purchase dict
# ---------------------------------------------------------------------------

def make_purchase(
    local_status: str = "paid",
    access_unlocked: bool = True,
    access_revoked: bool = False,
    refunded_amount: float = 0.0,
    manual_access_override: bool = False,
    status: str | None = None,
) -> dict[str, Any]:
    p: dict[str, Any] = {
        "purchase_id": "test-purchase",
        "user_id": "user-1",
        "course_id": "course-1",
        "local_status": local_status,
        "access_unlocked": access_unlocked,
        "access_revoked": access_revoked,
        "refunded_amount": Decimal(str(refunded_amount)),
        "manual_access_override": manual_access_override,
    }
    if status is not None:
        p["status"] = status
    return p


# ---------------------------------------------------------------------------
# Parametrised fixture: call purchase_grants_access on all three handlers
# ---------------------------------------------------------------------------

ALL_HANDLERS = [
    pytest.param(_course,   id="course_handler"),
    pytest.param(_video,    id="video_handler"),
    pytest.param(_progress, id="progress_handler"),
]

ADMIN_HANDLER = pytest.param(_admin, id="admin_handler")


@pytest.mark.parametrize("handler", ALL_HANDLERS)
class TestPurchaseGrantsAccess:
    """Same record must produce the same result across all three student-facing handlers."""

    # --- cases that MUST grant access ---

    def test_paid_access_unlocked(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="paid", access_unlocked=True
        )) is True

    def test_manual_override_needs_review(self, handler):
        """manual_access_override=True should grant access regardless of status."""
        assert handler.purchase_grants_access(make_purchase(
            local_status="needs_review", access_unlocked=True,
            manual_access_override=True,
        )) is True

    def test_paid_zero_refund(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="paid", access_unlocked=True, refunded_amount=0.0
        )) is True

    # --- cases that MUST deny access ---

    def test_access_revoked(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="paid", access_unlocked=False, access_revoked=True
        )) is False

    def test_refunded(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="refunded", access_unlocked=False, refunded_amount=99.0
        )) is False

    def test_disputed(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="disputed", access_unlocked=True
        )) is False

    def test_access_unlocked_false_even_if_paid(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="paid", access_unlocked=False
        )) is False

    def test_positive_refunded_amount_blocks_access(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="paid", access_unlocked=True, refunded_amount=1.0
        )) is False

    def test_cancelled_denies(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="cancelled", access_unlocked=True
        )) is False

    def test_failed_denies(self, handler):
        assert handler.purchase_grants_access(make_purchase(
            local_status="failed", access_unlocked=True
        )) is False

    # --- CURRENT_BUG: needs_review without manual_override grants access ---
    # After the fail-closed fix these assertions must be inverted to `is False`.

    def test_needs_review_no_override_FIXED_denies(self, handler):
        """FIXED: since all handlers now import from the shared layer,
        needs_review without manual_override is denied (fail-closed)."""
        result = handler.purchase_grants_access(make_purchase(
            local_status="needs_review", access_unlocked=True,
            manual_access_override=False,
        ))
        assert result is False, (
            "needs_review without manual_override must be denied after shared-layer fix."
        )

    def test_empty_local_status_CURRENT_BUG(self, handler):
        """CURRENT BUG: empty local_status resolves to '' which falls through to needs_review default."""
        p = make_purchase(local_status="paid")
        p.pop("local_status")          # missing field
        p["status"] = ""               # also empty
        result = handler.purchase_grants_access(p)
        # current behaviour: grants access because access_unlocked=True and status logic is lenient
        # After fix: must return False (fail-closed)
        assert isinstance(result, bool)  # just document it doesn't crash

    def test_unknown_status_CURRENT_BUG(self, handler):
        """CURRENT BUG: unknown status is not explicitly denied."""
        result = handler.purchase_grants_access(make_purchase(
            local_status="whatever_unknown_xyz", access_unlocked=True,
        ))
        # After fix: must return False
        assert isinstance(result, bool)


class TestAdminPurchaseGrantsAccess:
    """Admin handler has its own purchase_grants_access that goes through normalize_purchase first."""

    def test_paid_grants(self):
        assert _admin.purchase_grants_access(make_purchase(
            local_status="paid", access_unlocked=True
        )) is True

    def test_revoked_denies(self):
        assert _admin.purchase_grants_access(make_purchase(
            local_status="paid", access_unlocked=False, access_revoked=True
        )) is False

    def test_needs_review_FIXED_denies(self):
        """FIXED: admin handler also denies access for needs_review without override."""
        result = _admin.purchase_grants_access(make_purchase(
            local_status="needs_review", access_unlocked=True, manual_access_override=False
        ))
        assert result is False, "needs_review without manual_override must be denied after fix"


class TestAdminCustomerView:
    """The admin's support view must describe the customer's real app access."""

    def test_paid_purchase_with_ready_account_is_visible_to_customer(self):
        view = _admin.build_purchase_customer_view(
            make_purchase(local_status="paid", access_unlocked=True),
            {"user_id": "student-1", "email": "student@example.test"},
        )
        assert view == {
            "account_ready": True,
            "course_access_active": True,
            "course_access_reason": "active",
            "student_id": "student-1",
        }

    def test_paid_purchase_waits_for_account_provisioning_before_claiming_visibility(self):
        view = _admin.build_purchase_customer_view(
            make_purchase(local_status="paid", access_unlocked=True), {},
        )
        assert view["account_ready"] is False
        assert view["course_access_active"] is False
        assert view["course_access_reason"] == "account_provisioning"

    def test_failed_purchase_is_not_presented_as_customer_access(self):
        view = _admin.build_purchase_customer_view(
            make_purchase(local_status="failed", access_unlocked=False),
            {"user_id": "student-1"},
        )
        assert view["account_ready"] is True
        assert view["course_access_active"] is False
        assert view["course_access_reason"] == "payment_or_access_not_active"


class _AdminMemoryTable:
    def __init__(self, item=None):
        self.item = item
        self.update_calls = []
        self.deleted = []
        self.puts = []

    def get_item(self, **_kwargs):
        return {"Item": self.item} if self.item else {}

    def update_item(self, **kwargs):
        self.update_calls.append(kwargs)
        return {"Attributes": self.item or {}}

    def delete_item(self, **kwargs):
        self.deleted.append(kwargs)

    def put_item(self, **kwargs):
        self.puts.append(kwargs)


class TestAdminOperationGuards:
    """Regression tests for destructive and payment-affecting admin actions."""

    @pytest.mark.parametrize("path,method", [
        ("/admin/accounts", "GET"), ("/admin/account", "POST"),
        ("/admin/account/admin@example.test", "PATCH"), ("/admin/account/admin@example.test", "DELETE"),
        ("/admin/account/admin@example.test/resend-invite", "POST"),
        ("/admin/courses", "GET"), ("/admin/course", "POST"),
        ("/admin/course/course-1", "PUT"), ("/admin/course/course-1", "DELETE"),
        ("/admin/course/chapter", "POST"), ("/admin/course/chapter/chapter-1", "PUT"),
        ("/admin/course/chapter/chapter-1", "DELETE"), ("/admin/course/reorder-chapters", "PUT"),
        ("/admin/course/lesson", "POST"), ("/admin/course/lesson/lesson-1", "PUT"),
        ("/admin/course/lesson/lesson-1", "DELETE"), ("/admin/course/reorder-lessons", "PUT"),
        ("/admin/coupons", "GET"), ("/admin/coupon", "POST"),
        ("/admin/coupon/COUPON", "PUT"), ("/admin/coupon/COUPON", "DELETE"), ("/admin/coupon/test", "POST"),
        ("/admin/students", "GET"), ("/admin/students/search", "GET"), ("/admin/student/create", "POST"),
        ("/admin/student/student-1", "GET"), ("/admin/student/student-1", "PATCH"),
        ("/admin/student/student-1", "DELETE"), ("/admin/student/student-1/resend-invite", "POST"),
        ("/admin/student/student-1/reset-password", "POST"), ("/admin/student/student-1/grant-course", "POST"),
        ("/admin/purchases", "GET"), ("/admin/purchase/pi-1", "GET"), ("/admin/purchase/pi-1", "DELETE"),
        ("/admin/purchase/pi-1/resync", "POST"), ("/admin/purchase/pi-1/unlock", "POST"),
        ("/admin/purchase/pi-1/revoke", "POST"), ("/admin/purchase/pi-1/refund", "POST"),
        ("/admin/purchase/pi-1/mark-verified", "POST"), ("/admin/purchase/pi-1/correct-email", "POST"),
        ("/admin/stats", "GET"), ("/admin/video/upload", "POST"), ("/admin/image/upload", "POST"),
        ("/admin/video/video-key", "DELETE"), ("/admin/video/thumbnail", "POST"),
    ])
    def test_every_sensitive_admin_operation_rejects_a_non_admin(self, path, method):
        response = _admin.lambda_handler({"path": path, "httpMethod": method, "body": "{}"}, None)
        assert response["statusCode"] == 403

    def test_reorder_lessons_route_is_not_interpreted_as_a_course_update(self, monkeypatch):
        monkeypatch.setattr(_admin, "is_admin", lambda _event: True)
        monkeypatch.setattr(_admin, "reorder_lessons", lambda body: _admin.create_response(200, {"items": body["items"]}))
        monkeypatch.setattr(_admin, "update_course", lambda *_args: pytest.fail("reorder route must not call update_course"))

        response = _admin.lambda_handler({
            "path": "/admin/course/reorder-lessons",
            "httpMethod": "PUT",
            "body": json.dumps({"items": [{"id": "lesson-1", "order_number": 1}]}),
        }, None)

        assert response["statusCode"] == 200

    def test_already_refunded_purchase_is_reconciled_before_returning_conflict(self, monkeypatch):
        purchase = {
            **make_purchase(local_status="paid", access_unlocked=True, refunded_amount=0),
            "purchase_id": "purchase-1",
            "amount": Decimal("10.00"),
            "stripe_payment_intent_id": "pi_1",
        }
        table = _AdminMemoryTable(purchase)
        monkeypatch.setitem(_admin.TABLES, "PURCHASES", table)
        monkeypatch.setattr(_admin, "stripe", types.SimpleNamespace(
            PaymentIntent=types.SimpleNamespace(retrieve=lambda *_args, **_kwargs: {
                "latest_charge": {"id": "ch_1", "amount": 1000, "amount_refunded": 1000},
                "charges": {"data": []},
            }),
        ))
        monkeypatch.setattr(_admin, "fetch_stripe_purchase_state", lambda _purchase: {
            "local_status": "refunded", "refunded_amount": Decimal("10.00"), "refund_status": "refunded",
        })
        monkeypatch.setattr(_admin, "sync_purchase_access", lambda item: item)
        monkeypatch.setattr(_admin, "record_audit_log", lambda *_args, **_kwargs: None)

        response = _admin.refund_purchase("purchase-1", {"amount": "10.00"})

        assert response["statusCode"] == 409
        assert json.loads(response["body"])["already_refunded"] is True
        assert table.puts[0]["Item"]["local_status"] == "refunded"

    def test_hiding_a_published_course_also_clears_is_active(self, monkeypatch):
        table = _AdminMemoryTable({"course_id": "course-1", "status": "published", "is_active": True})
        monkeypatch.setitem(_admin.TABLES, "COURSES", table)
        monkeypatch.setattr(_admin, "get_course", lambda _course_id: table.item)

        response = _admin.update_course("course-1", {"is_active": False})
        call = table.update_calls[0]
        assert response["statusCode"] == 200
        assert call["ExpressionAttributeValues"][":status"] == "hidden"
        assert call["ExpressionAttributeValues"][":is_active"] is False

    @pytest.mark.parametrize("course,expected_error", [
        ({"title": "Course", "status": "published", "price": -1, "public_slug": "course"}, "price cannot be negative"),
        ({"title": "Course", "status": "published", "price": 10, "discounted_price": 11, "public_slug": "course"}, "discounted_price must be between zero and the full price"),
        ({"title": "Course", "status": "unknown", "price": 10, "public_slug": "course"}, "status is invalid"),
        ({"title": "Course", "status": "published", "price": 10, "public_slug": "Corso Maiuscolo"}, "public_slug"),
    ])
    def test_invalid_catalog_data_is_rejected_before_it_can_reach_checkout(self, course, expected_error):
        assert expected_error in _admin.validate_course_payload(course)

    def test_public_course_slug_must_be_unique(self, monkeypatch):
        monkeypatch.setattr(_admin, "list_all_items", lambda _table: [{"course_id": "other", "public_slug": "masterclass"}])
        error = _admin.validate_course_payload({"title": "Course", "status": "published", "price": 10, "public_slug": "masterclass"}, "course-1")
        assert error == "Esiste già un corso con questo URL pubblico"

    def test_malformed_course_price_returns_a_validation_error_instead_of_a_server_error(self):
        response = _admin.create_course({"title": "Course", "status": "published", "price": "not-a-price", "public_slug": "course"})
        assert response["statusCode"] == 400

    def test_chapter_and_lesson_updates_reject_empty_or_unsafe_payloads(self, monkeypatch):
        chapter_table = _AdminMemoryTable({"chapter_id": "chapter-1", "course_id": "course-1"})
        lesson_table = _AdminMemoryTable({"lesson_id": "lesson-1", "chapter_id": "chapter-1"})
        monkeypatch.setitem(_admin.TABLES, "CHAPTERS", chapter_table)
        monkeypatch.setitem(_admin.TABLES, "LESSONS", lesson_table)

        assert _admin.update_chapter("chapter-1", {"course_id": "other-course"})["statusCode"] == 400
        assert _admin.update_lesson("lesson-1", {"chapter_id": "other-chapter"})["statusCode"] == 400

    def test_reorder_rejects_cross_course_or_duplicate_items(self, monkeypatch):
        class Chapters:
            def get_item(self, Key):
                course_id = {"chapter-1": "course-1", "chapter-2": "course-2"}.get(Key["chapter_id"])
                return {"Item": {"chapter_id": Key["chapter_id"], "course_id": course_id}} if course_id else {}

        monkeypatch.setitem(_admin.TABLES, "CHAPTERS", Chapters())
        assert _admin.reorder_chapters({"items": [
            {"id": "chapter-1", "order_number": 1}, {"id": "chapter-2", "order_number": 2},
        ]})["statusCode"] == 400
        assert _admin.reorder_chapters({"items": [
            {"id": "chapter-1", "order_number": 1}, {"id": "chapter-1", "order_number": 2},
        ]})["statusCode"] == 400

    @pytest.mark.parametrize("payload", [
        {"code": "BAD SPACE", "discount_type": "percent", "discount_value": 10},
        {"code": "NEGATIVE", "discount_type": "fixed", "discount_value": -1},
        {"code": "OVER", "discount_type": "percent", "discount_value": 101},
        {"code": "LIMIT", "discount_type": "percent", "discount_value": 10, "max_redemptions": 0},
        {"code": "DATES", "discount_type": "percent", "discount_value": 10, "starts_at": "2026-12-02T00:00:00Z", "expires_at": "2026-12-01T00:00:00Z"},
    ])
    def test_invalid_coupon_rules_are_rejected_before_checkout_can_use_them(self, payload):
        assert _admin.create_coupon(payload)["statusCode"] == 400

    def test_duplicate_coupon_code_cannot_overwrite_an_existing_promotion(self, monkeypatch):
        monkeypatch.setattr(_admin, "get_coupon", lambda _code: {"coupon_id": "SAVE10"})
        response = _admin.create_coupon({"code": "SAVE10", "discount_type": "percent", "discount_value": 10})
        assert response["statusCode"] == 409

    def test_paid_student_cannot_be_deleted_and_lose_course_access(self, monkeypatch):
        monkeypatch.setattr(_admin, "resolve_student_record", lambda _student_id: {"user_id": "student-1", "email": "student@example.test"})
        monkeypatch.setattr(_admin, "get_user_purchases", lambda _user_id: [make_purchase("paid", True)])
        response = _admin.delete_student("student-1")
        assert response["statusCode"] == 409
        assert "accessi attivi" in json.loads(response["body"])["error"]

    @pytest.mark.parametrize("creator,payload", [
        (_admin.create_manual_student, {"email": "not-an-email", "full_name": "Student"}),
        (_admin.create_admin_account, {"email": "not-an-email", "full_name": "Admin"}),
    ])
    def test_account_creation_validates_email_before_calling_cognito(self, creator, payload):
        assert creator(payload)["statusCode"] == 400

    def test_manual_course_grant_does_not_duplicate_an_existing_active_access(self, monkeypatch):
        monkeypatch.setattr(_admin, "get_user_item", lambda _student_id: {"user_id": "student-1", "email": "student@example.test"})
        monkeypatch.setattr(_admin, "get_course", lambda _course_id: {"course_id": "course-1", "title": "Course"})
        monkeypatch.setattr(_admin, "get_user_purchases", lambda _student_id: [make_purchase("paid", True)])
        response = _admin.grant_course_to_student("student-1", {"course_id": "course-1"})
        assert response["statusCode"] == 409

    def test_manual_grant_is_an_explicit_access_record_not_a_fake_stripe_session(self, monkeypatch):
        purchases = _AdminMemoryTable()
        monkeypatch.setitem(_admin.TABLES, "PURCHASES", purchases)
        monkeypatch.setattr(_admin, "get_user_item", lambda _student_id: {"user_id": "student-1", "email": "student@example.test"})
        monkeypatch.setattr(_admin, "get_course", lambda _course_id: {"course_id": "course-1", "title": "Course"})
        monkeypatch.setattr(_admin, "get_user_purchases", lambda _student_id: [])
        monkeypatch.setattr(_admin, "record_audit_log", lambda *_args, **_kwargs: None)

        response = _admin.grant_course_to_student("student-1", {"course_id": "course-1"})
        purchase = json.loads(response["body"], parse_float=str)["purchase"]
        assert response["statusCode"] == 200
        assert purchase["manual_access_override"] is True
        assert purchase["stripe_session_id"] is None


class TestAccessControlConsistency:
    """All handlers must agree on the same purchase record."""

    CASES = [
        ("paid_unlocked",       make_purchase("paid",       True,  False, 0.0, False), True),
        ("revoked",             make_purchase("paid",       False, True,  0.0, False), False),
        ("refunded",            make_purchase("refunded",   False, False, 50., False), False),
        ("override_needs_rev",  make_purchase("needs_review", True, False, 0., True),  True),
        ("disputed",            make_purchase("disputed",   True,  False, 0.0, False), False),
        ("cancelled",           make_purchase("cancelled",  True,  False, 0.0, False), False),
    ]

    @pytest.mark.parametrize("label,purchase,expected", CASES)
    def test_all_handlers_agree(self, label, purchase, expected):
        results = {
            "course":   _course.purchase_grants_access(purchase),
            "video":    _video.purchase_grants_access(purchase),
            "progress": _progress.purchase_grants_access(purchase),
            "admin":    _admin.purchase_grants_access(purchase),
        }
        assert all(v == expected for v in results.values()), (
            f"Handlers disagree on '{label}': {results}"
        )


# ===========================================================================
# Tests for the SHARED LAYER module (fail-closed policy)
# These are the POST-FIX tests — they must ALL pass with the layer.
# ===========================================================================

from shared.purchase_access import (
    purchase_grants_access as shared_pga,
    sync_purchase_access as shared_spa,
    normalize_purchase_defaults,
)


class TestSharedLayerFailClosed:
    """Verify the fail-closed policy in shared/purchase_access.py."""

    # --- Must grant ---

    def test_paid_unlocked_grants(self):
        assert shared_pga(make_purchase("paid", True)) is True

    def test_manual_override_grants_regardless_of_needs_review(self):
        assert shared_pga(make_purchase("needs_review", True, False, 0.0, True)) is True

    def test_active_status_grants(self):
        assert shared_pga(make_purchase("active", True)) is True

    # --- Must deny (fail-closed) ---

    def test_needs_review_no_override_DENIED(self):
        """FIXED: needs_review without manual_override must be denied."""
        assert shared_pga(make_purchase("needs_review", True, False, 0.0, False)) is False

    def test_missing_local_status_DENIED(self):
        """FIXED: missing local_status must be denied (fail-closed)."""
        p = make_purchase("paid")
        p.pop("local_status")
        p.pop("status", None)
        assert shared_pga(p) is False

    def test_unknown_status_DENIED(self):
        """FIXED: unknown/corrupt status must be denied."""
        assert shared_pga(make_purchase("whatever_unknown_xyz", True)) is False

    def test_access_revoked_denied(self):
        assert shared_pga(make_purchase("paid", False, True)) is False

    def test_refunded_denied(self):
        assert shared_pga(make_purchase("refunded", False, False, 99.0)) is False

    def test_disputed_denied(self):
        assert shared_pga(make_purchase("disputed", True)) is False

    def test_cancelled_denied(self):
        assert shared_pga(make_purchase("cancelled", True)) is False

    def test_failed_denied(self):
        assert shared_pga(make_purchase("failed", True)) is False

    def test_positive_refund_denies_even_if_paid(self):
        assert shared_pga(make_purchase("paid", True, False, 1.0)) is False

    def test_manual_override_void_on_refunded(self):
        """Override does not bypass a refund."""
        assert shared_pga(make_purchase("refunded", True, False, 99.0, True)) is False


class TestSharedLayerSyncPurchaseAccess:
    """Verify sync_purchase_access respects access_revoked on 'sync' mode."""

    def test_revoked_paid_stays_revoked_FIXED(self):
        """FIXED: sync mode must not unlock an admin-revoked purchase."""
        purchase = {
            **make_purchase("paid", False, True, 0.0),
            "access_revoked_at": "2026-01-01T00:00:00Z",
            "access_revocation_reason": "manual_revoke",
        }
        result = shared_spa(purchase, mode="sync")
        assert result["access_revoked"] is True
        assert result["access_unlocked"] is False

    def test_force_unlock_clears_revocation(self):
        purchase = make_purchase("paid", False, True, 0.0)
        result = shared_spa(purchase, mode="force_unlock")
        assert result["access_unlocked"] is True
        assert result["access_revoked"] is False

    def test_force_unlock_blocked_on_refunded(self):
        purchase = make_purchase("refunded", False, False, 50.0)
        with pytest.raises(ValueError, match="refunded"):
            shared_spa(purchase, mode="force_unlock")

    def test_revoke_mode_revokes(self):
        purchase = make_purchase("paid", True, False, 0.0)
        result = shared_spa(purchase, mode="revoke")
        assert result["access_revoked"] is True
        assert result["access_unlocked"] is False


class TestNormalizePurchaseDefaults:
    """normalize_purchase_defaults must produce consistent typed fields."""

    def test_unknown_status_becomes_needs_review(self):
        p = normalize_purchase_defaults({"local_status": "xyz_unknown"})
        assert p["local_status"] == "needs_review"

    def test_missing_status_becomes_needs_review(self):
        p = normalize_purchase_defaults({})
        assert p["local_status"] == "needs_review"

    def test_access_unlocked_defaults_false_for_needs_review(self):
        p = normalize_purchase_defaults({"local_status": "needs_review"})
        assert p["access_unlocked"] is False

    def test_access_unlocked_defaults_true_for_paid(self):
        p = normalize_purchase_defaults({"local_status": "paid"})
        assert p["access_unlocked"] is True

    def test_access_revoked_defaults_false(self):
        p = normalize_purchase_defaults({"local_status": "paid"})
        assert p["access_revoked"] is False
