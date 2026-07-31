"""
Centralised purchase access policy for all VideoCorso Lambda functions.

This module is the single source of truth for:
  - purchase_grants_access()
  - can_access_course()
  - sync_purchase_access()
  - normalize_purchase_defaults()
  - purchase_status_from_stripe()

Policy (fail-closed):
  1. access_revoked=True               → deny, unconditionally
  2. manual_access_override=True       → grant (explicit admin decision)
  3. local_status in PAID_STATUSES     → grant if also access_unlocked=True
  4. anything else                     → deny

`needs_review` without explicit manual_access_override=True is DENIED.
Missing, unknown, or corrupt local_status values are DENIED.

A correct record must be stored by payment_handler or admin_handler BEFORE the
access gate is evaluated; neither gate must ever "guess" intent from ambiguous
state.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional


# ---------------------------------------------------------------------------
# States that explicitly grant access (used in access gate, not for syncing)
# ---------------------------------------------------------------------------
_PAID_STATUSES: frozenset[str] = frozenset({"paid", "active"})

# States that definitively revoke access regardless of flags
_DENIED_STATUSES: frozenset[str] = frozenset({"refunded", "disputed", "failed", "cancelled"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {"true", "1", "yes", "on"}
    return bool(value)


def _to_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return default


# ---------------------------------------------------------------------------
# normalize_purchase_defaults
# ---------------------------------------------------------------------------

_VALID_STATUSES = frozenset({
    "pending", "paid", "active", "failed", "refunded",
    "disputed", "cancelled", "needs_review",
})


def normalize_purchase_defaults(purchase: dict[str, Any]) -> dict[str, Any]:
    """
    Return a copy of *purchase* with all fields guaranteed to have sane types.

    Callers can rely on the returned dict having at minimum:
      - local_status: a str in _VALID_STATUSES (unknown → 'needs_review')
      - access_unlocked: bool
      - access_revoked: bool
      - manual_access_override: bool
      - refunded_amount: Decimal
      - is_disputed: bool
    """
    p = dict(purchase)

    raw_status = str(p.get("local_status") or p.get("status") or "").strip().lower()
    if raw_status not in _VALID_STATUSES:
        # Unknown / missing / corrupt status → default to needs_review so that
        # it is inspected by an admin before granting access.
        p["local_status"] = "needs_review"
    else:
        p["local_status"] = raw_status

    p["access_unlocked"] = _normalize_bool(
        p.get("access_unlocked", p["local_status"] in _PAID_STATUSES)
    )
    p["access_revoked"]         = _normalize_bool(p.get("access_revoked", False))
    p["manual_access_override"] = _normalize_bool(p.get("manual_access_override", False))
    p["refunded_amount"]        = _to_decimal(p.get("refunded_amount", 0))
    p["is_disputed"]            = _normalize_bool(p.get("is_disputed", False))

    p.setdefault("created_at", p.get("purchase_date") or _now_iso())
    p.setdefault("updated_at", p["created_at"])
    return p


# ---------------------------------------------------------------------------
# purchase_grants_access  (fail-closed)
# ---------------------------------------------------------------------------

def purchase_grants_access(purchase: dict[str, Any]) -> bool:
    """
    Fail-closed access gate.

    Precedence:
      1. access_revoked=True               → False (unconditional)
      2. manual_access_override=True       → True (admin override, explicit)
      3. local_status in _PAID_STATUSES
         AND access_unlocked=True
         AND refunded_amount == 0          → True
      4. everything else                   → False

    'needs_review' without manual_access_override → False.
    Missing or unknown local_status → False.
    """
    p = normalize_purchase_defaults(purchase)

    # Rule 1: explicit revocation always wins
    if p["access_revoked"]:
        return False

    # Rule 2: explicit admin override (must not be combined with revoked, handled above)
    if p["manual_access_override"]:
        # Safety: override is void if the payment was refunded or disputed
        if p["local_status"] in _DENIED_STATUSES or p["refunded_amount"] > 0:
            return False
        return True

    # Rule 3: normal paid access
    if (
        p["local_status"] in _PAID_STATUSES
        and p["access_unlocked"]
        and p["refunded_amount"] <= 0
    ):
        return True

    # Rule 4: everything else → deny
    return False


# ---------------------------------------------------------------------------
# sync_purchase_access  (unified state machine)
# ---------------------------------------------------------------------------

def sync_purchase_access(
    purchase: dict[str, Any],
    mode: str = "sync",
) -> dict[str, Any]:
    """
    Compute the correct access flags given the current purchase state.

    Modes:
      'sync'         - recalculate from local_status and payment data
      'force_unlock' - explicit admin grant (raises ValueError for refunded/disputed)
      'revoke'       - explicit admin revocation

    Returns a copy of *purchase* with access fields set correctly.
    """
    p = normalize_purchase_defaults(purchase)

    if mode == "force_unlock":
        if p["local_status"] in _DENIED_STATUSES or p["refunded_amount"] > 0:
            raise ValueError(
                "Cannot grant access to a refunded or disputed purchase."
            )
        p["access_unlocked"]         = True
        p["access_revoked"]          = False
        p["manual_access_override"]  = True
        p["access_revoked_at"]       = None
        p["access_revocation_reason"] = ""
        p["updated_at"]              = _now_iso()
        return p

    if mode == "revoke":
        p["access_unlocked"]          = False
        p["access_revoked"]           = True
        p["manual_access_override"]   = False
        p["access_revoked_at"]        = p.get("access_revoked_at") or _now_iso()
        p["access_revocation_reason"] = p.get("access_revocation_reason") or "manual_revoke"
        p["updated_at"]               = _now_iso()
        return p

    # mode == 'sync': recalculate without changing admin-set fields
    if p["access_revoked"]:
        # Already revoked by admin: do NOT auto-unlock even if status is 'paid'.
        p["access_unlocked"] = False
        p["updated_at"]      = _now_iso()
        return p

    if p["local_status"] in _PAID_STATUSES and p["refunded_amount"] <= 0:
        p["access_unlocked"]          = True
        p["access_revoked"]           = False
        p["manual_access_override"]   = False
        p["access_revoked_at"]        = None
        p["access_revocation_reason"] = ""
    elif p["manual_access_override"] and p["local_status"] not in _DENIED_STATUSES and p["refunded_amount"] <= 0:
        p["access_unlocked"] = True
    elif p["local_status"] in _DENIED_STATUSES:
        p["access_unlocked"]          = False
        p["access_revoked"]           = True
        p["access_revoked_at"]        = p.get("access_revoked_at") or _now_iso()
        p["access_revocation_reason"] = p.get("access_revocation_reason") or (
            "refund_total" if p["local_status"] == "refunded" else "payment_disputed"
        )
        p["manual_access_override"]   = False
    elif p["local_status"] in {"failed", "cancelled", "pending", "needs_review"}:
        p["access_unlocked"] = False

    p["updated_at"] = _now_iso()
    return p


# ---------------------------------------------------------------------------
# purchase_status_from_stripe  (deterministic status derivation)
# ---------------------------------------------------------------------------

def purchase_status_from_stripe(
    stripe_session_status: str,
    stripe_payment_status: Optional[str],
    refunded_amount: Decimal,
    is_disputed: bool,
) -> str:
    """
    Derive local_status from Stripe event data.
    Returns a value always in _VALID_STATUSES.
    """
    if is_disputed:
        return "disputed"
    if refunded_amount > 0:
        return "refunded"
    if stripe_payment_status == "paid":
        return "paid"
    if stripe_session_status in {"expired", "canceled"}:
        return "cancelled"
    if stripe_payment_status in {"unpaid", "no_payment_required"} or stripe_session_status in {"open", "complete"}:
        return "pending"
    return "needs_review"
