import json
import os
import boto3
import uuid
from decimal import Decimal
from datetime import datetime

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
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def get_user_id(event):
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except KeyError:
        return None

# --- Inizializzazione ---

dynamodb = boto3.resource('dynamodb')

PROGRESS_TABLE_NAME = os.environ.get('PROGRESS_TABLE')
PURCHASES_TABLE_NAME = os.environ.get('PURCHASES_TABLE')
LESSONS_TABLE_NAME = os.environ.get('LESSONS_TABLE')

progress_table = dynamodb.Table(PROGRESS_TABLE_NAME)
purchases_table = dynamodb.Table(PURCHASES_TABLE_NAME)
lessons_table = dynamodb.Table(LESSONS_TABLE_NAME)

# --- Funzioni Logiche ---

def find_progress_item(user_id, lesson_id):
    # Query inefficiente a causa dello schema. Vd. commenti precedenti.
    try:
        response = progress_table.query(
            IndexName='UserIndex',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id)
        )
        items = response.get('Items', [])
        for item in items:
            if item.get('lesson_id') == lesson_id:
                return item
        return None
    except Exception as e:
        print(f"Errore find_progress_item: {e}")
        return None

def update_progress(user_id, body):
    try:
        lesson_id = body.get('lesson_id')
        watched_seconds = body.get('watched_seconds')
        completed = body.get('completed', False)

        if not lesson_id or watched_seconds is None:
            return create_response(400, {'error': 'lesson_id e watched_seconds sono richiesti'})

        # Cerca un progresso esistente
        progress_item = find_progress_item(user_id, lesson_id)
        
        now_iso = datetime.utcnow().isoformat() + "Z"

        if progress_item:
            # Aggiorna
            progress_id = progress_item['progress_id']
            # Non sovrascrivere 'completed' se è già True
            if progress_item.get('completed', False):
                completed = True
                
            update_expression = "SET watched_seconds = :ws, completed = :c, last_watched = :lw"
            expression_values = {
                ':ws': Decimal(str(watched_seconds)),
                ':c': completed,
                ':lw': now_iso
            }
            
            updated_item = progress_table.update_item(
                Key={'progress_id': progress_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values,
                ReturnValues="ALL_NEW"
            )
            return create_response(200, {'success': True, 'data': updated_item.get('Attributes')})
        
        else:
            # Crea nuovo
            progress_id = str(uuid.uuid4())
            new_item = {
                'progress_id': progress_id,
                'user_id': user_id,
                'lesson_id': lesson_id,
                'watched_seconds': Decimal(str(watched_seconds)),
                'total_seconds': Decimal('0'), # Il frontend dovrebbe gestirlo
                'completed': completed,
                'last_watched': now_iso
            }
            progress_table.put_item(Item=new_item)
            return create_response(201, {'success': True, 'data': new_item})

    except Exception as e:
        print(f"Errore update_progress: {e}")
        return create_response(500, {'error': f"Internal server error: {e}"})

def get_user_progress(user_id):
    try:
        # 1. Prendi tutti i progressi dell'utente
        progress_response = progress_table.query(
            IndexName='UserIndex',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id)
        )
        progress_items = progress_response.get('Items', [])
        
        # 2. Prendi tutte le lezioni (costoso, da ottimizzare in futuro)
        lessons_response = lessons_table.scan()
        total_lessons = lessons_response.get('Count', 0)
        
        # 3. Calcola le statistiche
        completed_lessons = 0
        total_watch_time = 0
        lesson_progress_map = {}
        
        for item in progress_items:
            lesson_progress_map[item['lesson_id']] = item
            if item.get('completed', False):
                completed_lessons += 1
            total_watch_time += item.get('watched_seconds', 0)
        
        percentage = (completed_lessons / total_lessons) * 100 if total_lessons > 0 else 0
        
        response_body = {
            'total_lessons': total_lessons,
            'completed_lessons': completed_lessons,
            'percentage': percentage,
            'chapters': [], # L'aggregazione per capitoli è complessa, omessa per ora
            'lesson_progress': lesson_progress_map,
            'total_watch_time': total_watch_time
        }
        return create_response(200, response_body)
        
    except Exception as e:
        print(f"Errore get_user_progress: {e}")
        return create_response(500, {'error': f"Internal server error: {e}"})

def get_lesson_progress(user_id, lesson_id):
    try:
        progress_item = find_progress_item(user_id, lesson_id)
        if progress_item:
            return create_response(200, progress_item)
        else:
            # Restituisci un progresso di default se non esiste
            return create_response(200, {
                'progress_id': None,
                'user_id': user_id,
                'lesson_id': lesson_id,
                'watched_seconds': 0,
                'total_seconds': 0, # Il frontend deve sapere la durata
                'completed': False,
                'last_watched': None
            })
    except Exception as e:
        print(f"Errore get_lesson_progress: {e}")
        return create_response(500, {'error': f"Internal server error: {e}"})

def get_subscription(user_id):
    try:
        # Query per gli acquisti dell'utente
        response = purchases_table.query(
            IndexName='UserIndex',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id),
            ScanIndexForward=False # Ordina per data discendente (se purchase_id è basato sul tempo)
        )
        
        purchases = response.get('Items', [])
        if not purchases:
            return create_response(404, {'error': 'No subscription found'})

        # Prendi l'acquisto più recente
        latest_purchase = sorted(purchases, key=lambda x: x['purchase_date'], reverse=True)[0]
        
        end_date = datetime.fromisoformat(latest_purchase['expiration_date'].replace('Z', '+00:00'))
        now = datetime.now(datetime.timezone.utc)
        
        is_active = end_date > now
        days_remaining = (end_date - now).days
        
        return create_response(200, {
            'is_active': is_active,
            'days_remaining': days_remaining if days_remaining > 0 else 0,
            'purchase': latest_purchase,
            'course': { # Dati finti, dovresti prenderli da CoursesTable
                'course_id': 'course_001',
                'title': 'VideoCorso Completo'
            }
        })
    except Exception as e:
        print(f"Errore get_subscription: {e}")
        return create_response(500, {'error': f"Internal server error: {e}"})

# --- Handler Principale ---

def lambda_handler(event, context):
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')
    user_id = get_user_id(event)

    if http_method == 'OPTIONS':
        return create_response(200, {})

    if not user_id:
        return create_response(401, {'error': 'Unauthorized'})

    if path == '/progress/update' and http_method == 'POST':
        return update_progress(user_id, json.loads(event.get('body', '{}')))
        
    elif path == '/progress/user' and http_method == 'GET':
        return get_user_progress(user_id)
        
    elif path.startswith('/progress/lesson/') and http_method == 'GET':
        try:
            lesson_id = event['pathParameters']['lessonId']
            return get_lesson_progress(user_id, lesson_id)
        except (KeyError, TypeError):
            return create_response(400, {'error': 'Invalid lesson ID'})
            
    elif path == '/progress/complete' and http_method == 'POST':
        # Questa rotta è ridondante se /progress/update gestisce 'completed'
        # Ma la implementiamo come da API
        body = json.loads(event.get('body', '{}'))
        body['completed'] = True
        body['watched_seconds'] = body.get('watched_seconds', 0) # Assumi 0 se non fornito
        return update_progress(user_id, body)
        
    elif path == '/user/subscription' and http_method == 'GET':
        return get_subscription(user_id)

    return create_response(404, {'error': 'Not found'})