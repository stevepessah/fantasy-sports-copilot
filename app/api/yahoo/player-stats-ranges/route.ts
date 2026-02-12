import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * Get player statistics for multiple date ranges
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
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
    api.setAccessToken(accessToken)
    
    const stats = await api.getPlayerStatsMultipleRanges(playerKey, leagueKey || undefined, season)
    
    // Return parsed stats as JSON
    return NextResponse.json({ 
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
