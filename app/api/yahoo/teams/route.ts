// Get teams for a Yahoo league
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
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    let leagueKey = searchParams.get('leagueKey')
    
    if (!leagueKey) {
      return NextResponse.json(
        { 
          error: 'leagueKey parameter is required',
          note: 'League key format: 414.l.LEAGUE_ID (e.g., 414.l.45462)'
        },
        { status: 400 }
      )
    }
    
    // If user provided just the league ID, convert to full league key format
    // Yahoo league keys are: game_key.l.league_id (e.g., 414.l.45462 for NFL, 423.l.45462 for MLB)
    if (!leagueKey.includes('.')) {
      // Try MLB first (423), but user might need to specify
      // For now, default to 423 (MLB 2024), but this might need to be configurable
      leagueKey = `423.l.${leagueKey}`
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)
    
    const response = await api.getLeagueTeams(leagueKey)
    
    // Return raw XML response for debugging
    return NextResponse.json({ 
      raw: response.raw,
      leagueKey,
      note: 'Yahoo returns XML. Use the full league key format: 414.l.LEAGUE_ID'
    })
  } catch (error) {
    console.error('Error fetching Yahoo teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
