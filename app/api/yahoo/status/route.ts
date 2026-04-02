// Check Yahoo authentication status
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken =
      cookieStore.get('yahoo_access_token')?.value ||
      (process.env.NODE_ENV !== 'production' ? process.env.YAHOO_DEV_ACCESS_TOKEN : undefined)
    const userGuid = cookieStore.get('yahoo_user_guid')?.value
    const userNickname = cookieStore.get('yahoo_user_nickname')?.value
    
    return NextResponse.json(
      {
        authenticated: !!accessToken,
        userGuid: userGuid || null,
        userNickname: userNickname || null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
