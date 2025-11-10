import json
import os
import boto3
import stripe
from datetime import datetime, timedelta
from decimal import Decimal

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
cognito = boto3.client('cognito-idp')
ses = boto3.client('ses')

# Initialize Stripe
stripe.api_key = os.environ['STRIPE_SECRET_KEY']

purchases_table = dynamodb.Table(os.environ['PURCHASES_TABLE'])
users_table = dynamodb.Table(os.environ['USERS_TABLE'])

def lambda_handler(event, context):
    """
    Handle Stripe payment operations
    """
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    if path == '/payment/create-checkout' and http_method == 'POST':
        return create_checkout_session(event)
    elif path == '/payment/webhook' and http_method == 'POST':
        return handle_webhook(event)

    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Not found'})
    }

def create_checkout_session(event):
    """
    Create Stripe checkout session
    """
    try:
        body = json.loads(event['body'])
        course_id = body['course_id']
        success_url = body['success_url']
        cancel_url = body['cancel_url']

        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': 'Video Corso Completo',
                        'description': 'Full access to the video course',
                    },
                    'unit_amount': 9999,  # €99.99 in cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'course_id': course_id,
            }
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'session_id': session.id,
                'checkout_url': session.url
            })
        }
    except Exception as e:
        print(f"Error creating checkout session: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def handle_webhook(event):
    """
    Handle Stripe webhook events
    """
    try:
        payload = event['body']
        sig_header = event['headers'].get('Stripe-Signature')

        webhook_secret = os.environ['STRIPE_WEBHOOK_SECRET']

        # Verify webhook signature
        stripe_event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )

        if stripe_event['type'] == 'checkout.session.completed':
            session = stripe_event['data']['object']

            # Process successful payment
            process_successful_payment(session)

        return {
            'statusCode': 200,
            'body': json.dumps({'received': True})
        }
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }

def process_successful_payment(session):
    """
    Process successful payment: create user, save purchase, send email
    """
    try:
        customer_email = session['customer_details']['email']
        customer_name = session['customer_details']['name']
        course_id = session['metadata']['course_id']

        # Create Cognito user
        temp_password = generate_temp_password()

        user_response = cognito.admin_create_user(
            UserPoolId=os.environ['COGNITO_USER_POOL_ID'],
            Username=customer_email,
            UserAttributes=[
                {'Name': 'email', 'Value': customer_email},
                {'Name': 'email_verified', 'Value': 'true'},
                {'Name': 'custom:full_name', 'Value': customer_name},
                {'Name': 'custom:subscription_status', 'Value': 'active'},
                {'Name': 'custom:subscription_end_date', 'Value': (datetime.now() + timedelta(days=365)).isoformat()},
            ],
            TemporaryPassword=temp_password,
            MessageAction='SUPPRESS'
        )

        user_id = user_response['User']['Username']

        # Add user to students group
        cognito.admin_add_user_to_group(
            UserPoolId=os.environ['COGNITO_USER_POOL_ID'],
            Username=customer_email,
            GroupName='students'
        )

        # Save purchase to DynamoDB
        purchase_id = f"purchase_{int(datetime.now().timestamp())}"
        expiration_date = datetime.now() + timedelta(days=365)

        purchases_table.put_item(
            Item={
                'purchase_id': purchase_id,
                'user_id': user_id,
                'course_id': course_id,
                'payment_id': session['payment_intent'],
                'stripe_session_id': session['id'],
                'amount': Decimal(str(session['amount_total'])),
                'purchase_date': datetime.now().isoformat(),
                'expiration_date': expiration_date.isoformat(),
                'status': 'active'
            }
        )

        # Save user to users table
        users_table.put_item(
            Item={
                'user_id': user_id,
                'email': customer_email,
                'full_name': customer_name,
                'subscription_status': 'active',
                'subscription_end_date': expiration_date.isoformat(),
                'total_watch_time': Decimal('0'),
                'last_login': datetime.now().isoformat()
            }
        )

        # Send welcome email with credentials
        send_welcome_email(customer_email, customer_name, temp_password)

        print(f"Successfully processed payment for {customer_email}")

    except Exception as e:
        print(f"Error processing payment: {str(e)}")
        raise

def generate_temp_password():
    """
    Generate a temporary password
    """
    import secrets
    import string

    alphabet = string.ascii_letters + string.digits + "!@#$%"
    password = ''.join(secrets.choice(alphabet) for i in range(12))
    return password

def send_welcome_email(email, name, temp_password):
    """
    Send welcome email with login credentials
    """
    try:
        ses.send_email(
            Source='noreply@videocorso.com',  # Update with your verified email
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {
                    'Data': 'Welcome to VideoCorso - Your Login Credentials'
                },
                'Body': {
                    'Html': {
                        'Data': f"""
                        <h1>Welcome to VideoCorso, {name}!</h1>
                        <p>Thank you for your purchase. Here are your login credentials:</p>
                        <p><strong>Email:</strong> {email}</p>
                        <p><strong>Temporary Password:</strong> {temp_password}</p>
                        <p>Please log in and change your password immediately.</p>
                        <p><a href="https://videocorso.com/login">Login Now</a></p>
                        """
                    }
                }
            }
        )
    except Exception as e:
        print(f"Error sending email: {str(e)}")
