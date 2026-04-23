#!/bin/bash

# Vercel Deployment Script
# This script helps deploy Fantasy Sports Copilot to Vercel

echo "🚀 Fantasy Sports Copilot - Vercel Deployment"
echo ""

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "⚠️  Not logged in to Vercel"
    echo "Logging in..."
    vercel login
fi

echo "✅ Logged in to Vercel"
echo ""

# Check if project is linked
if [ -f ".vercel/project.json" ]; then
    echo "📦 Project already linked to Vercel"
    echo ""
    read -p "Deploy to production? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Deploying to production..."
        vercel --prod
    else
        echo "🚀 Deploying preview..."
        vercel
    fi
else
    echo "🔗 Linking project to Vercel..."
    echo ""
    vercel
    
    echo ""
    echo "📝 Setting up environment variables..."
    echo ""
    read -p "Do you want to add OPENAI_API_KEY? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Enter your OpenAI API key (or press Enter to skip):"
        read -s OPENAI_KEY
        if [ ! -z "$OPENAI_KEY" ]; then
            echo "$OPENAI_KEY" | vercel env add OPENAI_API_KEY production
            echo "$OPENAI_KEY" | vercel env add OPENAI_API_KEY preview
            echo "$OPENAI_KEY" | vercel env add OPENAI_API_KEY development
            echo "✅ Environment variable added"
        fi
    fi
    
    echo ""
    echo "🚀 Deploying to production..."
    vercel --prod
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Visit your Vercel dashboard to see your deployment"
echo "2. Set up a custom domain (optional)"
echo "3. Configure environment variables in Vercel dashboard"
echo ""
