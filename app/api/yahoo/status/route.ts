// Check Yahoo authentication status
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value
    const userGuid = cookieStore.get('yahoo_user_guid')?.value
    
    return NextResponse.json(
      { authenticated: !!accessToken, userGuid: userGuid || null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
