// Yahoo OAuth - Step 2: Handle callback from Yahoo
import { NextRequest, NextResponse } from 'next/server'
import { YahooOAuth } from '@/lib/yahoo/oauth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const oauthToken = searchParams.get('oauth_token')
    const oauthVerifier = searchParams.get('oauth_verifier')
    
    // Get base URL from request
    const baseUrl = request.headers.get('origin') || request.nextUrl.origin
    const redirectUrl = `${baseUrl}/?yahoo_connected=true`
    
    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(`${baseUrl}/?error=oauth_failed`)
    }
    
    // Get stored request token secret from cookie
    const cookieStore = await cookies()
    const requestTokenSecret = cookieStore.get('yahoo_request_token_secret')?.value
    const storedRequestToken = cookieStore.get('yahoo_request_token')?.value
    
    if (!requestTokenSecret || storedRequestToken !== oauthToken) {
      return NextResponse.redirect(`${baseUrl}/?error=invalid_token`)
    }
    
    const oauth = new YahooOAuth()
    
    // Exchange request token for access token
    const accessToken = await oauth.getAccessToken(
      oauthToken,
      requestTokenSecret,
      oauthVerifier
    )
    
    // Store access token in cookie (in production, use secure session storage)
    const response = NextResponse.redirect(redirectUrl)
    
    // Store access token (in production, use encrypted session storage)
    response.cookies.set('yahoo_access_token', accessToken.oauth_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    
    response.cookies.set('yahoo_access_token_secret', accessToken.oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    
    if (accessToken.oauth_session_handle) {
      response.cookies.set('yahoo_session_handle', accessToken.oauth_session_handle, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
    
    // Clear request token cookies
    response.cookies.delete('yahoo_request_token')
    response.cookies.delete('yahoo_request_token_secret')
    
    return response
  } catch (error) {
    console.error('Yahoo OAuth callback error:', error)
    const baseUrl = request.headers.get('origin') || request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/?error=oauth_callback_failed`)
  }
}
