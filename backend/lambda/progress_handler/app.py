import json

def lambda_handler(event, context):
    """
    Handle student progress operations
    """
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    if path == '/progress/update' and http_method == 'POST':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'data': {
                    'progress_id': 'prog_123',
                    'user_id': 'user_123',
                    'lesson_id': 'lesson_123',
                    'watched_seconds': 60,
                    'total_seconds': 300,
                    'completed': False,
                    'last_watched': '2024-01-01T12:00:00Z'
                }
            })
        }
    elif path == '/progress/user' and http_method == 'GET':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'total_lessons': 0,
                'completed_lessons': 0,
                'percentage': 0,
                'chapters': [],
                'lesson_progress': {},
                'total_watch_time': 0
            })
        }
    elif path.startswith('/progress/lesson/') and http_method == 'GET':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'progress_id': 'prog_123',
                'user_id': 'user_123',
                'lesson_id': 'lesson_123',
                'watched_seconds': 0,
                'total_seconds': 300,
                'completed': False,
                'last_watched': '2024-01-01T12:00:00Z'
            })
        }
    elif path == '/user/subscription' and http_method == 'GET':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'is_active': True,
                'days_remaining': 365,
                'purchase': {
                    'purchase_id': 'purchase_123',
                    'expiration_date': '2025-01-01T00:00:00Z',
                    'status': 'active'
                },
                'course': {
                    'course_id': 'course_001',
                    'title': 'VideoCorso Completo'
                }
            })
        }

    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Not found'})
    }
