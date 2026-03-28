#!/bin/bash
TABLE_NAME="prod-videocorso-users"
EMAIL="nicola.maraschi01@gmail.com"
PROFILE="personale"

echo "Scanning for users with email: $EMAIL..."

# Fetch IDs using AWS CLI with --query and text output
# This returns IDs separated by tabs or newlines
IDS=$(aws dynamodb scan \
    --table-name $TABLE_NAME \
    --filter-expression "email = :e" \
    --expression-attribute-values '{":e":{"S":"'$EMAIL'"}}' \
    --query "Items[*].user_id.S" \
    --output text \
    --profile $PROFILE)

if [ -z "$IDS" ]; then
    echo "No users found looking for $EMAIL"
    exit 0
fi

echo "Found IDs: $IDS"
echo "Deleting..."

for id in $IDS; do
    echo "Deleting user_id: $id"
    aws dynamodb delete-item \
        --table-name $TABLE_NAME \
        --key '{"user_id": {"S": "'$id'"}}' \
        --profile $PROFILE
done

echo "Cleanup complete."
