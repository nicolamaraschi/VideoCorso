import os
import sys
import json
import uuid
import subprocess
import boto3
from datetime import datetime, timezone
from boto3.s3.transfer import TransferConfig

# AWS Profile and Region
PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
BUCKET_NAME = 'prod-videocorso-content'
TABLE_NAME = 'prod-videocorso-lessons'

BASE_FOLDER = '/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_E_INTERCALARI_2026-09-05/CARTELLA_FINALE_DA_CARICARE_SU_AWS'

# 19 Videos mapping
UPLOADS = [
    # --- MODULO 1 ---
    {
        "module": "Modulo 1",
        "lesson_id": "bd20c4e6-7622-4729-9152-873010337e0c",
        "chapter_id": "89d99685-6f1e-4ca0-81fb-04950410701e",
        "order_number": 1,
        "title": "Presentazione",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 1 - 1 Presentazione (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 1",
        "lesson_id": "74328195-c4be-4790-a366-c7cc9f5fd6a1",
        "chapter_id": "89d99685-6f1e-4ca0-81fb-04950410701e",
        "order_number": 3,
        "title": "Mentalità",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 1 - 3 Mentalità (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },

    # --- MODULO 3 ---
    {
        "module": "Modulo 3",
        "lesson_id": "5eac6ae3-58d4-4a7d-a8e6-31b79f9be0a6",
        "chapter_id": "e2941c9c-29e5-413d-a84d-0d1a968084a3",
        "order_number": 1,
        "title": "L'importanza delle sopracciglia",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 3 - 1 Limportanza delle sopracciglia (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 3",
        "lesson_id": "627c46a9-23d6-486b-a881-f018f9f878dd",
        "chapter_id": "e2941c9c-29e5-413d-a84d-0d1a968084a3",
        "order_number": 2,
        "title": "Sistemare senza stravolgere",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 3 - 2 Sistemare senza stravolgere (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 3",
        "lesson_id": "011bab5c-0f23-405b-bfb5-7bdf791c4266",
        "chapter_id": "e2941c9c-29e5-413d-a84d-0d1a968084a3",
        "order_number": 3,
        "title": "Rapporto aureo e morfologia del viso",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 3 - 3 Rapporto aureo (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 3",
        "lesson_id": "77a03776-e310-4011-ae26-abb0a7c66153",
        "chapter_id": "e2941c9c-29e5-413d-a84d-0d1a968084a3",
        "order_number": 4,
        "title": "Gestione delle asimmetrie",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 3 - 4 Gestione delle asimmetrie (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 3",
        "lesson_id": "d614bd1c-667c-4304-9318-3d7a7c3359e6",
        "chapter_id": "e2941c9c-29e5-413d-a84d-0d1a968084a3",
        "order_number": 5,
        "title": "Forma su carta con righello",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 3 - Forma su carta con righello (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 3",
        "lesson_id": "63ca429e-c05f-46f2-b02e-f110607fafab",
        "chapter_id": "e2941c9c-29e5-413d-a84d-0d1a968084a3",
        "order_number": 6,
        "title": "Forma su carta con righello (più realistica)",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 3 - Forma su carta con righello (piu realistica) (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 3",
        "lesson_id": "206ac413-6088-4c3d-b758-fd0ceb9e04f4",
        "chapter_id": "e2941c9c-29e5-413d-a84d-0d1a968084a3",
        "order_number": 7,
        "title": "Forma su carta con compasso Phi",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 3 - Forma su carta con compasso Phi (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },

    # --- MODULO 8 ---
    {
        "module": "Modulo 8",
        "lesson_id": "3de9e269-7d9c-41e2-b389-b010c81ab605",
        "chapter_id": "bde1301e-1dab-406b-a9ab-b4a320114356",
        "order_number": 1,
        "title": "Codice Ateco, quale scegliere?",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 8 - 1 Codice Ateco quale scegliere (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 8",
        "lesson_id": "ac0860cf-40d4-43b1-84da-6dcd6fe3825f",
        "chapter_id": "bde1301e-1dab-406b-a9ab-b4a320114356",
        "order_number": 2,
        "title": "Affitto cabina o percentuale",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 8 - 2 Affitto cabina o percentuale (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 8",
        "lesson_id": "4755fb24-fb99-423e-a248-99955efedfd1",
        "chapter_id": "bde1301e-1dab-406b-a9ab-b4a320114356",
        "order_number": 3,
        "title": "Come cercare gli studi e come proporsi",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 8 - 3 Come cercare gli studi e come presentarsi (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 8",
        "lesson_id": "1569fed1-b9ac-4211-8471-5bb295687de7",
        "chapter_id": "bde1301e-1dab-406b-a9ab-b4a320114356",
        "order_number": 4,
        "title": "Consenso informato",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 8 - 4 Consenso informato (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },

    # --- MODULO 9 ---
    {
        "module": "Modulo 9",
        "lesson_id": "14a8d861-7908-4f7e-b57d-ebb328c2fc4b",
        "chapter_id": "8533ff33-9cd8-46c9-8515-260996875987",
        "order_number": 1,
        "title": "Introduzione",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 9 - 1 Introduzione (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 9",
        "lesson_id": "8eac8228-a097-43a7-a9ea-2c3645c82ba6",
        "chapter_id": "8533ff33-9cd8-46c9-8515-260996875987",
        "order_number": 2,
        "title": "Smetti di fare consulenza informativa",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 9 - 3 Smetti di fare consulenza informativa (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 9",
        "lesson_id": "8a78c288-35f1-42cb-89a1-75add3c3f7a1",
        "chapter_id": "8533ff33-9cd8-46c9-8515-260996875987",
        "order_number": 6,
        "title": "Consulenza di vendita in studio vs chiamata di vendita",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 9 - 6 Consulenza in studio di vendita vs chiamata di vendita (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },

    # --- MODULO 10 ---
    {
        "module": "Modulo 10",
        "lesson_id": "95a68ec7-dbba-433e-8372-eddfb2e446cb",
        "chapter_id": "64da6b31-8eba-42cd-aaf1-2568807ad8fe",
        "order_number": 2,
        "title": "Come superare i blocchi iniziali",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 10 - 1 Come superare i blocchi inizali (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
    },
    {
        "module": "Modulo 10",
        "lesson_id": "7b8e1515-1515-4000-a000-15kbusiness01",  # Static deterministic UUID for this lesson
        "chapter_id": "64da6b31-8eba-42cd-aaf1-2568807ad8fe",
        "order_number": 9,
        "title": "Come ho costruito un business da 15k al mese",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 10 - 8 Come ho costruito un business da 15k al mese (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": True
    },
    {
        "module": "Modulo 10",
        "lesson_id": "a2680f7a-f049-4716-98b8-1021213dd328",
        "chapter_id": "64da6b31-8eba-42cd-aaf1-2568807ad8fe",
        "order_number": 10,
        "title": "Quando è necessario fare la call strategica con Sabrina",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 10 - 9 Quando è necessario fare la call strategica con Sabrina (agent aws questo video solo devi caricare di sta cartella).mp4"),
        "is_new": False
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
    print("====================================================================")
    print("=== UPLOAD 19 VIDEO FINALI IN FORMATO NATIVO (0,00€ TRANSCODING) ===")
    print("====================================================================")
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

    total_uploaded_mb = 0
    total_duration_sec = 0

    for i, item in enumerate(UPLOADS, 1):
        filepath = item['file_path']
        lesson_id = item['lesson_id']
        chapter_id = item['chapter_id']
        title = item['title']
        module = item['module']
        order_number = item['order_number']
        is_new = item['is_new']

        if not os.path.exists(filepath):
            print(f"\n[{i}/{len(UPLOADS)}] ERRORE: File non trovato: {filepath}")
            sys.exit(1)

        file_size = os.path.getsize(filepath)
        file_size_mb = file_size / (1024 * 1024)
        total_uploaded_mb += file_size_mb
        duration_sec = get_duration(filepath)
        total_duration_sec += duration_sec
        dur_str = f"{duration_sec // 60}m {duration_sec % 60}s"

        print(f"\n-------------------------------------------------------------")
        print(f"[{i}/{len(UPLOADS)}] {module} -> '{title}' (Ordine: {order_number})")
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
            ExtraArgs={
                'ContentType': 'video/mp4',
                'CacheControl': 'public, max-age=31536000, immutable',
            },
            Config=transfer_config,
            Callback=progress
        )
        print("\n  Upload S3 completato con successo!")

        # Update or Insert DynamoDB
        if is_new:
            # Put new item
            now_iso = datetime.now(timezone.utc).isoformat()
            new_item = {
                'lesson_id': lesson_id,
                'chapter_id': chapter_id,
                'title': title,
                'description': '',
                'order_number': order_number,
                'duration_seconds': duration_sec,
                'video_s3_key': s3_key,
                'asset_version': asset_version,
                'transcode_status': 'NATIVE',
                'is_free_preview': False,
                'thumbnail_url': '',
                'attachments': [],
                'transcode_job_id': None,
                'created_at': now_iso
            }
            table.put_item(Item=new_item)
            print(f"  DynamoDB CREATO nuovo record: video_s3_key = {s3_key}, duration = {duration_sec}s, order = {order_number}")
        else:
            update_expr = (
                "SET video_s3_key = :vkey, "
                "asset_version = :aver, "
                "duration_seconds = :dur, "
                "transcode_status = :status, "
                "title = :title, "
                "order_number = :ord "
                "REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status"
            )
            expr_vals = {
                ':vkey': s3_key,
                ':aver': asset_version,
                ':dur': duration_sec,
                ':status': 'NATIVE',
                ':title': title,
                ':ord': order_number
            }

            table.update_item(
                Key={'lesson_id': lesson_id},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_vals
            )
            print(f"  DynamoDB AGGIORNATO record: video_s3_key = {s3_key}, duration = {duration_sec}s, order = {order_number}")

    print("\n====================================================================")
    print(f"TUTTI I {len(UPLOADS)} VIDEO SONO STATI CARICATI E ATTIVATI CON SUCCESSO!")
    print(f"Totale dati trasferiti: {total_uploaded_mb:.1f} MB (~{total_uploaded_mb/1024:.2f} GB)")
    print(f"Totale durata video: {total_duration_sec // 60}m {total_duration_sec % 60}s")
    print("Zero transcodifiche a pagamento eseguite (costo MediaConvert = 0,00€).")
    print("====================================================================")

if __name__ == '__main__':
    main()
