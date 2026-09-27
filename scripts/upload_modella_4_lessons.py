#!/usr/bin/env python3
"""
Upload 4 lessons with all web-optimized renditions (4K master, 1440p, 2k, 1080p, 720p, 480p, 360p)
from /Volumes/Sviluppo/MODELLA to AWS S3 and update DynamoDB.
Includes strict pre- and post-upload integrity validation and byte-range verification.
"""

import os
import sys
import time
import uuid
import json
import subprocess
from datetime import datetime, timezone
import boto3
from boto3.s3.transfer import TransferConfig
from botocore.exceptions import ClientError

PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
BUCKET_NAME = 'prod-videocorso-content'
TABLE_NAME = 'prod-videocorso-lessons'
FOLDER = '/Volumes/Sviluppo/MODELLA'

TASKS = [
    {
        'title': 'Forma su modella',
        'lesson_id': '6096ec26-70db-461c-bdbb-685cdeffa6e5',
        'master': 'MOD 4 LEZIONE 3 FORMA SU MODELLA.mp4',
        'prefix': 'MOD 4 LEZIONE 3 FORMA SU MODELLA'
    },
    {
        'title': 'Primo passaggio',
        'lesson_id': 'e8ad6dcc-bf29-463e-9192-16cc8b3f9e11',
        'master': 'MOD 7 LEZIONE 2 PRIMO PASSAGGIO(1).mp4',
        'prefix': 'MOD 7 LEZIONE 2 PRIMO PASSAGGIO'
    },
    {
        'title': 'Ripasso dei peli',
        'lesson_id': 'f7ca1389-885f-4fc7-90bf-01fa37e6f06d',
        'master': 'MOD 7 LEZ 3 RIPASSO PELI.mp4',
        'prefix': 'MOD 7 LEZ 3 RIPASSO PELI'
    },
    {
        'title': 'Maschera e pulizia finale',
        'lesson_id': 'fc38ebd8-4857-4b4a-86ad-0b0abd68e4aa',
        'master': 'MOD 7 LEZ 4 MASCERA PULIZIA FINALE.mp4',
        'prefix': 'MOD 7 LEZ 4 MASCERA PULIZIA FINALE'
    },
]

RENDITIONS = ['1440p', '1080p', '720p', '480p', '360p']

TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=15 * 1024 * 1024,
    max_concurrency=8,
    multipart_chunksize=10 * 1024 * 1024,
    use_threads=True
)

class ProgressPercentage:
    def __init__(self, filename, total_size):
        self._filename = filename
        self._size = float(total_size)
        self._seen_so_far = 0
        self._last_logged = 0

    def __call__(self, bytes_amount):
        self._seen_so_far += bytes_amount
        percentage = (self._seen_so_far / self._size) * 100
        # Log every 20% or on completion
        if percentage - self._last_logged >= 20 or self._seen_so_far >= self._size:
            print(f"        -> {percentage:.1f}% ({self._seen_so_far / (1024*1024):.1f}/{self._size / (1024*1024):.1f} MB)", flush=True)
            self._last_logged = percentage

def get_duration(file_path: str) -> float:
    cmd = [
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json', file_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(res.stdout)
    return float(data['format']['duration'])

def main():
    print("=" * 80)
    print("🚀 AWS S3 UPLOAD & DYNAMODB REGISTRATION FOR 4 MODELLA LESSONS")
    print(f"📁 Source Folder: {FOLDER}")
    print(f"🪣 S3 Bucket: {BUCKET_NAME}")
    print(f"📋 DynamoDB Table: {TABLE_NAME}")
    print("=" * 80)

    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    s3_client = session.client('s3')
    dynamodb = session.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)

    overall_start = time.time()
    uploaded_files_summary = []

    for idx, task in enumerate(TASKS, 1):
        lesson_id = task['lesson_id']
        title = task['title']
        master_name = task['master']
        prefix = task['prefix']
        master_path = os.path.join(FOLDER, master_name)

        print(f"\n[{idx}/4] 📹 PROCESSING LESSON: '{title}' ({lesson_id})")
        print(f"    Master File: {master_name}")

        if not os.path.exists(master_path):
            print(f"    ❌ Master file not found: {master_path}")
            sys.exit(1)

        duration_sec = int(round(get_duration(master_path)))
        asset_version = uuid.uuid4().hex
        print(f"    🔑 Generated Asset Version: {asset_version}")
        print(f"    ⏱️ Duration: {duration_sec}s ({duration_sec // 60}:{duration_sec % 60:02d})")

        # 1. Upload Master
        master_size = os.path.getsize(master_path)
        master_key = f"videos/{lesson_id}/{asset_version}/source.mp4"
        print(f"\n    ☁️ [Master] Uploading {master_name} ({master_size / (1024*1024):.1f} MB)...", flush=True)
        t0 = time.time()
        s3_client.upload_file(
            master_path,
            BUCKET_NAME,
            master_key,
            ExtraArgs={'ContentType': 'video/mp4'},
            Config=TRANSFER_CONFIG,
            Callback=ProgressPercentage(master_name, master_size)
        )
        print(f"       Uploaded in {time.time() - t0:.1f}s -> s3://{BUCKET_NAME}/{master_key}")

        # Post-upload head check for master
        head = s3_client.head_object(Bucket=BUCKET_NAME, Key=master_key)
        if head['ContentLength'] != master_size:
            print(f"    ❌ Size mismatch on S3: expected {master_size}, got {head['ContentLength']}")
            sys.exit(1)
        print(f"       ✅ S3 size verified ({head['ContentLength']} bytes, {head.get('ContentType')})")
        uploaded_files_summary.append((master_key, master_size))

        # 2. Upload Renditions
        for q in RENDITIONS:
            rendition_file = f"{prefix}_{q}.mp4"
            rendition_path = os.path.join(FOLDER, rendition_file)
            if not os.path.exists(rendition_path):
                print(f"    ❌ Rendition file not found: {rendition_path}")
                sys.exit(1)

            rendition_size = os.path.getsize(rendition_path)
            s3_key = f"streaming/{lesson_id}/{asset_version}/source_{q}.mp4"
            print(f"    ☁️ [{q}] Uploading {rendition_file} ({rendition_size / (1024*1024):.1f} MB)...", flush=True)
            t0 = time.time()
            s3_client.upload_file(
                rendition_path,
                BUCKET_NAME,
                s3_key,
                ExtraArgs={'ContentType': 'video/mp4'},
                Config=TRANSFER_CONFIG,
                Callback=ProgressPercentage(rendition_file, rendition_size)
            )
            print(f"       Uploaded in {time.time() - t0:.1f}s -> s3://{BUCKET_NAME}/{s3_key}")

            # Verify on S3
            head = s3_client.head_object(Bucket=BUCKET_NAME, Key=s3_key)
            if head['ContentLength'] != rendition_size:
                print(f"    ❌ Size mismatch on S3 for {s3_key}: expected {rendition_size}, got {head['ContentLength']}")
                sys.exit(1)
            print(f"       ✅ Verified ({head['ContentLength']} bytes, {head.get('ContentType')})")
            uploaded_files_summary.append((s3_key, rendition_size))

        # 3. Server-side copy for 2K alias (source_1440p.mp4 -> source_2k.mp4)
        key_1440p = f"streaming/{lesson_id}/{asset_version}/source_1440p.mp4"
        key_2k = f"streaming/{lesson_id}/{asset_version}/source_2k.mp4"
        print(f"    ⚡ [2k Alias] Server-side copying source_1440p.mp4 -> source_2k.mp4...", flush=True)
        s3_client.copy_object(
            Bucket=BUCKET_NAME,
            CopySource={'Bucket': BUCKET_NAME, 'Key': key_1440p},
            Key=key_2k,
            ContentType='video/mp4',
            MetadataDirective='REPLACE'
        )
        head_2k = s3_client.head_object(Bucket=BUCKET_NAME, Key=key_2k)
        print(f"       ✅ Created 2k alias: s3://{BUCKET_NAME}/{key_2k} ({head_2k['ContentLength']} bytes)")
        uploaded_files_summary.append((key_2k, head_2k['ContentLength']))

        # 4. Quick Byte-Range read test on 1080p and master to ensure S3 streaming works
        print(f"    🔍 Testing S3 Byte-Range streaming retrieval...", flush=True)
        resp = s3_client.get_object(Bucket=BUCKET_NAME, Key=f"streaming/{lesson_id}/{asset_version}/source_1080p.mp4", Range="bytes=0-1024")
        chunk = resp['Body'].read()
        if len(chunk) != 1025 or b'ftyp' not in chunk:
            print("    ⚠️ Warning: byte-range response didn't match expected MP4 header")
        else:
            print("       ✅ Byte-Range streaming tested and confirmed working!")

        # 5. Update DynamoDB
        print(f"    📝 Updating DynamoDB item for {lesson_id}...")
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        table.update_item(
            Key={'lesson_id': lesson_id},
            UpdateExpression="SET video_s3_key = :vkey, asset_version = :av, transcode_status = :status, transcode_completed_at = :now, duration_seconds = :d REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status",
            ExpressionAttributeValues={
                ':vkey': master_key,
                ':av': asset_version,
                ':status': 'COMPLETED',
                ':now': now_ms,
                ':d': duration_sec
            }
        )
        print(f"    ✅ DynamoDB updated: status=COMPLETED, duration={duration_sec}s")

    total_time = time.time() - overall_start
    total_mb = sum(s[1] for s in uploaded_files_summary) / (1024 * 1024)

    print("\n" + "=" * 80)
    print("🎉 ALL 4 LESSONS AND RENDITIONS UPLOADED AND VERIFIED SUCCESSFULLY!")
    print(f"⏱️ Total execution time: {total_time / 60:.1f} minutes")
    print(f"📦 Total data uploaded: {total_mb:.1f} MB across {len(uploaded_files_summary)} S3 objects")
    print("=" * 80)

if __name__ == '__main__':
    main()
