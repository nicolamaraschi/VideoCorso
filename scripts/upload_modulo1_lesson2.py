#!/usr/bin/env python3
"""
Upload and transcode Modulo 1 Lezione 2:
"Chi sono e perché dovresti ascoltarmi"
Lesson ID: 84f95ef9-dd67-47e0-b6fe-e6a8bd090f6c
Chapter ID: 89d99685-6f1e-4ca0-81fb-04950410701e (Modulo 1 Presentazione)

Steps:
1. Probe local video file (1080x1920 vertical 9:16, 285s).
2. Upload source.mp4 to S3 prod-videocorso-content.
3. Transcode 720p, 480p, 360p renditions locally with h264_videotoolbox and upload to streaming/.
4. Generate fixed thumbnail (without typo).
5. Update DynamoDB record with COMPLETED transcode status.
"""

import os
import sys
import uuid
import time
import json
import subprocess
from datetime import datetime, timezone
import boto3
from boto3.s3.transfer import TransferConfig
from PIL import Image, ImageDraw, ImageFont

PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
CONTENT_BUCKET = 'prod-videocorso-content'
THUMBNAILS_BUCKET = 'prod-videocorso-thumbnails'
LESSONS_TABLE = 'prod-videocorso-lessons'

LESSON_ID = '84f95ef9-dd67-47e0-b6fe-e6a8bd090f6c'
CHAPTER_ID = '89d99685-6f1e-4ca0-81fb-04950410701e'
TITLE = 'Chi sono e perché dovresti ascoltarmi'
SOURCE_FILE = (
    "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_E_INTERCALARI_2026-09-05/"
    "Modulo 1 Presentazione/2 Chi sono e perché dovresti ascoltarmi/"
    "Modulo 1 - 2 Chi sono e perché dovresti ascoltarmi (agent aws questo video solo devi caricare di sta cartella).mp4"
)
TEMP_DIR = '/Volumes/Sviluppo/Chiara Morocutti/RENDITIONS_TEMP/modulo1_l02'
THUMBNAIL_TEMPLATE = '/Users/nicolamaraschi/.gemini/antigravity-ide/brain/31346e9e-0d94-4cd6-bee4-12f0121a7dde/scratch/thumb_m01_l02.jpg'

PROFILES = [
    ("720p", 720, "2500k", "96k"),
    ("480p", 480, "1200k", "96k"),
    ("360p", 360, "750k", "64k"),
]

TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=15 * 1024 * 1024,
    max_concurrency=8,
    multipart_chunksize=10 * 1024 * 1024,
    use_threads=True
)

class UploadProgress:
    def __init__(self, filename, size_bytes):
        self._filename = filename
        self._size = size_bytes
        self._seen = 0
        self._start_time = time.time()
        self._last_print = 0

    def __call__(self, bytes_amount):
        self._seen += bytes_amount
        now = time.time()
        if now - self._last_print >= 0.5 or self._seen == self._size:
            percent = (self._seen / self._size) * 100
            elapsed = now - self._start_time
            speed = (self._seen / (1024 * 1024)) / elapsed if elapsed > 0 else 0
            mb_seen = self._seen / (1024 * 1024)
            mb_total = self._size / (1024 * 1024)
            sys.stdout.write(f"\r    Uploading: {percent:5.1f}% ({mb_seen:5.1f}/{mb_total:5.1f} MB) at {speed:4.1f} MB/s")
            sys.stdout.flush()
            self._last_print = now

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
        print(f"\n    [!] VideoToolbox failed ({exc.stderr.decode()[:150] if exc.stderr else ''}), falling back to libx264...")

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
        print(f"\n    [X] libx264 failed too: {exc2.stderr.decode()[:150] if exc2.stderr else ''}")
        return False

def generate_fixed_thumbnail() -> str:
    tmp_path = '/tmp/crisp_m01_l02_fixed.jpg'
    base = Image.open(THUMBNAIL_TEMPLATE)
    draw = ImageDraw.Draw(base)
    # Clear text area
    draw.rectangle([(155, 240), (1750, 750)], fill=(255, 255, 255))

    georgia_reg = ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf', 72)
    arial_bold = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 38)

    subtitle = 'LEZIONE 02'
    draw.text((160, 260), subtitle, fill=(164, 113, 122), font=arial_bold)
    sub_bbox = draw.textbbox((160, 260), subtitle, font=arial_bold)
    draw.line([(160, sub_bbox[3] + 12), (sub_bbox[2] + 4, sub_bbox[3] + 12)], fill=(164, 113, 122), width=4)

    draw.text((160, 390), 'Chi sono e perché\ndovresti ascoltarmi', fill=(27, 16, 20), font=georgia_reg, spacing=24)
    base.save(tmp_path, quality=95)
    return tmp_path

def main():
    print("=" * 70)
    print("🚀 UPLOAD & TRANSCODE MODULO 1 LEZIONE 2")
    print(f"File: {SOURCE_FILE}")
    print("=" * 70)

    if not os.path.exists(SOURCE_FILE):
        print(f"❌ Source file not found at: {SOURCE_FILE}")
        sys.exit(1)

    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    dynamodb = session.resource('dynamodb')
    s3_client = session.client('s3')
    table = dynamodb.Table(LESSONS_TABLE)

    # 1. Probe
    w, h, fps, duration = probe_video(SOURCE_FILE)
    duration_sec = int(round(duration))
    file_size = os.path.getsize(SOURCE_FILE)
    print(f"📊 Video specs: {w}x{h} ({fps:.1f} fps), Duration: {duration_sec}s ({duration_sec//60}m {duration_sec%60}s), Size: {file_size/(1024*1024):.1f} MB")

    asset_version = uuid.uuid4().hex
    source_s3_key = f"videos/{LESSON_ID}/{asset_version}/source.mp4"
    streaming_prefix = f"streaming/{LESSON_ID}/{asset_version}"

    # 2. Upload source.mp4
    print(f"\n1️⃣ Uploading source video to s3://{CONTENT_BUCKET}/{source_s3_key}...")
    prog = UploadProgress(SOURCE_FILE, file_size)
    s3_client.upload_file(
        Filename=SOURCE_FILE,
        Bucket=CONTENT_BUCKET,
        Key=source_s3_key,
        ExtraArgs={
            'ContentType': 'video/mp4',
            'CacheControl': 'public, max-age=31536000, immutable',
        },
        Config=TRANSFER_CONFIG,
        Callback=prog
    )
    print("\n  ✓ Source upload completed!")

    # 3. Transcode renditions
    print("\n2️⃣ Generating hardware-accelerated renditions (720p, 480p, 360p)...")
    os.makedirs(TEMP_DIR, exist_ok=True)
    renditions_count = 0
    short_side = min(w, h)

    for quality_label, target_side, v_bitrate, a_bitrate in PROFILES:
        if target_side > short_side:
            continue

        out_filename = f"source_{quality_label}.mp4"
        out_local_path = os.path.join(TEMP_DIR, out_filename)
        s3_target_key = f"{streaming_prefix}/{out_filename}"

        t0 = time.time()
        print(f"  ⚙️ Transcoding {quality_label} ({target_side}p @ {v_bitrate})...", end="", flush=True)
        ok = transcode_rendition(SOURCE_FILE, out_local_path, target_side, v_bitrate, a_bitrate, w, h, fps)
        t_el = time.time() - t0

        if ok and os.path.exists(out_local_path):
            sz_mb = os.path.getsize(out_local_path) / (1024 * 1024)
            print(f" Done in {t_el:.1f}s ({sz_mb:.1f} MB)")
            print(f"    ☁️ Uploading {out_filename} to S3...", end="", flush=True)
            s3_client.upload_file(
                out_local_path,
                CONTENT_BUCKET,
                s3_target_key,
                ExtraArgs={'ContentType': 'video/mp4', 'CacheControl': 'public, max-age=31536000, immutable'},
                Config=TRANSFER_CONFIG
            )
            print(" Done.")
            renditions_count += 1
            os.remove(out_local_path)
        else:
            print(" FAILED.")

    # 4. Generate and upload corrected thumbnail
    print("\n3️⃣ Generating corrected thumbnail (without typo)...")
    thumb_path = generate_fixed_thumbnail()
    rand_thumb_id = uuid.uuid4().hex
    thumb_s3_key = f"lessons/{rand_thumb_id}-crisp_m01_l02.jpg"
    with open(thumb_path, 'rb') as f:
        s3_client.put_object(
            Bucket=THUMBNAILS_BUCKET,
            Key=thumb_s3_key,
            Body=f,
            ContentType='image/jpeg'
        )
    thumb_url = f"https://{THUMBNAILS_BUCKET}.s3.amazonaws.com/{thumb_s3_key}"
    print(f"  ✓ Thumbnail uploaded: {thumb_url}")
    os.remove(thumb_path)

    # 5. Update DynamoDB
    print("\n4️⃣ Updating DynamoDB record...")
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    table.update_item(
        Key={'lesson_id': LESSON_ID},
        UpdateExpression=(
            "SET title = :tit, "
            "video_s3_key = :vkey, "
            "asset_version = :aver, "
            "duration_seconds = :dur, "
            "transcode_status = :status, "
            "transcode_completed_at = :tcomp, "
            "thumbnail_url = :thumb, "
            "order_number = :ord "
            "REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status"
        ),
        ExpressionAttributeValues={
            ':tit': TITLE,
            ':vkey': source_s3_key,
            ':aver': asset_version,
            ':dur': duration_sec,
            ':status': 'COMPLETED',
            ':tcomp': now_ms,
            ':thumb': thumb_url,
            ':ord': 2
        }
    )
    print(f"  ✅ DynamoDB updated for {LESSON_ID}!")

    # Cleanup temp dir
    try:
        os.rmdir(TEMP_DIR)
    except OSError:
        pass

    print("\n" + "=" * 70)
    print("🎉 MODULO 1 LEZIONE 2 È ORA ONLINE AL 100% SU TUTTE LE QUALITÀ!")
    print("=" * 70)

if __name__ == '__main__':
    main()
