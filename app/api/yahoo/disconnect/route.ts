import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const cookieStore = await cookies()

    cookieStore.delete('yahoo_access_token')
    cookieStore.delete('yahoo_refresh_token')
    cookieStore.delete('yahoo_oauth_state')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting from Yahoo:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 },
    )
  }
}
