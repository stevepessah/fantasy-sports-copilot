# Quick Fix: Use Production URL for OAuth Testing

Since ngrok requires signup, let's use your existing Vercel production URL for OAuth testing.

## Steps

### 1. Update Yahoo Developer Console

Set **Redirect URI(s)** to:
```
https://fantasy-sports-copilot.vercel.app/api/yahoo/callback
```

### 2. Update .env.local

Update your `.env.local` file:

```env
YAHOO_CONSUMER_KEY=dj0yJmk9aENxNmdMVVlKbW1UJmQ9WVdrOVVFVkRVSFo1Y2xjbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTE0
YAHOO_CONSUMER_SECRET=f6d8351365a6a4a371d204cbc6aff6574a9c23f5
YAHOO_CALLBACK_URL=https://fantasy-sports-copilot.vercel.app/api/yahoo/callback
```

### 3. Deploy to Vercel (if not already deployed)

Make sure your latest code is deployed:
```bash
git add .
git commit -m "Add Yahoo OAuth integration"
git push
# Vercel will auto-deploy
```

Or deploy manually:
```bash
vercel --prod
```

### 4. Test OAuth

1. Go to: `https://fantasy-sports-copilot.vercel.app`
2. Click "Connect Yahoo Fantasy League"
3. Complete OAuth flow
4. You'll be redirected back to production URL

### 5. For Local Development

After OAuth completes, the tokens are stored in cookies. You can:
- Continue using production URL for OAuth
- Or set up ngrok later for full local development

## Alternative: Set Up ngrok (Free)

If you want local development:

1. Sign up at: https://dashboard.ngrok.com/signup (free)
2. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
3. Run: `ngrok config add-authtoken YOUR_TOKEN`
4. Then: `ngrok http 3000`
5. Use the ngrok HTTPS URL in Yahoo Developer Console
