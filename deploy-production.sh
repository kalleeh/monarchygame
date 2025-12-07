#!/bin/bash
set -e

echo "🚀 Deploying Monarchy Game to Production"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="monarchy.gurum.se"
HOSTED_ZONE_ID="Z04995533PL60A6CSTZ2O"
REGION="eu-west-1"
REPO_URL="https://github.com/kalleeh/monarchygame"

echo -e "${BLUE}Step 1: Creating Amplify App${NC}"
APP_ID=$(aws amplify create-app \
  --name "monarchy-game" \
  --repository "$REPO_URL" \
  --platform WEB_COMPUTE \
  --region $REGION \
  --query 'app.appId' \
  --output text 2>/dev/null || aws amplify list-apps --region $REGION --query "apps[?name=='monarchy-game'].appId" --output text)

echo "✅ App ID: $APP_ID"

echo -e "${BLUE}Step 2: Creating main branch${NC}"
aws amplify create-branch \
  --app-id $APP_ID \
  --branch-name main \
  --region $REGION \
  --enable-auto-build \
  2>/dev/null || echo "Branch already exists"

echo -e "${BLUE}Step 3: Starting deployment${NC}"
JOB_ID=$(aws amplify start-job \
  --app-id $APP_ID \
  --branch-name main \
  --job-type RELEASE \
  --region $REGION \
  --query 'jobSummary.jobId' \
  --output text)

echo "✅ Deployment started: $JOB_ID"
echo "Waiting for deployment to complete..."

# Wait for deployment
while true; do
  STATUS=$(aws amplify get-job \
    --app-id $APP_ID \
    --branch-name main \
    --job-id $JOB_ID \
    --region $REGION \
    --query 'job.summary.status' \
    --output text)
  
  if [ "$STATUS" = "SUCCEED" ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    break
  elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CANCELLED" ]; then
    echo "❌ Deployment failed with status: $STATUS"
    exit 1
  fi
  
  echo "Status: $STATUS - waiting..."
  sleep 10
done

echo -e "${BLUE}Step 4: Adding custom domain${NC}"
aws amplify create-domain-association \
  --app-id $APP_ID \
  --domain-name "gurum.se" \
  --sub-domain-settings "prefix=monarchy,branchName=main" \
  --region $REGION \
  2>/dev/null || echo "Domain already configured"

echo -e "${GREEN}✅ Custom domain configured: https://$DOMAIN${NC}"
echo ""
echo "🎉 Deployment Complete!"
echo "========================"
echo "App URL: https://$DOMAIN"
echo "Amplify Console: https://console.aws.amazon.com/amplify/home?region=$REGION#/$APP_ID"
echo ""
echo "Note: DNS propagation may take 5-10 minutes"
echo "SSL certificate will be automatically provisioned by AWS"
