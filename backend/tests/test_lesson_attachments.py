import importlib.util
import pathlib
import sys
import types
from unittest.mock import MagicMock
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
        def __init__(self):
            self.items = {}
        def get_item(self, **kw):
            key = kw.get('Key', {})
            k = next(iter(key.values()), None)
            return {'Item': self.items.get(k)} if k in self.items else {}
        def query(self, **kw): return {"Items": []}
        def scan(self, **kw): return {"Items": []}
        def put_item(self, **kw):
            item = kw.get('Item', {})
            k = next(iter(item.values()), None)
            if k: self.items[k] = item
            return {}
        def update_item(self, **kw):
            return {"Attributes": {}}
        def delete_item(self, **kw):
            return {}

    class _FakeDynamo:
        def Table(self, n): return _FakeTable()

    fake_s3 = MagicMock()
    fake_s3.generate_presigned_url.side_effect = lambda action, Params=None, ExpiresIn=None: (
        f"https://fake-s3/{Params.get('Bucket')}/{Params.get('Key')}"
    )

    boto3_stub.resource = lambda *a, **k: _FakeDynamo()
    boto3_stub.client = lambda service, *a, **k: fake_s3 if service == 's3' else types.SimpleNamespace(
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
    return fake_s3


fake_s3 = _setup_stubs()

_ROOT = pathlib.Path(__file__).parent.parent / "lambda"
_course_spec = importlib.util.spec_from_file_location("course_handler_pkg2", _ROOT / "course_handler/app.py")
_course = importlib.util.module_from_spec(_course_spec)
_course_spec.loader.exec_module(_course)
_course.s3_client = fake_s3
_course.video_bucket_name = "test-video-bucket"


def test_filter_lesson_with_access_generates_attachment_urls():
    lesson = {
        "lesson_id": "les-1",
        "title": "Modulo 1 - Teoria",
        "is_free_preview": False,
        "attachments": [
            {
                "id": "att-1",
                "title": "Dispensa Modulo 1",
                "file_name": "dispensa.pdf",
                "s3_key": "materials/les-1/uuid-dispensa.pdf",
                "file_size": 1024,
                "file_type": "application/pdf",
            }
        ]
    }
    filtered = _course.filter_lesson_for_access(lesson, has_access=True, is_user_admin=False)
    assert filtered["is_locked"] is False
    assert len(filtered["attachments"]) == 1
    assert filtered["attachments"][0]["download_url"] == "https://fake-s3/test-video-bucket/materials/les-1/uuid-dispensa.pdf"
    assert filtered["attachments"][0]["file_name"] == "dispensa.pdf"


def test_filter_lesson_locked_strips_attachment_s3_key_and_url():
    lesson = {
        "lesson_id": "les-2",
        "title": "Modulo 2 - Pratica",
        "is_free_preview": False,
        "attachments": [
            {
                "id": "att-2",
                "title": "Slide Tecniche",
                "file_name": "slide.pptx",
                "s3_key": "materials/les-2/uuid-slide.pptx",
                "file_size": 2048,
                "file_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            }
        ]
    }
    filtered = _course.filter_lesson_for_access(lesson, has_access=False, is_user_admin=False)
    assert filtered["is_locked"] is True
    assert len(filtered["attachments"]) == 1
    assert "s3_key" not in filtered["attachments"][0]
    assert filtered["attachments"][0]["download_url"] is None
    assert filtered["attachments"][0]["title"] == "Slide Tecniche"
    assert filtered["attachments"][0]["file_name"] == "slide.pptx"
