# Testing Yahoo Login on a Preview Deployment

Goal: log in with a real Yahoo account on a **Vercel Preview** deployment and
verify the full OAuth flow — without deploying to production.

## Why this needs setup

Yahoo OAuth requires the `redirect_uri` sent during login to **exactly match** a
value registered in your Yahoo Developer app. Preview deployments have their own
URLs, so a single hard-coded callback can't cover them.

This app now resolves `redirect_uri` per environment (see
`getYahooRedirectUri()` in `lib/yahoo/oauth2.ts`):

1. `YAHOO_CALLBACK_URL` — explicit override (use for Production).
2. **Vercel Preview** → the stable per-branch alias `VERCEL_BRANCH_URL`
   (`https://<project>-git-<branch>-<scope>.vercel.app/api/yahoo/callback`),
   falling back to `VERCEL_URL`.
3. The incoming request host.
4. `http://localhost:3000/api/yahoo/callback` for local dev.

The **branch alias is stable per branch** (it always points at the latest deploy
of that branch), so you register it in Yahoo once and reuse it for all of that
branch's preview deploys.

## One-time setup

### 1. Scope env vars correctly in Vercel

Vercel → Project → Settings → Environment Variables:

- `YAHOO_CONSUMER_KEY`, `YAHOO_CONSUMER_SECRET` → set for **Production,
  Preview, and Development**.
- `YAHOO_CALLBACK_URL` → set for **Production only**. Do **not** set it in the
  Preview scope, or previews will send the prod URL and login will fail.

### 2. Find your branch's callback URL

Push your branch so Vercel builds a preview, then open on the preview:

```
GET /api/yahoo/debug
```

It returns the exact value that will be sent to Yahoo, e.g.:

```json
{
  "vercelEnv": "preview",
  "hasConsumerKey": true,
  "hasConsumerSecret": true,
  "callbackUrlOverride": "NOT SET",
  "resolvedRedirectUri": "https://fantasy-sports-copilot-git-my-branch-acme.vercel.app/api/yahoo/callback"
}
```

(`/api/yahoo/debug` is available on preview/dev and 404s on production.)

### 3. Register that URL in Yahoo

Yahoo Developer Network → your app → **Redirect URI(s)** → add the
`resolvedRedirectUri` from step 2. Keep your production and
`http://localhost:3000/api/yahoo/callback` entries too. Save.

## Test the login

### Automated (no Yahoo account needed)

The `@auth` E2E test (`e2e/yahoo-auth.spec.ts`) verifies the entry point on any
deployment: credentials are configured, the app redirects to Yahoo with the
right params, the `redirect_uri` points at this deployment's callback, and the
CSRF `state` cookie is set. It runs automatically in the **Preview Tests**
workflow (see `docs/PREVIEW_TESTING.md`) and locally:

```bash
# Against a preview
PLAYWRIGHT_BASE_URL=https://<your-branch-alias>.vercel.app npx playwright test e2e/yahoo-auth.spec.ts
# Or the full smoke set (includes @auth)
PLAYWRIGHT_BASE_URL=https://<your-branch-alias>.vercel.app npm run test:smoke
```

### Manual (real end-to-end login)

Because real consent needs your Yahoo credentials in a browser, complete the
final step manually:

1. Open the **branch alias** URL (the one you registered), not the per-commit
   hash URL: `https://<project>-git-<branch>-<scope>.vercel.app`.
2. Click **Connect Yahoo** (or go to `/api/yahoo/auth`).
3. Log in and approve on Yahoo.
4. You should land back on `/?yahoo_connected=true` and see authenticated state.
5. Verify `GET /api/yahoo/status` returns `{"authenticated": true, ...}` and that
   roster/matchup/standings features load.

If login fails, check `/api/yahoo/debug` `resolvedRedirectUri` matches a
registered Yahoo Redirect URI exactly (protocol, host, and `/api/yahoo/callback`
path).

## Local alternative (skip the browser)

For fast local iteration you can reuse tokens instead of logging in each time:
do the real OAuth once, copy `yahoo_access_token` / `yahoo_refresh_token` from
browser devtools (Application → Cookies), and set `YAHOO_DEV_ACCESS_TOKEN` /
`YAHOO_DEV_REFRESH_TOKEN` in `.env.local`. These dev env tokens are ignored in
production. See `.env.example`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `/api/yahoo/auth` returns 500 | `YAHOO_CONSUMER_KEY`/`SECRET` not set for this environment. |
| Yahoo shows "redirect_uri mismatch" | `resolvedRedirectUri` isn't registered in Yahoo, or `YAHOO_CALLBACK_URL` is set in the Preview scope and overrides the branch alias. |
| Redirected to `/?error=invalid_state` | `yahoo_oauth_state` cookie missing/blocked — ensure you start and finish on the same host (use the branch alias throughout). |
| Works on prod, not preview | You likely set `YAHOO_CALLBACK_URL` for all environments; unset it for Preview. |
