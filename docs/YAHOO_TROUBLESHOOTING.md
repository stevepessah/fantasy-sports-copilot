# Yahoo OAuth Troubleshooting

## Error: 404 "not found"

If you're getting a 404 error when trying to connect, check these:

### 1. Verify Callback URL in Yahoo Developer Console

The callback URL must match **exactly** between:
- Your `.env.local` file: `YAHOO_CALLBACK_URL=http://localhost:3000/api/yahoo/callback`
- Yahoo Developer Console: **Callback Domain** should be `localhost:3000`

**Important**: 
- In Yahoo Developer Console, you set the **Callback Domain** (not the full URL)
- The domain should be exactly `localhost:3000` (no `http://`)
- Make sure there are no trailing slashes or extra characters

### 2. Verify Your Credentials

Double-check that your Consumer Key and Consumer Secret in `.env.local` match what's shown in Yahoo Developer Console.

**Note**: If you regenerated your credentials, make sure you're using the latest ones.

### 3. Restart Your Dev Server

After updating `.env.local`, you **must** restart your Next.js dev server:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

Environment variables are only loaded when the server starts.

### 4. Check the OAuth Endpoints

The current implementation uses:
- Request Token: `https://api.login.yahoo.com/oauth/v2/get_request_token`
- Authorization: `https://api.login.yahoo.com/oauth/v2/request_auth`
- Access Token: `https://api.login.yahoo.com/oauth/v2/get_token`

If these endpoints have changed, we'll need to update `lib/yahoo/config.ts`.

### 5. Verify App Status in Yahoo Developer Console

Make sure your app is:
- ✅ **Active** (not disabled)
- ✅ Has **Fantasy Sports** permission enabled
- ✅ Has **Read** (or Read/Write) access granted

### 6. Check Browser Console

Open your browser's developer console (F12) and check for any additional error messages.

### 7. Check Server Logs

Look at your terminal where `npm run dev` is running. The updated code now logs:
- The callback URL being used
- The request URL
- Detailed error information

## Common Issues

### Issue: "Invalid callback URL"
**Solution**: Make sure the callback domain in Yahoo matches exactly `localhost:3000` (no http://, no trailing slash)

### Issue: "Consumer key not found"
**Solution**: 
1. Verify credentials in `.env.local`
2. Restart dev server
3. Check for typos or extra spaces

### Issue: "App not approved"
**Solution**: Some Yahoo apps require approval. Check your app status in Yahoo Developer Console.

## Still Not Working?

1. **Check the exact error message** in your browser console and server logs
2. **Verify all settings** in Yahoo Developer Console match exactly
3. **Try creating a new app** in Yahoo Developer Console with fresh credentials
4. **Check Yahoo's status page** to see if there are any API outages

## Testing the OAuth Flow Manually

You can test the OAuth endpoints directly:

```bash
# Check if your credentials are loaded
curl http://localhost:3000/api/yahoo/status

# Try initiating OAuth (should redirect to Yahoo)
curl -L http://localhost:3000/api/yahoo/auth
```
