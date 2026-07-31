import os
from urllib.parse import unquote_plus

import boto3


VIDEO_EXTENSIONS = ('.mp4', '.mov', '.m4v')


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


def build_job_settings(source_uri: str, destination_uri: str) -> dict:
    return {
        'TimecodeConfig': {'Source': 'ZEROBASED'},
        'OutputGroups': [{
            'Name': 'Progressive MP4 renditions',
            'OutputGroupSettings': {
                'Type': 'FILE_GROUP_SETTINGS',
                'FileGroupSettings': {'Destination': destination_uri},
            },
            'Outputs': [build_output(rendition) for rendition in RENDITIONS],
        }],
        'Inputs': [{
            'FileInput': source_uri,
            'AudioSelectors': {'Audio Selector 1': {'DefaultSelection': 'DEFAULT'}},
            # iPhone videos commonly store portrait orientation as metadata.
            # Bake that rotation into the output so every browser renders it upright.
            'VideoSelector': {'Rotate': 'AUTO'},
        }],
    }


def lambda_handler(event, context):
    del context
    bucket = os.environ['VIDEO_BUCKET']
    role = os.environ['MEDIACONVERT_ROLE_ARN']
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
        destination = f's3://{bucket}/streaming/{source_stem}/'
        response = client.create_job(
            Role=role,
            Settings=build_job_settings(f's3://{bucket}/{source_key}', destination),
            UserMetadata={'source_key': source_key, 'optimized_key': f'streaming/{source_stem}/{source_stem}_720p.mp4'},
            StatusUpdateInterval='SECONDS_60',
        )
        print(f"Started MediaConvert job {response['Job']['Id']} for {source_key}")

    return {'statusCode': 200}
