
import boto3
import sys

def cleanup_duplicates(email_to_clean):
    dynamodb = boto3.resource('dynamodb')
    table_name = 'prod-videocorso-users'
    table = dynamodb.Table(table_name)
    
    print(f"Scanning table {table_name} for email: {email_to_clean}...")
    
    # 1. Scan per trovare tutti gli utenti con quella email
    # Nota: Scan è costoso su tabelle grandi, ma qui abbiamo pochi dati.
    response = table.scan()
    items = response.get('Items', [])
    
    # Gestione paginazione se ci fossero molti item (non credo, ma buona pratica)
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))
        
    items_to_delete = []
    for item in items:
        if item.get('email') == email_to_clean:
            items_to_delete.append(item)
            
    print(f"Found {len(items_to_delete)} items to delete.")
    
    # 2. Cancellazione
    deleted_count = 0
    for item in items_to_delete:
        user_id = item['user_id']
        print(f"Deleting user_id: {user_id} (Purchase Date: {item.get('created_at', 'N/A')})")
        
        try:
            table.delete_item(Key={'user_id': user_id})
            deleted_count += 1
        except Exception as e:
            print(f"Error deleting {user_id}: {e}")
            
    print(f"Cleanup complete. Deleted {deleted_count} items.")

if __name__ == "__main__":
    email = "nicola.maraschi01@gmail.com"
    cleanup_duplicates(email)
