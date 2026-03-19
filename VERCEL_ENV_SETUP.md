# Setting Up Vercel Environment Variables

## Add Yahoo OAuth Credentials to Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your `fantasy-sports-copilot` project
3. Go to **Settings** → **Environment Variables**
4. Add these three variables:

### For Production:
- **Name**: `YAHOO_CONSUMER_KEY`
- **Value**: `your_consumer_key_here`
- **Environment**: Production, Preview, Development

- **Name**: `YAHOO_CONSUMER_SECRET`
- **Value**: `your_consumer_secret_here`
- **Environment**: Production, Preview, Development

- **Name**: `YAHOO_CALLBACK_URL`
- **Value**: `https://fantasy-sports-copilot.vercel.app/api/yahoo/callback`
- **Environment**: Production, Preview, Development

5. Click **Save** for each variable

## After Adding Variables

Vercel will automatically redeploy with the new environment variables. Wait for the deployment to complete (you'll see it in the Deployments tab).

## Then Test

1. Go to: https://fantasy-sports-copilot.vercel.app
2. Click "Connect Yahoo Fantasy League"
3. Complete OAuth flow
