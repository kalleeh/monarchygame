#!/bin/bash

REGION="eu-north-1"

echo "🧹 Force deleting stuck stacks in $REGION"
echo "=========================================="

# Get stack IDs for manual deletion
for stack in agie-dev-scheduler agie-dev-stacServer agie-dev-shared; do
  STACK_ID=$(aws cloudformation describe-stacks --stack-name $stack --region $REGION --query "Stacks[0].StackId" --output text 2>/dev/null)
  if [ ! -z "$STACK_ID" ]; then
    echo ""
    echo "Stack: $stack"
    echo "To delete via Console:"
    echo "https://eu-north-1.console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks/stackinfo?stackId=$(echo $STACK_ID | sed 's/\//%2F/g' | sed 's/:/%3A/g')"
    echo "Click 'Delete' and check 'Retain resources' for any that fail"
  fi
done

echo ""
echo "📝 Manual Steps:"
echo "1. Open each URL above"
echo "2. Click 'Delete' button"
echo "3. If deletion fails, retry with 'Retain resources' checked"
echo ""
echo "Or run this to delete all resources manually:"
echo "aws cloudformation delete-stack --stack-name agie-dev-scheduler --region $REGION --role-arn arn:aws:iam::789073296014:role/Admin || true"
echo "aws cloudformation delete-stack --stack-name agie-dev-stacServer --region $REGION --role-arn arn:aws:iam::789073296014:role/Admin || true"
echo "aws cloudformation delete-stack --stack-name agie-dev-shared --region $REGION --role-arn arn:aws:iam::789073296014:role/Admin || true"
