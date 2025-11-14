import json
import os
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError
from datetime import datetime, timedelta

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
        # L'autenticazione è gestita da API Gateway (CognitoAuthorizer)
        return event['requestContext']['authorizer']['claims']['sub']
    except KeyError:
        return None

# --- Inizializzazione ---

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

LESSONS_TABLE_NAME = os.environ.get('LESSONS_TABLE')
VIDEO_BUCKET_NAME = os.environ.get('VIDEO_BUCKET')

lessons_table = dynamodb.Table(LESSONS_TABLE_NAME)

# --- Funzioni Logiche ---

def get_video_url(user_id, lesson_id):
    try:
        # TODO: Aggiungere logica di controllo iscrizione
        # Attualmente, se l'utente è autenticato (user_id != None), 
        # gli viene concesso l'accesso.
        
        # 1. Trova la lezione nel DB
        lesson_response = lessons_table.get_item(
            Key={'lesson_id': lesson_id}
        )
        
        if 'Item' not in lesson_response:
            return create_response(404, {'error': 'Lesson not found'})
            
        lesson = lesson_response['Item']
        video_s3_key = lesson.get('video_s3_key')

        if not video_s3_key:
            return create_response(404, {'error': 'No video S3 key associated with this lesson'})

        # 2. Genera un S3 Pre-signed URL (valido per 1 ora)
        # Questo è coerente con i permessi S3ReadPolicy dati alla Lambda
        try:
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': VIDEO_BUCKET_NAME, 'Key': video_s3_key},
                ExpiresIn=3600  # 1 ora
            )
            
            return create_response(200, {
                'video_url': presigned_url,
                'expires_at': (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
            })
            
        except ClientError as e:
            print(f"Errore S3 generate_presigned_url: {e}")
            return create_response(500, {'error': f'S3 Error: {e}'})

    except Exception as e:
        print(f"Errore get_video_url: {e}")
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

    # Gestione rotta per /course/video/{lesson_id}
    if path.startswith('/course/video/') and http_method == 'GET':
        try:
            # Il template.yaml usa {lesson_id}
            lesson_id = event['pathParameters']['lesson_id']
            return get_video_url(user_id, lesson_id)
        except (KeyError, TypeError):
            return create_response(400, {'error': 'Invalid lesson ID'})

    return create_response(404, {'error': 'VideoHandler: Not found'})