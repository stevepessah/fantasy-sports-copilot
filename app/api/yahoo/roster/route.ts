// Get roster for a Yahoo team
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
    const teamKey = searchParams.get('teamKey')
    
    if (!teamKey) {
      return NextResponse.json(
        { error: 'teamKey parameter is required' },
        { status: 400 }
      )
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)
    
    const response = await api.getTeamRoster(teamKey)
    
    // Return parsed roster as JSON
    return NextResponse.json({ 
      players: response.players,
      teamKey,
      count: response.players.length
    })
  } catch (error) {
    console.error('Error fetching Yahoo roster:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roster', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
