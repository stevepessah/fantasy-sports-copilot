# Setting Up Vercel Environment Variables

## Add Yahoo OAuth Credentials to Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your `fantasy-sports-copilot` project
3. Go to **Settings** → **Environment Variables**
4. Add these three variables:

### For Production:
- **Name**: `YAHOO_CONSUMER_KEY`
- **Value**: `dj0yJmk9aENxNmdMVVlKbW1UJmQ9WVdrOVVFVkRVSFo1Y2xjbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTE0`
- **Environment**: Production, Preview, Development

- **Name**: `YAHOO_CONSUMER_SECRET`
- **Value**: `f6d8351365a6a4a371d204cbc6aff6574a9c23f5`
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
