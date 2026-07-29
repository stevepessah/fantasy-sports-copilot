import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YahooOAuth2, getYahooRedirectUri } from '@/lib/yahoo/oauth2'

const ORIGINAL_ENV = { ...process.env }

// Env keys that affect redirect_uri resolution — reset before each test so
// cases don't leak into one another.
const RESOLVER_KEYS = ['YAHOO_CALLBACK_URL', 'VERCEL_ENV', 'VERCEL_BRANCH_URL', 'VERCEL_URL']

function clearResolverEnv() {
  for (const k of RESOLVER_KEYS) delete process.env[k]
}

function makeSource(
  headers: Record<string, string>,
  nextUrl?: { protocol?: string; host?: string; origin?: string },
) {
  return { headers: new Headers(headers), nextUrl }
}

beforeEach(() => {
  clearResolverEnv()
  process.env.YAHOO_CONSUMER_KEY = 'test_key'
  process.env.YAHOO_CONSUMER_SECRET = 'test_secret'
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

describe('getYahooRedirectUri', () => {
  it('uses YAHOO_CALLBACK_URL override above everything else', () => {
    process.env.YAHOO_CALLBACK_URL = 'https://prod.example.com/api/yahoo/callback'
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_BRANCH_URL = 'app-git-branch-team.vercel.app'
    expect(getYahooRedirectUri(makeSource({ host: 'whatever' }))).toBe(
      'https://prod.example.com/api/yahoo/callback',
    )
  })

  it('uses the stable branch alias on Vercel Preview', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_BRANCH_URL = 'app-git-feature-team.vercel.app'
    process.env.VERCEL_URL = 'app-abc123-team.vercel.app'
    expect(getYahooRedirectUri()).toBe('https://app-git-feature-team.vercel.app/api/yahoo/callback')
  })

  it('falls back to VERCEL_URL when branch URL is missing on Preview', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'app-abc123-team.vercel.app'
    expect(getYahooRedirectUri()).toBe('https://app-abc123-team.vercel.app/api/yahoo/callback')
  })

  it('derives from x-forwarded-host / x-forwarded-proto', () => {
    const src = makeSource({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'my-preview.example.com',
    })
    expect(getYahooRedirectUri(src)).toBe('https://my-preview.example.com/api/yahoo/callback')
  })

  it('falls back to the Host header when no forwarded headers exist', () => {
    const src = makeSource({ host: 'localhost:3000' })
    expect(getYahooRedirectUri(src)).toBe('https://localhost:3000/api/yahoo/callback')
  })

  it('honors nextUrl protocol/host when headers are absent', () => {
    const src = makeSource({}, { protocol: 'http:', host: 'localhost:3000' })
    expect(getYahooRedirectUri(src)).toBe('http://localhost:3000/api/yahoo/callback')
  })

  it('defaults to localhost when nothing is available', () => {
    expect(getYahooRedirectUri()).toBe('http://localhost:3000/api/yahoo/callback')
  })

  it('does NOT use the branch alias outside a preview env', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.VERCEL_BRANCH_URL = 'app-git-main-team.vercel.app'
    // No override, not preview -> falls through to request/localhost.
    expect(getYahooRedirectUri()).toBe('http://localhost:3000/api/yahoo/callback')
  })
})

describe('YahooOAuth2', () => {
  it('throws when credentials are missing', () => {
    delete process.env.YAHOO_CONSUMER_KEY
    delete process.env.YAHOO_CONSUMER_SECRET
    expect(() => new YahooOAuth2()).toThrow(/credentials not configured/i)
  })

  it('builds an authorization URL with the provided redirect_uri and params', () => {
    const redirectUri = 'https://my-preview.example.com/api/yahoo/callback'
    const oauth2 = new YahooOAuth2(redirectUri)
    expect(oauth2.getRedirectUri()).toBe(redirectUri)

    const url = new URL(oauth2.getAuthorizationUrl('state123'))
    expect(url.origin + url.pathname).toBe('https://api.login.yahoo.com/oauth2/request_auth')
    expect(url.searchParams.get('client_id')).toBe('test_key')
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('fspt-r')
    expect(url.searchParams.get('state')).toBe('state123')
  })

  it('exchanges a code for tokens using the same redirect_uri', async () => {
    const redirectUri = 'https://my-preview.example.com/api/yahoo/callback'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-abc',
        refresh_token: 'refresh-xyz',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const oauth2 = new YahooOAuth2(redirectUri)
    const tokens = await oauth2.getAccessToken('auth-code-123')

    expect(tokens.access_token).toBe('access-abc')
    expect(tokens.refresh_token).toBe('refresh-xyz')
    expect(tokens.expires_in).toBe(3600)

    // Verify the request body carried the correct grant + redirect_uri.
    const [calledUrl, init] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe('https://api.login.yahoo.com/oauth2/get_token')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('auth-code-123')
    expect(body.get('redirect_uri')).toBe(redirectUri)
    // Basic auth header uses base64(client:secret).
    const expectedAuth = 'Basic ' + Buffer.from('test_key:test_secret').toString('base64')
    expect(init.headers.Authorization).toBe(expectedAuth)
  })

  it('throws with Yahoo error details when token exchange fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'invalid_grant',
    })
    vi.stubGlobal('fetch', fetchMock)

    const oauth2 = new YahooOAuth2('https://x.example.com/api/yahoo/callback')
    await expect(oauth2.getAccessToken('bad-code')).rejects.toThrow(/invalid_grant/)
  })

  it('refreshes tokens and preserves the old refresh token when none returned', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-access', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const oauth2 = new YahooOAuth2('https://x.example.com/api/yahoo/callback')
    const tokens = await oauth2.refreshAccessToken('old-refresh')

    expect(tokens.access_token).toBe('new-access')
    expect(tokens.refresh_token).toBe('old-refresh')

    const [, init] = fetchMock.mock.calls[0]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-refresh')
  })
})
