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
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)
    let leagueKey = searchParams.get('leagueKey')

    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
        { status: 400 },
      )
    }

    if (!leagueKey.includes('.')) {
      leagueKey = `469.l.${leagueKey}`
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)

    const { standings } = await api.getStandings(leagueKey)

    return NextResponse.json(
      { standings, leagueKey, count: standings.length },
      { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch standings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
