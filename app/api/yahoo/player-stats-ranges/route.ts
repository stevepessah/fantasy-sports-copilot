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
    
    const { searchParams } = new URL(request.url)
    const playerKey = searchParams.get('playerKey')
    const leagueKey = searchParams.get('leagueKey')
    const seasonParam = searchParams.get('season')
    const season = seasonParam ? parseInt(seasonParam, 10) : undefined
    
    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)
    
    const stats = await api.getPlayerStatsMultipleRanges(playerKey, leagueKey || undefined, season)
    
    return auth.json({ 
      stats,
      playerKey,
      leagueKey: leagueKey || null,
      season: season || null
    })
  } catch (error) {
    console.error('Error fetching Yahoo player stats ranges:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
