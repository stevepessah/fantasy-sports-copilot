// Get roster for a Yahoo team
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
    const teamKey = searchParams.get('teamKey')
    
    if (!teamKey) {
      return NextResponse.json(
        { error: 'teamKey parameter is required' },
        { status: 400 }
      )
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)
    
    const response = await api.getTeamRoster(teamKey)
    
    return auth.json(
      { players: response.players, teamKey, count: response.players.length },
      { headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=120' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch roster', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
