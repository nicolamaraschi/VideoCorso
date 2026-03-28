import json
import os
import boto3
import uuid
import datetime
from decimal import Decimal
from botocore.exceptions import ClientError
# FIX: Aggiungi import per timedelta
from datetime import timedelta
from boto3.dynamodb.conditions import Key

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
# FIX: Inizializza il client Cognito
cognito_client = boto3.client('cognito-idp')

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
# FIX: Recupera l'ID del User Pool dall'ambiente
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')

# --- Funzioni Logiche ---

# /admin/course/chapter
def create_chapter(body):
    try:
        chapter_id = str(uuid.uuid4())
        
        # FIX: Calcola order_number server-side per evitare duplicati
        course_id = body.get('course_id')
        response = TABLES['CHAPTERS'].query(
            IndexName='CourseIndex',
            KeyConditionExpression=Key('course_id').eq(course_id)
        )
        chapters = response.get('Items', [])
        max_order = max([int(c.get('order_number', 0)) for c in chapters], default=0)
        new_order = max_order + 1

        item = {
            'chapter_id': chapter_id,
            'course_id': course_id,
            'title': body.get('title'),
            'description': body.get('description', ''),
            'order_number': new_order,
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
        # 1. Recupera il capitolo per avere il course_id (per il riordino)
        response = TABLES['CHAPTERS'].get_item(Key={'chapter_id': chapter_id})
        item = response.get('Item')
        
        if not item:
            return create_response(404, {'error': 'Chapter not found'})
            
        course_id = item['course_id']

        # 2. CASCADE DELETE: Trova ed elimina tutte le lezioni di questo capitolo
        #    Questo previene dati orfani nel DB.
        lessons_response = TABLES['LESSONS'].query(
            IndexName='ChapterIndex',
            KeyConditionExpression=Key('chapter_id').eq(chapter_id)
        )
        lessons = lessons_response.get('Items', [])
        
        # Usiamo un batch writer per efficienza se ci sono molte lezioni
        if lessons:
            with TABLES['LESSONS'].batch_writer() as batch:
                for lesson in lessons:
                    batch.delete_item(Key={'lesson_id': lesson['lesson_id']})
            print(f"Eliminate {len(lessons)} lezioni orfane per il capitolo {chapter_id}")

        # 3. Elimina il capitolo
        TABLES['CHAPTERS'].delete_item(Key={'chapter_id': chapter_id})
        
        # 4. Rinormalizza l'ordine dei capitoli rimanenti
        renormalize_chapters(course_id)
        
        return create_response(200, {'success': True, 'message': 'Chapter and its lessons deleted'})
    except Exception as e:
        print(f"Errore delete_chapter cascade: {e}")
        return create_response(500, {'error': str(e)})

def renormalize_chapters(course_id):
    try:
        response = TABLES['CHAPTERS'].query(
            IndexName='CourseIndex',
            KeyConditionExpression=Key('course_id').eq(course_id)
        )
        chapters = response.get('Items', [])
        # Ordina per numero d'ordine attuale
        chapters.sort(key=lambda x: int(x.get('order_number', 0)))
        
        for index, chapter in enumerate(chapters):
            new_order = index + 1
            if int(chapter.get('order_number', 0)) != new_order:
                TABLES['CHAPTERS'].update_item(
                    Key={'chapter_id': chapter['chapter_id']},
                    UpdateExpression="SET order_number = :o",
                    ExpressionAttributeValues={':o': new_order}
                )
    except Exception as e:
        print(f"Errore durante la rinormalizzazione dei capitoli: {e}")

def reorder_chapters(body):
    try:
        items = body.get('items', [])
        for item in items:
            TABLES['CHAPTERS'].update_item(
                Key={'chapter_id': item['id']},
                UpdateExpression="SET order_number = :o",
                ExpressionAttributeValues={':o': item['order_number']}
            )
        return create_response(200, {'success': True, 'message': 'Chapters reordered'})
    except Exception as e:
        return create_response(500, {'error': str(e)})

# /admin/course/lesson
def create_lesson(body):
    try:
        lesson_id = str(uuid.uuid4())
        
        # FIX: Calcola order_number server-side
        chapter_id = body.get('chapter_id')
        response = TABLES['LESSONS'].query(
            IndexName='ChapterIndex',
            KeyConditionExpression=Key('chapter_id').eq(chapter_id)
        )
        lessons = response.get('Items', [])
        max_order = max([int(l.get('order_number', 0)) for l in lessons], default=0)
        new_order = max_order + 1

        item = {
            'lesson_id': lesson_id,
            'chapter_id': chapter_id,
            'title': body.get('title'),
            'description': body.get('description', ''),
            'order_number': new_order,
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
        # Recupera il chapter_id prima di cancellare
        response = TABLES['LESSONS'].get_item(Key={'lesson_id': lesson_id})
        item = response.get('Item')
        
        if not item:
            return create_response(404, {'error': 'Lesson not found'})
            
        chapter_id = item['chapter_id']

        TABLES['LESSONS'].delete_item(Key={'lesson_id': lesson_id})
        
        # Rinormalizza le lezioni
        renormalize_lessons(chapter_id)
        
        return create_response(200, {'success': True, 'message': 'Lesson deleted'})
    except Exception as e:
        return create_response(500, {'error': str(e)})

def renormalize_lessons(chapter_id):
    try:
        response = TABLES['LESSONS'].query(
            IndexName='ChapterIndex',
            KeyConditionExpression=Key('chapter_id').eq(chapter_id)
        )
        lessons = response.get('Items', [])
        lessons.sort(key=lambda x: int(x.get('order_number', 0)))
        
        for index, lesson in enumerate(lessons):
            new_order = index + 1
            if int(lesson.get('order_number', 0)) != new_order:
                TABLES['LESSONS'].update_item(
                    Key={'lesson_id': lesson['lesson_id']},
                    UpdateExpression="SET order_number = :o",
                    ExpressionAttributeValues={':o': new_order}
                )
    except Exception as e:
        print(f"Errore durante la rinormalizzazione delle lezioni: {e}")

def reorder_lessons(body):
    try:
        items = body.get('items', [])
        for item in items:
            TABLES['LESSONS'].update_item(
                Key={'lesson_id': item['id']},
                UpdateExpression="SET order_number = :o",
                ExpressionAttributeValues={':o': item['order_number']}
            )
        return create_response(200, {'success': True, 'message': 'Lessons reordered'})
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

# FIX: Aggiunta nuova funzione per creazione manuale studente
# Helper imports
import string
import random
import secrets
import resend

# --- Helpers ---

def generate_temp_password(length=10):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for i in range(length))
    # Ensure at least one of each required char type for Cognito
    password += "A1!" 
    return password

def send_welcome_email(email, temp_password):
    if not os.environ.get('RESEND_API_KEY'):
        print("RESEND_API_KEY non configurata. Email non inviata.")
        return

    try:
        resend.api_key = os.environ.get('RESEND_API_KEY')
        subject = "Benvenuto nel Corso PMU - Le tue credenziali"
        html_content = f"""
        <h1>Benvenuto!</h1>
        <p>Sei stato aggiunto manualmente al Corso Completo PMU.</p>
        <p>Ecco le tue credenziali per accedere alla piattaforma:</p>
        <ul>
            <li><strong>Email:</strong> {email}</li>
            <li><strong>Password Temporanea:</strong> {temp_password}</li>
        </ul>
        <p>Ti verrà chiesto di cambiare la password al primo accesso.</p>
        <p><a href="https://d123456789.cloudfront.net/login">Accedi ora</a> (Sostituisci con tuo dominio CloudFront reale)</p>
        """
        
        r = resend.Emails.send({
            "from": "Team Corso PMU <onboarding@resend.dev>", 
            "to": email,
            "subject": subject,
            "html": html_content
        })
        print(f"Email inviata a {email}. ID: {r.get('id')}")
    except Exception as e:
        print(f"Errore invio email Resend: {e}")

# /admin/student/create
def create_manual_student(body):
    email = body.get('email')
    full_name = body.get('full_name')

    if not email or not full_name:
        return create_response(400, {'error': 'Email e full_name sono richiesti'})

    user_id = None
    user_exists = False
    temp_password = None

    try:
        # 1. Controlla se l'utente esiste già in Cognito
        try:
            print(f"Cercando utente Cognito: {email}")
            user = cognito_client.admin_get_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email
            )
            user_id = next(attr['Value'] for attr in user['UserAttributes'] if attr['Name'] == 'sub')
            user_exists = True
            print(f"Utente Cognito esistente trovato: {user_id}")
            # Se l'utente esiste, NON generiamo nuova password né mandiamo email con password,
            # perché non possiamo vedere la vecchia password e cambiarla forzatamente potrebbe confonderlo se la sapeva.
            # OPZIONE: Potremmo fare AdminSetUserPassword, ma per ora assumiamo che se esiste sappia loggarsi.
            
        except cognito_client.exceptions.UserNotFoundException:
            # Utente non esiste, procedi alla creazione
            print(f"Utente non trovato. Creazione nuovo utente Cognito: {email}")
            
            temp_password = generate_temp_password()
            print("Password temporanea generata manualmente.")

            new_user = cognito_client.admin_create_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email,
                TemporaryPassword=temp_password,
                UserAttributes=[
                    {'Name': 'email', 'Value': email},
                    {'Name': 'full_name', 'Value': full_name},
                ],
                DesiredDeliveryMediums=['EMAIL'],
                MessageAction='SUPPRESS' # Sopprimiamo email di default
            )
            user_id = next(attr['Value'] for attr in new_user['User']['Attributes'] if attr['Name'] == 'sub')
            print(f"Nuovo utente creato. UserID: {user_id}")
            
            # Inviamo la NOSTRA email
            send_welcome_email(email, temp_password)

        except Exception as e:
            # Altri errori Cognito (es. AliasExistsException)
            print(f"Errore controllo/creazione utente: {e}")
            if 'UsernameExistsException' in str(e) or 'AliasExistsException' in str(e):
                 user = cognito_client.admin_get_user(UserPoolId=COGNITO_USER_POOL_ID, Username=email)
                 user_id = next(attr['Value'] for attr in user['UserAttributes'] if attr['Name'] == 'sub')
            else:
                raise e

        # 2. Aggiungi utente al gruppo 'students' (idempotente)
        try:
            cognito_client.admin_add_user_to_group(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email,
                GroupName='students'
            )
            print("Utente aggiunto al gruppo 'students'")
        except Exception as e:
            print(f"Warning: Errore aggiunta gruppo (forse già aggiunto): {e}")

        # 3. Calcola date
        purchase_date = datetime.datetime.utcnow()
        expiration_date = purchase_date + timedelta(days=365)
        
        purchase_date_iso = purchase_date.isoformat() + "Z"
        expiration_date_iso = expiration_date.isoformat() + "Z"

        # 4. Salva/Sovrascrivi dati utente in DynamoDB
        user_item = {
            'user_id': user_id,
            'email': email,
            'full_name': full_name,
            'subscription_status': 'active',
            'sub_end_date': expiration_date_iso,
            'created_at': purchase_date_iso
        }
        TABLES['USERS'].put_item(Item=user_item)
        print("Tabella Users aggiornata.")
        
        return create_response(201, {'success': True, 'data': user_item})

    except Exception as e:
        print(f"Errore durante la creazione manuale: {e}")
        return create_response(500, {'error': f"Errore server: {e}"})

# /admin/stats
def get_stats():
    try:
        # 1. Recupera Utenti
        users_response = TABLES['USERS'].scan(Select='COUNT')
        users_count = users_response.get('Count', 0)
        
        # 2. Recupera Acquisti (per Revenue)
        purchases_response = TABLES['PURCHASES'].scan()
        purchases = purchases_response.get('Items', [])
        total_revenue = sum(item.get('amount', 0) for item in purchases)
        
        # 3. Recupera Progressi (Analisi Reale)
        progress_response = TABLES['PROGRESS'].scan()
        progress_items = progress_response.get('Items', [])
        
        # --- Calcolo Statistiche Video ---
        total_video_views = 0
        total_completion_percent = 0
        lesson_views_map = {} # lesson_id -> count
        daily_activity_map = {} # YYYY-MM-DD -> set(user_id)
        
        # DEBUG: Raccolta date grezze
        debug_dates = []

        for p in progress_items:
            progress_pct = p.get('progress_percent', 0)
            is_completed = p.get('completed', False)
            watched_sec = p.get('watched_seconds', 0)

            # Fallback: se progress_percent manca ma è completato, è 100%
            if progress_pct == 0 and is_completed:
                progress_pct = 100
            
            # Conta come "view" se ha visto almeno qualcosa (>0%) o ha secondi guardati
            if progress_pct > 0 or watched_sec > 0:
                total_video_views += 1
                total_completion_percent += progress_pct
                
                # Aggregazione per Lezione
                lid = p.get('lesson_id')
                # ... (logica lezione omessa per brevità, vedi sopra per contesto) ...
                if lid:
                    lesson_views_map[lid] = lesson_views_map.get(lid, 0) + 1
            
            # NOTA: Spostiamo la logica di attività FUORI dall'if 'view > 0'
            # Perché anche se guardo 0 secondi ma ho fatto 'play', è attività.
            # O meglio: last_watched viene aggiornato solo se c'è update.
            # Ma teniamolo dentro per coerenza con "Active Users = Users who watched something".
            
            # Aggregazione per Attività Giornaliera
            last_watched = p.get('last_watched') # ISO String
            if last_watched:
                debug_dates.append(str(last_watched)) # DEBUG
                try:
                    # Parsing Robusto
                    clean_date = str(last_watched).replace('Z', '').strip()
                    if 'T' in clean_date:
                        day = clean_date.split('T')[0]
                    else:
                        day = clean_date.split(' ')[0] # Fallback spazio
                    
                    if day not in daily_activity_map:
                        daily_activity_map[day] = set()
                    
                    uid = p.get('user_id')
                    if uid:
                        daily_activity_map[day].add(uid)
                except Exception as e:
                    print(f"Date parse error: {e}")
                    debug_dates.append(f"ERROR: {e}")

        # Media Completamento
        avg_completion_rate = 0
        if total_video_views > 0:
            avg_completion_rate = round(total_completion_percent / total_video_views, 1)

        # --- Top Lessons ---
        # Ordina le lezioni per visualizzazioni
        sorted_lessons = sorted(lesson_views_map.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Arricchisci con Titoli (BatchGetItem per efficienza)
        most_viewed_enriched = []
        if sorted_lessons:
            lesson_ids_to_fetch = [lid for lid, count in sorted_lessons]
            # DynamoDB BatchGetItem richiede keys strutturate
            keys = [{'lesson_id': lid} for lid in lesson_ids_to_fetch]
            
            try:
                # Nota: BatchGetItem standard non è esposto direttamente su Table resource in modo semplice per liste diverse,
                # ma possiamo usare il client o fare un loop se sono poche (max 5).
                # Dato che sono solo 5, facciamo loop veloce è più sicuro per "robustezza" codice immediata.
                for lid, count in sorted_lessons:
                    l_resp = TABLES['LESSONS'].get_item(Key={'lesson_id': lid})
                    l_item = l_resp.get('Item')
                    title = l_item.get('title', 'Unknown Lesson') if l_item else 'Unknown Lesson'
                    most_viewed_enriched.append({
                        'lesson_id': lid,
                        'title': title,
                        'views': count
                    })
            except Exception as e:
                print(f"Errore arricchimento lezioni: {e}")
                # Fallback senza titoli se errore
                most_viewed_enriched = [{'lesson_id': lid, 'title': 'Error fetching title', 'views': count} for lid, count in sorted_lessons]

        # --- Daily Chart ---
        # Ultime 7 giorni
        today = datetime.datetime.utcnow().date()
        daily_chart = []
        for i in range(6, -1, -1):
            day = (today - datetime.timedelta(days=i)).isoformat()
            count = len(daily_activity_map.get(day, set()))
            daily_chart.append({
                'date': day,
                'active_users': count
            })

        return create_response(200, {
            'total_students': users_count,
            'active_students': users_count, # Per ora assumiamo tutti attivi
            'total_revenue': total_revenue,
            'new_purchases_today': 0, # Implementabile con filtro su purchases
            'new_purchases_week': 0,
            'new_purchases_month': len(purchases), # Semplificazione
            'total_video_views': total_video_views,
            'average_completion_rate': avg_completion_rate,
            'most_viewed_lessons': most_viewed_enriched,
            'recent_purchases': sorted(purchases, key=lambda x: x.get('purchase_date', ''), reverse=True)[:5],
            'daily_access_chart': daily_chart,
            '_debug_dates': debug_dates # DEBUG EXPOSED
        })
    except Exception as e:
        print(f"Errore get_stats: {e}")
        return create_response(500, {'error': str(e)})

# /admin/students
def get_students(params):
    try:
        from boto3.dynamodb.conditions import Key # Added for Key condition
        response = TABLES['USERS'].scan()
        users = response.get('Items', [])
        
        # Arricchisci ogni utente con i dati di progresso
        enriched_users = []
        
        # 1. Recupera il totale delle lezioni per il calcolo della percentuale
        # (Ottimizzazione: facciamo una scan delle lezioni una volta sola o usiamo un valore fisso se noto)
        # Per correttezza, contiamo le lezioni
        lessons_scan = TABLES['LESSONS'].scan(Select='COUNT')
        total_lessons_count = lessons_scan.get('Count', 0)

        for user in users:
            uid = user.get('user_id')
            if not uid:
                enriched_users.append(user)
                continue
                
            # Query Progress
            try:
                progress_resp = TABLES['PROGRESS'].query(
                    IndexName='UserIndex',
                    KeyConditionExpression=Key('user_id').eq(uid)
                )
                progress_items = progress_resp.get('Items', [])
                
                # Calcola statistiche utente
                completed_count = 0
                total_progress_sum = 0
                last_watched_date = None
                total_watch_time = 0
                
                for p in progress_items:
                    # Completamento
                    if p.get('completed'):
                        completed_count += 1
                        total_progress_sum += 100
                    else:
                        total_progress_sum += int(p.get('progress_percent', 0))
                    
                    # Watch time
                    total_watch_time += int(p.get('watched_seconds', 0))
                    
                    # Last watched (trova il più recente)
                    lw = p.get('last_watched')
                    if lw:
                        if not last_watched_date or lw > last_watched_date:
                            last_watched_date = lw

                # Calcolo percentuale globale corso
                # Se total_lessons_count è 0, evita divisione per zero
                if total_lessons_count > 0:
                    # Opzione A: Basato su lezioni completate
                    # course_completion = (completed_count / total_lessons_count) * 100
                    
                    # Opzione B: Basato su media percentuali (più granulare)
                    # Ma richiede di sapere esattamente quali lezioni esistono.
                    # Semplifichiamo: (somma progressi) / (totale lezioni * 100) * 100
                    # Cioè: somma_progressi / totale_lezioni
                    course_completion = total_progress_sum / total_lessons_count
                    if course_completion > 100: course_completion = 100
                else:
                    course_completion = 0
                
                user['completion_percentage'] = int(course_completion)
                user['last_watched'] = last_watched_date
                user['total_watch_time'] = total_watch_time
                
            except Exception as e:
                print(f"Errore arricchimento user {uid}: {e}")
                # Fallback
                user['completion_percentage'] = 0
            
            enriched_users.append(user)

        return create_response(200, {
            'items': enriched_users,
            'total': len(enriched_users),
            'page': 1,
            'per_page': len(enriched_users),
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

        # FIX: Aggiunta rotta per creazione manuale studente
        elif path == '/admin/student/create' and http_method == 'POST':
            return create_manual_student(body)

        # Rotte per Video
        elif path == '/admin/video/upload' and http_method == 'POST':
            return get_presigned_upload_url(body)
        
        # Rotte Statistiche
        elif path == '/admin/stats' and http_method == 'GET':
            return get_stats()
            
        # Rotte Studenti
        elif path == '/admin/students' and http_method == 'GET':
            return get_students(params)

        # Rotte Riordino
        elif path == '/admin/course/reorder-chapters' and http_method == 'PUT':
            return reorder_chapters(body)
        elif path == '/admin/course/reorder-lessons' and http_method == 'PUT':
            return reorder_lessons(body)
        
        # Fallback per rotte non implementate ma definite
        else:
            return create_response(404, {'error': f"Rotta admin non ancora implementata: {http_method} {path}"})

    except Exception as e:
        print(f"Errore principale handler admin: {e}")
        return create_response(500, {'error': str(e)})