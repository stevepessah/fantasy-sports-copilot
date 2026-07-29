// Yahoo OAuth 2.0 Implementation
// For Confidential Client apps (OAuth 2.0)

import crypto from 'crypto'

export interface YahooOAuth2Tokens {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  xoauth_yahoo_guid?: string
}

/**
 * Minimal shape needed to derive the OAuth redirect URI from an incoming
 * request. `NextRequest` satisfies this structurally.
 */
export interface RedirectUriSource {
  headers: Pick<Headers, 'get'>
  nextUrl?: { protocol?: string; host?: string; origin?: string }
}

/**
 * Resolve the Yahoo OAuth `redirect_uri` for the current deployment.
 *
 * Yahoo requires the redirect_uri sent during authorization AND token exchange
 * to EXACTLY match a value registered in the Yahoo Developer app. Because Vercel
 * Preview deployments get their own URLs, a single static value cannot work
 * everywhere — so we resolve it per environment:
 *
 *   1. `YAHOO_CALLBACK_URL` — explicit override. Set this in the **Production**
 *      environment (and pin it wherever you want a fixed URL).
 *   2. Vercel **Preview** — use the stable per-branch alias (`VERCEL_BRANCH_URL`,
 *      falling back to `VERCEL_URL`). Register that one URL in Yahoo and every
 *      deploy of the branch can complete real login. Do NOT set
 *      `YAHOO_CALLBACK_URL` in the Preview scope, or it will take priority.
 *   3. Request host — derive from the incoming request (any host).
 *   4. Localhost default — for local development.
 *
 * Both `/api/yahoo/auth` and `/api/yahoo/callback` call this with the same
 * request, so the value stays consistent across the flow.
 */
export function getYahooRedirectUri(source?: RedirectUriSource): string {
  const path = '/api/yahoo/callback'

  // 1. Explicit override always wins.
  if (process.env.YAHOO_CALLBACK_URL) {
    return process.env.YAHOO_CALLBACK_URL
  }

  // 2. Vercel Preview: prefer the stable branch alias so one registered URI
  //    covers every deploy of that branch.
  if (process.env.VERCEL_ENV === 'preview') {
    const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
    if (host) return `https://${host}${path}`
  }

  // 3. Derive from the incoming request host.
  if (source) {
    const forwardedProto = source.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const forwardedHost = source.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || source.headers.get('host') || source.nextUrl?.host
    if (host) {
      const proto = forwardedProto || source.nextUrl?.protocol?.replace(':', '') || 'https'
      return `${proto}://${host}${path}`
    }
  }

  // 4. Local development default.
  return `http://localhost:3000${path}`
}

export class YahooOAuth2 {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private baseUrl = 'https://api.login.yahoo.com/oauth2'

  /**
   * @param redirectUri Optional explicit redirect URI. When omitted it is
   *   resolved from the environment via {@link getYahooRedirectUri}. Pass the
   *   value derived from the current request for the authorize/callback flow so
   *   the redirect_uri matches the deployment.
   */
  constructor(redirectUri?: string) {
    this.clientId = process.env.YAHOO_CONSUMER_KEY || ''
    this.clientSecret = process.env.YAHOO_CONSUMER_SECRET || ''
    this.redirectUri = redirectUri || getYahooRedirectUri()

    if (!this.clientId || !this.clientSecret) {
      const error =
        'Yahoo OAuth 2.0 credentials not configured. Set YAHOO_CONSUMER_KEY and YAHOO_CONSUMER_SECRET in environment variables.'
      console.error(error)
      throw new Error(error)
    }
  }

  /** The redirect_uri this client will send to Yahoo. */
  getRedirectUri(): string {
    return this.redirectUri
  }

  /**
   * Get authorization URL (step 1 - redirect user here)
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'fspt-r', // Fantasy Sports read-only
      ...(state && { state }),
    })

    return `${this.baseUrl}/request_auth?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token (step 2)
   */
  async getAccessToken(code: string): Promise<YahooOAuth2Tokens> {
    // Base64 encode client_id:client_secret for Authorization header
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    })

    const response = await fetch(`${this.baseUrl}/get_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Yahoo OAuth 2.0 token error:', {
        status: response.status,
        statusText: response.statusText,
        body: text,
      })
      throw new Error(`Failed to get access token: ${response.status} ${text}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer',
      xoauth_yahoo_guid: data.xoauth_yahoo_guid,
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<YahooOAuth2Tokens> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })

    const response = await fetch(`${this.baseUrl}/get_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to refresh access token: ${response.status} ${text}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Use new refresh token if provided
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer',
    }
  }

  /**
   * Make authenticated API request
   */
  async makeRequest(
    method: string,
    endpoint: string,
    accessToken: string,
    queryParams: Record<string, string> = {},
  ): Promise<any> {
    const url = `https://fantasysports.yahooapis.com/fantasy/v2${endpoint}`
    const queryString = new URLSearchParams(queryParams).toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url

    const response = await fetch(fullUrl, {
      method: method.toUpperCase(),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Yahoo API request failed: ${response.status} ${text}`)
    }

    const xmlText = await response.text()
    return { raw: xmlText }
  }
}
