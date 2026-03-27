import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Dev only' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Missing access_token query param' },
      { status: 400 },
    )
  }

  const response = NextResponse.redirect(new URL('/', request.url))

  response.cookies.set('yahoo_access_token', accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })

  if (refreshToken) {
    response.cookies.set('yahoo_refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90,
    })
  }

  return response
}
