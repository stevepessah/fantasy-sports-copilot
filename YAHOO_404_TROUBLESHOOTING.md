# Yahoo OAuth 404 Error - Troubleshooting Guide

## Current Issue
Getting 404 error from Yahoo OAuth endpoint when trying to get request token.

## Error Message
```
Failed to get request token: 404 {"error":{"localizedMessage":"not found","errorId":"NOT_FOUND","message":"not found"}}
```

## Possible Causes

### 1. **OAuth Endpoint URL Might Be Wrong**
The endpoint we're using: `https://api.login.yahoo.com/oauth/v2/get_request_token`

Yahoo might have:
- Changed their OAuth endpoints
- Deprecated the v2 endpoints
- Require different endpoint format

### 2. **OAuth Signature Still Incorrect**
Even with RFC 3986 encoding fixes, the signature might still be wrong. Yahoo returns 404 for invalid signatures in some cases.

### 3. **Missing Required Parameters**
Yahoo might require additional parameters we're not sending.

### 4. **Environment Variables Not Loading**
The credentials might not be accessible at runtime in Vercel.

## Debugging Steps

### Step 1: Check Vercel Function Logs
1. Go to Vercel Dashboard → Your Project
2. Click on the latest deployment
3. Go to "Functions" tab
4. Find `/api/yahoo/auth` function
5. Check the logs for:
   - The detailed request info we're logging
   - Any error messages
   - The actual URL being called

### Step 2: Test the Debug Endpoint
Visit: `https://fantasy-sports-copilot.vercel.app/api/yahoo/debug`

This will show:
- If environment variables are loaded
- What callback URL is configured
- If credentials are present

### Step 3: Verify Yahoo Developer Console
1. Go to https://developer.yahoo.com/apps
2. Check your app settings:
   - **Redirect URI** must be exactly: `https://fantasy-sports-copilot.vercel.app/api/yahoo/callback`
   - **Application Type** should be "Web Application"
   - **OAuth 2.0 Redirect URIs** - make sure it's set correctly

### Step 4: Check Yahoo OAuth Documentation
The Yahoo OAuth endpoints might have changed. Check:
- https://developer.yahoo.com/oauth/guide/oauth-auth-flow.html
- https://developer.yahoo.com/fantasysports/guide/

## Potential Solutions

### Solution 1: Verify OAuth Endpoint URLs
Yahoo might use different endpoints. Try checking if these work:
- `https://api.login.yahoo.com/oauth2/request_auth` (OAuth 2.0?)
- `https://api.login.yahoo.com/oauth/v1/get_request_token` (v1 instead of v2?)

### Solution 2: Use OAuth Library
Consider using a proven OAuth 1.0a library instead of custom implementation:
```bash
npm install oauth-1.0a
```

### Solution 3: Check Request Format
Yahoo might require:
- Different HTTP method
- Different content type
- Query parameters instead of form data
- Additional headers

## Next Steps

1. **Check Vercel logs** - This will show what's actually being sent
2. **Verify environment variables** - Use the debug endpoint
3. **Check Yahoo documentation** - Verify the correct endpoints
4. **Test with curl** - Try making a manual OAuth request to see what works

Let me know what the Vercel function logs show, and we can fix the specific issue!
