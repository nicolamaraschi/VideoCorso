import json
import os
import boto3
from decimal import Decimal

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
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }
    
def get_user_id(event):
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except KeyError:
        return None
        
def check_subscription(user_id):
    # Questa è una funzione helper che dovrai espandere
    # Per ora, restituisce True se l'utente è loggato
    # In produzione, dovresti controllare la data di scadenza
    # dalla tabella Users o Purchases
    return user_id is not None

# --- Inizializzazione ---

dynamodb = boto3.resource('dynamodb')

COURSES_TABLE_NAME = os.environ.get('COURSES_TABLE')
CHAPTERS_TABLE_NAME = os.environ.get('CHAPTERS_TABLE')
LESSONS_TABLE_NAME = os.environ.get('LESSONS_TABLE')

courses_table = dynamodb.Table(COURSES_TABLE_NAME)
chapters_table = dynamodb.Table(CHAPTERS_TABLE_NAME)
lessons_table = dynamodb.Table(LESSONS_TABLE_NAME)

# --- Funzioni Logiche ---

def get_course_structure(event):
    user_id = get_user_id(event)
    has_access = check_subscription(user_id)
    
    try:
        # 1. Prendi il corso
        course_response = courses_table.scan(Limit=1)
        if not course_response.get('Items'):
            return create_response(404, {'error': 'Course not found'})
        
        course = course_response['Items'][0]
        course_id = course['course_id']

        # 2. Prendi i capitoli
        chapters_response = chapters_table.query(
            IndexName='CourseIndex',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('course_id').eq(course_id)
        )
        chapters = sorted(chapters_response.get('Items', []), key=lambda x: x.get('order_number', 0))

        # 3. Per ogni capitolo, prendi le lezioni
        for chapter in chapters:
            lessons_response = lessons_table.query(
                IndexName='ChapterIndex',
                KeyConditionExpression=boto3.dynamodb.conditions.Key('chapter_id').eq(chapter['chapter_id'])
            )
            lessons = sorted(lessons_response.get('Items', []), key=lambda x: x.get('order_number', 0))
            
            # Filtra i dati sensibili se l'utente non ha accesso
            processed_lessons = []
            for lesson in lessons:
                is_free = lesson.get('is_free_preview', False)
                if has_access or is_free:
                    # L'utente ha accesso, mostra tutto tranne la S3 key
                    lesson.pop('video_s3_key', None) 
                else:
                    # L'utente non ha accesso e non è free preview
                    lesson = {
                        'lesson_id': lesson.get('lesson_id'),
                        'title': lesson.get('title'),
                        'duration_seconds': lesson.get('duration_seconds'),
                        'is_locked': True
                    }
                processed_lessons.append(lesson)
            
            chapter['lessons'] = processed_lessons

        response_body = {
            'course': course,
            'chapters': chapters
        }
        return create_response(200, response_body)

    except Exception as e:
        print(f"Errore get_course_structure: {e}")
        return create_response(500, {'error': 'Internal server error'})

def get_free_previews():
    try:
        response = lessons_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('is_free_preview').eq(True)
        )
        lessons = response.get('Items', [])
        # Rimuovi dati sensibili
        for lesson in lessons:
            lesson.pop('video_s3_key', None)
            
        return create_response(200, lessons)
    except Exception as e:
        print(f"Errore get_free_previews: {e}")
        return create_response(500, {'error': 'Internal server error'})

# --- Handler Principale ---

def lambda_handler(event, context):
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if path == '/course/structure' and http_method == 'GET':
        return get_course_structure(event)
        
    elif path == '/course/previews' and http_method == 'GET':
        return get_free_previews()

    return create_response(404, {'error': 'Not found'})