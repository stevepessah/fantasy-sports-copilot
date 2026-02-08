// Get all available Yahoo games/seasons for authenticated user
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
    
    // Query all games to see what seasons are available
    const response = await api.getGames()
    
    // Return raw XML response - this will show all available game keys and seasons
    return NextResponse.json({ 
      raw: response.raw,
      note: 'This shows all available games/seasons. Look for game_key and season to find 2026 MLB.'
    })
  } catch (error) {
    console.error('Error fetching Yahoo games:', error)
    return NextResponse.json(
      { error: 'Failed to fetch games', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
