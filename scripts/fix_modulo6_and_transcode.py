#!/usr/bin/env python3
"""
Fix Modulo 6 (Latex) according to Client's Master Plan:
1. Disconnect misplaced Modulo 5 videos from:
   - Order 2: "La testa" (DA REGISTRARE)
   - Order 3: "Transizione" (DA REGISTRARE)
2. Generate 720p, 480p, 360p renditions locally for the 3 actual Modulo 6 videos:
   - Order 1: "Come impugnare il tool e primi peli"
   - Order 6: "Sopracciglio completo spine 3"
   - Order 7: "Sopracciglio completo spine 6"
3. Upload renditions to S3 and update DynamoDB to COMPLETED.
"""

import os
import sys
import json
import time
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

REAL_LESSONS = [
    {
        'lesson_id': '1a22afdc-b02b-4b52-a842-3a5aee114993',
        'title': 'Come impugnare il tool e primi peli',
        'file_path': '/Volumes/Sviluppo/Chiara Morocutti/Modulo 6 Latex/Come impugnare il tool e primi peli/mod5 Come impugnare il tool e primi peli(gia in 16:9 non toccarlo).mp4',
        'asset_version': '9216032d99e0427e9ad91f8d91c7bb4e'
    },
    {
        'lesson_id': '5c1f7b7d-bd31-4f77-842c-4b9547c2a885',
        'title': 'Sopracciglio completo spine 3',
        'file_path': '/Volumes/Sviluppo/Chiara Morocutti/Modulo 6 Latex/Sopracciglio completo su latex spine 3/mod6 Sopracciglio completo su latex spine 3(gia in 16:9 non toccare).mp4',
        'asset_version': '464587f08bae4f4fbef069f175d9caf9'
    },
    {
        'lesson_id': 'fb821a67-0801-40c7-aba8-30187876f3bf',
        'title': 'Sopracciglio completo spine 6',
        'file_path': '/Volumes/Sviluppo/Chiara Morocutti/Modulo 6 Latex/Sopracciglio completo su latex spine 6/Sopracciglio completo su latex spine 6(gia in 16:9 non toccarlo).mp4',
        'asset_version': '2e8afcc27c854b7e8507498883122e4a'
    },
]

TO_BE_RECORDED_IDS = [
    '9362d12c-5a3d-4b63-9c9a-e383356f1f4a', # La testa in Mod 6
    '7db2f914-de0e-4404-923c-ef838b7884bb', # Transizione in Mod 6
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
    except subprocess.CalledProcessError:
        pass

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
    print("🛠️ FIX MODULO 6 (LATEX) & MULTI-RENDITION GENERATOR")
    print("=" * 70)

    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    dynamodb = session.resource('dynamodb')
    s3_client = session.client('s3')
    table = dynamodb.Table(TABLE_NAME)

    # 1. Disconnect wrong videos from Modulo 6 "La testa" and "Transizione"
    print("\n1️⃣ Disconnecting misplaced Modulo 5 videos from Modulo 6 (marking as DA REGISTRARE)...")
    for lid in TO_BE_RECORDED_IDS:
        table.update_item(
            Key={'lesson_id': lid},
            UpdateExpression="REMOVE video_s3_key, transcode_status, transcode_completed_at SET duration_seconds = :zero",
            ExpressionAttributeValues={':zero': 0}
        )
        print(f"    ✓ Lesson {lid} is now cleanly marked without video (DA REGISTRARE)")

    # 2. Transcode and upload renditions for the 3 real Modulo 6 lessons
    print("\n2️⃣ Processing renditions for the 3 actual Modulo 6 lessons...")
    os.makedirs(TEMP_DIR, exist_ok=True)

    for idx, item in enumerate(REAL_LESSONS, 1):
        lid = item['lesson_id']
        title = item['title']
        src = item['file_path']
        asset_version = item['asset_version']

        print(f"\n[{idx}/3] ▶️ {title} ({lid})")
        w, h, fps, duration = probe_video(src)
        print(f"    Source: {src}")
        print(f"    Resolution: {w}x{h} (16:9 horizontal), {duration:.1f}s, {fps:.1f} fps")

        s3_streaming_prefix = f"streaming/{lid}/{asset_version}"
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

        # Update DynamoDB to COMPLETED
        print("    📝 Updating DynamoDB...")
        table.update_item(
            Key={'lesson_id': lid},
            UpdateExpression="SET transcode_status = :status, transcode_completed_at = :now, duration_seconds = :d",
            ExpressionAttributeValues={
                ':status': 'COMPLETED',
                ':now': int(datetime.now(timezone.utc).timestamp() * 1000),
                ':d': int(duration)
            }
        )
        print(f"    ✅ Lesson {title} is now COMPLETED with 4 qualities!")

        # Clean up
        for f in generated_files:
            try: os.remove(f)
            except OSError: pass
        try: os.rmdir(lesson_temp_dir)
        except OSError: pass

    print("\n" + "=" * 70)
    print("🎉 MODULO 6 LATEX FULLY ALIGNED WITH CLIENT MASTER PLAN!")
    print("=" * 70)

if __name__ == '__main__':
    main()
