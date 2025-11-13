import json

def lambda_handler(event, context):
    """
    Handle course operations
    """
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    if path == '/course/structure' and http_method == 'GET':
        # Return dummy course structure
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'course': {
                    'course_id': 'course_001',
                    'title': 'VideoCorso Completo',
                    'description': 'Un corso completo',
                    'price': 9999,
                    'created_at': '2024-01-01T00:00:00Z',
                    'updated_at': '2024-01-01T00:00:00Z',
                    'is_active': True
                },
                'chapters': []
            })
        }
    elif path == '/course/previews' and http_method == 'GET':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps([])
        }

    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Not found'})
    }
