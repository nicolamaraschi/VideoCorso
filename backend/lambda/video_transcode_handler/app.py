from __future__ import annotations

import os
import hashlib
from urllib.parse import unquote_plus

import boto3
from botocore.exceptions import ClientError


VIDEO_EXTENSIONS = ('.mp4', '.mov', '.m4v')
TERMINAL_STATUSES = {'COMPLETE', 'ERROR', 'CANCELED'}


def mediaconvert_client():
    discovery = boto3.client('mediaconvert')
    endpoint = discovery.describe_endpoints(MaxResults=1)['Endpoints'][0]['Url']
    return boto3.client('mediaconvert', endpoint_url=endpoint)



# Three progressive-download renditions instead of a single fixed-bitrate 1080p.
# QVBR lets MediaConvert spend more bits only on complex scenes, keeping files
# smaller than a constant bitrate would for the same visual quality - a good
# fit for course footage (talking head, slides, low motion).
# Bitrates follow AWS's own QVBR reference points for each resolution tier.
RENDITIONS = [
    {
        'name_modifier': '_720p',
        'width': 1280,
        'height': 720,
        'qvbr_quality_level': 7,
        'max_bitrate': 2000000,
        'audio_bitrate': 96000,
    },
    {
        'name_modifier': '_480p',
        'width': 854,
        'height': 480,
        'qvbr_quality_level': 6,
        'max_bitrate': 1000000,
        'audio_bitrate': 80000,
    },
    {
        'name_modifier': '_360p',
        'width': 640,
        'height': 360,
        'qvbr_quality_level': 5,
        'max_bitrate': 650000,
        'audio_bitrate': 64000,
    },
]


def get_renditions_for_orientation(is_portrait: bool) -> list[dict]:
    if is_portrait:
        return [
            {
                'name_modifier': '_720p',
                'width': 720,
                'height': 1280,
                'qvbr_quality_level': 7,
                'max_bitrate': 2000000,
                'audio_bitrate': 96000,
            },
            {
                'name_modifier': '_480p',
                'width': 480,
                'height': 854,
                'qvbr_quality_level': 6,
                'max_bitrate': 1000000,
                'audio_bitrate': 80000,
            },
            {
                'name_modifier': '_360p',
                'width': 360,
                'height': 640,
                'qvbr_quality_level': 5,
                'max_bitrate': 650000,
                'audio_bitrate': 64000,
            },
        ]
    return RENDITIONS


def detect_video_portrait(bucket: str, key: str) -> bool:
    """Detect whether an MP4/MOV in S3 is portrait (either via tkhd rotation or dimensions)."""
    try:
        s3 = boto3.client('s3')
        response = s3.get_object(Bucket=bucket, Key=key, Range='bytes=0-2097151')
        data = response['Body'].read()
        idx = 0
        while idx < len(data) - 56:
            if data[idx:idx + 4] == b'tkhd':
                box_start = idx - 4
                version = data[idx + 4]
                matrix_start = box_start + (60 if version == 1 else 48)
                if matrix_start + 16 <= len(data):
                    a = int.from_bytes(data[matrix_start:matrix_start + 4], 'big', signed=True)
                    b = int.from_bytes(data[matrix_start + 4:matrix_start + 8], 'big', signed=True)
                    c = int.from_bytes(data[matrix_start + 8:matrix_start + 12], 'big', signed=True)
                    d = int.from_bytes(data[matrix_start + 12:matrix_start + 16], 'big', signed=True)
                    if (a == 0 and b > 0 and c < 0 and d == 0) or (a == 0 and b < 0 and c > 0 and d == 0):
                        return True
            idx += 1
    except Exception as exc:
        print(f"Could not inspect orientation for {key}: {exc}")
    return False


def build_output(rendition: dict) -> dict:
    return {
        'NameModifier': rendition['name_modifier'],
        'ContainerSettings': {
            'Container': 'MP4',
            'Mp4Settings': {'MoovPlacement': 'PROGRESSIVE_DOWNLOAD'},
        },
        'VideoDescription': {
            'Width': rendition['width'],
            'Height': rendition['height'],
            'ScalingBehavior': 'DEFAULT',
            'CodecSettings': {
                'Codec': 'H_264',
                'H264Settings': {
                    'RateControlMode': 'QVBR',
                    'QualityTuningLevel': 'SINGLE_PASS_HQ',
                    'QvbrSettings': {'QvbrQualityLevel': rendition['qvbr_quality_level']},
                    'MaxBitrate': rendition['max_bitrate'],
                    'GopSize': 2,
                    'GopSizeUnits': 'SECONDS',
                    'CodecProfile': 'HIGH',
                    'CodecLevel': 'AUTO',
                    'FramerateControl': 'INITIALIZE_FROM_SOURCE',
                },
            },
        },
        'AudioDescriptions': [{
            'AudioSourceName': 'Audio Selector 1',
            'CodecSettings': {
                'Codec': 'AAC',
                'AacSettings': {
                    'Bitrate': rendition['audio_bitrate'],
                    'CodingMode': 'CODING_MODE_2_0',
                    'SampleRate': 48000,
                },
            },
        }],
    }


def build_job_settings(source_uri: str, destination_uri: str, is_portrait: bool = False) -> dict:
    renditions = get_renditions_for_orientation(is_portrait)
    return {
        'TimecodeConfig': {'Source': 'ZEROBASED'},
        'OutputGroups': [{
            'Name': 'Progressive MP4 renditions',
            'OutputGroupSettings': {
                'Type': 'FILE_GROUP_SETTINGS',
                'FileGroupSettings': {'Destination': destination_uri},
            },
            'Outputs': [build_output(rendition) for rendition in renditions],
        }],
        'Inputs': [{
            'FileInput': source_uri,
            'AudioSelectors': {'Audio Selector 1': {'DefaultSelection': 'DEFAULT'}},
            # iPhone videos commonly store portrait orientation as metadata.
            # Bake that rotation into the output so every browser renders it upright.
            'VideoSelector': {'Rotate': 'AUTO'},
        }],
    }


def parse_versioned_source_key(source_key: str) -> tuple[str | None, str | None]:
    """Parse videos/<lesson_id>/<asset_version>/source.ext safely."""
    parts = source_key.strip('/').split('/')
    if len(parts) != 4 or parts[0] != 'videos' or not parts[3].startswith('source.'):
        return None, None
    return parts[1], parts[2]


def output_prefix(lesson_id: str, asset_version: str) -> str:
    return f'streaming/{lesson_id}/{asset_version}/'


def delete_prefix(bucket: str, prefix: str) -> None:
    """Best-effort cleanup for an obsolete MediaConvert job's output."""
    paginator = s3_client.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = [{'Key': item['Key']} for item in page.get('Contents', [])]
        if objects:
            s3_client.delete_objects(Bucket=bucket, Delete={'Objects': objects, 'Quiet': True})


def mark_job_completion(detail: dict, bucket: str) -> None:
    metadata = detail.get('userMetadata') or detail.get('user_metadata') or {}
    lesson_id = metadata.get('lesson_id')
    asset_version = metadata.get('asset_version')
    job_id = detail.get('jobId') or detail.get('job_id') or detail.get('id')
    if not lesson_id or not asset_version:
        return
    status = str(detail.get('status') or '').upper()
    if status not in TERMINAL_STATUSES:
        return
    lesson = lessons_table.get_item(Key={'lesson_id': lesson_id}, ConsistentRead=True).get('Item')
    prefix = output_prefix(lesson_id, asset_version)
    if not lesson or lesson.get('pending_asset_version') != asset_version or lesson.get('transcode_job_id') != job_id:
        delete_prefix(bucket, prefix)
        return
    if status == 'COMPLETE':
        try:
            lessons_table.update_item(
                Key={'lesson_id': lesson_id},
                UpdateExpression='SET video_s3_key = pending_video_s3_key, asset_version = pending_asset_version, transcode_status = :status, transcode_completed_at = :now REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status',
                ConditionExpression='pending_asset_version = :version AND transcode_job_id = :job_id',
                ExpressionAttributeValues={
                    ':status': 'COMPLETE', ':now': detail.get('timestamp') or '',
                    ':version': asset_version, ':job_id': job_id,
                },
            )
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
                delete_prefix(bucket, prefix)
                return
            raise
    else:
        # Failed/cancelled jobs must not leave an active-looking rendition set.
        lessons_table.update_item(Key={'lesson_id': lesson_id},
            UpdateExpression='SET transcode_status=:status, transcode_completed_at=:now, transcode_error_message=:error',
            ConditionExpression='pending_asset_version=:version AND transcode_job_id=:job_id',
            ExpressionAttributeValues={':status':status, ':now':detail.get('timestamp') or '', ':error':str(detail.get('errorMessage') or ''), ':version':asset_version, ':job_id':job_id})
        delete_prefix(bucket, prefix)


def lambda_handler(event, context):
    del context
    bucket = os.environ['VIDEO_BUCKET']
    role = os.environ['MEDIACONVERT_ROLE_ARN']
    if event.get('source') == 'aws.mediaconvert' and event.get('detail-type') == 'MediaConvert Job State Change':
        mark_job_completion(event.get('detail') or {}, bucket)
        return {'statusCode': 200}

    client = mediaconvert_client()

    records = event.get('Records', [])
    if event.get('source') == 'aws.s3' and event.get('detail-type') == 'Object Created':
        records = [{'s3': {
            'bucket': {'name': event['detail']['bucket']['name']},
            'object': {'key': event['detail']['object']['key']},
        }}]

    for record in records:
        source_bucket = record['s3']['bucket']['name']
        source_key = unquote_plus(record['s3']['object']['key'])
        if source_bucket != bucket or not source_key.startswith('videos/'):
            continue
        if not source_key.lower().endswith(VIDEO_EXTENSIONS):
            print(f'Skipping unsupported upload: {source_key}')
            continue

        source_name = source_key.rsplit('/', 1)[-1]
        source_stem = source_name.rsplit('.', 1)[0]
        lesson_id, asset_version = parse_versioned_source_key(source_key)
        if lesson_id and asset_version:
            lesson = lessons_table.get_item(Key={'lesson_id': lesson_id}, ConsistentRead=True).get('Item')
            # A deleted/replaced lesson is not allowed to start a stale job.
            if not lesson or lesson.get('pending_video_s3_key') != source_key or lesson.get('pending_asset_version') != asset_version:
                continue
            token = hashlib.sha256(f'{bucket}:{source_key}:{asset_version}'.encode()).hexdigest()[:64]
            try:
                lessons_table.update_item(Key={'lesson_id':lesson_id},
                    UpdateExpression='SET pending_transcode_status=:submitting, submission_token=:token',
                    ConditionExpression='pending_asset_version=:version AND pending_video_s3_key=:source AND pending_transcode_status IN (:pending,:failed)',
                    ExpressionAttributeValues={':submitting':'SUBMITTING',':token':token,':version':asset_version,':source':source_key,':pending':'PENDING_UPLOAD',':failed':'FAILED'})
            except ClientError as exc:
                if exc.response.get('Error',{}).get('Code') == 'ConditionalCheckFailedException': continue
                raise
            destination = f's3://{bucket}/{output_prefix(lesson_id, asset_version)}'
        else:
            # Legacy uploads continue to work while they are gradually replaced.
            destination = f's3://{bucket}/streaming/{source_stem}/'
        is_portrait = detect_video_portrait(bucket, source_key)
        response = client.create_job(
            Role=role,
            Settings=build_job_settings(f's3://{bucket}/{source_key}', destination, is_portrait),
            UserMetadata={
                'source_key': source_key,
                'lesson_id': lesson_id or '',
                'asset_version': asset_version or '',
                'optimized_key': (
                    f'{output_prefix(lesson_id, asset_version)}source_720p.mp4'
                    if lesson_id and asset_version else f'streaming/{source_stem}/{source_stem}_720p.mp4'
                ),
            },
            StatusUpdateInterval='SECONDS_60',
            ClientRequestToken=token,
        )
        if lesson_id and asset_version:
            try:
                lessons_table.update_item(
                    Key={'lesson_id': lesson_id},
                    UpdateExpression='SET transcode_job_id = :job_id, transcode_status = :status',
                    ConditionExpression='pending_asset_version = :version AND pending_video_s3_key = :source AND submission_token = :token',
                    ExpressionAttributeValues={
                        ':job_id': response['Job']['Id'], ':status': 'SUBMITTED',
                        ':version': asset_version, ':source': source_key, ':token':token,
                    },
                )
            except ClientError as exc:
                if exc.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
                    delete_prefix(bucket, output_prefix(lesson_id, asset_version))
                    continue
                raise
        print(f"Started MediaConvert job {response['Job']['Id']} for {source_key}")

    return {'statusCode': 200}


s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
lessons_table = dynamodb.Table(os.environ.get('LESSONS_TABLE'))
