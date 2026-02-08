// Get teams for a Yahoo league
import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { YahooAccessToken } from '@/lib/yahoo/config'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value
    const accessTokenSecret = cookieStore.get('yahoo_access_token_secret')?.value
    const sessionHandle = cookieStore.get('yahoo_session_handle')?.value
    
    if (!accessToken || !accessTokenSecret) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const leagueKey = searchParams.get('leagueKey')
    
    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
        { status: 400 }
      )
    }
    
    const yahooToken: YahooAccessToken = {
      oauth_token: accessToken,
      oauth_token_secret: accessTokenSecret,
      oauth_session_handle: sessionHandle || '',
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(yahooToken)
    
    const teams = await api.getLeagueTeams(leagueKey)
    
    return NextResponse.json({ teams })
  } catch (error) {
    console.error('Error fetching Yahoo teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
