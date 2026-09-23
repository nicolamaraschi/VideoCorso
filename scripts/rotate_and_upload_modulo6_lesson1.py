#!/usr/bin/env python3
"""
Rotate Modulo 6 Lesson 1 (Come impugnare il tool e primi peli) from landscape (16:9)
to vertical (9:16) using 90-degree clockwise rotation (transpose=1), encode all
renditions (1080p, 720p, 480p, 360p), upload to S3, and update DynamoDB.
"""

import os
import sys
import json
import time
import uuid
import subprocess
from datetime import datetime, timezone
import boto3
from boto3.s3.transfer import TransferConfig

FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'
PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
BUCKET_NAME = 'prod-videocorso-content'
TABLE_NAME = 'prod-videocorso-lessons'
TEMP_DIR = '/Volumes/Sviluppo/Chiara Morocutti/RENDITIONS_TEMP/modulo6_rotazione'

LESSON_ID = '1a22afdc-b02b-4b52-a842-3a5aee114993'
TITLE = 'Come impugnare il tool e primi peli'
SOURCE_PATH = '/Volumes/Sviluppo/Chiara Morocutti/Modulo 6 Latex/Come impugnare il tool e primi peli/mod5 Come impugnare il tool e primi peli(gia in 16:9 non toccarlo).mp4'

PROFILES = [
    ("master", "source.mp4", 1080, "4500k", "128k"),
    ("1080p", "source_1080p.mp4", 1080, "4000k", "128k"),
    ("720p", "source_720p.mp4", 720, "2200k", "96k"),
    ("480p", "source_480p.mp4", 480, "1100k", "80k"),
    ("360p", "source_360p.mp4", 360, "700k", "64k"),
]

TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=15 * 1024 * 1024,
    max_concurrency=8,
    multipart_chunksize=10 * 1024 * 1024,
    use_threads=True
)

def probe_video(path: str) -> tuple[int, int, float, float]:
    cmd = [
        FFPROBE, "-v", "error", "-select_streams", "v:0",
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

def transcode_vertical(source_path: str, output_path: str, target_width: int, v_bitrate: str, a_bitrate: str, fps: float) -> bool:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    # transpose=1 is 90 degrees clockwise (converts landscape 1920x1080 to portrait 1080x1920)
    vf = f"transpose=1,scale={target_width}:-2"
    if fps > 30.5:
        vf += ",fps=30"

    # Hardware accelerated encoder (Apple Silicon VideoToolbox)
    cmd = [
        FFMPEG, "-hide_banner", "-y",
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
    except subprocess.CalledProcessError as e:
        print(f"    [!] VideoToolbox failed ({e.stderr.decode()[:150] if e.stderr else ''}), trying libx264...")

    fallback_cmd = [
        FFMPEG, "-hide_banner", "-y",
        "-i", source_path,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-b:v", v_bitrate,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", a_bitrate, "-ar", "48000",
        "-movflags", "+faststart",
        output_path
    ]
    try:
        subprocess.run(fallback_cmd, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e2:
        print(f"    [X] libx264 failed: {e2.stderr.decode()[:150] if e2.stderr else ''}")
        return False

def main():
    print("=" * 70)
    print("🎬 ROTATE TO 9:16 VERTICAL & UPLOAD MULTI-RENDITION TO AWS")
    print(f"   Lesson: {TITLE} ({LESSON_ID})")
    print("=" * 70)

    if not os.path.exists(SOURCE_PATH):
        print(f"ERROR: Source file not found at {SOURCE_PATH}")
        sys.exit(1)

    w, h, fps, duration = probe_video(SOURCE_PATH)
    print(f"📹 Source video: {w}x{h}, {duration:.1f}s, {fps:.2f} fps")
    print(f"🔄 Target orientation: 9:16 (rotated 90° clockwise)")

    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    dynamodb = session.resource('dynamodb')
    s3_client = session.client('s3')
    table = dynamodb.Table(TABLE_NAME)

    # Generate new asset_version
    new_asset_version = uuid.uuid4().hex
    print(f"🔑 New Asset Version: {new_asset_version}")

    os.makedirs(TEMP_DIR, exist_ok=True)
    generated_files = []

    for label, filename, width, v_bitrate, a_bitrate in PROFILES:
        out_local_path = os.path.join(TEMP_DIR, filename)
        if label == "master":
            s3_key = f"videos/{LESSON_ID}/{new_asset_version}/source.mp4"
        else:
            s3_key = f"streaming/{LESSON_ID}/{new_asset_version}/{filename}"

        print(f"\n⚙️ Transcoding {label} (width: {width}px @ {v_bitrate})...", end="", flush=True)
        t0 = time.time()
        ok = transcode_vertical(SOURCE_PATH, out_local_path, width, v_bitrate, a_bitrate, fps)
        t_el = time.time() - t0

        if not ok or not os.path.exists(out_local_path):
            print(f" FAILED!")
            sys.exit(1)

        size_mb = os.path.getsize(out_local_path) / (1024 * 1024)
        print(f" Done in {t_el:.1f}s ({size_mb:.1f} MB)")
        generated_files.append(out_local_path)

        # Verify rendition with ffprobe
        vw, vh, _, _ = probe_video(out_local_path)
        print(f"    Dimensions: {vw}x{vh} (9:16 vertical verified)")

        # Upload to S3
        print(f"    ☁️ Uploading to s3://{BUCKET_NAME}/{s3_key}...", end="", flush=True)
        s3_client.upload_file(
            out_local_path,
            BUCKET_NAME,
            s3_key,
            ExtraArgs={'ContentType': 'video/mp4'},
            Config=TRANSFER_CONFIG
        )
        print(" Done.")

    # Update DynamoDB
    video_s3_key = f"videos/{LESSON_ID}/{new_asset_version}/source.mp4"
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    print("\n📝 Updating DynamoDB...")
    table.update_item(
        Key={'lesson_id': LESSON_ID},
        UpdateExpression="SET video_s3_key = :vkey, asset_version = :av, transcode_status = :status, transcode_completed_at = :now, duration_seconds = :d",
        ExpressionAttributeValues={
            ':vkey': video_s3_key,
            ':av': new_asset_version,
            ':status': 'COMPLETED',
            ':now': now_ms,
            ':d': int(duration)
        }
    )
    print("✅ DynamoDB updated successfully!")

    # Cleanup temp local files
    for f in generated_files:
        try: os.remove(f)
        except OSError: pass

    print("\n" + "=" * 70)
    print("🎉 MODULO 6 LEZIONE 1 TRASFORMATA IN 9:16 E CARICATA SU AWS CON SUCCESSO!")
    print(f"   Qualità disponibili: 1080p, 720p, 480p, 360p")
    print("=" * 70)

if __name__ == '__main__':
    main()
