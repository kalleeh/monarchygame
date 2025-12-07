# 🚀 Deploy to monarchy.gurum.se - Quick Start

## ✅ Pre-Deployment Checklist
- [x] Code is production-ready (0 errors, 73/73 tests passing)
- [x] Build successful (1.44MB, 3.54s)
- [x] Git repository connected (kalleeh/monarchygame)
- [x] Route53 domain ready (gurum.se)
- [x] Deployment files committed

## 🎯 Deploy Now (5 Steps)

### Step 1: Open AWS Amplify Console
```
https://console.aws.amazon.com/amplify/home?region=us-east-1
```

### Step 2: Create New App
1. Click **"New app"** → **"Host web app"**
2. Select **GitHub**
3. Authorize AWS Amplify (one-time)

### Step 3: Connect Repository
- **Repository**: kalleeh/monarchygame
- **Branch**: main
- Click **Next**

### Step 4: Confirm Build Settings
- Build settings auto-detected from `amplify.yml` ✅
- Click **Next** → **Save and deploy**
- Wait ~5-10 minutes for first deployment

### Step 5: Add Custom Domain
1. Go to **App settings** → **Domain management**
2. Click **Add domain**
3. Select **gurum.se** (auto-detected from Route53)
4. Add subdomain: **monarchy**
5. Click **Configure domain**
6. Wait ~15 minutes for SSL certificate

## 🎉 Done!

Your app will be live at:
**https://monarchy.gurum.se**

## 📊 What Happens Automatically

✅ SSL certificate via AWS Certificate Manager (ACM)  
✅ CNAME records added to Route53  
✅ HTTPS redirect configured  
✅ Auto-deploy on every push to main  
✅ CloudWatch logging enabled  

## 🔄 Future Deployments

Just push to main:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

Amplify will automatically build and deploy!

## 💰 Cost Estimate

- **Amplify Hosting**: ~$0.01/GB + $0.01/build minute
- **Route53**: $0.50/month
- **ACM Certificate**: Free
- **Total**: ~$5-20/month

## 🆘 Need Help?

See detailed guide: `DEPLOYMENT.md`
