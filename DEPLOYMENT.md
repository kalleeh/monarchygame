# Monarchy Game - Production Deployment Guide

## Prerequisites
- AWS Account with Amplify access
- GitHub repository: https://github.com/kalleeh/monarchygame
- Domain: gurum.se (Route53 hosted zone)
- Target subdomain: monarchy.gurum.se

## Step 1: Create Amplify App via Console

Since Amplify Gen 2 requires GitHub OAuth, use the AWS Console:

1. Go to AWS Amplify Console: https://eu-west-1.console.aws.amazon.com/amplify/home?region=eu-west-1
2. Click "Create new app"
3. Select "GitHub" as source
4. Authorize AWS Amplify to access your GitHub account
5. Select repository: `kalleeh/monarchygame`
6. Select branch: `main`
7. App name: `monarchygame`
8. Build settings: Use the `amplify.yml` file in the repository
9. Click "Save and deploy"

## Step 2: Configure Custom Domain

After the app is created:

1. In Amplify Console, go to "Domain management"
2. Click "Add domain"
3. Select "gurum.se" from your Route53 hosted zones
4. Add subdomain: `monarchy`
5. Amplify will automatically:
   - Create SSL certificate via ACM
   - Add CNAME records to Route53
   - Configure CDN distribution

## Step 3: Environment Variables

In Amplify Console > App settings > Environment variables, add:

```
VITE_AWS_REGION=eu-west-1
```

## Step 4: Build Settings

Verify `amplify.yml` is configured correctly:
- Backend: Amplify Gen 2 pipeline deployment
- Frontend: Vite build from `frontend/` directory
- Artifacts: `frontend/dist`

## Step 5: Deploy

### Automatic Deployment
Push to main branch triggers automatic deployment:
```bash
git add .
git commit -m "Production deployment"
git push origin main
```

### Manual Deployment
In Amplify Console, click "Redeploy this version"

## Step 6: Verify Deployment

1. Check build logs in Amplify Console
2. Verify backend resources deployed
3. Test application at: https://monarchy.gurum.se
4. Verify SSL certificate is active
5. Test all game features

## Step 7: Monitoring

- CloudWatch Logs: Monitor Lambda functions
- Amplify Console: Build and deployment logs
- Route53: DNS query metrics
- CloudFront: CDN performance metrics

## Rollback Procedure

If deployment fails:
1. In Amplify Console, go to "Deployments"
2. Find last successful deployment
3. Click "Redeploy this version"

## Custom Domain DNS Records

Amplify automatically creates:
```
monarchy.gurum.se CNAME -> [amplify-domain].cloudfront.net
```

## SSL Certificate

- Automatically provisioned via AWS Certificate Manager
- Validates via DNS (automatic with Route53)
- Renewal: Automatic

## Cost Estimate

- Amplify Hosting: ~$0.01/GB served + $0.01/build minute
- CloudFront: ~$0.085/GB (first 10TB)
- Route53: $0.50/hosted zone/month
- Lambda: Free tier covers development usage
- Aurora Serverless v2: ~$0.12/ACU-hour (scales to zero)

## Troubleshooting

### Build Fails
- Check `amplify.yml` syntax
- Verify Node.js version compatibility
- Check environment variables

### Domain Not Working
- Verify Route53 hosted zone exists
- Check DNS propagation (can take up to 48 hours)
- Verify SSL certificate status in ACM

### Backend Not Deployed
- Check Amplify service role permissions
- Verify `amplify/backend.ts` configuration
- Check CloudFormation stack status

## Support

- AWS Amplify Documentation: https://docs.amplify.aws/
- GitHub Issues: https://github.com/kalleeh/monarchygame/issues
