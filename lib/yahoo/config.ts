// Yahoo Fantasy Sports API Configuration

/**
 * Maps MLB season year → Yahoo game key.
 * Shared across API routes and lib code.
 */
export const MLB_SEASON_TO_GAME_KEY: Record<number, string> = {
  2026: '469',
  2025: '458',
  2024: '431',
  2023: '422',
  2022: '414',
}

export const YAHOO_CONFIG = {
  // OAuth 1.0a endpoints (standard for Fantasy Sports API)
  requestTokenUrl: 'https://api.login.yahoo.com/oauth/v1/get_request_token',
  authorizeUrl: 'https://api.login.yahoo.com/oauth/v1/request_auth',
  accessTokenUrl: 'https://api.login.yahoo.com/oauth/v1/get_token',
  
  // API base URL
  apiBaseUrl: 'https://fantasysports.yahooapis.com/fantasy/v2',
  
  // OAuth callback URL (will be set in environment)
  callbackUrl: process.env.YAHOO_CALLBACK_URL || 'http://localhost:3000/api/yahoo/callback',
  
  // Required scopes for Fantasy Sports
  scope: 'fspt-r', // Read-only access to fantasy sports
}

export interface YahooOAuthTokens {
  oauth_token: string
  oauth_token_secret: string
  oauth_verifier?: string
  oauth_session_handle?: string
}

export interface YahooAccessToken {
  oauth_token: string
  oauth_token_secret: string
  oauth_session_handle: string
  oauth_expires_in?: string
  xoauth_yahoo_guid?: string
}
