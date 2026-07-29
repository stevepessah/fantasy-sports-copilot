import { NextRequest, NextResponse } from 'next/server'
import { isNonProdEnvironment } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Inject Yahoo tokens directly as cookies to skip the interactive OAuth flow.
 *
 * Enabled on local dev AND Vercel Preview so you can test the authenticated app
 * state on a preview without clicking through Yahoo every time. It is blocked on
 * real production. This only sets cookies in the caller's own browser using
 * tokens the caller supplies, so it cannot authenticate anyone else.
 */
export async function GET(request: NextRequest) {
  if (!isNonProdEnvironment()) {
    return NextResponse.json({ error: 'Dev/preview only' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access_token query param' }, { status: 400 })
  }

  const response = NextResponse.redirect(new URL('/', request.url))

  // On HTTPS (e.g. Vercel Preview) the cookie must be Secure to be stored.
  const secure = process.env.NODE_ENV === 'production'

  response.cookies.set('yahoo_access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })

  if (refreshToken) {
    response.cookies.set('yahoo_refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90,
    })
  }

  return response
}
