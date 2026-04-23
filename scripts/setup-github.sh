#!/bin/bash

# Script to create GitHub repository and push code
# Usage: ./setup-github.sh [repository-name]

REPO_NAME=${1:-"fantasy-sports-copilot"}
GITHUB_USER=$(git config user.name 2>/dev/null || echo "your-username")

echo "🚀 Setting up GitHub repository: $REPO_NAME"
echo ""

# Check if gh CLI is installed
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI found"
    echo ""
    echo "Creating repository on GitHub..."
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Repository created and code pushed successfully!"
        echo ""
        gh repo view --web
    else
        echo "❌ Failed to create repository. Please check your GitHub authentication."
        echo "Run: gh auth login"
    fi
else
    echo "⚠️  GitHub CLI not found. Using manual setup instructions..."
    echo ""
    echo "📋 Manual Setup Instructions:"
    echo ""
    echo "1. Go to https://github.com/new"
    echo "2. Repository name: $REPO_NAME"
    echo "3. Choose Public or Private"
    echo "4. DO NOT initialize with README, .gitignore, or license"
    echo "5. Click 'Create repository'"
    echo ""
    echo "6. Then run these commands:"
    echo ""
    echo "   git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
    echo "Or if you prefer SSH:"
    echo ""
    echo "   git remote add origin git@github.com:$GITHUB_USER/$REPO_NAME.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
fi
