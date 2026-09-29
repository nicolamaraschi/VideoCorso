"""
Transcodifica in locale i 4 video nuovi (720p, 480p, 360p) con FFmpeg
e li carica su S3 sotto il prefisso streaming/.
Infine aggiorna DynamoDB: transcode_status = 'COMPLETED'.
"""
import os, sys, json, subprocess, tempfile, boto3
from boto3.s3.transfer import TransferConfig

FFMPEG   = '/opt/homebrew/bin/ffmpeg'
PROFILE  = 'personale'
REGION   = 'us-east-1'
BUCKET   = 'prod-videocorso-content'
TABLE    = 'prod-videocorso-lessons'
BASE_FOLDER = '/Volumes/Sviluppo/Chiara Morocutti/VIDEO_SENZA_SILENZI_E_INTERCALARI_2026-09-05/CARTELLA_FINALE_DA_CARICARE_SU_AWS'

# Encoding parameters (identici a MediaConvert)
RENDITIONS = [
    {'suffix': '720p',  'width': 720,  'maxrate': '2000k', 'audio': '96k'},
    {'suffix': '480p',  'width': 480,  'maxrate': '1000k', 'audio': '80k'},
    {'suffix': '360p',  'width': 360,  'maxrate': '650k',  'audio': '64k'},
]

# 4 video da processare
VIDEOS = [
    {
        'title': 'Strumenti per la forma',
        'lesson_id':  'b6a2ef5b-9a5c-4eb5-8c29-692e61d0e0f2',
        'video_s3_key': 'videos/b6a2ef5b-9a5c-4eb5-8c29-692e61d0e0f2/c468a00aa42b473c93f9523648ff05cf/source.mp4',
        'local_file': os.path.join(BASE_FOLDER, 'Modulo 4 - 1 Strumenti per la forma (agent aws questo video solo devi caricare di sta cartella).mp4'),
    },
    {
        'title': 'Affilare la matita',
        'lesson_id':  '8f72378d-5de8-49f8-be47-6522163387ec',
        'video_s3_key': 'videos/8f72378d-5de8-49f8-be47-6522163387ec/d4916a0b2e41445586cb3280752ecaab/source.mp4',
        'local_file': os.path.join(BASE_FOLDER, 'Modulo 4 - 2 Affilare la matita (agent aws questo video solo devi caricare di sta cartella).mp4'),
    },
    {
        'title': 'Strumenti di lavoro',
        'lesson_id':  '2af87613-429f-4365-af79-bbd63ce87384',
        'video_s3_key': 'videos/2af87613-429f-4365-af79-bbd63ce87384/832f6b81a0814048a759768517da3095/source.mp4',
        'local_file': os.path.join(BASE_FOLDER, 'Modulo 7 - 1 Strumenti di lavoro (agent aws questo video solo devi caricare di sta cartella).mp4'),
    },
    {
        'title': 'Registrazione di una chiamata di vendita',
        'lesson_id':  '6e556b7d-8332-4d71-89fe-7aebc586a788',
        'video_s3_key': 'videos/6e556b7d-8332-4d71-89fe-7aebc586a788/c1f954c077ed4aea8e27de91ba3bab74/source.mp4',
        'local_file': os.path.join(BASE_FOLDER, 'Modulo 9 - 7 Registrazione di una chiamata di vendita (agent aws questo video solo devi caricare di sta cartella).mp4'),
    },
]

def streaming_key(video_s3_key: str, suffix: str) -> str:
    """Replica la logica get_optimized_video_key del backend."""
    parts = video_s3_key.strip('/').split('/')
    if len(parts) >= 4 and parts[0] == 'videos' and parts[-1].startswith('source.'):
        return f"streaming/{'/'.join(parts[1:-1])}/source_{suffix}.mp4"
    stem = video_s3_key.rsplit('/', 1)[-1].rsplit('.', 1)[0]
    return f'streaming/{stem}/{stem}_{suffix}.mp4'

def transcode(src: str, out: str, width: int, maxrate: str, audio: str) -> bool:
    """FFmpeg: scala mantenendo AR (video verticale), VBR con maxrate."""
    cmd = [
        FFMPEG, '-y', '-i', src,
        '-vf', f'scale={width}:-2',          # width fissata, height auto pari
        '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow',
        '-crf', '23', '-maxrate', maxrate, '-bufsize', str(int(maxrate[:-1])*2)+'k',
        '-pix_fmt', 'yuv420p',   # iPhone HEVC è 10-bit → force 8-bit per h264 high
        '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', audio, '-ar', '48000',
        out
    ]
    print(f"    $ ffmpeg scale={width} maxrate={maxrate} audio={audio}")
    proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, text=True)
    # Print FFmpeg progress lines
    last_time = ''
    for line in proc.stderr:
        if 'time=' in line:
            t = line.split('time=')[1].split(' ')[0]
            if t != last_time:
                print(f"\r    progress: {t}", end='', flush=True)
                last_time = t
    proc.wait()
    print()
    return proc.returncode == 0

def main():
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    s3      = session.client('s3')
    table   = session.resource('dynamodb').Table(TABLE)
    cfg     = TransferConfig(multipart_threshold=15*1024*1024, max_concurrency=8,
                             multipart_chunksize=10*1024*1024, use_threads=True)

    print("=" * 70)
    print(f"TRANSCODE + UPLOAD  {len(VIDEOS)} video × {len(RENDITIONS)} rendizioni")
    print("=" * 70)

    total_failures = []

    for vi, video in enumerate(VIDEOS, 1):
        title     = video['title']
        lid       = video['lesson_id']
        src       = video['local_file']
        s3_source = video['video_s3_key']

        print(f"\n{'─'*70}")
        print(f"[{vi}/{len(VIDEOS)}] {title}")
        print(f"  Sorgente locale: {os.path.basename(src)}")

        if not os.path.exists(src):
            print(f"  ❌ FILE LOCALE NON TROVATO! Skip.")
            total_failures.append(f"{title}: file mancante")
            continue

        with tempfile.TemporaryDirectory() as tmpdir:
            for r in RENDITIONS:
                suffix  = r['suffix']
                out_local = os.path.join(tmpdir, f"source_{suffix}.mp4")
                s3_key  = streaming_key(s3_source, suffix)

                print(f"\n  → Rendizione {suffix}")
                print(f"    S3 key: {s3_key}")

                # Transcode
                ok = transcode(src, out_local, r['width'], r['maxrate'], r['audio'])
                if not ok:
                    print(f"    ❌ FFmpeg fallito per {suffix}")
                    total_failures.append(f"{title} {suffix}: ffmpeg error")
                    continue

                out_size = os.path.getsize(out_local) / 1024 / 1024
                print(f"    ✅ Transcodifica OK ({out_size:.1f} MB)")

                # Upload S3
                print(f"    ↑ Upload su S3...")
                s3.upload_file(
                    out_local, BUCKET, s3_key,
                    ExtraArgs={'ContentType': 'video/mp4',
                               'CacheControl': 'public,max-age=31536000,immutable'},
                    Config=cfg,
                )
                print(f"    ✅ S3 upload OK")

        # Aggiorna DynamoDB: COMPLETED
        table.update_item(
            Key={'lesson_id': lid},
            UpdateExpression="SET transcode_status = :s",
            ExpressionAttributeValues={':s': 'COMPLETED'},
        )
        print(f"\n  ✅ DynamoDB → transcode_status = COMPLETED")

    print(f"\n{'='*70}")
    if total_failures:
        print(f"COMPLETATO CON ERRORI ({len(total_failures)}):")
        for f in total_failures: print(f"  ❌ {f}")
    else:
        print(f"✅ TUTTO COMPLETATO! {len(VIDEOS)} video × {len(RENDITIONS)} rendizioni live.")
    print("=" * 70)

if __name__ == '__main__':
    main()
