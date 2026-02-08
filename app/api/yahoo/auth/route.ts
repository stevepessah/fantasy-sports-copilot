// Yahoo OAuth 2.0 - Step 1: Redirect to Yahoo authorization
import { NextRequest, NextResponse } from 'next/server'
import { YahooOAuth2 } from '@/lib/yahoo/oauth2'

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

    const oauth2 = new YahooOAuth2()
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex')
    
    // Get authorization URL and redirect user
    const authUrl = oauth2.getAuthorizationUrl(state)
    
    // Store state in cookie for verification in callback
    const response = NextResponse.redirect(authUrl)
    
    response.cookies.set('yahoo_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    })
    
    return response
  } catch (error) {
    console.error('Yahoo OAuth 2.0 error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Yahoo OAuth', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
