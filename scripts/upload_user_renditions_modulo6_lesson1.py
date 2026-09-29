#!/usr/bin/env python3
"""
Upload user-provided renditions for Modulo 6 Lesson 1 (Come impugnare il tool e primi peli).
Direct upload to S3 and DynamoDB update with zero transcoding.
"""

import os
import sys
import uuid
from datetime import datetime, timezone
import boto3
from boto3.s3.transfer import TransferConfig

PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
BUCKET_NAME = 'prod-videocorso-content'
TABLE_NAME = 'prod-videocorso-lessons'

LESSON_ID = '1a22afdc-b02b-4b52-a842-3a5aee114993'
TITLE = 'Come impugnare il tool e primi peli'
SOURCE_DIR = '/Volumes/Sviluppo/Chiara Morocutti/Modulo 6 Latex/Come impugnare il tool e primi peli/RISOLUZIONI_AWS'

FILES_TO_UPLOAD = [
    # (local_filename, s3_suffix/type)
    ('source.mp4', 'master', f'videos/{LESSON_ID}/{{asset_version}}/source.mp4'),
    ('source.mp4', '1080p', f'streaming/{LESSON_ID}/{{asset_version}}/source_1080p.mp4'),
    ('source_720p.mp4', '720p', f'streaming/{LESSON_ID}/{{asset_version}}/source_720p.mp4'),
    ('source_480p.mp4', '480p', f'streaming/{LESSON_ID}/{{asset_version}}/source_480p.mp4'),
    ('source_360p.mp4', '360p', f'streaming/{LESSON_ID}/{{asset_version}}/source_360p.mp4'),
]

TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=15 * 1024 * 1024,
    max_concurrency=8,
    multipart_chunksize=10 * 1024 * 1024,
    use_threads=True
)

def main():
    print("=" * 70)
    print("🚀 DIRECT UPLOAD OF USER-GENERATED RENDITIONS")
    print(f"   Lesson: {TITLE} ({LESSON_ID})")
    print(f"   Folder: {SOURCE_DIR}")
    print("=" * 70)

    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    dynamodb = session.resource('dynamodb')
    s3_client = session.client('s3')
    table = dynamodb.Table(TABLE_NAME)

    # Generate new asset_version to bust CDN / browser caches
    new_asset_version = uuid.uuid4().hex
    print(f"🔑 New Asset Version: {new_asset_version}\n")

    for local_name, label, s3_key_template in FILES_TO_UPLOAD:
        local_path = os.path.join(SOURCE_DIR, local_name)
        if not os.path.exists(local_path):
            print(f"❌ File not found: {local_path}")
            sys.exit(1)

        size_mb = os.path.getsize(local_path) / (1024 * 1024)
        s3_key = s3_key_template.format(asset_version=new_asset_version)
        print(f"☁️ Uploading {label} ({local_name}, {size_mb:.1f} MB) -> s3://{BUCKET_NAME}/{s3_key}...", end="", flush=True)

        s3_client.upload_file(
            local_path,
            BUCKET_NAME,
            s3_key,
            ExtraArgs={'ContentType': 'video/mp4'},
            Config=TRANSFER_CONFIG
        )
        print(" Done.")

    # Update DynamoDB
    video_s3_key = f"videos/{LESSON_ID}/{new_asset_version}/source.mp4"
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    duration_seconds = 248 # 4:08

    print("\n📝 Updating DynamoDB...")
    table.update_item(
        Key={'lesson_id': LESSON_ID},
        UpdateExpression="SET video_s3_key = :vkey, asset_version = :av, transcode_status = :status, transcode_completed_at = :now, duration_seconds = :d",
        ExpressionAttributeValues={
            ':vkey': video_s3_key,
            ':av': new_asset_version,
            ':status': 'COMPLETED',
            ':now': now_ms,
            ':d': duration_seconds
        }
    )
    print("✅ DynamoDB updated successfully!")

    print("\n" + "=" * 70)
    print("🎉 VIDEO E RISOLUZIONI UFFICIALI CARICATI CON SUCCESSO SU AWS!")
    print("=" * 70)

if __name__ == '__main__':
    main()
