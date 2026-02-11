import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * Get player statistics for multiple seasons
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
    const seasonsParam = searchParams.get('seasons')
    
    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }
    
    // Parse seasons from comma-separated string (e.g., "2024,2025,2026")
    const seasons = seasonsParam 
      ? seasonsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(s => !isNaN(s))
      : [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)
    
    console.log('Fetching player stats for multiple seasons:', { playerKey, leagueKey, seasons })
    
    // Fetch stats for each season in parallel
    const seasonStats = await Promise.all(
      seasons.map(async (season) => {
        try {
          const response = await api.getPlayerStats(playerKey, leagueKey || undefined, season)
          return {
            season,
            stats: response.stats
          }
        } catch (error) {
          console.error(`Error fetching stats for season ${season}:`, error)
          return {
            season,
            stats: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )
    
    console.log('Player stats seasons response:', {
      seasons,
      hasStats: seasonStats.map(s => ({ season: s.season, hasStats: !!s.stats }))
    })
    
    // Return parsed stats as JSON
    return NextResponse.json({ 
      seasonStats,
      playerKey,
      leagueKey: leagueKey || null
    })
  } catch (error) {
    console.error('Error fetching Yahoo player stats for seasons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
