# 🚀 Deploy Monarchy Game NOW

## Quick Start (5 minutes)

### Step 1: Prepare Repository
```bash
./deploy-simple.sh
```

### Step 2: Create Amplify App

**Go to:** https://eu-west-1.console.aws.amazon.com/amplify/home?region=eu-west-1

1. Click **"Create new app"**
2. Select **"GitHub"** → Authorize if needed
3. Repository: **kalleeh/monarchygame**
4. Branch: **main**
5. App name: **monarchygame**
6. Build settings: **Detected automatically** (uses amplify.yml)
7. Click **"Save and deploy"**

⏱️ Wait 5-10 minutes for first deployment

### Step 3: Add Custom Domain

In Amplify Console:

1. Go to **"Domain management"** (left sidebar)
2. Click **"Add domain"**
3. Select **"gurum.se"** from dropdown
4. Add subdomain: **monarchy**
5. Click **"Configure domain"**

Amplify automatically:
- ✅ Creates SSL certificate
- ✅ Adds DNS records to Route53
- ✅ Configures CloudFront CDN

⏱️ Wait 15-30 minutes for SSL certificate validation

### Step 4: Verify

Visit: **https://monarchy.gurum.se**

## Environment Variables (Optional)

If needed, add in Amplify Console → App settings → Environment variables:

```
VITE_AWS_REGION=eu-west-1
```

## That's It! 🎉

Your game is now live at: **https://monarchy.gurum.se**

## Troubleshooting

**Build fails?**
- Check build logs in Amplify Console
- Verify amplify.yml is correct

**Domain not working?**
- Wait for DNS propagation (up to 48 hours)
- Check SSL certificate status in ACM

**Backend not deployed?**
- Check CloudFormation stacks in AWS Console
- Verify Amplify service role has permissions

## Next Deployments

Just push to main branch:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

Amplify automatically rebuilds and deploys! 🚀
