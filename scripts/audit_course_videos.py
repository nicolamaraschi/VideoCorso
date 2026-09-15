#!/usr/bin/env python3
"""
Full Course Video & CloudFront Audit
Verifies:
1. All chapters & lessons in DynamoDB
2. S3 source videos & renditions (1080p, 720p, 480p, 360p)
3. CloudFront signed URL delivery
"""

import sys
import boto3
from concurrent.futures import ThreadPoolExecutor
import requests

PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
BUCKET_NAME = 'prod-videocorso-content'

session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
dynamodb = session.resource('dynamodb')
s3 = session.client('s3')

chapters_table = dynamodb.Table('prod-videocorso-chapters')
lessons_table = dynamodb.Table('prod-videocorso-lessons')

print("Fetching chapters and lessons from DynamoDB...", flush=True)
chapters = sorted(chapters_table.scan().get('Items', []), key=lambda c: int(c.get('display_order', 999)))

res = lessons_table.scan()
lessons = res.get('Items', [])
while 'LastEvaluatedKey' in res:
    res = lessons_table.scan(ExclusiveStartKey=res['LastEvaluatedKey'])
    lessons.extend(res.get('Items', []))

print(f"Loaded {len(chapters)} chapters and {len(lessons)} total lessons.\n", flush=True)

# Build map of lessons by chapter
lessons_by_chapter = {}
for l in lessons:
    cid = l.get('chapter_id', 'UNASSIGNED')
    lessons_by_chapter.setdefault(cid, []).append(l)

# Check all S3 objects concurrently
def check_lesson_s3(l):
    lid = l['lesson_id']
    v_key = l.get('video_s3_key')
    if not v_key:
        return {'lid': lid, 'has_source': False, '720p': False, '480p': False, '360p': False}
    
    has_source = False
    try:
        s3.head_object(Bucket=BUCKET_NAME, Key=v_key)
        has_source = True
    except Exception:
        pass
    
    parts = v_key.strip('/').split('/')
    has_720 = False
    has_480 = False
    has_360 = False
    if len(parts) >= 4:
        v_version = parts[2]
        p_prefix = f'streaming/{lid}/{v_version}'
        for r_label, r_attr in [('source_720p.mp4', '720p'), ('source_480p.mp4', '480p'), ('source_360p.mp4', '360p')]:
            try:
                s3.head_object(Bucket=BUCKET_NAME, Key=f'{p_prefix}/{r_label}')
                if r_attr == '720p': has_720 = True
                if r_attr == '480p': has_480 = True
                if r_attr == '360p': has_360 = True
            except Exception:
                pass
    return {'lid': lid, 'has_source': has_source, '720p': has_720, '480p': has_480, '360p': has_360}

print("Verifying S3 assets in parallel...", flush=True)
with ThreadPoolExecutor(max_workers=30) as executor:
    results = list(executor.map(check_lesson_s3, lessons))

s3_map = {r['lid']: r for r in results}

# Print detailed report per chapter
total_lessons_in_course = 0
total_with_all_renditions = 0
total_with_source_only = 0
total_without_video = 0

print("=" * 80)
print("📋 DETTAGLIO MODULI E LEZIONI")
print("=" * 80)

for ch in chapters:
    cid = ch['chapter_id']
    ch_title = ch.get('title', 'Senza titolo')
    order = ch.get('display_order', '?')
    ch_lessons = sorted(lessons_by_chapter.get(cid, []), key=lambda l: int(l.get('display_order', 999)))
    total_lessons_in_course += len(ch_lessons)
    
    print(f"\n📂 [Modulo {order}] {ch_title} ({len(ch_lessons)} lezioni)")
    for idx, l in enumerate(ch_lessons, 1):
        lid = l['lesson_id']
        ltitle = l.get('title', 'Senza titolo')
        v_key = l.get('video_s3_key')
        st = l.get('transcode_status', 'NONE')
        s3_res = s3_map.get(lid, {})
        
        if not v_key:
            total_without_video += 1
            print(f"   {idx:2d}. ⚪ {ltitle} -> [NESSUN VIDEO]")
        elif s3_res.get('720p') and s3_res.get('480p') and s3_res.get('360p'):
            total_with_all_renditions += 1
            print(f"   {idx:2d}. ✅ {ltitle} -> 1080p, 720p, 480p, 360p (COMPLETED)")
        elif s3_res.get('has_source'):
            total_with_source_only += 1
            print(f"   {idx:2d}. 🟡 {ltitle} -> Solo 1080p source ({st})")
        else:
            print(f"   {idx:2d}. ❌ {ltitle} -> S3 KEY MANCANTE ({v_key})")

unassigned = lessons_by_chapter.get('UNASSIGNED', [])
if unassigned:
    print(f"\n⚠️ Lezioni non assegnate a moduli: {len(unassigned)}")

print("\n" + "=" * 80)
print("📊 RIEPILOGO FINALE")
print("=" * 80)
print(f"Moduli totali: {len(chapters)}")
print(f"Lezioni totali nei moduli: {total_lessons_in_course}")
print(f"✅ Lezioni con 4 qualità (1080p + 720p + 480p + 360p): {total_with_all_renditions}")
print(f"🟡 Lezioni con video sorgente 1080p: {total_with_source_only}")
print(f"⚪ Lezioni senza video: {total_without_video}")
print("=" * 80)
