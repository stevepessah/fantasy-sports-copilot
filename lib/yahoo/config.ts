// Yahoo Fantasy Sports API Configuration

export const YAHOO_CONFIG = {
  // OAuth endpoints
  // Try v1 endpoints first (Yahoo Fantasy Sports API might use v1, not v2)
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
