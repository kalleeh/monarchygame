#!/bin/bash

# Monarchy Game - Simple Deployment Script
# This script prepares the repository for production deployment

set -e

echo "🎮 Monarchy Game - Production Deployment Preparation"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "amplify.yml" ]; then
    echo "❌ Error: amplify.yml not found. Are you in the project root?"
    exit 1
fi

# Check Git status
echo ""
echo "📋 Checking Git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes:"
    git status --short
    echo ""
    read -p "Do you want to commit these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " commit_msg
        git add .
        git commit -m "$commit_msg"
    else
        echo "❌ Deployment cancelled. Please commit or stash your changes."
        exit 1
    fi
fi

# Check if on main branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    echo "⚠️  You're on branch '$current_branch', not 'main'"
    read -p "Do you want to switch to main? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout main
    else
        echo "❌ Deployment cancelled. Please switch to main branch."
        exit 1
    fi
fi

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Repository pushed to GitHub!"
echo ""
echo "📝 Next Steps:"
echo "1. Go to AWS Amplify Console: https://eu-west-1.console.aws.amazon.com/amplify/home?region=eu-west-1"
echo "2. Click 'Create new app' → 'GitHub'"
echo "3. Select repository: kalleeh/monarchygame"
echo "4. Select branch: main"
echo "5. Use amplify.yml for build settings"
echo "6. After deployment, add custom domain: monarchy.gurum.se"
echo ""
echo "📖 Full instructions: See DEPLOYMENT.md"
