#!/bin/bash
set -e

REGION="eu-west-1"

echo "🧹 Cleaning up Amplify sandbox stacks in $REGION"
echo "================================================"

# Get all sandbox stacks
STACKS=$(aws cloudformation list-stacks \
  --region $REGION \
  --query "StackSummaries[?contains(StackName, 'amplify-monarchygame') && contains(StackName, 'sandbox') && StackStatus != 'DELETE_COMPLETE' && StackStatus != 'DELETE_IN_PROGRESS'].StackName" \
  --output text)

if [ -z "$STACKS" ]; then
  echo "✅ No sandbox stacks to clean up"
  exit 0
fi

echo "Found stacks to delete:"
echo "$STACKS"
echo ""

# Delete parent stacks (nested stacks will be deleted automatically)
for stack in $STACKS; do
  # Only delete parent stacks (not nested)
  if [[ ! $stack =~ "Nested" ]]; then
    echo "Deleting: $stack"
    aws cloudformation delete-stack --stack-name "$stack" --region $REGION
  fi
done

echo ""
echo "✅ Deletion initiated. This will take ~5-10 minutes."
echo "Monitor progress:"
echo "aws cloudformation list-stacks --region $REGION --query \"StackSummaries[?contains(StackName, 'amplify-monarchygame')].{Name:StackName, Status:StackStatus}\" --output table"
