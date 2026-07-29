// Get Yahoo leagues for authenticated user
import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { withYahooAuth } from '@/lib/yahoo/auth'
import { classifyYahooError } from '@/lib/yahoo/errors'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await withYahooAuth()
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)
    
    const { searchParams } = new URL(request.url)
    // Game keys: 414 = NFL, 423 = MLB (2024), 406 = MLB (2023), etc.
    // For 2026 MLB, query all games to find the correct game key
    // Use 'all' to get all leagues across all games/seasons
    // Use 'mlb' or 'baseball' to get MLB leagues
    // Use specific game key number (e.g., '450') for a specific season
    let gameKey = searchParams.get('game')
    
    if (!gameKey) {
      // Default to 'all' to see all available games/seasons
      // This will help find the 2026 MLB game key
      gameKey = 'all'
    }
    
    const response = await api.getLeagues(gameKey)
    
    return auth.json(
      { leagues: response.leagues, gameKey, count: response.leagues.length },
      { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    const classified = classifyYahooError(error)
    reportError(error, { source: 'yahoo.leagues', metadata: { code: classified.code } },
      classified.code === 'yahoo_not_authorized' ? 'warning' : 'error')
    return NextResponse.json(
      {
        error: 'Failed to fetch leagues',
        code: classified.code,
        message: classified.message,
        details: classified.details,
      },
      { status: classified.httpStatus },
    )
  }
}
