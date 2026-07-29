import { test, expect } from '@playwright/test'

/**
 * @smoke @auth — validate the Yahoo login entry point on any deployment.
 *
 * This exercises the first half of the OAuth flow WITHOUT needing a Yahoo
 * account or completing login: it confirms the deployment has credentials
 * configured, redirects to Yahoo with the correct parameters, sends a
 * redirect_uri that points back to THIS deployment's callback (so it can match
 * what's registered in Yahoo), and sets the CSRF `state` cookie.
 *
 * The second half (real user consent) is a manual step — see
 * docs/YAHOO_PREVIEW_TESTING.md.
 */
const YAHOO_AUTH_BASE = 'https://api.login.yahoo.com/oauth2/request_auth'

test.describe('@smoke @auth Yahoo OAuth entry point', () => {
  test('authorize endpoint redirects to Yahoo with correct params', async ({ request, baseURL }) => {
    let res = await request.get('/api/yahoo/auth', { maxRedirects: 0 })
    let location = res.headers()['location']

    // A platform layer (e.g. Vercel Deployment Protection setting a bypass
    // cookie) may 3xx back to an app-relative path before the app's own OAuth
    // redirect. Follow one such intermediate hop so we assert against the real
    // app response, not the platform's.
    if (location && !location.startsWith('https://api.login.yahoo.com')) {
      const next = new URL(location, baseURL ?? undefined).toString()
      res = await request.get(next, { maxRedirects: 0 })
      location = res.headers()['location']
    }

    // If this fails with 500, the deployment is missing YAHOO_CONSUMER_KEY /
    // YAHOO_CONSUMER_SECRET.
    expect(
      [301, 302, 303, 307, 308],
      `expected a redirect but got ${res.status()} (are Yahoo credentials set on this deployment?)`,
    ).toContain(res.status())

    expect(location, 'redirect Location header should be present').toBeTruthy()
    expect(location).toContain(YAHOO_AUTH_BASE)

    const authUrl = new URL(location)
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('scope')).toBe('fspt-r')
    expect(authUrl.searchParams.get('client_id')).toBeTruthy()
    expect(authUrl.searchParams.get('state')).toBeTruthy()

    // redirect_uri must be a real callback URL for this app. Yahoo requires it
    // to exactly match a registered value, so it must point at /api/yahoo/callback.
    const redirectUri = authUrl.searchParams.get('redirect_uri')
    expect(redirectUri, 'redirect_uri should be present').toBeTruthy()
    const redirectUrl = new URL(redirectUri!)
    expect(redirectUrl.pathname).toBe('/api/yahoo/callback')
    expect(['http:', 'https:']).toContain(redirectUrl.protocol)

    // The CSRF state cookie must be set so the callback can verify it.
    const setCookies = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .join('\n')
    expect(setCookies).toContain('yahoo_oauth_state')
  })
})
