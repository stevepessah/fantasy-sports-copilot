// Yahoo OAuth - Step 1: Get request token and redirect to Yahoo
import { NextRequest, NextResponse } from 'next/server'
import { YahooOAuth } from '@/lib/yahoo/oauth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify environment variables are set
    if (!process.env.YAHOO_CONSUMER_KEY || !process.env.YAHOO_CONSUMER_SECRET) {
      console.error('Missing Yahoo OAuth credentials in environment variables')
      return NextResponse.json(
        { 
          error: 'Yahoo OAuth not configured',
          details: 'YAHOO_CONSUMER_KEY and YAHOO_CONSUMER_SECRET must be set in Vercel environment variables'
        },
        { status: 500 }
      )
    }

    const oauth = new YahooOAuth()
    
    // Get request token
    const requestToken = await oauth.getRequestToken()
    
    // Store request token secret in session/cookie for callback
    // For MVP, we'll use a simple approach with cookies
    const response = NextResponse.redirect(
      oauth.getAuthorizationUrl(requestToken.oauth_token)
    )
    
    // Store token secret in httpOnly cookie
    response.cookies.set('yahoo_request_token_secret', requestToken.oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    })
    
    response.cookies.set('yahoo_request_token', requestToken.oauth_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    })
    
    return response
  } catch (error) {
    console.error('Yahoo OAuth error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Yahoo OAuth', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
