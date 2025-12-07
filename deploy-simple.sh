#!/bin/bash
set -e

echo "🚀 Deploying Monarchy Game to Production"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "amplify.yml" ]; then
  echo "❌ Error: amplify.yml not found. Run from project root."
  exit 1
fi

# Ensure we're on main branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Warning: Not on main branch (current: $BRANCH)"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Ensure everything is committed
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Warning: Uncommitted changes detected"
  read -p "Commit and push changes? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add -A
    git commit -m "Deploy to production"
    git push origin main
  fi
fi

echo ""
echo "📦 Building frontend..."
cd frontend
npm run build

echo ""
echo "✅ Build successful!"
echo ""
echo "🌐 Next steps to complete deployment:"
echo "======================================"
echo ""
echo "1. Go to AWS Amplify Console:"
echo "   https://console.aws.amazon.com/amplify/home?region=eu-west-1"
echo ""
echo "2. Click 'New app' → 'Host web app'"
echo ""
echo "3. Connect GitHub repository:"
echo "   Repository: kalleeh/monarchygame"
echo "   Branch: main"
echo ""
echo "4. Build settings will auto-detect amplify.yml ✅"
echo ""
echo "5. After deployment, add custom domain:"
echo "   - Domain: gurum.se"
echo "   - Subdomain: monarchy"
echo "   - SSL: Automatic via ACM"
echo ""
echo "6. Your app will be live at:"
echo "   https://monarchy.gurum.se"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
