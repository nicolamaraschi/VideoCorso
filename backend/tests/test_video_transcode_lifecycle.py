"""Regression tests for stale MediaConvert completions.

The test stays local: the important property is that a completion can only
publish a rendition when both asset_version and transcode_job_id still belong
to the lesson.  Deleted/replaced assets are cleaned instead.
"""

import importlib.util
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).parent.parent


class FakeTable:
    def __init__(self, item=None):
        self.item = item
        self.updates = []

    def get_item(self, **_kwargs):
        return {"Item": self.item} if self.item else {}

    def update_item(self, **kwargs):
        self.updates.append(kwargs)
        return {}


def load_transcoder():
    boto3 = types.ModuleType("boto3")
    boto3.client = lambda *_args, **_kwargs: types.SimpleNamespace()
    boto3.resource = lambda *_args, **_kwargs: types.SimpleNamespace(Table=lambda *_a: FakeTable())
    sys.modules["boto3"] = boto3
    exceptions = types.ModuleType("botocore.exceptions")
    exceptions.ClientError = Exception
    sys.modules["botocore"] = types.ModuleType("botocore")
    sys.modules["botocore.exceptions"] = exceptions
    spec = importlib.util.spec_from_file_location("video_transcode_lifecycle", ROOT / "lambda" / "video_transcode_handler" / "app.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_late_completion_after_replacement_deletes_old_outputs(monkeypatch):
    transcoder = load_transcoder()
    transcoder.lessons_table = FakeTable({
        "lesson_id": "lesson-1", "asset_version": "version-new", "transcode_job_id": "job-new",
    })
    deleted = []
    monkeypatch.setattr(transcoder, "delete_prefix", lambda bucket, prefix: deleted.append((bucket, prefix)))
    transcoder.mark_job_completion({
        "jobId": "job-old", "status": "COMPLETE",
        "userMetadata": {"lesson_id": "lesson-1", "asset_version": "version-old"},
    }, "video-bucket")
    assert deleted == [("video-bucket", "streaming/lesson-1/version-old/")]
    assert transcoder.lessons_table.updates == []


def test_completion_of_active_version_is_conditionally_published(monkeypatch):
    transcoder = load_transcoder()
    table = FakeTable({
        "lesson_id": "lesson-1", "pending_asset_version": "version-current", "transcode_job_id": "job-current",
    })
    transcoder.lessons_table = table
    monkeypatch.setattr(transcoder, "delete_prefix", lambda *_args: (_ for _ in ()).throw(AssertionError("must not clean active output")))
    transcoder.mark_job_completion({
        "jobId": "job-current", "status": "COMPLETE", "timestamp": "2026-07-31T00:00:00Z",
        "userMetadata": {"lesson_id": "lesson-1", "asset_version": "version-current"},
    }, "video-bucket")
    assert table.updates[0]["ConditionExpression"] == "pending_asset_version = :version AND transcode_job_id = :job_id"


def test_build_job_settings_respects_portrait_orientation():
    transcoder = load_transcoder()
    landscape_job = transcoder.build_job_settings("s3://bucket/source.mp4", "s3://bucket/out", is_portrait=False)
    portrait_job = transcoder.build_job_settings("s3://bucket/source.mp4", "s3://bucket/out", is_portrait=True)

    land_720 = landscape_job['OutputGroups'][0]['Outputs'][0]['VideoDescription']
    port_720 = portrait_job['OutputGroups'][0]['Outputs'][0]['VideoDescription']

    assert land_720['Width'] == 1280 and land_720['Height'] == 720
    assert port_720['Width'] == 720 and port_720['Height'] == 1280
