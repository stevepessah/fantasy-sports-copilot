# Vercel Deployment Guide

This guide will help you deploy Fantasy Sports Copilot to Vercel.

## 🚀 Quick Deploy (Recommended)

### Option 1: Deploy via GitHub (Easiest)

1. **Push your code to GitHub** (if you haven't already):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/fantasy-sports-copilot.git
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your `fantasy-sports-copilot` repository
   - Vercel will auto-detect Next.js settings

3. **Configure Environment Variables**:
   - In the Vercel project settings, go to "Environment Variables"
   - Add: `OPENAI_API_KEY` = `your_openai_api_key_here` (optional - app works without it)
   - Select all environments (Production, Preview, Development)

4. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Your app will be live at `https://fantasy-sports-copilot.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Login to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy**:
   ```bash
   cd /Users/stevenpessah/fantasy-sports-copilot
   vercel
   ```

3. **Follow the prompts**:
   - Link to existing project? (No for first time)
   - Project name: `fantasy-sports-copilot`
   - Directory: `./`
   - Override settings? (No)

4. **Set Environment Variables**:
   ```bash
   vercel env add OPENAI_API_KEY
   # Enter your OpenAI API key when prompted
   # Select all environments
   ```

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

## 📋 Environment Variables

### Required
- None (app works without OpenAI API key using fallback system)

### Optional
- `OPENAI_API_KEY` - Your OpenAI API key for enhanced AI responses
  - Get one at: https://platform.openai.com/api-keys
  - Without this, the app uses a rule-based fallback system

## 🔧 Vercel Configuration

The project includes:
- ✅ `vercel.json` - Vercel configuration
- ✅ `.vercelignore` - Files to exclude from deployment
- ✅ Next.js 14 optimized for Vercel
- ✅ Standalone output for faster builds

## 🌐 Custom Domain (Optional)

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## 🔄 Continuous Deployment

Once connected to GitHub:
- **Automatic deployments** on every push to `main`
- **Preview deployments** for pull requests
- **Instant rollbacks** if needed

## 📊 Monitoring

Vercel provides:
- Real-time logs
- Performance metrics
- Error tracking
- Analytics (optional)

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version (Vercel uses 18.x by default)

### Environment Variables Not Working
- Make sure variables are set for the correct environment
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

### API Routes Not Working
- Verify routes are in `app/api/` directory
- Check Vercel function logs
- Ensure proper error handling

## 🚀 Post-Deployment

After deployment:

1. **Test your deployment**:
   - Visit your Vercel URL
   - Test chat functionality
   - Verify API routes work

2. **Set up monitoring**:
   - Enable Vercel Analytics (optional)
   - Set up error tracking

3. **Configure domains**:
   - Add custom domain if desired
   - Set up SSL (automatic with Vercel)

4. **Share your app**:
   - Your app is live and shareable!
   - Update README with live URL

## 📝 Notes

- Vercel automatically handles:
  - SSL certificates
  - CDN distribution
  - Edge network optimization
  - Automatic scaling

- The app uses in-memory database for MVP
  - For production, consider adding a real database
  - Vercel supports PostgreSQL, MongoDB, etc.

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
