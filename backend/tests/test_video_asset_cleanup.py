"""Regression tests for deletion of source and all video renditions."""

import importlib.util
import json
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "layers" / "shared" / "python"))


def install_stubs():
    boto3 = types.ModuleType("boto3")
    boto3.client = lambda *_args, **_kwargs: types.SimpleNamespace()
    boto3.resource = lambda *_args, **_kwargs: types.SimpleNamespace(Table=lambda *_a: None)
    sys.modules["boto3"] = boto3
    conditions = types.ModuleType("boto3.dynamodb.conditions")
    conditions.Key = lambda *_args, **_kwargs: None
    sys.modules["boto3.dynamodb"] = types.ModuleType("boto3.dynamodb")
    sys.modules["boto3.dynamodb.conditions"] = conditions
    exceptions = types.ModuleType("botocore.exceptions")
    exceptions.ClientError = Exception
    sys.modules["botocore"] = types.ModuleType("botocore")
    sys.modules["botocore.exceptions"] = exceptions
    sys.modules["stripe"] = types.ModuleType("stripe")


install_stubs()
spec = importlib.util.spec_from_file_location("admin_asset_cleanup", ROOT / "lambda" / "admin_handler" / "app.py")
admin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin)


def test_delete_lesson_assets_deletes_source_and_all_renditions(monkeypatch):
    deleted = []
    monkeypatch.setattr(admin, "VIDEO_BUCKET", "video")
    monkeypatch.setattr(admin, "THUMBNAIL_BUCKET", "thumb")
    monkeypatch.setattr(admin, "delete_s3_object_safely", lambda bucket, key: deleted.append((bucket, key)))
    monkeypatch.setattr(admin, "get_owned_s3_key", lambda _url, _bucket: None)
    admin.delete_lesson_assets({"video_s3_key": "uploads/lesson.mov"})
    assert deleted == [
        ("video", "uploads/lesson.mov"),
        ("video", "streaming/lesson/lesson_720p.mp4"),
        ("video", "streaming/lesson/lesson_480p.mp4"),
        ("video", "streaming/lesson/lesson_360p.mp4"),
        ("video", "streaming/lesson/lesson_1080p.mp4"),
        ("thumb", None),
    ]


def test_external_video_has_no_owned_renditions():
    assert admin.get_optimized_video_keys("https://cdn.example/video.mp4") == []


def test_versioned_lesson_assets_are_isolated_from_old_versions():
    key = "videos/lesson-1/version-new/source.mp4"
    assert admin.extract_asset_version(key, "lesson-1") == "version-new"
    assert admin.extract_asset_version(key, "lesson-other") is None
    assert admin.get_optimized_video_keys(key) == [
        "streaming/lesson-1/version-new/source_720p.mp4",
        "streaming/lesson-1/version-new/source_480p.mp4",
        "streaming/lesson-1/version-new/source_360p.mp4",
        "streaming/lesson-1/version-new/source_1080p.mp4",
    ]


class FakeLessonsTable:
    def __init__(self, lesson):
        self.lesson = lesson
        self.updates = []

    def get_item(self, **_kwargs):
        return {'Item': self.lesson}

    def update_item(self, **kwargs):
        self.updates.append(kwargs)
        return {'Attributes': self.lesson}


def test_saving_after_presigned_upload_does_not_reset_pending_transcode(monkeypatch):
    """The editor PUT follows the presigned upload and must retain its job state."""
    lesson_id = 'lesson-1'
    asset_version = 'asset-1'
    source_key = f'videos/{lesson_id}/{asset_version}/source.mp4'
    table = FakeLessonsTable({
        'lesson_id': lesson_id,
        'title': 'Before',
        'video_s3_key': '',
        'pending_video_s3_key': source_key,
        'pending_asset_version': asset_version,
        'transcode_job_id': 'job-1',
        'transcode_status': 'SUBMITTED',
    })
    monkeypatch.setitem(admin.TABLES, 'LESSONS', table)

    response = admin.update_lesson(lesson_id, {
        'title': 'After',
        'video_s3_key': source_key,
    })

    assert response['statusCode'] == 200
    assert json.loads(response['body'])['success'] is True
    update = table.updates[0]
    assert update['ExpressionAttributeNames'] == {'#title': 'title'}
    assert 'transcode_job_id' not in update['UpdateExpression']
    assert 'transcode_status' not in update['UpdateExpression']
