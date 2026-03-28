import json
import os
import boto3
import uuid
from datetime import datetime, timedelta
import stripe
import secrets
import string

# Inizializza Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')

# Inizializza Boto3
dynamodb = boto3.resource('dynamodb')
cognito_client = boto3.client('cognito-idp')

USERS_TABLE_NAME = os.environ.get('USERS_TABLE')
PURCHASES_TABLE_NAME = os.environ.get('PURCHASES_TABLE')
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')

users_table = dynamodb.Table(USERS_TABLE_NAME)
purchases_table = dynamodb.Table(PURCHASES_TABLE_NAME)

# Inizializza Resend (Lazy initialization to allow fallback if missing)
try:
    import resend
    resend.api_key = os.environ.get('RESEND_API_KEY')
except ImportError:
    resend = None
    print("WARNING: resend library not found")

# --- Helpers ---

def generate_temp_password(length=10):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for i in range(length))
    # Ensure at least one of each required char type for Cognito
    password += "A1!" 
    return password

def create_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }

def send_welcome_email(email, temp_password):
    if not resend or not resend.api_key:
        print("RESEND_API_KEY non configurata o libreria mancante. Email non inviata.")
        return

    try:
        subject = "Benvenuto nel Corso PMU - Le tue credenziali"
        html_content = f"""
        <h1>Benvenuto!</h1>
        <p>Grazie per aver acquistato il Corso Completo PMU.</p>
        <p>Ecco le tue credenziali per accedere alla piattaforma:</p>
        <ul>
            <li><strong>Email:</strong> {email}</li>
            <li><strong>Password Temporanea:</strong> {temp_password}</li>
        </ul>
        <p>Ti verrà chiesto di cambiare la password al primo accesso.</p>
        <p><a href="https://tuo-sito.com/login">Accedi ora</a></p>
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

def handle_checkout_session(session):
    print("Handling checkout.session.completed")
    customer_email = session.get('customer_details', {}).get('email')
    payment_intent_id = session.get('payment_intent')
    
    if not customer_email or not payment_intent_id:
        print("Errore: Email o Payment Intent ID mancante nella sessione")
        return create_response(400, {'error': 'Dati mancanti'})

    # 1. Controlla se l'acquisto esiste già
    try:
        existing_purchase = purchases_table.get_item(Key={'purchase_id': payment_intent_id})
        if 'Item' in existing_purchase:
            print("Acquisto già processato.")
            return create_response(200, {'message': 'Acquisto già processato'})
    except Exception as e:
        print(f"Errore controllo acquisto: {e}")

    # 2. Logica di creazione/aggiornamento utente
    user_id = None
    temp_password = None
    
    try:
        # Controlla se l'utente esiste in Cognito
        try:
            user = cognito_client.admin_get_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=customer_email
            )
            # Estrai 'sub' (user_id) dagli attributi
            user_id = next(attr['Value'] for attr in user['UserAttributes'] if attr['Name'] == 'sub')
            print(f"Utente {customer_email} trovato. UserID: {user_id}")
            
        except cognito_client.exceptions.UserNotFoundException:
            # Crea l'utente se non esiste
            print(f"Utente {customer_email} non trovato. Creazione in corso...")
            
            # Generiamo noi la password temporanea per essere SICURI di averla
            temp_password = generate_temp_password()
            print("Password temporanea generata manualmente.")

            # Creiamo l'utente ma NON inviamo la mail di default di Cognito (SUPPRESS)
            new_user = cognito_client.admin_create_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=customer_email,
                TemporaryPassword=temp_password,
                UserAttributes=[
                    {'Name': 'email', 'Value': customer_email},
                    {'Name': 'custom:subscription_status', 'Value': 'active'}
                ],
                DesiredDeliveryMediums=['EMAIL'],
                MessageAction='SUPPRESS' # Sopprimiamo l'email automatica
            )
            
            # Estrai 'sub' (user_id) dagli attributi del nuovo utente
            user_id = next(attr['Value'] for attr in new_user['User']['Attributes'] if attr['Name'] == 'sub')
            print(f"Utente creato. UserID: {user_id}")

            # Aggiungi utente al gruppo 'students'
            cognito_client.admin_add_user_to_group(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=customer_email,
                GroupName='students'
            )
            print("Utente aggiunto al gruppo 'students'")
            
            # Invia email con Resend
            if temp_password:
                send_welcome_email(customer_email, temp_password)

    except Exception as e:
        print(f"Errore durante la gestione utente Cognito: {e}")
        return create_response(500, {'error': f"Errore Cognito: {e}"})

    if not user_id:
        return create_response(500, {'error': 'Impossibile creare/trovare user_id'})

    # 3. Calcola la data di scadenza (es. 1 anno)
    purchase_date = datetime.utcnow()
    expiration_date = purchase_date + timedelta(days=365)
    
    # Formato ISO 8601
    purchase_date_iso = purchase_date.isoformat() + "Z"
    expiration_date_iso = expiration_date.isoformat() + "Z"

    # 4. Salva i dati utente nella nostra tabella Users
    try:
        users_table.put_item(
            Item={
                'user_id': user_id,
                'email': customer_email,
                'subscription_status': 'active',
                'sub_end_date': expiration_date_iso, # Attributo corretto da template.yaml
                'created_at': purchase_date_iso
            }
        )
        print("Tabella Users aggiornata.")
    except Exception as e:
        print(f"Errore salvataggio utente in DynamoDB: {e}")
        # Non fatale, continuiamo a salvare l'acquisto

    # 5. Salva l'acquisto nella tabella Purchases
    try:
        purchases_table.put_item(
            Item={
                'purchase_id': payment_intent_id,
                'user_id': user_id,
                'stripe_session_id': session.get('id'),
                'amount': session.get('amount_total', 0), # Questo è in centesimi
                'purchase_date': purchase_date_iso,
                'expiration_date': expiration_date_iso,
                'status': 'active',
                'customer_email': customer_email
            }
        )
        print("Tabella Purchases aggiornata.")
    except Exception as e:
        print(f"Errore salvataggio acquisto in DynamoDB: {e}")
        return create_response(500, {'error': f"Errore DB Purchase: {e}"})

    return create_response(200, {'message': 'Webhook processato con successo'})

# --- Handler Principale ---

def lambda_handler(event, context):
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    print(f"Richiesta: path={path}, method={http_method}")

    # Gestione OPTIONS pre-flight
    if http_method == 'OPTIONS':
        return create_response(200, {})

    # Creazione sessione di Checkout
    if path == '/payment/create-checkout' and http_method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
            
            # Prezzo fisso sul backend (99.99 EUR)
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'eur',
                        'product_data': {
                            'name': 'Corso Completo PMU',
                        },
                        'unit_amount': 9999, # 99.99 EUR in centesimi
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=body.get('success_url'),
                cancel_url=body.get('cancel_url'),
                # Passiamo l'email per pre-compilare
                customer_email=body.get('email') 
            )
            
            return create_response(200, {'session_id': session.id, 'checkout_url': session.url})
        except Exception as e:
            print(f"Errore create-checkout: {e}")
            return create_response(500, {'error': str(e)})

    # Webhook da Stripe
    elif path == '/payment/webhook' and http_method == 'POST':
        raw_body = event.get('body')
        stripe_signature = event.get('headers', {}).get('Stripe-Signature')

        if not raw_body or not stripe_signature:
            return create_response(400, {'error': 'Header o body mancante'})

        try:
            event_data = stripe.Webhook.construct_event(
                payload=raw_body, sig_header=stripe_signature, secret=webhook_secret
            )
        except ValueError as e:
            return create_response(400, {'error': f"Payload non valido: {e}"})
        except stripe.error.SignatureVerificationError as e:
            return create_response(400, {'error': f"Firma non valida: {e}"})
        except Exception as e:
            return create_response(500, {'error': f"Errore webhook: {e}"})

        # Gestisci l'evento
        if event_data['type'] == 'checkout.session.completed':
            session = event_data['data']['object']
            return handle_checkout_session(session)
        else:
            print(f"Evento non gestito: {event_data['type']}")

        return create_response(200, {'received': True})

    return create_response(404, {'error': 'Not found'})