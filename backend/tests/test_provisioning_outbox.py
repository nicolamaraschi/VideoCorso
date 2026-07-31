"""Outbox recovery tests: external provisioning must be retry-safe."""

import importlib.util
import os
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).parent.parent


def load_worker():
    os.environ.setdefault("PURCHASES_TABLE", "purchases")
    os.environ.setdefault("USERS_TABLE", "users")
    os.environ.setdefault("PROVISIONING_OUTBOX_TABLE", "outbox")
    os.environ.setdefault("COGNITO_USER_POOL_ID", "pool")
    botocore = types.ModuleType("botocore")
    exceptions = types.ModuleType("botocore.exceptions")
    exceptions.ClientError = Exception
    botocore.exceptions = exceptions
    sys.modules["botocore"] = botocore
    sys.modules["botocore.exceptions"] = exceptions
    boto3 = types.ModuleType("boto3")
    boto3.client = lambda *_args, **_kwargs: types.SimpleNamespace()
    boto3.resource = lambda *_args, **_kwargs: types.SimpleNamespace(Table=lambda *_a: types.SimpleNamespace())
    sys.modules["boto3"] = boto3
    sys.modules["boto3.dynamodb"] = types.ModuleType("boto3.dynamodb")
    types_module = types.ModuleType("boto3.dynamodb.types")
    types_module.TypeDeserializer = type("TypeDeserializer", (), {"deserialize": lambda _self, value: value})
    sys.modules["boto3.dynamodb.types"] = types_module
    spec = importlib.util.spec_from_file_location("provisioning_outbox", ROOT / "lambda" / "provisioning_outbox_handler" / "app.py")
    worker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(worker)
    return worker


class Table:
    def __init__(self): self.calls = []
    def update_item(self, **kwargs): self.calls.append(kwargs); return {}


def test_pending_user_id_is_stable_and_email_scoped():
    worker = load_worker()
    assert worker.pending_user_id("student@example.test") == worker.pending_user_id(" STUDENT@example.test ")
    assert worker.pending_user_id("student@example.test") != worker.pending_user_id("other@example.test")


def test_outbox_completion_reassigns_only_the_pending_purchase(monkeypatch):
    worker = load_worker()
    worker.users_table = Table()
    worker.purchases_table = Table()
    worker.outbox_table = Table()
    monkeypatch.setattr(worker, "ensure_cognito_user", lambda *_args: "cognito-sub")
    monkeypatch.setattr(worker, "claim_outbox", lambda *_args: True)
    worker.process_outbox({
        "outbox_id": "provision:pi-1", "purchase_id": "pi-1", "pending_user_id": worker.pending_user_id("a@example.test"),
        "customer_email": "a@example.test", "full_name": "A", "status": "PENDING",
    }, "worker-1")
    assert worker.purchases_table.calls[0]["ConditionExpression"] == "user_id = :pending_user_id"
    assert worker.outbox_table.calls[0]["ExpressionAttributeValues"][":completed"] == "COMPLETED"
