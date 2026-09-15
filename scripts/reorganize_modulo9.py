#!/usr/bin/env python3
"""
Reorganize Modulo 9 according to user specification:
1. Introduzione
2. Vendere e fare dermopigmentazione sono due cose diverse (moved from Modulo 10)
3. Smetti di fare consulenza informativa
4. Come fare una consulenza di vendita
5. Gestire le obiezioni - Live
6. Consulenza di vendita in studio vs chiamata di vendita
7. Registrazione chiamata di vendita DA REGISTRARE
8. Come impostare il giusto prezzo per partire

Removes:
- e433a57e-3e11-45ba-8700-2f45d0ca280f (duplicate)
- 6d8644a2-ee4e-48d0-8af7-d8ec6a8b3cf5 (Risoluzione obiezioni - merged into Lesson 5)

Generates and uploads crisp thumbnails for all 8 lessons in Modulo 9.
Renumbers Modulo 10 lessons 1..9.
"""

import os
import uuid
import boto3
from PIL import Image, ImageDraw, ImageFont

PROFILE_NAME = 'personale'
REGION_NAME = 'us-east-1'
THUMBNAILS_BUCKET = 'prod-videocorso-thumbnails'
LESSONS_TABLE = 'prod-videocorso-lessons'

MODULO_9_CHAPTER_ID = '8533ff33-9cd8-46c9-8515-260996875987'
MODULO_10_CHAPTER_ID = '64da6b31-8eba-42cd-aaf1-2568807ad8fe'

session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
dynamodb = session.resource('dynamodb')
s3 = session.client('s3')
table = dynamodb.Table(LESSONS_TABLE)

# Define Modulo 9 structure
MODULO_9_SPEC = [
    {
        'order': 1,
        'lesson_id': '14a8d861-7908-4f7e-b57d-ebb328c2fc4b',
        'title': 'Introduzione',
        'thumb_title': 'Introduzione'
    },
    {
        'order': 2,
        'lesson_id': 'ebb896ea-b4e1-448a-a8b8-1fdc88c966ee',
        'title': 'Vendere e fare dermopigmentazione sono 2 cose diverse',
        'thumb_title': 'Vendere e fare dermopigmentazione\nsono 2 cose diverse'
    },
    {
        'order': 3,
        'lesson_id': '8eac8228-a097-43a7-a9ea-2c3645c82ba6',
        'title': 'Smetti di fare consulenza informativa',
        'thumb_title': 'Smetti di fare consulenza\ninformativa'
    },
    {
        'order': 4,
        'lesson_id': '236964d5-27f5-4631-a0d3-8698179d1560',
        'title': 'Come fare una consulenza di vendita',
        'thumb_title': 'Come fare una consulenza di vendita'
    },
    {
        'order': 5,
        'lesson_id': 'b59cbda6-d9a0-4440-b046-aa6e4dda47fd',
        'title': 'Gestire le obiezioni',
        'thumb_title': 'Gestire le obiezioni'
    },
    {
        'order': 6,
        'lesson_id': '8a78c288-35f1-42cb-89a1-75add3c3f7a1',
        'title': 'Consulenza in studio di vendita vs chiamata di vendita',
        'thumb_title': 'Consulenza in studio di vendita\nvs chiamata di vendita'
    },
    {
        'order': 7,
        'lesson_id': '6e556b7d-8332-4d71-89fe-7aebc586a788',
        'title': 'Registrazione di una chiamata di vendita',
        'thumb_title': 'Registrazione di una chiamata di vendita'
    },
    {
        'order': 8,
        'lesson_id': '298960a8-9fc4-46ef-bf2f-ef53592fa02a',
        'title': 'Come impostare il giusto prezzo per partire',
        'thumb_title': 'Come impostare il giusto prezzo\nper partire'
    },
]

# Deleted items
TO_DELETE = [
    'e433a57e-3e11-45ba-8700-2f45d0ca280f',  # duplicate
    '6d8644a2-ee4e-48d0-8af7-d8ec6a8b3cf5',  # Risoluzione obiezioni (superseded)
]

# Modulo 10 renumbering
MODULO_10_RENUMBER = [
    ('95a68ec7-dbba-433e-8372-eddfb2e446cb', 1, 'Come superare i blocchi iniziali'),
    ('11e04d40-7c30-48d9-9f9a-48ffbb825af3', 2, 'Come impostare correttamente una pagina social professionale'),
    ('9891d871-641e-4d52-82f4-7ceb6adaec2e', 3, 'I tre contenuti da creare'),
    ('14c83ae4-2e9b-40b6-a703-88bb057f621d', 4, 'Strategie di contenuto'),
    ('20efab06-f709-47f5-842c-efd0993d05d7', 5, 'Contenuti di attrazione, fidelizzazione e vendita'),
    ('16eba908-6e69-4b90-8ea8-12cba0a7da46', 6, 'Che tipi di stories fare'),
    ('c737d161-ba00-4a4c-aaad-606c8fd99e4a', 7, 'Cosa sono i contenuti personali'),
    ('7b8e1515-1515-4000-a000-15kbusiness01', 8, 'Come ho costruito un business da 15k al mese'),
    ('a2680f7a-f049-4716-98b8-1021213dd328', 9, 'Quando è necessario fare la call strategica con Sabrina'),
]

TEMPLATE_PATH = '/Users/nicolamaraschi/.gemini/antigravity-ide/brain/31346e9e-0d94-4cd6-bee4-12f0121a7dde/scratch/thumb_l07.jpg'

def generate_thumbnail(order_num: int, thumb_title: str) -> str:
    """Generates a crisp 1920x1080 thumbnail and returns the local file path."""
    tmp_path = f'/tmp/crisp_m09_l0{order_num}.jpg'
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
    """Uploads thumbnail to S3 and returns public URL."""
    rand_id = uuid.uuid4().hex
    key = f'lessons/{rand_id}-crisp_m09_l0{order_num}.jpg'
    with open(local_path, 'rb') as f:
        s3.put_object(
            Bucket=THUMBNAILS_BUCKET,
            Key=key,
            Body=f,
            ContentType='image/jpeg'
        )
    url = f'https://{THUMBNAILS_BUCKET}.s3.amazonaws.com/{key}'
    return url

def main():
    print("=== Starting Modulo 9 Reorganization ===\n")
    
    # 1. Generate, upload thumbnails and update Modulo 9 lessons
    print("1. Updating Modulo 9 lessons in DynamoDB...")
    for item in MODULO_9_SPEC:
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
            UpdateExpression='SET chapter_id = :cid, order_number = :ord, title = :tit, thumbnail_url = :thu',
            ExpressionAttributeValues={
                ':cid': MODULO_9_CHAPTER_ID,
                ':ord': num,
                ':tit': title,
                ':thu': thumb_url
            }
        )
        print(f"  ✅ Updated DynamoDB for lesson {lid} (Lezione {num})\n")
    
    # 2. Delete the extra lessons
    print("2. Deleting obsolete / duplicate lessons...")
    for lid in TO_DELETE:
        table.delete_item(Key={'lesson_id': lid})
        print(f"  🗑️ Deleted item {lid} from {LESSONS_TABLE}")
        
    # 3. Renumber Modulo 10
    print("\n3. Renumbering Modulo 10 lessons (1..9)...")
    for lid, new_order, title in MODULO_10_RENUMBER:
        table.update_item(
            Key={'lesson_id': lid},
            UpdateExpression='SET order_number = :ord',
            ExpressionAttributeValues={
                ':ord': new_order
            }
        )
        print(f"  ✅ Modulo 10 Lezione {new_order}: {title} ({lid})")
        
    print("\n🎉 Reorganization completed successfully!")

if __name__ == '__main__':
    main()
