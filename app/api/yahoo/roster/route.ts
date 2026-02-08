// Get roster for a Yahoo team
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
    const teamKey = searchParams.get('teamKey')
    
    if (!teamKey) {
      return NextResponse.json(
        { error: 'teamKey parameter is required' },
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
    
    const roster = await api.getTeamRoster(teamKey)
    
    return NextResponse.json({ roster })
  } catch (error) {
    console.error('Error fetching Yahoo roster:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roster', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
