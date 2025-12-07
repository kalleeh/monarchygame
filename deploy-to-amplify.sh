#!/bin/bash
set -e

# Monarchy Game - AWS Amplify Deployment Script
# Region: eu-west-1
# Domain: monarchy.gurum.se

REGION="eu-west-1"
REPO_NAME="monarchygame"
APP_NAME="Monarchy Game"
DOMAIN="gurum.se"
SUBDOMAIN="monarchy"
HOSTED_ZONE_ID="Z04995533PL60A6CSTZ2O"

echo "🚀 Monarchy Game - AWS Amplify Deployment"
echo "=========================================="
echo ""

# Step 1: Create CodeCommit Repository
echo "📦 Step 1: Creating CodeCommit repository..."
if aws codecommit get-repository --repository-name $REPO_NAME --region $REGION &>/dev/null; then
    echo "✅ Repository already exists"
    CLONE_URL=$(aws codecommit get-repository --repository-name $REPO_NAME --region $REGION --query 'repositoryMetadata.cloneUrlHttp' --output text)
else
    aws codecommit create-repository \
        --repository-name $REPO_NAME \
        --repository-description "Monarchy Game - Modern Strategy Game" \
        --region $REGION
    echo "✅ Repository created"
    CLONE_URL=$(aws codecommit get-repository --repository-name $REPO_NAME --region $REGION --query 'repositoryMetadata.cloneUrlHttp' --output text)
fi

echo "   Clone URL: $CLONE_URL"
echo ""

# Step 2: Configure Git Remote
echo "🔗 Step 2: Configuring Git remote..."
if git remote get-url codecommit &>/dev/null; then
    echo "✅ CodeCommit remote already configured"
else
    git remote add codecommit $CLONE_URL
    echo "✅ CodeCommit remote added"
fi
echo ""

# Step 3: Push to CodeCommit
echo "📤 Step 3: Pushing code to CodeCommit..."
read -p "Push code to CodeCommit? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push codecommit main
    echo "✅ Code pushed to CodeCommit"
else
    echo "⏭️  Skipped code push"
fi
echo ""

# Step 4: Create Amplify App (Manual step - requires console)
echo "🌐 Step 4: Create Amplify App"
echo "   ⚠️  This step requires AWS Console (first time only)"
echo ""
echo "   1. Go to: https://eu-west-1.console.aws.amazon.com/amplify/home"
echo "   2. Click 'New app' → 'Host web app'"
echo "   3. Select 'AWS CodeCommit'"
echo "   4. Choose repository: $REPO_NAME"
echo "   5. Choose branch: main"
echo "   6. App name: $APP_NAME"
echo "   7. Verify amplify.yml is detected"
echo "   8. Click 'Save and deploy'"
echo ""
read -p "Press Enter after creating Amplify app in console..."
echo ""

# Step 5: Get Amplify App ID
echo "🔍 Step 5: Getting Amplify App ID..."
APP_ID=$(aws amplify list-apps --region $REGION --query "apps[?name=='$APP_NAME'].appId" --output text)

if [ -z "$APP_ID" ]; then
    echo "❌ Amplify app not found. Please create it in the console first."
    exit 1
fi

echo "✅ App ID: $APP_ID"
echo ""

# Step 6: Add Custom Domain
echo "🌍 Step 6: Adding custom domain..."
if aws amplify get-domain-association --app-id $APP_ID --domain-name $DOMAIN --region $REGION &>/dev/null; then
    echo "✅ Domain already configured"
else
    aws amplify create-domain-association \
        --app-id $APP_ID \
        --domain-name $DOMAIN \
        --sub-domain-settings "[{\"prefix\":\"$SUBDOMAIN\",\"branchName\":\"main\"}]" \
        --region $REGION
    echo "✅ Domain association created"
fi
echo ""

# Step 7: Check Domain Status
echo "📊 Step 7: Checking domain status..."
DOMAIN_STATUS=$(aws amplify get-domain-association \
    --app-id $APP_ID \
    --domain-name $DOMAIN \
    --region $REGION \
    --query 'domainAssociation.domainStatus' \
    --output text)

echo "   Status: $DOMAIN_STATUS"
echo ""

if [ "$DOMAIN_STATUS" != "AVAILABLE" ]; then
    echo "⏳ Domain is being configured. This may take 5-15 minutes."
    echo "   You can monitor progress in the Amplify Console:"
    echo "   https://eu-west-1.console.aws.amazon.com/amplify/home?region=eu-west-1#/$APP_ID"
fi
echo ""

# Step 8: Summary
echo "✅ Deployment Configuration Complete!"
echo "======================================"
echo ""
echo "📋 Summary:"
echo "   Region:        $REGION"
echo "   Repository:    $REPO_NAME"
echo "   App ID:        $APP_ID"
echo "   Domain:        https://$SUBDOMAIN.$DOMAIN"
echo "   Console:       https://eu-west-1.console.aws.amazon.com/amplify/home?region=eu-west-1#/$APP_ID"
echo ""
echo "🔄 Next Steps:"
echo "   1. Wait for initial build to complete (~5-10 minutes)"
echo "   2. Wait for domain SSL certificate (~5-15 minutes)"
echo "   3. Visit https://$SUBDOMAIN.$DOMAIN"
echo "   4. Configure environment variables in Amplify Console"
echo ""
echo "📚 Full documentation: AMPLIFY-DEPLOYMENT-GUIDE.md"
echo ""
