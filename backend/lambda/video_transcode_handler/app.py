import os
from urllib.parse import unquote_plus

import boto3


VIDEO_EXTENSIONS = ('.mp4', '.mov', '.m4v')


def mediaconvert_client():
    discovery = boto3.client('mediaconvert')
    endpoint = discovery.describe_endpoints(MaxResults=1)['Endpoints'][0]['Url']
    return boto3.client('mediaconvert', endpoint_url=endpoint)


def build_job_settings(source_uri: str, destination_uri: str) -> dict:
    return {
        'TimecodeConfig': {'Source': 'ZEROBASED'},
        'OutputGroups': [{
            'Name': 'HD MP4',
            'OutputGroupSettings': {
                'Type': 'FILE_GROUP_SETTINGS',
                'FileGroupSettings': {'Destination': destination_uri},
            },
            'Outputs': [{
                'NameModifier': '_1080p',
                'ContainerSettings': {
                    'Container': 'MP4',
                    'Mp4Settings': {'MoovPlacement': 'PROGRESSIVE_DOWNLOAD'},
                },
                'VideoDescription': {
                    'Width': 1920,
                    'ScalingBehavior': 'DEFAULT',
                    'CodecSettings': {
                        'Codec': 'H_264',
                        'H264Settings': {
                            'RateControlMode': 'QVBR',
                            'QualityTuningLevel': 'SINGLE_PASS_HQ',
                            'QvbrSettings': {'QvbrQualityLevel': 7},
                            'MaxBitrate': 4000000,
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
                            'Bitrate': 128000,
                            'CodingMode': 'CODING_MODE_2_0',
                            'SampleRate': 48000,
                        },
                    },
                }],
            }],
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
            UserMetadata={'source_key': source_key, 'optimized_key': f'streaming/{source_stem}/{source_stem}_1080p.mp4'},
            StatusUpdateInterval='SECONDS_60',
        )
        print(f"Started MediaConvert job {response['Job']['Id']} for {source_key}")

    return {'statusCode': 200}
