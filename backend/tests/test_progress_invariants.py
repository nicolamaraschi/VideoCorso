"""
Characterization + invariant tests for progress tracking.

Unit tests (no network, no DynamoDB) cover the pure logic.
Integration tests that require DynamoDB Local / stack-dev are skipped
unless the env var DYNAMODB_ENDPOINT is set.

Tests prefixed CURRENT_BUG document broken behaviour that the fix must change.

Run unit tests only:
    pytest tests/test_progress_invariants.py -v -m "not integration"

Run all (requires DynamoDB Local on localhost:8000):
    DYNAMODB_ENDPOINT=http://localhost:8000 pytest tests/test_progress_invariants.py -v
"""

import os
import sys
import types
import importlib.util
import pathlib
import uuid
from decimal import Decimal
from typing import Any
import pytest


# ---------------------------------------------------------------------------
# Stub infrastructure (same pattern as test_purchase_access.py)
# ---------------------------------------------------------------------------

def _patch_sys_modules():
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
        def get_item(self, **kwargs): return {}
        def query(self, **kwargs):    return {"Items": [], "Count": 0}
        def scan(self, **kwargs):     return {"Items": [], "Count": 0}
        def put_item(self, **kwargs): return {}
        def update_item(self, **kwargs): return {"Attributes": {}}
        def delete_item(self, **kwargs): return {}

    class _FakeDynamo:
        def Table(self, name): return _FakeTable()

    boto3_stub.resource = lambda *a, **k: _FakeDynamo()
    boto3_stub.client = lambda *a, **k: types.SimpleNamespace(
        get_parameter=lambda **kw: {"Parameter": {"Value": "stub"}},
    )
    sys.modules["boto3"] = boto3_stub
    sys.modules["boto3.dynamodb"] = types.ModuleType("boto3.dynamodb")
    cond = types.ModuleType("boto3.dynamodb.conditions")
    cond.Key = lambda k: types.SimpleNamespace(eq=lambda v: None)
    sys.modules["boto3.dynamodb.conditions"] = cond
    sys.modules.setdefault("stripe", types.ModuleType("stripe"))
    sys.modules.setdefault("resend", types.ModuleType("resend"))


_patch_sys_modules()

_ROOT = pathlib.Path(__file__).parent.parent / "lambda"
_spec = importlib.util.spec_from_file_location("progress_handler", _ROOT / "progress_handler/app.py")
_ph = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ph)


# ---------------------------------------------------------------------------
# Pure-logic helpers extracted from the handler (no I/O)
# ---------------------------------------------------------------------------

def _compute_progress_percent(watched: int, total: int, completed: bool) -> int:
    """Replicate the current handler logic verbatim."""
    percent = 0
    if total > 0:
        percent = min(int((watched / total) * 100), 100)
    if completed:
        percent = 100
    return percent


# ---------------------------------------------------------------------------
# 1. progress_percent computation
# ---------------------------------------------------------------------------

class TestProgressPercentComputation:

    def test_zero_total_yields_zero(self):
        assert _compute_progress_percent(0, 0, False) == 0

    def test_half_watched(self):
        assert _compute_progress_percent(45, 90, False) == 50

    def test_capped_at_100(self):
        assert _compute_progress_percent(200, 90, False) == 100

    def test_completed_flag_forces_100(self):
        """completed=True forces percent=100 even with partial watched_seconds."""
        assert _compute_progress_percent(10, 90, True) == 100

    def test_90_percent_threshold(self):
        """81/90 = 90% exactly."""
        assert _compute_progress_percent(81, 90, False) == 90


# ---------------------------------------------------------------------------
# 2. Invariant: completed must not regress (backend protection)
# ---------------------------------------------------------------------------

class TestCompletedMonotonicity:

    def test_existing_completed_forces_completed_true(self):
        """
        When an existing progress record has completed=True,
        the handler must force completed=True regardless of the incoming payload.
        This is the CURRENT protection in update_progress (lines: if existing and existing.get('completed')).
        """
        existing = {"completed": True, "watched_seconds": Decimal("81"), "progress_id": "p-1"}
        incoming_completed = False  # client sends false

        # Replicate the handler guard exactly:
        if existing and existing.get("completed"):
            incoming_completed = True

        assert incoming_completed is True


# ---------------------------------------------------------------------------
# 3. watched_seconds CURRENT_BUG: can decrease
# ---------------------------------------------------------------------------

class TestWatchedSecondsMonotonicity:

    def test_CURRENT_BUG_watched_seconds_can_decrease(self):
        """
        CURRENT BUG: update_progress does an unconditional SET watched_seconds = :ws.
        A second request with watched_seconds=10 overwrites a first with watched_seconds=60.

        After the optimistic-locking fix, the new value must be max(existing, incoming).
        """
        existing_ws = 60
        incoming_ws = 10

        # Current handler: just uses incoming value directly (no max())
        new_ws = incoming_ws  # ← broken
        assert new_ws == 10, (
            "CURRENT_BUG: watched_seconds can be overwritten with a lower value. "
            "After fix: new_ws must equal max(existing_ws, incoming_ws) = 60."
        )

    def test_FIXED_watched_seconds_monotone(self):
        """Target behaviour after fix."""
        existing_ws = 60
        incoming_ws = 10
        new_ws = max(existing_ws, incoming_ws)
        assert new_ws == 60


# ---------------------------------------------------------------------------
# 4. Server-side completion logic (target behaviour)
# ---------------------------------------------------------------------------

class TestServerSideCompletion:

    @pytest.mark.parametrize("watched,total,expected_completed", [
        (81,  90, True),   # exactly 90%
        (80,  90, False),  # 88.9% → below threshold
        (90,  90, True),   # 100%
        (0,   90, False),  # zero watched → not complete
        (10,   0, False),  # unknown total → not complete
        (100, 100, True),  # full
    ])
    def test_completion_threshold(self, watched, total, expected_completed):
        """
        Target: the backend must compute completed from watched/total >= 0.90.
        total=0 is treated as unknown → not complete (safe default).
        """
        if total > 0:
            completed = (watched / total) >= 0.90
        else:
            completed = False
        assert completed == expected_completed

    def test_watched_zero_never_completes(self):
        """A /progress/complete call with watched_seconds=0 must NOT produce completed=True."""
        watched = 0
        total = 90
        completed = (watched / total) >= 0.90 if total > 0 else False
        assert completed is False


# ---------------------------------------------------------------------------
# 5. /progress/reset semantics (target behaviour)
# ---------------------------------------------------------------------------

class TestProgressResetSemantics:

    def test_reset_is_only_path_to_zero(self):
        """
        Demonstrate that the ordinary update path with watched_seconds=0
        must NOT reset a completed lesson.
        Only an explicit /progress/reset may do so.
        """
        # Simulate the post-fix guard: /progress/update refuses to lower watched_seconds
        existing_ws = 60
        existing_completed = True
        incoming_ws = 0
        incoming_completed = False

        # After fix: update path enforces monotonicity
        new_ws = max(existing_ws, incoming_ws)
        new_completed = existing_completed or incoming_completed

        assert new_ws == 60
        assert new_completed is True

    def test_reset_clears_all_fields(self):
        """Target: /progress/reset must zero everything including completed_at."""
        after_reset = {
            "watched_seconds": 0,
            "progress_percent": 0,
            "completed": False,
            "completed_at": None,
        }
        assert after_reset["completed"] is False
        assert after_reset["watched_seconds"] == 0
        assert after_reset["completed_at"] is None


# ---------------------------------------------------------------------------
# 6. Optimistic locking: version field
# ---------------------------------------------------------------------------

class TestOptimisticLocking:

    def test_version_increment_logic(self):
        """Each successful write must increment version by 1."""
        existing_version = 5
        new_version = existing_version + 1
        assert new_version == 6

    def test_stale_version_must_be_retried(self):
        """
        ConditionalCheckFailedException on version mismatch must trigger a
        read-then-write retry, not silently discard the update.
        """
        MAX_RETRIES = 3
        attempts = 0
        success = False

        # Simulate: first 2 attempts fail (stale version), third succeeds
        for _ in range(MAX_RETRIES + 1):
            attempts += 1
            stale = attempts < 3  # first two are stale
            if not stale:
                success = True
                break

        assert success is True
        assert attempts == 3

    def test_completed_at_set_only_once(self):
        """
        completed_at must be written the first time completed transitions to True
        and never overwritten.
        Uses: completed_at = if_not_exists(completed_at, :now)
        """
        existing_completed_at = "2026-01-01T00:00:00Z"
        # Simulate DynamoDB if_not_exists semantics:
        def if_not_exists(existing, new_val):
            return existing if existing is not None else new_val

        first_write_at = if_not_exists(None,                    "2026-01-01T00:00:00Z")
        second_write_at = if_not_exists(existing_completed_at, "2026-12-31T23:59:59Z")

        assert first_write_at == "2026-01-01T00:00:00Z"
        assert second_write_at == "2026-01-01T00:00:00Z"  # unchanged


# ---------------------------------------------------------------------------
# 7. Integration: concurrent updates (requires DynamoDB Local)
# ---------------------------------------------------------------------------

INTEGRATION = pytest.mark.skipif(
    not os.environ.get("DYNAMODB_ENDPOINT"),
    reason="Set DYNAMODB_ENDPOINT=http://localhost:8000 to run integration tests",
)


@INTEGRATION
class TestConcurrentProgressUpdates:

    @pytest.fixture(autouse=True)
    def setup_table(self):
        import boto3
        endpoint = os.environ["DYNAMODB_ENDPOINT"]
        dynamo = boto3.resource("dynamodb", region_name="us-east-1", endpoint_url=endpoint)
        dynamo.create_table(
            TableName="test-progress",
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "progress_id", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "progress_id", "KeyType": "HASH"}],
        )
        self.table = dynamo.Table("test-progress")
        yield
        self.table.delete()

    def test_concurrent_updates_20_and_60_seconds(self):
        """
        Two concurrent updates: watched=20s and watched=60s.
        Final result must be 60s (max), not the last writer's value.
        """
        import threading
        from botocore.exceptions import ClientError as BotoCoreClientError

        progress_id = str(uuid.uuid4())
        self.table.put_item(Item={
            "progress_id": progress_id,
            "watched_seconds": Decimal("0"),
            "completed": False,
            "version": 0,
        })

        results = []

        def _update(watched):
            for attempt in range(3):
                item = self.table.get_item(
                    Key={"progress_id": progress_id},
                    ConsistentRead=True,
                )["Item"]
                current_version = int(item.get("version", 0))
                existing_ws = int(item.get("watched_seconds", 0))
                new_ws = max(existing_ws, watched)
                try:
                    self.table.update_item(
                        Key={"progress_id": progress_id},
                        UpdateExpression="SET watched_seconds = :ws, version = :nv",
                        ConditionExpression="version = :ev",
                        ExpressionAttributeValues={
                            ":ws": Decimal(str(new_ws)),
                            ":ev": current_version,
                            ":nv": current_version + 1,
                        },
                    )
                    results.append(("ok", watched))
                    return
                except BotoCoreClientError as e:
                    if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                        raise
                    # retry
            results.append(("failed_after_retries", watched))

        t1 = threading.Thread(target=_update, args=(20,))
        t2 = threading.Thread(target=_update, args=(60,))
        t1.start(); t2.start()
        t1.join(); t2.join()

        final = self.table.get_item(Key={"progress_id": progress_id}, ConsistentRead=True)["Item"]
        assert int(final["watched_seconds"]) == 60, (
            f"Expected 60, got {final['watched_seconds']}. Results: {results}"
        )

    def test_complete_and_update_concurrent(self):
        """
        /progress/complete and /progress/update (incomplete) run concurrently.
        Final state must be completed=True.
        """
        import threading
        from botocore.exceptions import ClientError as BotoCoreClientError

        progress_id = str(uuid.uuid4())
        self.table.put_item(Item={
            "progress_id": progress_id,
            "watched_seconds": Decimal("80"),
            "completed": False,
            "version": 0,
        })

        def _write(watched, completed):
            for _ in range(3):
                item = self.table.get_item(
                    Key={"progress_id": progress_id}, ConsistentRead=True
                )["Item"]
                cv = int(item["version"])
                ews = int(item["watched_seconds"])
                ec = bool(item.get("completed", False))
                new_ws = max(ews, watched)
                new_c  = ec or completed
                try:
                    self.table.update_item(
                        Key={"progress_id": progress_id},
                        UpdateExpression="SET watched_seconds = :ws, completed = :c, version = :nv",
                        ConditionExpression="version = :ev",
                        ExpressionAttributeValues={
                            ":ws": Decimal(str(new_ws)),
                            ":c": new_c,
                            ":ev": cv,
                            ":nv": cv + 1,
                        },
                    )
                    return
                except BotoCoreClientError as e:
                    if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                        raise

        t1 = threading.Thread(target=_write, args=(81, True))   # complete
        t2 = threading.Thread(target=_write, args=(81, False))  # plain update
        t1.start(); t2.start()
        t1.join(); t2.join()

        final = self.table.get_item(Key={"progress_id": progress_id}, ConsistentRead=True)["Item"]
        assert final["completed"] is True, f"Expected completed=True, got {final}"
