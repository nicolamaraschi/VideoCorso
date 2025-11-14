import json
import os
import boto3
import uuid
import datetime
from decimal import Decimal
from botocore.exceptions import ClientError

# --- Helpers ---

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def create_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def get_user_groups(event):
    try:
        groups = event['requestContext']['authorizer']['claims'].get('cognito:groups', '')
        if isinstance(groups, str):
            return groups.split(',') if groups else []
        return groups if isinstance(groups, list) else []
    except KeyError:
        return []

def is_admin(event):
    return 'admin' in get_user_groups(event)

# --- Inizializzazione ---

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

# Mappa per tutte le tabelle
TABLE_NAMES = {
    'COURSES': os.environ.get('COURSES_TABLE'),
    'CHAPTERS': os.environ.get('CHAPTERS_TABLE'),
    'LESSONS': os.environ.get('LESSONS_TABLE'),
    'PURCHASES': os.environ.get('PURCHASES_TABLE'),
    'PROGRESS': os.environ.get('PROGRESS_TABLE'),
    'USERS': os.environ.get('USERS_TABLE'),
}

TABLES = {name: dynamodb.Table(table_name) for name, table_name in TABLE_NAMES.items() if table_name}

VIDEO_BUCKET = os.environ.get('VIDEO_BUCKET')

# --- Funzioni Logiche ---

# /admin/course/chapter
def create_chapter(body):
    try:
        chapter_id = str(uuid.uuid4())
        item = {
            'chapter_id': chapter_id,
            'course_id': body.get('course_id'),
            'title': body.get('title'),
            'description': body.get('description', ''),
            'order_number': body.get('order_number', 0),
            'created_at': datetime.datetime.utcnow().isoformat() + 'Z'
        }
        TABLES['CHAPTERS'].put_item(Item=item)
        return create_response(201, {'success': True, 'data': item})
    except Exception as e:
        return create_response(500, {'error': str(e)})

def update_chapter(chapter_id, body):
    try:
        update_expression = "SET "
        expression_values = {}
        for key, value in body.items():
            if key != 'chapter_id':
                update_expression += f" {key} = :{key},"
                expression_values[f":{key}"] = value
        
        update_expression = update_expression.rstrip(',')
        
        updated_item = TABLES['CHAPTERS'].update_item(
            Key={'chapter_id': chapter_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ReturnValues="ALL_NEW"
        )
        return create_response(200, {'success': True, 'data': updated_item.get('Attributes')})
    except Exception as e:
        return create_response(500, {'error': str(e)})

def delete_chapter(chapter_id):
    try:
        TABLES['CHAPTERS'].delete_item(Key={'chapter_id': chapter_id})
        return create_response(200, {'success': True, 'message': 'Chapter deleted'})
    except Exception as e:
        return create_response(500, {'error': str(e)})

# /admin/course/lesson
def create_lesson(body):
    try:
        lesson_id = str(uuid.uuid4())
        item = {
            'lesson_id': lesson_id,
            'chapter_id': body.get('chapter_id'),
            'title': body.get('title'),
            'description': body.get('description', ''),
            'order_number': body.get('order_number', 0),
            'duration_seconds': body.get('duration_seconds', 0),
            'video_s3_key': body.get('video_s3_key'),
            'thumbnail_url': body.get('thumbnail_url', ''),
            'is_free_preview': body.get('is_free_preview', False),
            'created_at': datetime.datetime.utcnow().isoformat() + 'Z'
        }
        TABLES['LESSONS'].put_item(Item=item)
        return create_response(201, {'success': True, 'data': item})
    except Exception as e:
        return create_response(500, {'error': str(e)})

def update_lesson(lesson_id, body):
    try:
        update_expression = "SET "
        expression_values = {}
        for key, value in body.items():
            if key != 'lesson_id':
                update_expression += f" {key} = :{key},"
                expression_values[f":{key}"] = value
        
        update_expression = update_expression.rstrip(',')
        
        updated_item = TABLES['LESSONS'].update_item(
            Key={'lesson_id': lesson_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ReturnValues="ALL_NEW"
        )
        return create_response(200, {'success': True, 'data': updated_item.get('Attributes')})
    except Exception as e:
        return create_response(500, {'error': str(e)})

def delete_lesson(lesson_id):
    try:
        TABLES['LESSONS'].delete_item(Key={'lesson_id': lesson_id})
        return create_response(200, {'success': True, 'message': 'Lesson deleted'})
    except Exception as e:
        return create_response(500, {'error': str(e)})

# /admin/video/upload
def get_presigned_upload_url(body):
    try:
        file_name = body.get('file_name')
        file_type = body.get('file_type')
        if not file_name or not file_type:
            return create_response(400, {'error': 'file_name e file_type sono richiesti'})

        s3_key = f"videos/{str(uuid.uuid4())}-{file_name}"
        
        response = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': VIDEO_BUCKET, 'Key': s3_key, 'ContentType': file_type},
            ExpiresIn=3600
        )
        
        return create_response(200, {
            'upload_url': response,
            'video_s3_key': s3_key,
            'expires_at': (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).isoformat() + "Z"
        })
    except ClientError as e:
        print(f"Errore S3: {e}")
        return create_response(500, {'error': f'Errore S3: {e}'})
    except Exception as e:
        return create_response(500, {'error': str(e)})

# /admin/stats
def get_stats():
    try:
        users_response = TABLES['USERS'].scan(Select='COUNT')
        users = users_response.get('Count', 0)
        
        purchases_response = TABLES['PURCHASES'].scan()
        purchases = purchases_response.get('Items', [])
        
        total_revenue = sum(item.get('amount', 0) for item in purchases)
        
        return create_response(200, {
            'total_students': users,
            'active_students': users,
            'total_revenue': total_revenue,
            'new_purchases_today': 0,
            'new_purchases_week': 0,
            'new_purchases_month': len(purchases),
            'total_video_views': 0,
            'average_completion_rate': 0,
            'most_viewed_lessons': [],
            'recent_purchases': sorted(purchases, key=lambda x: x.get('purchase_date', ''), reverse=True)[:5],
            'daily_access_chart': []
        })
    except Exception as e:
        print(f"Errore get_stats: {e}")
        return create_response(500, {'error': str(e)})

# /admin/students
def get_students(params):
    try:
        response = TABLES['USERS'].scan()
        items = response.get('Items', [])
        return create_response(200, {
            'items': items,
            'total': len(items),
            'page': 1,
            'per_page': len(items),
            'total_pages': 1
        })
    except Exception as e:
        print(f"Errore get_students: {e}")
        return create_response(500, {'error': str(e)})

# --- Handler Principale ---

def lambda_handler(event, context):
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    
    # Gestione OPTIONS
    if http_method == 'OPTIONS':
        return create_response(200, {})

    # Controllo Admin
    if not is_admin(event):
        return create_response(403, {'error': 'Accesso negato. Privilegi di amministratore richiesti.'})

    # FIX: body può essere None per GET requests
    body_str = event.get('body') or '{}'
    body = json.loads(body_str)
    params = event.get('queryStringParameters') or {}
    
    try:
        # Rotte per Capitoli
        if path == '/admin/course/chapter' and http_method == 'POST':
            return create_chapter(body)
        elif path.startswith('/admin/course/chapter/') and http_method == 'PUT':
            chapter_id = event['pathParameters']['chapterId']
            return update_chapter(chapter_id, body)
        elif path.startswith('/admin/course/chapter/') and http_method == 'DELETE':
            chapter_id = event['pathParameters']['chapterId']
            return delete_chapter(chapter_id)

        # Rotte per Lezioni
        elif path == '/admin/course/lesson' and http_method == 'POST':
            return create_lesson(body)
        elif path.startswith('/admin/course/lesson/') and http_method == 'PUT':
            lesson_id = event['pathParameters']['lessonId']
            return update_lesson(lesson_id, body)
        elif path.startswith('/admin/course/lesson/') and http_method == 'DELETE':
            lesson_id = event['pathParameters']['lessonId']
            return delete_lesson(lesson_id)

        # Rotte per Video
        elif path == '/admin/video/upload' and http_method == 'POST':
            return get_presigned_upload_url(body)
        
        # Rotte Statistiche
        elif path == '/admin/stats' and http_method == 'GET':
            return get_stats()
            
        # Rotte Studenti
        elif path == '/admin/students' and http_method == 'GET':
            return get_students(params)
        
        # Fallback per rotte non implementate ma definite
        else:
            return create_response(404, {'error': f"Rotta admin non ancora implementata: {http_method} {path}"})

    except Exception as e:
        print(f"Errore principale handler admin: {e}")
        return create_response(500, {'error': str(e)})