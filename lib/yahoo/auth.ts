import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { YahooOAuth2, type YahooOAuth2Tokens } from './oauth2'

interface TokenResult {
  accessToken: string
  refreshedTokens?: YahooOAuth2Tokens
}

function devEnvToken(name: string): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined
  return process.env[name] || undefined
}

/**
 * Reads the Yahoo access token from cookies. If the access token is missing
 * but a refresh token exists, performs a token refresh and returns the new
 * tokens so the caller can persist them on the response via applyTokenCookies.
 *
 * In development, falls back to YAHOO_DEV_ACCESS_TOKEN / YAHOO_DEV_REFRESH_TOKEN
 * env vars so you don't need to re-authenticate through the browser.
 */
export async function getValidYahooToken(): Promise<TokenResult | null> {
  const cookieStore = await cookies()
  const accessToken =
    cookieStore.get('yahoo_access_token')?.value || devEnvToken('YAHOO_DEV_ACCESS_TOKEN')
  const refreshToken =
    cookieStore.get('yahoo_refresh_token')?.value || devEnvToken('YAHOO_DEV_REFRESH_TOKEN')

  if (accessToken) {
    return { accessToken }
  }

  if (!refreshToken) {
    return null
  }

  try {
    const oauth2 = new YahooOAuth2()
    const tokens = await oauth2.refreshAccessToken(refreshToken)
    return { accessToken: tokens.access_token, refreshedTokens: tokens }
  } catch (error) {
    console.error('[yahoo/auth] Token refresh failed:', error)
    return null
  }
}

/**
 * Sets refreshed token cookies on a NextResponse so the browser receives
 * the updated access and refresh tokens.
 */
export function applyTokenCookies(
  response: NextResponse,
  tokens: YahooOAuth2Tokens,
) {
  const secure = process.env.NODE_ENV === 'production'

  response.cookies.set('yahoo_access_token', tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: tokens.expires_in || 3600,
  })

  if (tokens.refresh_token) {
    response.cookies.set('yahoo_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90,
    })
  }
}

/**
 * All-in-one auth helper for Yahoo data routes. Returns an object with the
 * valid access token and a `json()` method that transparently persists
 * refreshed tokens on the response. Returns null if unauthenticated.
 *
 * Usage:
 *   const auth = await withYahooAuth()
 *   if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
 *   api.setAccessToken(auth.accessToken)
 *   return auth.json(data, { headers: { ... } })   // success responses
 */
export async function withYahooAuth(): Promise<{
  accessToken: string
  json: (data: unknown, init?: ResponseInit) => NextResponse
} | null> {
  const result = await getValidYahooToken()
  if (!result) return null

  return {
    accessToken: result.accessToken,
    json(data: unknown, init?: ResponseInit) {
      const response = NextResponse.json(data, init)
      if (result.refreshedTokens) applyTokenCookies(response, result.refreshedTokens)
      return response
    },
  }
}

/**
 * Checks that the user has a valid Yahoo session (access token cookie).
 * Returns the access token string, or null if unauthenticated.
 * Use this for non-Yahoo routes that just need a simple auth gate.
 */
export async function requireYahooAuth(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('yahoo_access_token')?.value ?? devEnvToken('YAHOO_DEV_ACCESS_TOKEN') ?? null
}
