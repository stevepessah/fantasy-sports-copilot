// Get Yahoo leagues for authenticated user
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
        { error: 'Not authenticated. Please connect your Yahoo account first.' },
        { status: 401 }
      )
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)
    
    const { searchParams } = new URL(request.url)
    const gameKey = searchParams.get('game') || '414' // 414 is MLB game key
    
    const response = await api.getLeagues(gameKey)
    
    // Return raw XML response for debugging
    // Yahoo returns XML, so we'll return it as-is for now
    return NextResponse.json({ 
      raw: response.raw,
      gameKey,
      note: 'Yahoo returns XML. League keys are in format: 414.l.LEAGUE_ID'
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    console.error('Error fetching Yahoo leagues:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leagues', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
