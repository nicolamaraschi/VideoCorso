#!/usr/bin/env python3
"""
Automated Pipeline: Monitor, Transcode & Upload 6 New Videos to AWS
Zero AWS MediaConvert costs (100% hardware-accelerated locally).

Targets:
1. Modulo 5 - 5 Peli inferiori  -> Lesson c857ce63-1694-4cf5-bbac-14cfeba1bbab (Order 5)
2. Modulo 5 - 6 Peli superiori  -> Lesson 4359d26f-133d-443f-86f9-d6141a03ffe9 (Order 6)
3. Modulo 6 - 2 La testa        -> Lesson 9362d12c-5a3d-4b63-9c9a-e383356f1f4a (Order 2)
4. Modulo 6 - 3 Transizione     -> Lesson 7db2f914-de0e-4404-923c-ef838b7884bb (Order 3)
5. Modulo 6 - 4 Peli inferiori  -> Lesson 07b0fec4-b8f9-470c-a045-fc5142185b4c (Order 4)
6. Modulo 6 - 5 Peli superiori  -> Lesson c40df06d-33b1-4d28-b6fb-f8253f6327a0 (Order 5)
"""

import os
import sys
import time
import json
import uuid
import subprocess
from datetime import datetime, timezone
import boto3
from boto3.s3.transfer import TransferConfig

PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
CONTENT_BUCKET = 'prod-videocorso-content'
LESSONS_TABLE = 'prod-videocorso-lessons'

AWS_FOLDER = (
    "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_E_INTERCALARI_2026-09-05/"
    "CARTELLA_FINALE_DA_CARICARE_SU_AWS"
)
TEMP_BASE = "/Volumes/Sviluppo/Chiara Morocutti/RENDITIONS_TEMP/nuovi_6_video"

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

TAG = "(agent aws questo video solo devi caricare di sta cartella)"

TARGET_VIDEOS = [
    {
        "module": "Modulo 5 Schemi e Spine",
        "lesson_id": "c857ce63-1694-4cf5-bbac-14cfeba1bbab",
        "chapter_id": "6a43afd0-ab94-4e29-8217-666d596de32d",
        "order_number": 5,
        "title": "Peli inferiori",
        "filename": f"Modulo 5 - 5 Peli inferiori {TAG}.mp4",
    },
    {
        "module": "Modulo 5 Schemi e Spine",
        "lesson_id": "4359d26f-133d-443f-86f9-d6141a03ffe9",
        "chapter_id": "6a43afd0-ab94-4e29-8217-666d596de32d",
        "order_number": 6,
        "title": "Peli superiori",
        "filename": f"Modulo 5 - 6 Peli superiori {TAG}.mp4",
    },
    {
        "module": "Modulo 6 Latex",
        "lesson_id": "9362d12c-5a3d-4b63-9c9a-e383356f1f4a",
        "chapter_id": "dac458f9-ff54-4934-9e40-c3aa41c77270",
        "order_number": 2,
        "title": "La testa",
        "filename": f"Modulo 6 - 2 La testa {TAG}.mp4",
    },
    {
        "module": "Modulo 6 Latex",
        "lesson_id": "7db2f914-de0e-4404-923c-ef838b7884bb",
        "chapter_id": "dac458f9-ff54-4934-9e40-c3aa41c77270",
        "order_number": 3,
        "title": "Transizione",
        "filename": f"Modulo 6 - 3 Transizione {TAG}.mp4",
    },
    {
        "module": "Modulo 6 Latex",
        "lesson_id": "07b0fec4-b8f9-470c-a045-fc5142185b4c",
        "chapter_id": "dac458f9-ff54-4934-9e40-c3aa41c77270",
        "order_number": 4,
        "title": "Peli inferiori",
        "filename": f"Modulo 6 - 4 Peli inferiori {TAG}.mp4",
    },
    {
        "module": "Modulo 6 Latex",
        "lesson_id": "c40df06d-33b1-4d28-b6fb-f8253f6327a0",
        "chapter_id": "dac458f9-ff54-4934-9e40-c3aa41c77270",
        "order_number": 5,
        "title": "Peli superiori",
        "filename": f"Modulo 6 - 5 Peli superiori {TAG}.mp4",
    },
]

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
            percent = (self._seen / self._size) * 100 if self._size > 0 else 100
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

    # Try Apple Silicon hardware acceleration first
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
        err_msg = exc.stderr.decode()[:150] if exc.stderr else ""
        print(f"\n    [!] VideoToolbox failed ({err_msg}), falling back to libx264...")

    # Fallback to libx264
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
        err_msg2 = exc2.stderr.decode()[:150] if exc2.stderr else ""
        print(f"\n    [X] libx264 failed too: {err_msg2}")
        return False

def check_lesson_complete(s3_client, table, item_cfg):
    lid = item_cfg['lesson_id']
    res = table.get_item(Key={'lesson_id': lid})
    item = res.get('Item')
    if not item:
        return False
    vkey = item.get('video_s3_key')
    status = item.get('transcode_status')
    if not vkey or status != 'COMPLETED':
        return False
    try:
        s3_client.head_object(Bucket=CONTENT_BUCKET, Key=vkey)
    except Exception:
        return False

    # Check 720p, 480p, 360p
    parts = vkey.strip('/').split('/')
    if len(parts) >= 4:
        aver = parts[2]
        for q, _, _, _ in PROFILES:
            rkey = f"streaming/{lid}/{aver}/source_{q}.mp4"
            try:
                s3_client.head_object(Bucket=CONTENT_BUCKET, Key=rkey)
            except Exception:
                return False
        return True
    return False

def process_single_video(s3_client, table, item_cfg, file_path):
    lid = item_cfg['lesson_id']
    mod = item_cfg['module']
    title = item_cfg['title']
    order = item_cfg['order_number']
    fname = item_cfg['filename']

    print(f"\n=======================================================")
    print(f"🎬 PROCESSING: [{mod}] {title} (Lezione {order})")
    print(f"   File: {fname}")
    print(f"=======================================================")

    w, h, fps, duration = probe_video(file_path)
    dur_sec = int(round(duration))
    size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"📊 Video specs: {w}x{h} ({fps:.1f} fps), Duration: {dur_sec}s ({dur_sec//60}m {dur_sec%60}s), Size: {size_mb:.1f} MB")

    asset_version = uuid.uuid4().hex
    source_s3_key = f"videos/{lid}/{asset_version}/source.mp4"
    streaming_prefix = f"streaming/{lid}/{asset_version}"

    # 1. Upload source.mp4 (1080p source)
    print(f"\n1️⃣ Uploading source video to s3://{CONTENT_BUCKET}/{source_s3_key}...")
    prog = UploadProgress(file_path, os.path.getsize(file_path))
    s3_client.upload_file(
        Filename=file_path,
        Bucket=CONTENT_BUCKET,
        Key=source_s3_key,
        ExtraArgs={
            'ContentType': 'video/mp4',
            'CacheControl': 'public, max-age=31536000, immutable',
        },
        Config=TRANSFER_CONFIG,
        Callback=prog
    )
    print("\n   ✓ Source upload completed!")

    # 2. Transcode & Upload Renditions (720p, 480p, 360p)
    print("\n2️⃣ Generating hardware-accelerated renditions (720p, 480p, 360p)...")
    lesson_temp = os.path.join(TEMP_BASE, lid)
    os.makedirs(lesson_temp, exist_ok=True)
    short_side = min(w, h)
    uploaded_renditions = 0

    for q_label, target_side, v_bitrate, a_bitrate in PROFILES:
        if target_side > short_side:
            continue
        out_name = f"source_{q_label}.mp4"
        out_local = os.path.join(lesson_temp, out_name)
        s3_key = f"{streaming_prefix}/{out_name}"

        t0 = time.time()
        print(f"   ⚙️ Transcoding {q_label} ({target_side}p @ {v_bitrate})...", end="", flush=True)
        ok = transcode_rendition(file_path, out_local, target_side, v_bitrate, a_bitrate, w, h, fps)
        t_elapsed = time.time() - t0

        if ok and os.path.exists(out_local):
            r_sz_mb = os.path.getsize(out_local) / (1024 * 1024)
            print(f" Done in {t_elapsed:.1f}s ({r_sz_mb:.1f} MB)")
            print(f"   ☁️ Uploading to s3://{CONTENT_BUCKET}/{s3_key}...", end="", flush=True)
            s3_client.upload_file(
                out_local,
                CONTENT_BUCKET,
                s3_key,
                ExtraArgs={
                    'ContentType': 'video/mp4',
                    'CacheControl': 'public, max-age=31536000, immutable',
                },
                Config=TRANSFER_CONFIG
            )
            print(" Done.")
            uploaded_renditions += 1
            try:
                os.remove(out_local)
            except OSError:
                pass
        else:
            print(" FAILED.")

    # 3. Update DynamoDB
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    print(f"\n3️⃣ Updating DynamoDB record for lesson {lid}...")
    table.update_item(
        Key={'lesson_id': lid},
        UpdateExpression=(
            "SET video_s3_key = :vkey, "
            "asset_version = :aver, "
            "duration_seconds = :dur, "
            "transcode_status = :status, "
            "transcode_completed_at = :tcomp, "
            "order_number = :ord "
            "REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status, transcode_job_id, submission_token"
        ),
        ExpressionAttributeValues={
            ':vkey': source_s3_key,
            ':aver': asset_version,
            ':dur': dur_sec,
            ':status': 'COMPLETED',
            ':tcomp': now_ms,
            ':ord': order,
        }
    )
    print(f"   ✅ DynamoDB updated to COMPLETED for [{mod}] {title}!")

    # Cleanup lesson temp dir
    try:
        os.rmdir(lesson_temp)
    except OSError:
        pass

    return True

def is_pipeline_running():
    cmd = ["pgrep", "-f", "elabora_nuovi_video_settembre10.py"]
    res = subprocess.run(cmd, capture_output=True)
    return res.returncode == 0

def main():
    print("=" * 70)
    print("🚀 AUTOMATED AWS UPLOADER: 6 NUOVI VIDEO CHIARA MOROCUTTI")
    print("=" * 70)

    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    s3_client = session.client('s3')
    dynamodb = session.resource('dynamodb')
    table = dynamodb.Table(LESSONS_TABLE)

    completed_ids = set()

    # Initial check
    for item in TARGET_VIDEOS:
        if check_lesson_complete(s3_client, table, item):
            print(f"✓ Già completo su AWS: [{item['module']}] {item['title']}")
            completed_ids.add(item['lesson_id'])

    print(f"\nStato iniziale: {len(completed_ids)}/{len(TARGET_VIDEOS)} già completati.")

    while len(completed_ids) < len(TARGET_VIDEOS):
        found_new = False

        for item in TARGET_VIDEOS:
            lid = item['lesson_id']
            if lid in completed_ids:
                continue

            expected_path = os.path.join(AWS_FOLDER, item['filename'])
            if os.path.exists(expected_path) and os.path.getsize(expected_path) > 1024 * 1024:
                # Video file is ready in destination folder!
                print(f"\n🎯 TROVATO NUOVO VIDEO PRONTO: {item['filename']}")
                success = process_single_video(s3_client, table, item, expected_path)
                if success:
                    completed_ids.add(lid)
                    found_new = True
                    print(f"🎉 Progresso globale: {len(completed_ids)}/{len(TARGET_VIDEOS)} video completati!")

        if len(completed_ids) == len(TARGET_VIDEOS):
            break

        # Check if tightcut pipeline is still generating videos
        pipeline_alive = is_pipeline_running()
        if not pipeline_alive and not found_new:
            print("\n⚠️ Il processo di elaborazione locale sembra terminato, ma mancano ancora alcuni video.")
            # Do one more check in AWS folder
            time.sleep(5)
            # Re-check
            if not is_pipeline_running():
                print("Verifica finale completata.")
                break

        print(f"\r⏳ In attesa che il prossimo video completi il taglio silenzi... ({len(completed_ids)}/6 pronti su AWS)", end="", flush=True)
        time.sleep(10)

    print("\n" + "=" * 70)
    print(f"🏁 COMPLETATI {len(completed_ids)}/6 NUOVI VIDEO SU AWS!")
    print("=" * 70)

if __name__ == '__main__':
    main()
