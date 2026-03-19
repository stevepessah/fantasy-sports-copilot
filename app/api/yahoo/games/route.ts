// Get all available Yahoo games/seasons for authenticated user
import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { withYahooAuth } from '@/lib/yahoo/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await withYahooAuth()
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)
    
    const response = await api.getGames()
    
    return auth.json({ 
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
