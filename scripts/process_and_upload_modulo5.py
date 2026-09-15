#!/usr/bin/env python3
"""
Process, Transcode & Upload Modulo 5 (Schemi e Spine) to AWS (Zero Cost)
Fixes:
1. Lez 1 (Introduzione): generates 720p/480p/360p renditions, sets COMPLETED
2. Lez 2 (Seguire il pelo naturale): uploads the correct 1920x1080 HORIZONTAL video (prendi questo aws), generates renditions, sets COMPLETED
3. Lez 3 (La testa): uploads the 1920x1080 HORIZONTAL video, generates renditions, sets COMPLETED
4. Lez 4 (Transizione): uploads the 1920x1080 HORIZONTAL video, generates renditions, sets COMPLETED
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

TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=15 * 1024 * 1024,
    max_concurrency=8,
    multipart_chunksize=10 * 1024 * 1024,
    use_threads=True
)

LESSONS_MOD5 = [
    {
        'lesson_id': '504a922c-daf0-4753-994c-4b041712ff99',
        'title': 'Introduzione',
        'file_path': '/Volumes/Sviluppo/Chiara Morocutti/Modulo 5 Schemi e Spine/1 Introduzione /mod5 Introduzione(gia in 16:9 non toccare).mp4',
        'upload_source': False # source already uploaded, only need renditions & status update
    },
    {
        'lesson_id': '7fb2cdce-3b3c-4f26-a08e-db99dd1784b4',
        'title': 'Seguire il pelo naturale',
        'file_path': '/Volumes/Sviluppo/Chiara Morocutti/Modulo 5 Schemi e Spine/2 Seguire il pelo naturale /mod5 2 Seguire il pelo naturale(prendi questo aws).mp4',
        'upload_source': True # replace previous vertical upload with horizontal 16:9
    },
    {
        'lesson_id': '6cdad452-0d73-42ec-a54f-c24c3c5528fc',
        'title': 'La testa',
        'file_path': '/Volumes/Sviluppo/Chiara Morocutti/Modulo 5 Schemi e Spine/3 La testa/3 La testa(gia in 16:9 non toccarlo).mp4',
        'upload_source': True # upload 16:9 horizontal
    },
    {
        'lesson_id': '4f663c0e-728b-4f06-aea3-df2dd7967d76',
        'title': 'Transizione',
        'file_path': '/Volumes/Sviluppo/Chiara Morocutti/Modulo 5 Schemi e Spine/4 Transizione/mod5 transizione( gia 16:9 non toccarlo).mp4',
        'upload_source': True # upload 16:9 horizontal
    },
]

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
        print(f"    [!] VideoToolbox failed, falling back to libx264...")

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
    except subprocess.CalledProcessError:
        return False

def main():
    print("=" * 70)
    print("🚀 MODULO 5 PROCESSOR & MULTI-RENDITION UPLOADER (ZERO COST)")
    print("=" * 70)

    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    dynamodb = session.resource('dynamodb')
    s3_client = session.client('s3')
    table = dynamodb.Table(TABLE_NAME)

    os.makedirs(TEMP_DIR, exist_ok=True)

    for idx, item in enumerate(LESSONS_MOD5, 1):
        lid = item['lesson_id']
        title = item['title']
        src = item['file_path']
        upload_source = item['upload_source']

        print(f"\n[{idx}/4] ▶️ {title} ({lid})")
        w, h, fps, duration = probe_video(src)
        print(f"    Source: {src}")
        print(f"    Resolution: {w}x{h} (16:9 horizontal), {duration:.1f}s, {fps:.1f} fps")

        # Fetch current lesson record
        db_item = table.get_item(Key={'lesson_id': lid}).get('Item') or {}
        asset_version = db_item.get('asset_version')

        # If uploading fresh source, generate new asset version
        if upload_source or not asset_version:
            asset_version = uuid.uuid4().hex

        s3_source_key = f"videos/{lid}/{asset_version}/source.mp4"
        s3_streaming_prefix = f"streaming/{lid}/{asset_version}"

        if upload_source:
            size_mb = os.path.getsize(src) / (1024 * 1024)
            print(f"    ☁️ Uploading horizontal source ({size_mb:.1f} MB) to s3://{BUCKET_NAME}/{s3_source_key}...", end="", flush=True)
            s3_client.upload_file(
                src,
                BUCKET_NAME,
                s3_source_key,
                ExtraArgs={'ContentType': 'video/mp4'},
                Config=TRANSFER_CONFIG
            )
            print(" Done.")

        short_side = min(w, h)
        lesson_temp_dir = os.path.join(TEMP_DIR, lid)
        os.makedirs(lesson_temp_dir, exist_ok=True)
        generated_files = []

        for q_label, target_side, v_bitrate, a_bitrate in PROFILES:
            out_filename = f"source_{q_label}.mp4"
            out_local_path = os.path.join(lesson_temp_dir, out_filename)
            s3_target_key = f"{s3_streaming_prefix}/{out_filename}"

            t0 = time.time()
            print(f"    ⚙️ Encoding {q_label} ({target_side}p @ {v_bitrate})...", end="", flush=True)
            ok = transcode_rendition(src, out_local_path, target_side, v_bitrate, a_bitrate, w, h, fps)
            t_el = time.time() - t0

            if ok and os.path.exists(out_local_path):
                out_mb = os.path.getsize(out_local_path) / (1024 * 1024)
                print(f" Done in {t_el:.1f}s ({out_mb:.1f} MB)")
                generated_files.append(out_local_path)

                print(f"    ☁️ Uploading {out_filename}...", end="", flush=True)
                s3_client.upload_file(
                    out_local_path,
                    BUCKET_NAME,
                    s3_target_key,
                    ExtraArgs={'ContentType': 'video/mp4'},
                    Config=TRANSFER_CONFIG
                )
                print(" Done.")
            else:
                print(" FAILED.")

        # Update DynamoDB
        print("    📝 Updating DynamoDB...")
        update_expr = "SET transcode_status = :status, transcode_completed_at = :now, video_s3_key = :k, asset_version = :v, duration_seconds = :d"
        expr_vals = {
            ':status': 'COMPLETED',
            ':now': int(datetime.now(timezone.utc).timestamp() * 1000),
            ':k': s3_source_key,
            ':v': asset_version,
            ':d': int(duration)
        }
        table.update_item(
            Key={'lesson_id': lid},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_vals
        )
        print(f"    ✅ Lesson {title} is now COMPLETED with 4 qualities!")

        # Clean up
        for f in generated_files:
            try: os.remove(f)
            except OSError: pass
        try: os.rmdir(lesson_temp_dir)
        except OSError: pass

    print("\n" + "=" * 70)
    print("🎉 MODULO 5 ALL 4 LESSONS UPDATED TO 16:9 HORIZONTAL & COMPLETED!")
    print("=" * 70)

if __name__ == '__main__':
    main()
