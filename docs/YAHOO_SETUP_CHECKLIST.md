# Yahoo OAuth Setup Checklist

## ✅ Step 1: Verify Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Make sure these are set (using your **original app** credentials):
- `YAHOO_CONSUMER_KEY` = `your_consumer_key_here`
- `YAHOO_CONSUMER_SECRET` = `your_consumer_secret_here`
- `YAHOO_CALLBACK_URL` = `https://fantasy-sports-copilot.vercel.app/api/yahoo/callback`

**Important**: Make sure these are set for **Production** environment.

## ✅ Step 2: Verify Yahoo App Settings

Go to https://developer.yahoo.com/apps and open your **original app**:

1. **Redirect URI** must be exactly:
   ```
   https://fantasy-sports-copilot.vercel.app/api/yahoo/callback
   ```
   (No trailing slash, exact match required)

2. **API Permissions**:
   - ✅ Fantasy Sports (Read) must be enabled

3. **App Status**: Make sure the app is active/enabled

## ✅ Step 3: Test the Connection

1. Go to: `https://fantasy-sports-copilot.vercel.app/`
2. Click "Connect Yahoo Fantasy League"
3. Check what happens:
   - **If it redirects to Yahoo**: Good! The OAuth flow is working
   - **If you get a 404 error**: The app type might not support OAuth 1.0a
   - **If you get a different error**: Share the error message

## 🔄 Step 4: If OAuth 1.0a Doesn't Work

If we still get 404 errors, it means:
- "Confidential Client" apps might only support OAuth 2.0
- We'll need to implement OAuth 2.0 Authorization Code Grant flow
- This requires rewriting the authentication code

## 📝 Current Status

- ✅ Code is ready for OAuth 1.0a
- ✅ Endpoints are set to `/oauth/v1/`
- ✅ OAuth signature generation is implemented
- ⏳ Waiting to test with original app credentials

## Next Action

**Test the connection** and let me know what error (if any) you get!
