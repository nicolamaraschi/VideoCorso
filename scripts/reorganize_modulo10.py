#!/usr/bin/env python3
"""
Reorganize Modulo 10 according to user specification:
1. Come superare i blocchi iniziali
2. Biografia e Set Up Profilo
3. I 3 Contenuti da creare
4. Le 3 strategie
5. Contenuti di attrazione, fidelizzazione, vendita
6. Cosa sono i contenuti personali
7. Quali tipi di stories fare
8. Come ho costruito un business da 15k al mese
9. Quando è necessario fare la call strategica

Generates and uploads crisp 1920x1080 thumbnails to S3, and updates DynamoDB.
"""

import os
import uuid
import boto3
from PIL import Image, ImageDraw, ImageFont

PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
THUMBNAILS_BUCKET = 'prod-videocorso-thumbnails'
LESSONS_TABLE = 'prod-videocorso-lessons'
MODULO_10_CHAPTER_ID = '64da6b31-8eba-42cd-aaf1-2568807ad8fe'

session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
dynamodb = session.resource('dynamodb')
s3 = session.client('s3')
table = dynamodb.Table(LESSONS_TABLE)

TEMPLATE_PATH = '/Users/nicolamaraschi/.gemini/antigravity-ide/brain/31346e9e-0d94-4cd6-bee4-12f0121a7dde/scratch/thumb_m10_l01.jpg'

MODULO_10_SPEC = [
    {
        'order': 1,
        'lesson_id': '95a68ec7-dbba-433e-8372-eddfb2e446cb',
        'title': 'Come superare i blocchi iniziali',
        'thumb_title': 'Come superare i blocchi iniziali'
    },
    {
        'order': 2,
        'lesson_id': '11e04d40-7c30-48d9-9f9a-48ffbb825af3',
        'title': 'Biografia e Set Up Profilo',
        'thumb_title': 'Biografia e Set Up Profilo'
    },
    {
        'order': 3,
        'lesson_id': '9891d871-641e-4d52-82f4-7ceb6adaec2e',
        'title': 'I 3 Contenuti da creare',
        'thumb_title': 'I 3 Contenuti da creare'
    },
    {
        'order': 4,
        'lesson_id': '14c83ae4-2e9b-40b6-a703-88bb057f621d',
        'title': 'Le 3 strategie',
        'thumb_title': 'Le 3 strategie'
    },
    {
        'order': 5,
        'lesson_id': '20efab06-f709-47f5-842c-efd0993d05d7',
        'title': 'Contenuti di attrazione, fidelizzazione, vendita',
        'thumb_title': 'Contenuti di attrazione,\nfidelizzazione, vendita'
    },
    {
        'order': 6,
        'lesson_id': 'c737d161-ba00-4a4c-aaad-606c8fd99e4a',
        'title': 'Cosa sono i contenuti personali',
        'thumb_title': 'Cosa sono i contenuti personali'
    },
    {
        'order': 7,
        'lesson_id': '16eba908-6e69-4b90-8ea8-12cba0a7da46',
        'title': 'Quali tipi di stories fare',
        'thumb_title': 'Quali tipi di stories fare'
    },
    {
        'order': 8,
        'lesson_id': '7b8e1515-1515-4000-a000-15kbusiness01',
        'title': 'Come ho costruito un business da 15k al mese',
        'thumb_title': 'Come ho costruito un business\nda 15k al mese'
    },
    {
        'order': 9,
        'lesson_id': 'a2680f7a-f049-4716-98b8-1021213dd328',
        'title': 'Quando è necessario fare la call strategica',
        'thumb_title': 'Quando è necessario fare la call strategica'
    },
]

def generate_thumbnail(order_num: int, thumb_title: str) -> str:
    tmp_path = f'/tmp/crisp_m10_l0{order_num}.jpg'
    base = Image.open(TEMPLATE_PATH)
    draw = ImageDraw.Draw(base)
    draw.rectangle([(155, 240), (1750, 750)], fill=(255, 255, 255))
    
    georgia_reg = ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf', 72)
    arial_bold = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 38)
    
    subtitle = f'LEZIONE {order_num:02d}'
    draw.text((160, 260), subtitle, fill=(164, 113, 122), font=arial_bold)
    sub_bbox = draw.textbbox((160, 260), subtitle, font=arial_bold)
    draw.line([(160, sub_bbox[3] + 12), (sub_bbox[2] + 4, sub_bbox[3] + 12)], fill=(164, 113, 122), width=4)
    
    draw.text((160, 390), thumb_title, fill=(27, 16, 20), font=georgia_reg, spacing=24)
    base.save(tmp_path, quality=95)
    return tmp_path

def upload_thumbnail(local_path: str, order_num: int) -> str:
    rand_id = uuid.uuid4().hex
    key = f'lessons/{rand_id}-crisp_m10_l0{order_num}.jpg'
    with open(local_path, 'rb') as f:
        s3.put_object(
            Bucket=THUMBNAILS_BUCKET,
            Key=key,
            Body=f,
            ContentType='image/jpeg'
        )
    return f'https://{THUMBNAILS_BUCKET}.s3.amazonaws.com/{key}'

def main():
    print("=== Starting Modulo 10 Reorganization ===\n")
    for item in MODULO_10_SPEC:
        num = item['order']
        lid = item['lesson_id']
        title = item['title']
        thumb_title = item['thumb_title']
        
        print(f"  Generating thumbnail for Lezione {num}: {title}...")
        thumb_file = generate_thumbnail(num, thumb_title)
        thumb_url = upload_thumbnail(thumb_file, num)
        print(f"  Uploaded thumbnail -> {thumb_url}")
        
        table.update_item(
            Key={'lesson_id': lid},
            UpdateExpression='SET order_number = :ord, title = :tit, thumbnail_url = :thu',
            ExpressionAttributeValues={
                ':ord': num,
                ':tit': title,
                ':thu': thumb_url
            }
        )
        print(f"  ✅ Updated DynamoDB for lesson {lid} (Lezione {num})\n")

    print("🎉 Modulo 10 Reorganization completed successfully!")

if __name__ == '__main__':
    main()
