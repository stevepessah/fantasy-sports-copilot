// Yahoo OAuth 2.0 - Step 2: Handle callback from Yahoo
import { NextRequest, NextResponse } from 'next/server'
import { YahooOAuth2, getYahooRedirectUri } from '@/lib/yahoo/oauth2'
import { cookies } from 'next/headers'
import { recordLogin } from '@/lib/loginLog'

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

    // Must use the SAME redirect_uri that was sent during authorization.
    const oauth2 = new YahooOAuth2(getYahooRedirectUri(request))

    // Exchange authorization code for access token
    const tokens = await oauth2.getAccessToken(code)

    // Fetch the authenticated user's GUID and nickname from the Fantasy API
    let guid = 'unknown'
    let nickname = 'unknown'
    try {
      const profile = await oauth2.makeRequest(
        'GET',
        '/users;use_login=1/games/teams',
        tokens.access_token,
      )
      const xml: string = profile.raw ?? ''

      // GUID lives in the top-level <user> block
      const guidMatch = xml.match(/<guid>(.*?)<\/guid>/)
      if (guidMatch) guid = guidMatch[1].trim()

      // Find the manager whose <guid> matches the user's GUID.
      // (Yahoo sometimes uses self-closing <is_current_login/> instead of
      //  <is_current_login>1</is_current_login>, so matching by GUID is safer.)
      if (guid !== 'unknown') {
        const managerRegex = /<manager>([\s\S]*?)<\/manager>/g
        let m
        while ((m = managerRegex.exec(xml)) !== null) {
          if (m[1].includes(`<guid>${guid}</guid>`)) {
            const nick = m[1].match(/<nickname>(.*?)<\/nickname>/)
            if (nick) {
              nickname = nick[1].trim()
              break
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch Yahoo user identity:', e)
    }

    // Log who connected (visible in Vercel Function Logs + /api/admin/logins)
    console.log('[Yahoo Login]', { guid, nickname, timestamp: new Date().toISOString() })
    recordLogin(guid, nickname)

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

    // Store Yahoo user identity for tracking
    if (guid !== 'unknown') {
      response.cookies.set('yahoo_user_guid', guid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90,
      })
    }
    if (nickname !== 'unknown') {
      response.cookies.set('yahoo_user_nickname', nickname, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90,
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
