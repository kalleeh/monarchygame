# AWS Amplify Deployment Guide - Monarchy Game

## Overview
Deploy Monarchy Game to AWS Amplify in eu-west-1 with:
- Custom domain: monarchy.gurum.se
- ACM certificate (auto-provisioned)
- CodeCommit repository integration
- Route53 DNS configuration

## Current AWS Resources
- ✅ Route53 Hosted Zone: gurum.se (Z04995533PL60A6CSTZ2O)
- ❌ CodeCommit Repository: Not created yet
- ❌ Amplify App: Not created yet

---

## Step 1: Create CodeCommit Repository

### Option A: Using AWS CLI
```bash
# Create CodeCommit repository
aws codecommit create-repository \
  --repository-name monarchygame \
  --repository-description "Monarchy Game - Modern Strategy Game" \
  --region eu-west-1

# Get repository clone URL
aws codecommit get-repository \
  --repository-name monarchygame \
  --region eu-west-1 \
  --query 'repositoryMetadata.cloneUrlHttp' \
  --output text
```

### Option B: Using AWS Console
1. Go to: https://eu-west-1.console.aws.amazon.com/codesuite/codecommit/repositories
2. Click "Create repository"
3. Name: `monarchygame`
4. Description: "Monarchy Game - Modern Strategy Game"
5. Click "Create"

---

## Step 2: Configure Git Credentials for CodeCommit

### Generate HTTPS Git Credentials
```bash
# Option 1: IAM User credentials (recommended)
# Go to IAM Console → Users → Your User → Security Credentials
# Generate HTTPS Git credentials for AWS CodeCommit

# Option 2: Use git-remote-codecommit (easier)
pip install git-remote-codecommit

# Configure git to use CodeCommit
git config --global credential.helper '!aws codecommit credential-helper $@'
git config --global credential.UseHttpPath true
```

---

## Step 3: Push Code to CodeCommit

```bash
# Add CodeCommit as remote
git remote add codecommit https://git-codecommit.eu-west-1.amazonaws.com/v1/repos/monarchygame

# Or with git-remote-codecommit:
git remote add codecommit codecommit://monarchygame

# Push to CodeCommit
git push codecommit main

# Verify
git remote -v
```

---

## Step 4: Create Amplify App

### Using AWS CLI
```bash
# Create Amplify app connected to CodeCommit
aws amplify create-app \
  --name "Monarchy Game" \
  --description "Modern Strategy Game - Production" \
  --repository "https://git-codecommit.eu-west-1.amazonaws.com/v1/repos/monarchygame" \
  --platform WEB \
  --iam-service-role-arn "arn:aws:iam::YOUR_ACCOUNT_ID:role/amplifyconsole-backend-role" \
  --region eu-west-1

# Note: You may need to create the IAM role first (see Step 5)
```

### Using AWS Console (Recommended for First Time)
1. Go to: https://eu-west-1.console.aws.amazon.com/amplify/home
2. Click "New app" → "Host web app"
3. Select "AWS CodeCommit"
4. Choose repository: `monarchygame`
5. Choose branch: `main`
6. App name: "Monarchy Game"
7. Click "Next"

---

## Step 5: Configure Build Settings

Amplify will auto-detect your `amplify.yml`. Verify it contains:

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci --cache .npm --prefer-offline
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
      - frontend/.npm/**/*
```

**Environment Variables to Set:**
- `VITE_AWS_REGION`: `eu-west-1`
- Any other production-specific configs

---

## Step 6: Add Custom Domain (monarchy.gurum.se)

### Using AWS Console (Easiest)
1. In Amplify Console → Your App → "Domain management"
2. Click "Add domain"
3. Select domain: `gurum.se` (auto-detected from Route53)
4. Add subdomain: `monarchy`
5. Click "Configure domain"

**Amplify will automatically:**
- Create ACM certificate for monarchy.gurum.se
- Add DNS validation records to Route53
- Configure HTTPS redirect
- Set up CDN distribution

### Using AWS CLI
```bash
# Get your Amplify app ID first
APP_ID=$(aws amplify list-apps --region eu-west-1 --query 'apps[0].appId' --output text)

# Add custom domain
aws amplify create-domain-association \
  --app-id $APP_ID \
  --domain-name gurum.se \
  --sub-domain-settings '[
    {
      "prefix": "monarchy",
      "branchName": "main"
    }
  ]' \
  --region eu-west-1
```

---

## Step 7: Verify DNS Configuration

After Amplify creates the domain association, verify Route53 records:

```bash
# Check DNS records
aws route53 list-resource-record-sets \
  --hosted-zone-id Z04995533PL60A6CSTZ2O \
  --query "ResourceRecordSets[?contains(Name, 'monarchy')]" \
  --region eu-west-1
```

**Expected records:**
- `monarchy.gurum.se` → CNAME to Amplify CloudFront distribution
- `_<validation>.monarchy.gurum.se` → CNAME for ACM validation

---

## Step 8: Monitor Deployment

### Check Build Status
```bash
# List builds
aws amplify list-jobs \
  --app-id $APP_ID \
  --branch-name main \
  --region eu-west-1

# Get specific build details
aws amplify get-job \
  --app-id $APP_ID \
  --branch-name main \
  --job-id <JOB_ID> \
  --region eu-west-1
```

### Check Domain Status
```bash
# Check domain association status
aws amplify get-domain-association \
  --app-id $APP_ID \
  --domain-name gurum.se \
  --region eu-west-1
```

**Domain Status Progression:**
1. `CREATING` - Setting up domain
2. `PENDING_VERIFICATION` - Waiting for DNS propagation
3. `PENDING_DEPLOYMENT` - Deploying to CloudFront
4. `AVAILABLE` - Ready to use ✅

---

## Step 9: SSL Certificate Verification

ACM certificate is automatically provisioned. Check status:

```bash
# List ACM certificates
aws acm list-certificates \
  --region us-east-1 \
  --query "CertificateSummaryList[?contains(DomainName, 'monarchy.gurum.se')]"

# Note: CloudFront certificates must be in us-east-1
```

**Certificate validation is automatic** via Route53 DNS validation.

---

## Step 10: Configure Production Environment

### Set Environment Variables in Amplify Console
1. Go to: App Settings → Environment variables
2. Add:
   - `VITE_AWS_REGION`: `eu-west-1`
   - `NODE_ENV`: `production`
   - Any API keys or secrets

### Configure Branch Settings
1. Go to: App Settings → Branch settings
2. Enable:
   - ✅ Automatic builds on push
   - ✅ Pull request previews
   - ✅ Performance mode (if needed)

---

## Deployment Workflow

### Automatic Deployment
```bash
# Make changes
git add .
git commit -m "feat: add new feature"

# Push to CodeCommit
git push codecommit main

# Amplify automatically:
# 1. Detects push
# 2. Runs backend build (ampx pipeline-deploy)
# 3. Runs frontend build (npm run build)
# 4. Deploys to CloudFront
# 5. Updates monarchy.gurum.se
```

### Manual Deployment
```bash
# Trigger manual build
aws amplify start-job \
  --app-id $APP_ID \
  --branch-name main \
  --job-type RELEASE \
  --region eu-west-1
```

---

## Verification Checklist

After deployment completes:

- [ ] **Build Status**: Check Amplify Console shows "Deployed"
- [ ] **Domain Status**: `AVAILABLE` in domain association
- [ ] **SSL Certificate**: Valid and trusted (check browser)
- [ ] **DNS Resolution**: `nslookup monarchy.gurum.se` returns CloudFront
- [ ] **HTTPS Redirect**: http:// redirects to https://
- [ ] **Application Loads**: Visit https://monarchy.gurum.se
- [ ] **Backend Connected**: Test authentication and API calls
- [ ] **CloudWatch Logs**: Check for errors in Lambda functions

---

## Troubleshooting

### Build Fails
```bash
# Check build logs
aws amplify get-job \
  --app-id $APP_ID \
  --branch-name main \
  --job-id <JOB_ID> \
  --region eu-west-1 \
  --query 'job.steps[*].[stepName,status,logUrl]'
```

### Domain Not Resolving
```bash
# Check DNS propagation
dig monarchy.gurum.se

# Check Route53 records
aws route53 list-resource-record-sets \
  --hosted-zone-id Z04995533PL60A6CSTZ2O \
  --query "ResourceRecordSets[?contains(Name, 'monarchy')]"
```

### SSL Certificate Issues
- Wait 5-10 minutes for DNS validation
- Check Route53 has validation CNAME records
- Verify domain ownership in ACM console

---

## Cost Estimation

**Monthly costs for moderate traffic (1000 users):**
- Amplify Hosting: ~$15-30/month
- CloudFront: ~$5-10/month
- Route53: $0.50/month (hosted zone)
- ACM Certificate: FREE
- CodeCommit: FREE (5 users, 50GB storage)
- Lambda/DynamoDB: Variable based on usage

**Total estimated: $20-50/month**

---

## Next Steps

1. ✅ Create CodeCommit repository
2. ✅ Push code to CodeCommit
3. ✅ Create Amplify app
4. ✅ Configure build settings
5. ✅ Add custom domain
6. ✅ Verify SSL certificate
7. ✅ Test production deployment
8. 📊 Set up CloudWatch monitoring
9. 🔔 Configure deployment notifications
10. 📈 Enable performance monitoring

---

## Useful Commands Reference

```bash
# Get Amplify app details
aws amplify get-app --app-id $APP_ID --region eu-west-1

# List all branches
aws amplify list-branches --app-id $APP_ID --region eu-west-1

# Get branch details
aws amplify get-branch --app-id $APP_ID --branch-name main --region eu-west-1

# Delete domain association (if needed)
aws amplify delete-domain-association \
  --app-id $APP_ID \
  --domain-name gurum.se \
  --region eu-west-1

# Update environment variables
aws amplify update-app \
  --app-id $APP_ID \
  --environment-variables VITE_AWS_REGION=eu-west-1 \
  --region eu-west-1
```

---

**Last Updated:** 2025-12-07  
**Region:** eu-west-1  
**Domain:** monarchy.gurum.se  
**Repository:** CodeCommit (monarchygame)
