// Get Yahoo leagues for authenticated user
import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect your Yahoo account first.' },
        { status: 401 }
      )
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)
    
    const { searchParams } = new URL(request.url)
    const gameKey = searchParams.get('game') || 'mlb'
    
    const leagues = await api.getLeagues(gameKey)
    
    return NextResponse.json({ leagues })
  } catch (error) {
    console.error('Error fetching Yahoo leagues:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leagues', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
