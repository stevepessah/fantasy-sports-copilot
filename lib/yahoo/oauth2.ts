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

export class YahooOAuth2 {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private baseUrl = 'https://api.login.yahoo.com/oauth2'

  constructor() {
    this.clientId = process.env.YAHOO_CONSUMER_KEY || ''
    this.clientSecret = process.env.YAHOO_CONSUMER_SECRET || ''
    this.redirectUri = process.env.YAHOO_CALLBACK_URL || 'http://localhost:3000/api/yahoo/callback'

    if (!this.clientId || !this.clientSecret) {
      const error = 'Yahoo OAuth 2.0 credentials not configured. Set YAHOO_CONSUMER_KEY and YAHOO_CONSUMER_SECRET in environment variables.'
      console.error(error)
      throw new Error(error)
    }
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
        'Authorization': `Basic ${credentials}`,
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
        'Authorization': `Basic ${credentials}`,
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
    queryParams: Record<string, string> = {}
  ): Promise<any> {
    const url = `https://fantasysports.yahooapis.com/fantasy/v2${endpoint}`
    const queryString = new URLSearchParams(queryParams).toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url

    const response = await fetch(fullUrl, {
      method: method.toUpperCase(),
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
