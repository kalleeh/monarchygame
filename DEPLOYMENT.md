# Production Deployment Guide

## Prerequisites
- AWS Account with admin access
- GitHub repository: https://github.com/kalleeh/monarchygame
- Route53 hosted zone: gurum.se (ID: Z04995533PL60A6CSTZ2O)

## Deployment Steps

### 1. Create Amplify App (AWS Console)

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/home?region=eu-west-1)
2. Click **"New app"** → **"Host web app"**
3. Select **GitHub** as the repository service
4. Authorize AWS Amplify to access your GitHub account
5. Select repository: **kalleeh/monarchygame**
6. Select branch: **main**
7. Click **Next**

### 2. Configure Build Settings

The `amplify.yml` file is already in the repository. Verify it shows:

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
```

Click **Next**

### 3. Review and Deploy

1. Review settings
2. Click **Save and deploy**
3. Wait for deployment to complete (~5-10 minutes)

### 4. Add Custom Domain

1. In Amplify Console, go to **App settings** → **Domain management**
2. Click **Add domain**
3. Select **gurum.se** from the dropdown (it should auto-detect your Route53 zone)
4. Add subdomain: **monarchy**
5. Click **Configure domain**
6. Amplify will automatically:
   - Create SSL certificate via AWS Certificate Manager (ACM)
   - Add CNAME records to Route53
   - Configure HTTPS redirect

### 5. Wait for SSL Certificate

- Certificate validation: ~5 minutes
- DNS propagation: ~5-10 minutes
- Total time: ~15 minutes

### 6. Verify Deployment

Once complete, your app will be available at:
- **Production URL**: https://monarchy.gurum.se
- **Amplify URL**: https://main.[app-id].amplifyapp.com

## Environment Variables (Optional)

If you need to add environment variables:

1. Go to **App settings** → **Environment variables**
2. Add variables:
   - `VITE_AWS_REGION`: eu-west-1
   - Any other environment-specific configs

## Automatic Deployments

Every push to `main` branch will trigger automatic deployment:
1. Push code to GitHub
2. Amplify detects changes
3. Runs build automatically
4. Deploys to production

## Monitoring

- **Build logs**: Amplify Console → App → Branch → Build history
- **CloudWatch**: Automatic logging enabled
- **Metrics**: Available in Amplify Console

## Rollback

To rollback to a previous version:
1. Go to Amplify Console
2. Select the app
3. Click on a previous successful build
4. Click **Redeploy this version**

## Custom Domain Status

Check domain status:
```bash
aws amplify get-domain-association \
  --app-id [YOUR_APP_ID] \
  --domain-name gurum.se \
  --region eu-west-1
```

## Troubleshooting

### Build Fails
- Check build logs in Amplify Console
- Verify `amplify.yml` is correct
- Ensure all dependencies are in `package.json`

### Domain Not Working
- Wait 15 minutes for DNS propagation
- Check Route53 records were created
- Verify SSL certificate status in ACM

### SSL Certificate Issues
- Amplify handles this automatically
- If stuck, delete domain and re-add it
- Certificate validation requires DNS records

## Cost Estimate

- **Amplify Hosting**: ~$0.01/GB served + $0.01/build minute
- **Route53**: $0.50/month for hosted zone
- **ACM Certificate**: Free
- **Estimated monthly**: $5-20 depending on traffic

## Next Steps

After deployment:
1. Test all features on production
2. Set up monitoring alerts
3. Configure backup strategy
4. Document API endpoints
5. Create user documentation
