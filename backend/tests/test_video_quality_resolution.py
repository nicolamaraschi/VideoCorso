"""Unit tests for deterministic rendition selection in the video endpoint."""

import importlib.util
import json
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).parent.parent


def load_video_handler():
    boto3 = types.ModuleType('boto3')
    boto3.client = lambda *_args, **_kwargs: types.SimpleNamespace()
    boto3.resource = lambda *_args, **_kwargs: types.SimpleNamespace(Table=lambda *_a: None)
    dynamodb_mod = types.ModuleType('boto3.dynamodb')
    conditions_mod = types.ModuleType('boto3.dynamodb.conditions')
    conditions_mod.Key = lambda *_args, **_kwargs: None
    dynamodb_mod.conditions = conditions_mod
    boto3.dynamodb = dynamodb_mod
    sys.modules['boto3'] = boto3
    sys.modules['boto3.dynamodb'] = dynamodb_mod
    sys.modules['boto3.dynamodb.conditions'] = conditions_mod
    exceptions = types.ModuleType('botocore.exceptions')
    exceptions.ClientError = Exception
    sys.modules['botocore'] = types.ModuleType('botocore')
    sys.modules['botocore.exceptions'] = exceptions
    spec = importlib.util.spec_from_file_location('video_quality_resolution', ROOT / 'lambda' / 'video_handler' / 'app.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_requested_qualities_select_their_matching_rendition():
    handler = load_video_handler()
    source = 'videos/lesson-1/version-1/source.mp4'
    renditions = {
        '720p': 'streaming/lesson-1/version-1/source_720p.mp4',
        '480p': 'streaming/lesson-1/version-1/source_480p.mp4',
        '360p': 'streaming/lesson-1/version-1/source_360p.mp4',
    }

    assert handler.resolve_served_video_key(source, 'high', renditions) == (renditions['720p'], '720p')
    assert handler.resolve_served_video_key(source, 'medium', renditions) == (renditions['480p'], '480p')
    assert handler.resolve_served_video_key(source, 'low', renditions) == (renditions['360p'], '360p')


def test_missing_rendition_uses_the_documented_fallback_chain():
    handler = load_video_handler()
    source = 'videos/lesson-1/version-1/source.mp4'
    renditions = {'360p': 'streaming/lesson-1/version-1/source_360p.mp4'}

    assert handler.resolve_served_video_key(source, 'high', renditions) == (renditions['360p'], '360p')
    assert handler.resolve_served_video_key(source, 'medium', renditions) == (renditions['360p'], '360p')
    assert handler.resolve_served_video_key(source, 'low', renditions) == (renditions['360p'], '360p')


def test_source_is_served_only_while_no_rendition_exists():
    handler = load_video_handler()
    source = 'videos/lesson-1/version-1/source.mp4'

    assert handler.resolve_served_video_key(source, 'high', {}) == (source, None)


class _StaticTable:
    def __init__(self, item):
        self.item = item

    def get_item(self, **_kwargs):
        return {'Item': self.item}


class _CaptureTable:
    def __init__(self):
        self.items = []

    def put_item(self, **kwargs):
        self.items.append(kwargs['Item'])


def test_global_access_can_open_a_protected_video_and_is_audited():
    """A global entitlement has no purchase object, but must never produce a 403."""
    handler = load_video_handler()
    handler.lessons_table = _StaticTable({
        'lesson_id': 'lesson-1',
        'chapter_id': 'chapter-1',
        'video_s3_key': 'videos/lesson-1/source.mp4',
        'is_free_preview': False,
    })
    handler.chapters_table = _StaticTable({'chapter_id': 'chapter-1', 'course_id': 'course-1'})
    handler.users_table = _StaticTable({'user_id': 'user-1', 'global_access': True})
    handler.purchases_table = types.SimpleNamespace(query=lambda **_kwargs: {'Items': []})
    handler.get_available_renditions = lambda _key: {}
    handler.s3_client = types.SimpleNamespace(
        generate_presigned_url=lambda *_args, **_kwargs: 'https://video.example.test/signed'
    )
    access_log = _CaptureTable()
    handler.video_access_logs_table = access_log

    response = handler.get_video_url(
        'user-1',
        'lesson-1',
        request_event={'requestContext': {}, 'headers': {}},
    )

    assert response['statusCode'] == 200
    assert json.loads(response['body'])['video_url'] == 'https://video.example.test/signed'
    assert access_log.items[0]['purchase_id'] == 'global_access'
