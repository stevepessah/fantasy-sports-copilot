// Yahoo OAuth 2.0 - Step 2: Handle callback from Yahoo
import { NextRequest, NextResponse } from 'next/server'
import { YahooOAuth2 } from '@/lib/yahoo/oauth2'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    
    // Get base URL from request
    const baseUrl = request.headers.get('origin') || request.nextUrl.origin
    const redirectUrl = `${baseUrl}/?yahoo_connected=true`
    
    if (error) {
      console.error('Yahoo OAuth 2.0 error:', error)
      return NextResponse.redirect(`${baseUrl}/?error=oauth_denied`)
    }
    
    if (!code) {
      return NextResponse.redirect(`${baseUrl}/?error=oauth_failed`)
    }
    
    // Verify state for CSRF protection
    const cookieStore = await cookies()
    const storedState = cookieStore.get('yahoo_oauth_state')?.value
    
    if (!storedState || storedState !== state) {
      console.error('State mismatch in OAuth callback')
      return NextResponse.redirect(`${baseUrl}/?error=invalid_state`)
    }
    
    const oauth2 = new YahooOAuth2()
    
    // Exchange authorization code for access token
    const tokens = await oauth2.getAccessToken(code)

    // Log who connected (visible in Vercel Function Logs)
    console.log('[Yahoo Login]', {
      guid: tokens.xoauth_yahoo_guid || 'unknown',
      timestamp: new Date().toISOString(),
    })
    
    // Store access token in cookie (in production, use secure session storage)
    const response = NextResponse.redirect(redirectUrl)
    
    // Store access token
    response.cookies.set('yahoo_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 60 * 60 * 24 * 30, // Use expires_in or default to 30 days
    })
    
    if (tokens.refresh_token) {
      response.cookies.set('yahoo_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90, // 90 days for refresh token
      })
    }

    // Store Yahoo user GUID for identifying the connected user
    if (tokens.xoauth_yahoo_guid) {
      response.cookies.set('yahoo_user_guid', tokens.xoauth_yahoo_guid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90, // 90 days
      })
    }
    
    // Clear state cookie
    response.cookies.delete('yahoo_oauth_state')
    
    return response
  } catch (error) {
    console.error('Yahoo OAuth 2.0 callback error:', error)
    const baseUrl = request.headers.get('origin') || request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/?error=oauth_callback_failed`)
  }
}
