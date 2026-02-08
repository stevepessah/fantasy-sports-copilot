# Yahoo OAuth Endpoint Issue - Both v1 and v2 Return 404

## Problem
Both `/oauth/v1/` and `/oauth/v2/` endpoints return 404 "not found" errors from Yahoo.

## Possible Causes

### 1. Wrong Base URL
The endpoints might need a different base URL. Current:
- `https://api.login.yahoo.com/oauth/v1/get_request_token`

Alternatives to try:
- `https://login.yahoo.com/oauth/v1/get_request_token` (no "api.")
- `https://api.login.yahoo.com/oauth/get_request_token` (no version)
- `https://api.login.yahoo.com/oauth2/request_auth` (OAuth 2.0?)

### 2. Wrong Request Method
Currently using POST with form data. Maybe Yahoo requires:
- GET with query parameters
- POST with query parameters in URL
- Different content type

### 3. Yahoo Fantasy Sports Uses Different Auth
The Fantasy Sports API might use:
- OAuth 2.0 instead of OAuth 1.0a
- A different authentication flow entirely
- API keys instead of OAuth

### 4. Endpoint Deprecated
Yahoo might have deprecated OAuth 1.0a entirely and only support OAuth 2.0 now.

## Next Steps

1. **Check Yahoo Developer Console** - See what authentication method your app is configured for
2. **Try OAuth 2.0** - If Fantasy Sports supports it, switch to OAuth 2.0
3. **Check for working examples** - Look for GitHub repos or code samples using Yahoo Fantasy Sports API
4. **Contact Yahoo Support** - If documentation is unclear

## Recommendation

Given the consistent 404 errors, it's likely that:
- Yahoo Fantasy Sports API has moved to OAuth 2.0
- OR the endpoint URLs are completely different
- OR the request format is wrong

We should verify the exact authentication method required by checking the Yahoo Developer Console app settings and the Fantasy Sports API documentation more carefully.
