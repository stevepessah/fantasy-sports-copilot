// Yahoo OAuth 1.0a Implementation
// Yahoo uses OAuth 1.0a, not OAuth 2.0

import crypto from 'crypto'
import { YAHOO_CONFIG, YahooOAuthTokens, YahooAccessToken } from './config'

export class YahooOAuth {
  private consumerKey: string
  private consumerSecret: string
  private callbackUrl: string

  constructor() {
    this.consumerKey = process.env.YAHOO_CONSUMER_KEY || ''
    this.consumerSecret = process.env.YAHOO_CONSUMER_SECRET || ''
    this.callbackUrl = YAHOO_CONFIG.callbackUrl

    if (!this.consumerKey || !this.consumerSecret) {
      const error = 'Yahoo OAuth credentials not configured. Set YAHOO_CONSUMER_KEY and YAHOO_CONSUMER_SECRET in environment variables.'
      console.error(error)
      console.error('Consumer Key present:', !!this.consumerKey)
      console.error('Consumer Secret present:', !!this.consumerSecret)
      throw new Error(error)
    }
    
    console.log('Yahoo OAuth initialized:', {
      callbackUrl: this.callbackUrl,
      consumerKeyPrefix: this.consumerKey.substring(0, 10) + '...',
      hasSecret: !!this.consumerSecret,
    })
  }

  /**
   * Generate OAuth signature according to OAuth 1.0a spec
   */
  private generateSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    tokenSecret: string = ''
  ): string {
    // Normalize URL (remove query params, normalize port)
    const normalizedUrl = this.normalizeUrl(url)
    
    // Create parameter string - sort keys and encode properly
    const sortedKeys = Object.keys(params).sort()
    const paramPairs = sortedKeys.map(key => {
      // OAuth 1.0a requires RFC 3986 encoding
      return `${this.rfc3986Encode(key)}=${this.rfc3986Encode(params[key])}`
    })
    const paramString = paramPairs.join('&')

    // Create signature base string: METHOD & normalized_url & normalized_parameters
    const signatureBaseString = [
      method.toUpperCase(),
      this.rfc3986Encode(normalizedUrl),
      this.rfc3986Encode(paramString),
    ].join('&')

    // Create signing key: consumer_secret & token_secret
    const signingKey = `${this.rfc3986Encode(this.consumerSecret)}&${this.rfc3986Encode(tokenSecret)}`

    // Generate HMAC-SHA1 signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64')

    return signature
  }

  /**
   * RFC 3986 encoding (OAuth 1.0a standard)
   * Slightly different from encodeURIComponent - encodes more characters
   */
  private rfc3986Encode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A')
  }

  /**
   * Generate OAuth parameters
   */
  private generateOAuthParams(
    method: string,
    url: string,
    tokenSecret: string = '',
    additionalParams: Record<string, string> = {}
  ): Record<string, string> {
    const params: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
      ...additionalParams,
    }

    // Generate signature (MUST be calculated WITHOUT oauth_signature in params)
    const signature = this.generateSignature(method, url, params, tokenSecret)
    
    // Add signature AFTER calculation
    params.oauth_signature = signature

    return params
  }

  /**
   * Normalize URL for OAuth signature (remove query params, normalize)
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // Return base URL without query or fragment
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`
    } catch {
      // If URL parsing fails, return as-is
      return url
    }
  }

  /**
   * Get request token (step 1 of OAuth flow)
   * Yahoo OAuth 1.0a requires POST with form data
   * 
   * Note: Yahoo Fantasy Sports API uses OAuth 1.0a, not OAuth 2.0
   */
  async getRequestToken(): Promise<YahooOAuthTokens> {
    const url = YAHOO_CONFIG.requestTokenUrl
    const params = this.generateOAuthParams('POST', url, '', {
      oauth_callback: this.callbackUrl,
    })

    // Convert params to form data format (use RFC 3986 encoding)
    const formData = Object.keys(params)
      .map(key => `${this.rfc3986Encode(key)}=${this.rfc3986Encode(params[key])}`)
      .join('&')

    // Log detailed request info for debugging
    console.log('Yahoo OAuth Request Details:', {
      url,
      callbackUrl: this.callbackUrl,
      consumerKey: this.consumerKey ? `${this.consumerKey.substring(0, 10)}...` : 'MISSING',
      hasConsumerSecret: !!this.consumerSecret,
      paramsCount: Object.keys(params).length,
      paramKeys: Object.keys(params).sort(),
      formDataPreview: formData.substring(0, 200) + '...',
    })
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Fantasy-Sports-Copilot/1.0',
      },
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Yahoo OAuth error:', {
        status: response.status,
        statusText: response.statusText,
        body: text,
        url,
        callbackUrl: this.callbackUrl,
        headers: Object.fromEntries(response.headers.entries()),
      })
      throw new Error(`Failed to get request token: ${response.status} ${text}`)
    }

    const text = await response.text()
    const tokenData = this.parseOAuthResponse(text)

    return {
      oauth_token: tokenData.oauth_token,
      oauth_token_secret: tokenData.oauth_token_secret,
    }
  }

  /**
   * Get authorization URL (step 2 - redirect user here)
   */
  getAuthorizationUrl(requestToken: string): string {
    return `${YAHOO_CONFIG.authorizeUrl}?oauth_token=${encodeURIComponent(requestToken)}`
  }

  /**
   * Exchange request token for access token (step 3)
   * Yahoo OAuth 1.0a requires POST with form data
   */
  async getAccessToken(
    requestToken: string,
    requestTokenSecret: string,
    verifier: string
  ): Promise<YahooAccessToken> {
    const url = YAHOO_CONFIG.accessTokenUrl
    const params = this.generateOAuthParams('POST', url, requestTokenSecret, {
      oauth_token: requestToken,
      oauth_verifier: verifier,
    })

    // Convert params to form data format
    const formData = Object.keys(params)
      .map(key => `${this.rfc3986Encode(key)}=${this.rfc3986Encode(params[key])}`)
      .join('&')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to get access token: ${response.status} ${text}`)
    }

    const text = await response.text()
    const responseParams = this.parseOAuthResponse(text)
    return this.toYahooAccessToken(responseParams)
  }

  /**
   * Refresh access token using session handle
   * Yahoo OAuth 1.0a requires POST with form data
   */
  async refreshAccessToken(
    accessToken: string,
    accessTokenSecret: string,
    sessionHandle: string
  ): Promise<YahooAccessToken> {
    const url = YAHOO_CONFIG.accessTokenUrl
    const params = this.generateOAuthParams('POST', url, accessTokenSecret, {
      oauth_token: accessToken,
      oauth_session_handle: sessionHandle,
    })

    // Convert params to form data format
    const formData = Object.keys(params)
      .map(key => `${this.rfc3986Encode(key)}=${this.rfc3986Encode(params[key])}`)
      .join('&')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to refresh access token: ${response.status} ${text}`)
    }

    const text = await response.text()
    const responseParams = this.parseOAuthResponse(text)
    return this.toYahooAccessToken(responseParams)
  }

  /**
   * Make authenticated API request
   */
  async makeRequest(
    method: string,
    endpoint: string,
    accessToken: string,
    accessTokenSecret: string,
    queryParams: Record<string, string> = {}
  ): Promise<any> {
    const url = `${YAHOO_CONFIG.apiBaseUrl}${endpoint}`
    const params = this.generateOAuthParams(method, url, accessTokenSecret, {
      oauth_token: accessToken,
      ...queryParams,
    })

    const queryString = Object.keys(params)
      .map(key => `${this.rfc3986Encode(key)}=${this.rfc3986Encode(params[key])}`)
      .join('&')

    const fullUrl = `${url}?${queryString}`

    const response = await fetch(fullUrl, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Yahoo API request failed: ${response.status} ${text}`)
    }

    const xmlText = await response.text()
    // Yahoo returns XML, we'll need to parse it
    return this.parseXMLResponse(xmlText)
  }

  /**
   * Parse OAuth response (key=value format)
   */
  private parseOAuthResponse(text: string): Record<string, string> {
    const params: Record<string, string> = {}
    const pairs = text.split('&')
    for (const pair of pairs) {
      const [key, value] = pair.split('=')
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value)
      }
    }
    return params
  }

  /**
   * Convert parsed OAuth response to YahooAccessToken
   */
  private toYahooAccessToken(params: Record<string, string>): YahooAccessToken {
    return {
      oauth_token: params.oauth_token || '',
      oauth_token_secret: params.oauth_token_secret || '',
      oauth_session_handle: params.oauth_session_handle || '',
      oauth_expires_in: params.oauth_expires_in,
      xoauth_yahoo_guid: params.xoauth_yahoo_guid,
    }
  }

  /**
   * Parse XML response (simplified - you may want to use a proper XML parser)
   * For now, we'll return the raw XML and parse it in the API service
   */
  private parseXMLResponse(xml: string): any {
    // Yahoo returns XML, but for MVP we'll parse it simply
    // In production, use a proper XML parser like 'xml2js'
    return { raw: xml }
  }
}
