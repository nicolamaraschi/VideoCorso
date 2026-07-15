import os
import pytest
import requests
import boto3

def get_api_endpoint():
    # If provided via environment variable, use it directly
    if 'API_ENDPOINT' in os.environ:
        return os.environ['API_ENDPOINT'].rstrip('/')
        
    # Otherwise, fetch it from CloudFormation
    try:
        stack_name = os.environ.get('STACK_NAME', 'corso-video-chiara')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        client = boto3.client('cloudformation', region_name=region)
        response = client.describe_stacks(StackName=stack_name)
        outputs = response['Stacks'][0].get('Outputs', [])
        for output in outputs:
            if output['OutputKey'] == 'ApiEndpoint':
                return output['OutputValue'].rstrip('/')
    except Exception as e:
        pytest.fail(f"Could not determine API_ENDPOINT: {e}")
        
    pytest.fail("API_ENDPOINT not found in environment and could not be fetched from CloudFormation.")

@pytest.fixture(scope="module")
def api_base_url():
    return get_api_endpoint()

def test_get_courses(api_base_url):
    """Test that the public catalog endpoint returns 200 and a list of courses."""
    url = f"{api_base_url}/courses"
    response = requests.get(url, timeout=10)
    
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert 'items' in data, "Response should contain an 'items' array"
    assert isinstance(data['items'], list), "'items' should be a list"

def test_get_course_structure(api_base_url):
    """Test that we can fetch the structure of an existing course."""
    # First get a course from the catalog
    url = f"{api_base_url}/courses"
    response = requests.get(url, timeout=10)
    assert response.status_code == 200
    data = response.json()
    
    if not data.get('items'):
        pytest.skip("No courses found in the catalog to test structure.")
        
    course_id = data['items'][0].get('public_slug') or data['items'][0].get('course_id')
    
    # Now get its structure
    structure_url = f"{api_base_url}/course/structure?course_id={course_id}"
    struct_response = requests.get(structure_url, timeout=10)
    
    assert struct_response.status_code == 200, f"Expected 200 OK for structure of {course_id}, got {struct_response.status_code}"
    struct_data = struct_response.json()
    assert 'course' in struct_data, "Structure response should contain 'course'"
    assert 'chapters' in struct_data, "Structure response should contain 'chapters'"
