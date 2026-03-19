// Get matchups for a Yahoo league — returns parsed scoreboard data
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
    const leagueKey = searchParams.get('leagueKey')
    const week = searchParams.get('week')
    
    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
        { status: 400 }
      )
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)
    
    const { scoreboard } = await api.getMatchups(leagueKey, week ? parseInt(week) : undefined)
    
    return auth.json({ scoreboard })
  } catch (error) {
    console.error('Error fetching Yahoo matchups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch matchups', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
