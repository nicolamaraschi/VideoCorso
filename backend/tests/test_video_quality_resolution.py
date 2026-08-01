"""Unit tests for deterministic rendition selection in the video endpoint."""

import importlib.util
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).parent.parent


def load_video_handler():
    boto3 = types.ModuleType('boto3')
    boto3.client = lambda *_args, **_kwargs: types.SimpleNamespace()
    boto3.resource = lambda *_args, **_kwargs: types.SimpleNamespace(Table=lambda *_a: None)
    sys.modules['boto3'] = boto3
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
