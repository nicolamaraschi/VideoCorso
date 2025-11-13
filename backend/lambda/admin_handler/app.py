import json

def lambda_handler(event, context):
    """
    Handle admin operations
    """
    path = event.get('path', '')
    http_method = event.get('httpMethod', '')

    # Default response
    response = {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'message': 'Admin handler operation'})
    }

    if path == '/admin/stats' and http_method == 'GET':
        response['body'] = json.dumps({
            'total_students': 0,
            'active_students': 0,
            'total_revenue': 0,
            'new_purchases_today': 0,
            'new_purchases_week': 0,
            'new_purchases_month': 0,
            'total_video_views': 0,
            'average_completion_rate': 0,
            'most_viewed_lessons': [],
            'recent_purchases': [],
            'daily_access_chart': []
        })
    elif path == '/admin/students' and http_method == 'GET':
        response['body'] = json.dumps({
            'items': [],
            'total': 0,
            'page': 1,
            'per_page': 20,
            'total_pages': 0
        })
    elif path == '/admin/video/upload' and http_method == 'POST':
        response['body'] = json.dumps({
            'upload_url': 'https://example.com/upload',
            'video_s3_key': 'videos/dummy.mp4',
            'expires_at': '2024-12-31T23:59:59Z'
        })

    return response
