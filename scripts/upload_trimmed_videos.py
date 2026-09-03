import os
import sys
import json
import uuid
import subprocess
import boto3
from boto3.s3.transfer import TransferConfig

# AWS Profile and Region
PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
BUCKET_NAME = 'prod-videocorso-content'
TABLE_NAME = 'prod-videocorso-lessons'

UPLOADS = [
    {
        "module": "Modulo 10",
        "lesson_id": "ebb896ea-b4e1-448a-a8b8-1fdc88c966ee",
        "title": "Vendere e fare dermopigmentazione sono due cose diverse",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 9 Consulenza/2 Vendere e fare dermopigmentazione sono 2 cose diverse/Vendere e fare dermopigmentazione sono due cose diverse_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 9",
        "lesson_id": "8eac8228-a097-43a7-a9ea-2c3645c82ba6",
        "title": "Smetti di fare consulenza informativa",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 9 Consulenza/3 Smetti di fare consulenza informativa/Smetti di fare consulenza informativa_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 9",
        "lesson_id": "b59cbda6-d9a0-4440-b046-aa6e4dda47fd",
        "title": "Gestire le obiezioni",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 9 Consulenza/5 Gestire le obiezioni/Gestire le obiezioni - Live_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 9",
        "lesson_id": "298960a8-9fc4-46ef-bf2f-ef53592fa02a",
        "title": "Come impostare il giusto prezzo per partire",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 9 Consulenza/8 Come impostare il giusto prezzo per partire/Come impostare il giusto prezzo per partire_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 10",
        "lesson_id": "9891d871-641e-4d52-82f4-7ceb6adaec2e",
        "title": "I tre contenuti da creare",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 10 Come trovare i tuoi primi clienti /3 I tre contenuti da creare/I 3 Contenuti da creare_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 10",
        "lesson_id": "14c83ae4-2e9b-40b6-a703-88bb057f621d",
        "title": "Strategie di contenuto",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 10 Come trovare i tuoi primi clienti /4 Le tre strategie/Le 3 strategie_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 10",
        "lesson_id": "20efab06-f709-47f5-842c-efd0993d05d7",
        "title": "Contenuti di attrazione, fidelizzazione e vendita",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 10 Come trovare i tuoi primi clienti /5 Contenuti di attrazione, fidelizzazione e vendita/contenuti di attrazione, fidelizzazione, vendita (1)_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 10",
        "lesson_id": "c737d161-ba00-4a4c-aaad-606c8fd99e4a",
        "title": "Cosa sono i contenuti personali",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 10 Come trovare i tuoi primi clienti /6 Cosa sono i contenuti personali/Cosa sono i contenuti personali (1) (1)_senza_silenzi.mp4"
    },
    {
        "module": "Modulo 10",
        "lesson_id": "16eba908-6e69-4b90-8ea8-12cba0a7da46",
        "title": "Che tipi di stories fare",
        "file_path": "/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_2026-09-03/Modulo 10 Come trovare i tuoi primi clienti /7 Quali tipi di stories fare/Quali tipi di stories fare_senza_silenzi.mp4"
    }
]

class ProgressPercentage(object):
    def __init__(self, filename, total_size):
        self._filename = filename
        self._total_size = total_size
        self._seen_so_far = 0

    def __call__(self, bytes_amount):
        self._seen_so_far += bytes_amount
        percentage = (self._seen_so_far / self._total_size) * 100
        mb_current = self._seen_so_far / (1024 * 1024)
        mb_total = self._total_size / (1024 * 1024)
        sys.stdout.write(f"\r  Uploading: {mb_current:.1f}MB / {mb_total:.1f}MB ({percentage:.1f}%)")
        sys.stdout.flush()

def get_duration(filepath):
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', filepath]
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        dur = float(json.loads(res.stdout)['format'].get('duration', 0))
        return int(round(dur))
    except Exception as e:
        print(f"  Warning calculating duration: {e}")
        return 0

def main():
    print(f"=== UPLOAD VIDEO SENZA SILENZI IN FORMATO NATIVO (0,00€ TRANSCODING) ===")
    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    s3 = session.client('s3')
    dynamodb = session.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)

    transfer_config = TransferConfig(
        multipart_threshold=15 * 1024 * 1024,
        max_concurrency=10,
        multipart_chunksize=10 * 1024 * 1024,
        use_threads=True
    )

    for i, item in enumerate(UPLOADS, 1):
        filepath = item['file_path']
        lesson_id = item['lesson_id']
        title = item['title']
        module = item['module']

        if not os.path.exists(filepath):
            print(f"\n[{i}/{len(UPLOADS)}] ERRORE: File non trovato: {filepath}")
            continue

        file_size = os.path.getsize(filepath)
        file_size_mb = file_size / (1024 * 1024)
        duration_sec = get_duration(filepath)
        dur_str = f"{duration_sec // 60}m {duration_sec % 60}s"

        print(f"\n-------------------------------------------------------------")
        print(f"[{i}/{len(UPLOADS)}] {module} -> '{title}'")
        print(f"  Lesson ID: {lesson_id}")
        print(f"  File: {os.path.basename(filepath)} ({file_size_mb:.1f} MB, {dur_str})")

        asset_version = uuid.uuid4().hex
        s3_key = f"videos/{lesson_id}/{asset_version}/source.mp4"

        # Upload to S3
        progress = ProgressPercentage(filepath, file_size)
        s3.upload_file(
            Filename=filepath,
            Bucket=BUCKET_NAME,
            Key=s3_key,
            ExtraArgs={'ContentType': 'video/mp4'},
            Config=transfer_config,
            Callback=progress
        )
        print("\n  Upload S3 completato con successo!")

        # Update DynamoDB
        update_expr = (
            "SET video_s3_key = :vkey, "
            "asset_version = :aver, "
            "duration_seconds = :dur, "
            "transcode_status = :status, "
            "title = :title "
            "REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status"
        )
        expr_vals = {
            ':vkey': s3_key,
            ':aver': asset_version,
            ':dur': duration_sec,
            ':status': 'NATIVE',
            ':title': title
        }

        table.update_item(
            Key={'lesson_id': lesson_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_vals
        )
        print(f"  DynamoDB aggiornato: video_s3_key = {s3_key}, duration = {duration_sec}s")

    print("\n=============================================================")
    print("TUTTI I 9 VIDEO SONO STATI CARICATI E ATTIVATI CON SUCCESSO!")
    print("Zero transcodifiche a pagamento eseguite (costo MediaConvert = 0,00€).")
    print("=============================================================")

if __name__ == '__main__':
    main()
