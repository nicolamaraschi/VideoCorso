import os
import boto3
from typing import Optional, List

ses_client = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

DEFAULT_SENDER = os.environ.get(
    'SES_SENDER_EMAIL',
    'Chiara Morocutti Academy <noreply@chiaramorocuttiacademy.it>'
)
DEFAULT_REPLY_TO = os.environ.get('SES_REPLY_TO_EMAIL', 'info@chiaramorocuttiacademy.it')


def render_academy_email_html(
    title: str,
    subtitle: str,
    paragraphs: List[str],
    email: Optional[str] = None,
    temp_password: Optional[str] = None,
    cta_url: Optional[str] = None,
    cta_text: Optional[str] = None,
    note: Optional[str] = None,
) -> str:
    paragraphs_html = ''.join(
        f'<p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 12px;">{p}</p>'
        for p in paragraphs
    )

    credentials_html = ''
    if email or temp_password:
        email_row = f'<p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px;"><strong style="color: #111827;">Email / Username:</strong><br><span style="color: #4a0e2e; font-size: 15px; font-weight: 600;">{email}</span></p>' if email else ''
        pass_row = f'<p style="margin: 0; color: #4b5563; font-size: 14px;"><strong style="color: #111827;">Password temporanea:</strong></p><div style="font-family: monospace; font-size: 18px; font-weight: bold; color: #4a0e2e; background-color: #ffffff; padding: 12px 16px; border-radius: 8px; border: 1px dashed #d1a4b1; margin-top: 6px; letter-spacing: 1px; display: inline-block;">{temp_password}</div>' if temp_password else ''
        credentials_html = f'''
        <div style="background-color: #faf5f7; border: 1px solid #f3dce3; border-radius: 12px; padding: 20px; margin: 24px 0;">
            {email_row}
            {pass_row}
        </div>
        '''

    cta_html = ''
    if cta_url and cta_text:
        cta_html = f'''
        <div style="text-align: center; margin: 32px 0 24px 0;">
            <a href="{cta_url}" style="background-color: #4a0e2e; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(74, 14, 46, 0.25);">{cta_text}</a>
        </div>
        '''

    note_html = f'<p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">{note}</p>' if note else ''

    return f'''
    <div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #f0e6eb; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #4a0e2e; font-size: 24px; font-weight: bold; margin: 0;">Chiara Morocutti Academy</h1>
            <p style="color: #9c7178; font-size: 13px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">{subtitle}</p>
        </div>
        <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin-bottom: 16px;">{title}</h2>
        {paragraphs_html}
        {credentials_html}
        {note_html}
        {cta_html}
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center;">Chiara Morocutti Academy • Tutti i diritti riservati</p>
    </div>
    '''


def send_ses_email(
    to_address: str,
    subject: str,
    html_body: str,
    sender: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> bool:
    sender_email = sender or os.environ.get('SES_SENDER_EMAIL', DEFAULT_SENDER)
    reply_to_email = reply_to or os.environ.get('SES_REPLY_TO_EMAIL', DEFAULT_REPLY_TO)
    try:
        kwargs = {
            'Source': sender_email,
            'Destination': {
                'ToAddresses': [to_address],
            },
            'Message': {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'},
                },
            },
        }
        if reply_to_email:
            kwargs['ReplyToAddresses'] = [reply_to_email]
        response = ses_client.send_email(**kwargs)
        print(f"[SES EMAIL SUCCESS] Email '{subject}' sent to {to_address}. MessageId: {response.get('MessageId')}")
        return True
    except Exception as exc:
        print(f"[SES EMAIL ERROR] Failed to send email to {to_address}: {exc}")
        return False
