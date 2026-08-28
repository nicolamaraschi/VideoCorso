"""
Unit tests for the Basic/Intermedio/Avanzato package model.

Core invariant under test: all packages of a course grant identical lesson
access. Packages only change price and included benefits (kit, ebook,
WhatsApp support, community, live meetings). A package that includes a
physical kit must force collection of a shipping address at checkout.

Run with:
    pytest tests/test_course_packages.py -v
"""

import sys
import types
import importlib.util
import pathlib
from decimal import Decimal
import pytest


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

    boto3_stub = types.ModuleType("boto3")

    class _FakeTable:
        def get_item(self, **kw): return {}
        def query(self, **kw): return {"Items": []}
        def scan(self, **kw): return {"Items": []}
        def put_item(self, **kw): return {}
        def update_item(self, **kw): return {"Attributes": {}}

    class _FakeDynamo:
        def Table(self, n): return _FakeTable()

    boto3_stub.resource = lambda *a, **k: _FakeDynamo()
    boto3_stub.client = lambda *a, **k: types.SimpleNamespace(
        get_parameter=lambda **kw: {"Parameter": {"Value": "stub"}},
    )
    sys.modules["boto3"] = boto3_stub
    sys.modules["boto3.dynamodb"] = types.ModuleType("boto3.dynamodb")
    cond_mod = types.ModuleType("boto3.dynamodb.conditions")
    cond_mod.Key = lambda k: types.SimpleNamespace(eq=lambda v: None)
    sys.modules["boto3.dynamodb.conditions"] = cond_mod
    dynamodb_types_mod = types.ModuleType("boto3.dynamodb.types")
    dynamodb_types_mod.TypeSerializer = lambda: types.SimpleNamespace(serialize=lambda v: v)
    sys.modules["boto3.dynamodb.types"] = dynamodb_types_mod
    stripe_mod = types.ModuleType("stripe")
    stripe_mod.api_key = None
    stripe_mod.error = types.SimpleNamespace(SignatureVerificationError=Exception)
    sys.modules["stripe"] = stripe_mod
    sys.modules.setdefault("resend", types.ModuleType("resend"))


_setup_stubs()

_ROOT = pathlib.Path(__file__).parent.parent / "lambda"
_course_spec = importlib.util.spec_from_file_location("course_handler_pkg", _ROOT / "course_handler/app.py")
_course = importlib.util.module_from_spec(_course_spec)
_course_spec.loader.exec_module(_course)

_payment_spec = importlib.util.spec_from_file_location("payment_handler_pkg", _ROOT / "payment_handler/app.py")
_payment = importlib.util.module_from_spec(_payment_spec)
_payment_spec.loader.exec_module(_payment)


# ---------------------------------------------------------------------------
# Fixtures: the 3-tier Basic/Intermedio/Avanzato structure from the brief
# ---------------------------------------------------------------------------

def make_packages():
    return [
        {
            "package_id": "basic",
            "name": "Basic",
            "price": 1290,
            "display_order": 1,
            "benefits": ["Ebook digitale", "Kit Microblading incluso"],
            "includes_kit": True,
            "includes_ebook": True,
            "includes_whatsapp_support": False,
            "includes_community": False,
            "live_meetings_count": 0,
        },
        {
            "package_id": "intermedio",
            "name": "Intermedio",
            "price": 1490,
            "display_order": 2,
            "benefits": [
                "Ebook digitale", "Kit Microblading incluso",
                "Supporto WhatsApp Chat 1:1 illimitato per 6 mesi",
                "Accesso alla Community gratuita",
            ],
            "includes_kit": True,
            "includes_ebook": True,
            "includes_whatsapp_support": True,
            "whatsapp_support_months": 6,
            "includes_community": True,
            "live_meetings_count": 0,
        },
        {
            "package_id": "avanzato",
            "name": "Avanzato",
            "price": 1990,
            "display_order": 3,
            "benefits": [
                "Ebook digitale", "Kit Microblading incluso",
                "Supporto WhatsApp Chat 1:1", "Accesso alla Community gratuita",
                "3 incontri individuali 1:1 dal vivo",
            ],
            "includes_kit": True,
            "includes_ebook": True,
            "includes_whatsapp_support": True,
            # Duration intentionally NOT specified for Avanzato per the brief:
            # do not assume 6 months when not explicitly confirmed.
            "whatsapp_support_months": None,
            "includes_community": True,
            "live_meetings_count": 3,
        },
    ]


def make_course(packages=None):
    return {
        "course_id": "microblading-course",
        "public_slug": "microblading-course",
        "title": "Microblading Masterclass",
        "status": "published",
        "is_purchasable": True,
        "price": Decimal("1290"),
        "packages": packages if packages is not None else make_packages(),
    }


# ---------------------------------------------------------------------------
# 1. normalize_course / normalize_package: single course, 3 tiers
# ---------------------------------------------------------------------------

class TestCoursePackageNormalization:

    def test_course_has_three_packages(self):
        course = _course.normalize_course(make_course())
        assert len(course["packages"]) == 3

    def test_packages_sorted_by_display_order(self):
        packages = make_packages()
        # Shuffle the input order; normalize_course must sort by display_order.
        shuffled = [packages[2], packages[0], packages[1]]
        course = _course.normalize_course(make_course(shuffled))
        ids = [p["package_id"] for p in course["packages"]]
        assert ids == ["basic", "intermedio", "avanzato"]

    def test_all_packages_share_the_same_course_id(self):
        """Core invariant: packages are NOT separate courses."""
        course = _course.normalize_course(make_course())
        # There is exactly one course_id for all three tiers.
        assert course["course_id"] == "microblading-course"
        assert len(course["packages"]) == 3

    def test_basic_has_no_whatsapp_or_community(self):
        course = _course.normalize_course(make_course())
        basic = next(p for p in course["packages"] if p["package_id"] == "basic")
        assert basic["includes_whatsapp_support"] is False
        assert basic["includes_community"] is False
        assert basic["live_meetings_count"] == 0

    def test_intermedio_has_whatsapp_6_months_and_community(self):
        course = _course.normalize_course(make_course())
        intermedio = next(p for p in course["packages"] if p["package_id"] == "intermedio")
        assert intermedio["includes_whatsapp_support"] is True
        assert intermedio["whatsapp_support_months"] == 6
        assert intermedio["includes_community"] is True
        assert intermedio["live_meetings_count"] == 0

    def test_avanzato_has_live_meetings_and_unspecified_whatsapp_duration(self):
        """
        Per the brief: do not assume the Avanzato WhatsApp support duration
        is 6 months just because Intermedio's is. It must be None/unspecified
        until explicitly confirmed.
        """
        course = _course.normalize_course(make_course())
        avanzato = next(p for p in course["packages"] if p["package_id"] == "avanzato")
        assert avanzato["includes_whatsapp_support"] is True
        assert avanzato["whatsapp_support_months"] is None, (
            "Avanzato's WhatsApp support duration must not be assumed as 6 months "
            "when not explicitly confirmed in the source brief."
        )
        assert avanzato["live_meetings_count"] == 3

    def test_all_three_include_kit_and_ebook(self):
        """All tiers include the kit and ebook per the brief - only support
        level differs."""
        course = _course.normalize_course(make_course())
        for package in course["packages"]:
            assert package["includes_kit"] is True
            assert package["includes_ebook"] is True

    def test_course_without_packages_falls_back_to_flat_price(self):
        """Legacy courses without any packages must keep working (flat price)."""
        course = _course.normalize_course(make_course(packages=[]))
        assert course["packages"] == []
        assert course["price"] == Decimal("1290")


# ---------------------------------------------------------------------------
# 2. find_package / package pricing
# ---------------------------------------------------------------------------

class TestFindPackageAndPricing:

    def test_find_package_by_id(self):
        course = _course.normalize_course(make_course())
        found = _course.find_package(course, "intermedio")
        assert found is not None
        assert found["name"] == "Intermedio"

    def test_find_package_missing_returns_none(self):
        course = _course.normalize_course(make_course())
        assert _course.find_package(course, "nonexistent") is None

    def test_find_package_none_id_returns_none(self):
        course = _course.normalize_course(make_course())
        assert _course.find_package(course, None) is None

    def test_package_prices_increase_with_tier(self):
        course = _payment.normalize_course(make_course())
        prices = [_payment.get_package_effective_price(p) for p in course["packages"]]
        assert prices == sorted(prices)
        assert prices[0] == Decimal("1290")
        assert prices[1] == Decimal("1490")
        assert prices[2] == Decimal("1990")

    def test_package_discounted_price_takes_precedence(self):
        package = {"price": Decimal("1290"), "discounted_price": Decimal("999")}
        assert _payment.get_package_effective_price(package) == Decimal("999")


# ---------------------------------------------------------------------------
# 3. Shipping address requirement
# ---------------------------------------------------------------------------

class TestShippingAddressRequirement:

    def test_package_with_kit_requires_shipping_address(self):
        package = {"includes_kit": True}
        assert _payment.package_requires_shipping_address(package) is True

    def test_package_without_kit_does_not_require_address(self):
        package = {"includes_kit": False}
        assert _payment.package_requires_shipping_address(package) is False

    def test_no_package_does_not_require_address(self):
        assert _payment.package_requires_shipping_address(None) is False

    def test_all_three_tiers_require_shipping_address(self):
        """Every tier in this brief includes the kit, so all three require an address."""
        for package in make_packages():
            assert _payment.package_requires_shipping_address(package) is True


class TestValidateShippingAddress:

    VALID_ADDRESS = {
        "full_name": "Maria Rossi",
        "address_line1": "Via Roma 1",
        "city": "Milano",
        "postal_code": "20100",
        "country": "IT",
    }

    def test_valid_address_accepted_for_kit_package(self):
        package = {"includes_kit": True}
        result = _payment.validate_shipping_address(self.VALID_ADDRESS, package)
        assert result["full_name"] == "Maria Rossi"
        assert result["country"] == "IT"

    def test_missing_address_rejected_for_kit_package(self):
        package = {"includes_kit": True}
        with pytest.raises(ValueError, match="shipping_address is required"):
            _payment.validate_shipping_address(None, package)

    def test_incomplete_address_rejected(self):
        package = {"includes_kit": True}
        incomplete = dict(self.VALID_ADDRESS)
        del incomplete["postal_code"]
        with pytest.raises(ValueError, match="postal_code"):
            _payment.validate_shipping_address(incomplete, package)

    def test_address_ignored_when_package_has_no_kit(self):
        package = {"includes_kit": False}
        result = _payment.validate_shipping_address(None, package)
        assert result is None

    def test_address_ignored_when_no_package_at_all(self):
        result = _payment.validate_shipping_address(None, None)
        assert result is None

    def test_optional_fields_default_to_empty_string(self):
        package = {"includes_kit": True}
        result = _payment.validate_shipping_address(self.VALID_ADDRESS, package)
        assert result["address_line2"] == ""
        assert result["province"] == ""
        assert result["phone"] == ""


# ---------------------------------------------------------------------------
# 4. compute_discounted_total with a package
# ---------------------------------------------------------------------------

class TestComputeDiscountedTotalWithPackage:

    def test_no_coupon_uses_package_price(self):
        course = _payment.normalize_course(make_course())
        package = _payment.find_package(course, "avanzato")
        total = _payment.compute_discounted_total(course, None, package)
        assert total == Decimal("1990")

    def test_percent_coupon_applies_to_package_price_not_course_price(self):
        course = _payment.normalize_course(make_course())
        package = _payment.find_package(course, "basic")
        coupon = {"discount_type": "percent", "discount_value": Decimal("10"), "is_free_access": False}
        total = _payment.compute_discounted_total(course, coupon, package)
        assert total == Decimal("1161.00")  # 1290 - 10%

    def test_free_access_coupon_zeroes_package_price(self):
        course = _payment.normalize_course(make_course())
        package = _payment.find_package(course, "intermedio")
        coupon = {"is_free_access": True}
        total = _payment.compute_discounted_total(course, coupon, package)
        assert total == Decimal("0")

    def test_no_package_falls_back_to_course_flat_price(self):
        """Legacy single-price course (no packages) must still work."""
        course = _payment.normalize_course(make_course(packages=[]))
        course["price"] = Decimal("99.99")
        total = _payment.compute_discounted_total(course, None, None)
        assert total == Decimal("99.99")


# ---------------------------------------------------------------------------
# 5. Deterministic purchase_id includes package_id
# ---------------------------------------------------------------------------

class TestPurchaseIdIncludesPackage:

    def test_different_packages_produce_different_purchase_ids(self):
        """
        The same user redeeming a free coupon for Basic vs Intermedio must
        produce different purchase records - the package purchased matters.
        """
        id_basic = _payment.coupon_purchase_id("FREE100", "course-1", "user-1", package_id="basic")
        id_intermedio = _payment.coupon_purchase_id("FREE100", "course-1", "user-1", package_id="intermedio")
        assert id_basic != id_intermedio

    def test_same_package_same_id(self):
        id_1 = _payment.coupon_purchase_id("FREE100", "course-1", "user-1", package_id="basic")
        id_2 = _payment.coupon_purchase_id("FREE100", "course-1", "user-1", package_id="basic")
        assert id_1 == id_2

    def test_no_package_id_still_works_for_legacy_courses(self):
        id_no_package = _payment.coupon_purchase_id("FREE100", "course-1", "user-1")
        assert id_no_package  # does not raise, produces a stable id
