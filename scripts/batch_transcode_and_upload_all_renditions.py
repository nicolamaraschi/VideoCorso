#!/usr/bin/env python3
"""
Batch Video Transcoder & S3 Uploader (100% Free - Apple Silicon Hardware Accelerated)
Generates 1080p, 720p, 480p, and 360p renditions locally on the Mac using
h264_videotoolbox (with libx264 fallback) and uploads them to S3 under streaming/.
Updates DynamoDB transcode_status to 'COMPLETED'.
Zero AWS MediaConvert costs.
"""

import os
import sys
import json
import time
import subprocess
from datetime import datetime, timezone
import boto3
from boto3.s3.transfer import TransferConfig

# Configuration
PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
BUCKET_NAME = 'prod-videocorso-content'
TABLE_NAME = 'prod-videocorso-lessons'
TEMP_DIR = '/Volumes/Sviluppo/Chiara Morocutti/RENDITIONS_TEMP'

PROFILES = [
    ("720p", 720, "2500k", "96k"),
    ("480p", 480, "1200k", "96k"),
    ("360p", 360, "750k", "64k"),
]

# Transfer config for fast S3 multipart uploads
TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=15 * 1024 * 1024,
    max_concurrency=8,
    multipart_chunksize=10 * 1024 * 1024,
    use_threads=True
)

def probe_video(path: str) -> tuple[int, int, float, float]:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate:format=duration",
        "-of", "json", path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(res.stdout)
    stream = data["streams"][0]
    w = int(stream["width"])
    h = int(stream["height"])
    fps_parts = stream.get("r_frame_rate", "30/1").split("/")
    fps = float(fps_parts[0]) / float(fps_parts[1] or 1)
    duration = float(data.get("format", {}).get("duration", 0))
    return w, h, fps, duration

def transcode_rendition(source_path: str, output_path: str, target_short_side: int, v_bitrate: str, a_bitrate: str, w: int, h: int, fps: float) -> bool:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    is_portrait = h > w
    vf = f"scale={target_short_side}:-2" if is_portrait else f"scale=-2:{target_short_side}"
    if fps > 30.5:
        vf += ",fps=30"

    # 1. Try Apple Silicon hardware encoder (VideoToolbox)
    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", source_path,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", vf,
        "-c:v", "h264_videotoolbox", "-b:v", v_bitrate,
        "-c:a", "aac", "-b:a", a_bitrate, "-ar", "48000",
        "-movflags", "+faststart",
        output_path
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as exc:
        print(f"    [!] VideoToolbox failed ({exc.stderr.decode()[:150] if exc.stderr else ''}), falling back to libx264...")

    # 2. Fallback to libx264 fast
    fallback_cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", source_path,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-b:v", v_bitrate,
        "-c:a", "aac", "-b:a", a_bitrate, "-ar", "48000",
        "-movflags", "+faststart",
        output_path
    ]
    try:
        subprocess.run(fallback_cmd, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as exc2:
        print(f"    [X] libx264 failed too: {exc2.stderr.decode()[:150] if exc2.stderr else ''}")
        return False

def main():
    print("=" * 70)
    print("🚀 BATCH VIDEO TRANSCODER & S3 UPLOADER (ZERO AWS COST)")
    print("=" * 70)

    # Initialize AWS Session
    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    dynamodb = session.resource('dynamodb')
    s3_client = session.client('s3')
    table = dynamodb.Table(TABLE_NAME)

    # Load source mappings from upload scripts
    sys.path.append(os.path.join(os.path.dirname(__file__)))
    from upload_19_final_videos import UPLOADS as U19
    from upload_trimmed_videos import UPLOADS as U8

    source_map = {}
    for u in U19:
        source_map[u['lesson_id']] = u['file_path']
    for u in U8:
        source_map[u['lesson_id']] = u['file_path']

    # Scan DynamoDB for NATIVE lessons
    response = table.scan()
    items = list(response.get('Items', []))
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))

    native_lessons = [it for it in items if it.get('transcode_status') == 'NATIVE' and it.get('video_s3_key')]
    print(f"Found {len(native_lessons)} NATIVE lessons requiring renditions.\n")

    os.makedirs(TEMP_DIR, exist_ok=True)
    total_start = time.time()
    processed_count = 0

    for idx, lesson in enumerate(native_lessons, 1):
        lesson_id = lesson['lesson_id']
        title = lesson.get('title', 'Untitled')
        video_s3_key = lesson['video_s3_key'] # e.g. videos/<lesson_id>/<asset_version>/source.mp4
        parts = video_s3_key.strip('/').split('/')
        if len(parts) < 4:
            print(f"[{idx}/{len(native_lessons)}] SKIPPING {lesson_id}: invalid s3 key format {video_s3_key}")
            continue

        asset_version = parts[2]
        s3_streaming_prefix = f"streaming/{lesson_id}/{asset_version}"

        source_file = source_map.get(lesson_id)
        if not source_file or not os.path.exists(source_file):
            print(f"[{idx}/{len(native_lessons)}] SKIPPING {lesson_id} ({title}): local source not found at {source_file}")
            continue

        file_size_mb = os.path.getsize(source_file) / (1024 * 1024)
        print(f"[{idx}/{len(native_lessons)}] ▶️ PROCESSING: {title} ({file_size_mb:.1f} MB)")
        print(f"    Source: {source_file}")

        try:
            w, h, fps, duration = probe_video(source_file)
            print(f"    Metadata: {w}x{h} @ {fps:.1f} fps, {duration:.1f}s")
        except Exception as e:
            print(f"    [X] ffprobe error: {e}")
            continue

        short_side = min(w, h)
        lesson_temp_dir = os.path.join(TEMP_DIR, lesson_id)
        os.makedirs(lesson_temp_dir, exist_ok=True)

        generated_files = []
        renditions_uploaded = 0

        for quality_label, target_side, v_bitrate, a_bitrate in PROFILES:
            if target_side > short_side:
                continue

            out_filename = f"source_{quality_label}.mp4"
            out_local_path = os.path.join(lesson_temp_dir, out_filename)
            s3_target_key = f"{s3_streaming_prefix}/{out_filename}"

            # Check if already in S3
            try:
                s3_client.head_object(Bucket=BUCKET_NAME, Key=s3_target_key)
                print(f"    ✓ {quality_label} already exists in S3, skipping transcode")
                renditions_uploaded += 1
                continue
            except s3_client.exceptions.ClientError:
                pass # Doesn't exist, transcode

            t0 = time.time()
            print(f"    ⚙️ Encoding {quality_label} ({target_side}p @ {v_bitrate})...", end="", flush=True)
            success = transcode_rendition(source_file, out_local_path, target_side, v_bitrate, a_bitrate, w, h, fps)
            t_elapsed = time.time() - t0

            if success and os.path.exists(out_local_path):
                out_size_mb = os.path.getsize(out_local_path) / (1024 * 1024)
                print(f" Done in {t_elapsed:.1f}s ({out_size_mb:.1f} MB)")
                generated_files.append(out_local_path)

                # Upload to S3
                print(f"    ☁️ Uploading {out_filename} to s3://{BUCKET_NAME}/{s3_target_key}...", end="", flush=True)
                s3_client.upload_file(
                    out_local_path,
                    BUCKET_NAME,
                    s3_target_key,
                    ExtraArgs={'ContentType': 'video/mp4'},
                    Config=TRANSFER_CONFIG
                )
                print(" Done.")
                renditions_uploaded += 1
            else:
                print(f" FAILED.")

        # If at least 2 renditions exist, update DynamoDB
        if renditions_uploaded >= 2:
            print(f"    📝 Updating DynamoDB transcode_status = 'COMPLETED'...")
            table.update_item(
                Key={'lesson_id': lesson_id},
                UpdateExpression="SET transcode_status = :status, transcode_completed_at = :now",
                ExpressionAttributeValues={
                    ':status': 'COMPLETED',
                    ':now': int(datetime.now(timezone.utc).timestamp() * 1000)
                }
            )
            processed_count += 1
            print(f"    ✅ Lesson {lesson_id} completed successfully!")
        else:
            print(f"    ⚠️ Not enough renditions uploaded ({renditions_uploaded}), keeping NATIVE status.")

        # Clean up local temporary files for this lesson
        for f in generated_files:
            try:
                os.remove(f)
            except OSError:
                pass
        try:
            os.rmdir(lesson_temp_dir)
        except OSError:
            pass

        print()

    total_time = time.time() - total_start
    print("=" * 70)
    print(f"🎉 BATCH COMPLETE: {processed_count}/{len(native_lessons)} lessons transcoded and uploaded!")
    print(f"⏱️ Total duration: {total_time / 60:.1f} minutes")
    print(f"💰 AWS MediaConvert cost: 0.00€")
    print("=" * 70)

if __name__ == '__main__':
    main()
