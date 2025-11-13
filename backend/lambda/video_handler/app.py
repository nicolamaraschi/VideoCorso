import json

def lambda_handler(event, context):
    """
    Handle video streaming operations
    """
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    if path.startswith('/course/video/') and http_method == 'GET':
        # Extract lesson_id from path
        lesson_id = path.split('/')[-1]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'video_url': 'https://example.com/video.mp4',
                'expires_at': '2024-12-31T23:59:59Z'
            })
        }

    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Not found'})
    }
