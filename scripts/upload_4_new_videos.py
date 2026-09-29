import os, sys, json, uuid, subprocess, boto3
from datetime import datetime, timezone
from boto3.s3.transfer import TransferConfig

PROFILE_NAME = 'personale'
REGION_NAME  = 'us-east-1'
BUCKET_NAME  = 'prod-videocorso-content'
TABLE_NAME   = 'prod-videocorso-lessons'
BASE_FOLDER  = '/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_E_INTERCALARI_2026-09-05/CARTELLA_FINALE_DA_CARICARE_SU_AWS'

UPLOADS = [
    {
        "module": "Modulo 4", "order_number": 1,
        "title": "Strumenti per la forma",
        "lesson_id": "b6a2ef5b-9a5c-4eb5-8c29-692e61d0e0f2",
        "chapter_id": "ecf131c8-aab4-45d2-9fc3-6098ae809c82",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 4 - 1 Strumenti per la forma (agent aws questo video solo devi caricare di sta cartella).mp4"),
    },
    {
        "module": "Modulo 4", "order_number": 2,
        "title": "Affilare la matita",
        "lesson_id": "8f72378d-5de8-49f8-be47-6522163387ec",
        "chapter_id": "ecf131c8-aab4-45d2-9fc3-6098ae809c82",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 4 - 2 Affilare la matita (agent aws questo video solo devi caricare di sta cartella).mp4"),
    },
    {
        "module": "Modulo 7", "order_number": 1,
        "title": "Strumenti di lavoro",
        "lesson_id": "2af87613-429f-4365-af79-bbd63ce87384",
        "chapter_id": "3aa1ed1c-5d42-4bf2-8cd1-089ba225ced2",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 7 - 1 Strumenti di lavoro (agent aws questo video solo devi caricare di sta cartella).mp4"),
    },
    {
        "module": "Modulo 9", "order_number": 7,
        "title": "Registrazione di una chiamata di vendita",
        "lesson_id": "6e556b7d-8332-4d71-89fe-7aebc586a788",
        "chapter_id": "8533ff33-9cd8-46c9-8515-260996875987",
        "file_path": os.path.join(BASE_FOLDER, "Modulo 9 - 7 Registrazione di una chiamata di vendita (agent aws questo video solo devi caricare di sta cartella).mp4"),
    },
]

class Progress:
    def __init__(self, total):
        self._total = total
        self._seen  = 0
    def __call__(self, n):
        self._seen += n
        pct = self._seen / self._total * 100
        sys.stdout.write(f"\r  {self._seen/1024/1024:.1f}/{self._total/1024/1024:.1f} MB ({pct:.1f}%)")
        sys.stdout.flush()

def duration(fp):
    ffprobe = '/opt/homebrew/bin/ffprobe'
    r = subprocess.run([ffprobe,'-v','quiet','-print_format','json','-show_format',fp], capture_output=True, text=True)
    try:    return int(round(float(json.loads(r.stdout)['format']['duration'])))
    except: return 0

print("=" * 68)
print("=== UPLOAD 4 VIDEO NUOVI → AWS S3 + DynamoDB             ===")
print("=" * 68)

# Pre-flight
missing = [i for i in UPLOADS if not os.path.exists(i['file_path'])]
if missing:
    for m in missing: print(f"  ❌ MANCANTE: {m['file_path']}")
    sys.exit(1)
print("✅ Tutti e 4 i file trovati.\n")

session  = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
s3       = session.client('s3')
table    = session.resource('dynamodb').Table(TABLE_NAME)
cfg      = TransferConfig(multipart_threshold=15*1024*1024, max_concurrency=10,
                          multipart_chunksize=10*1024*1024, use_threads=True)

total_mb = 0; total_sec = 0; failed = []

for i, item in enumerate(UPLOADS, 1):
    fp   = item['file_path']
    lid  = item['lesson_id']
    cid  = item['chapter_id']
    sz   = os.path.getsize(fp)
    dur  = duration(fp); total_sec += dur
    mb   = sz/1024/1024
    aver = uuid.uuid4().hex
    key  = f"videos/{lid}/{aver}/source.mp4"

    print(f"[{i}/4] {item['module']} — {item['title']}")
    print(f"  {mb:.1f} MB | {dur//60}m{dur%60}s | key: {key}")
    try:
        s3.upload_file(fp, BUCKET_NAME, key,
                       ExtraArgs={'ContentType':'video/mp4','CacheControl':'public,max-age=31536000,immutable'},
                       Config=cfg, Callback=Progress(sz))
        print(f"\n  ✅ S3 OK")
        total_mb += mb
        table.update_item(
            Key={'lesson_id': lid},
            UpdateExpression=(
                "SET video_s3_key=:k, asset_version=:av, duration_seconds=:d,"
                "    transcode_status=:s, title=:t, order_number=:o "
                "REMOVE pending_video_s3_key, pending_asset_version, pending_transcode_status"
            ),
            ExpressionAttributeValues={':k':key,':av':aver,':d':dur,':s':'NATIVE',
                                        ':t':item['title'],':o':item['order_number']}
        )
        print(f"  ✅ DynamoDB AGGIORNATO")
    except Exception as e:
        print(f"\n  ❌ ERRORE: {e}")
        failed.append(item['title'])
    print()

print("=" * 68)
print(f"FATTO: {4-len(failed)}/4 video caricati | {total_mb:.1f} MB | {total_sec//60}m{total_sec%60}s totali")
if failed:
    print(f"FALLITI: {', '.join(failed)}")
print("=" * 68)
