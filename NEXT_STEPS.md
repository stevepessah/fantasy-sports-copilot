# Next Steps: Yahoo OAuth Setup

## Current Situation
- Using original app with both Consumer Key and Consumer Secret
- App is configured as "Confidential Client" (OAuth 2.0 label)
- Fantasy Sports API requires OAuth 1.0a
- We'll try OAuth 1.0a endpoints with these credentials

## Step 1: Update Environment Variables

Make sure your Vercel environment variables are set to the **original app** credentials:

```
YAHOO_CONSUMER_KEY=dj0yJmk9aENxNmdMVVlKbW1UJmQ9WVdrOVVFVkRVSFo1Y2xjbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTE0
YAHOO_CONSUMER_SECRET=f6d8351365a6a4a371d204cbc6aff6574a9c23f5
YAHOO_CALLBACK_URL=https://fantasy-sports-copilot.vercel.app/api/yahoo/callback
```

## Step 2: Verify Yahoo App Settings

In Yahoo Developer Console, check your original app:
1. **Redirect URI** must be exactly: `https://fantasy-sports-copilot.vercel.app/api/yahoo/callback`
2. **Fantasy Sports** permission must be enabled
3. **Read** access should be selected

## Step 3: Test OAuth 1.0a Flow

Even though the app is labeled "Confidential Client", it has both credentials needed for OAuth 1.0a. We'll try:
1. Using OAuth 1.0a endpoints (we've already updated these)
2. Using the Consumer Key and Secret to generate signatures
3. Testing the connection

## Step 4: If It Still Doesn't Work

If we still get 404 errors, it means:
- Yahoo doesn't allow OAuth 1.0a for "Confidential Client" apps
- We'll need to implement OAuth 2.0 instead
- Or check if there's a way to switch the app type

## What We'll Do Now

1. Make sure environment variables are correct
2. Test the OAuth flow
3. Check the error messages
4. Decide if we need to switch to OAuth 2.0
