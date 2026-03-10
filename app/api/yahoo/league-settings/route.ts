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
    const leagueKey = searchParams.get('leagueKey')

    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
        { status: 400 }
      )
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)

    const [settingsResponse, leaguesResponse] = await Promise.all([
      api.getLeagueSettings(leagueKey),
      api.getLeagues('mlb'),
    ])

    const league = leaguesResponse.leagues.find(l => l.league_key === leagueKey)

    return NextResponse.json({
      settings: settingsResponse.settings,
      league: league ? {
        league_key: league.league_key,
        league_id: league.league_id,
        name: league.name,
        url: league.url,
        logo_url: league.logo_url,
        num_teams: league.num_teams,
        scoring_type: league.scoring_type,
        league_type: league.league_type,
        draft_status: league.draft_status,
        current_week: league.current_week,
        start_week: league.start_week,
        end_week: league.end_week,
        start_date: league.start_date,
        end_date: league.end_date,
        is_finished: league.is_finished,
        game_code: league.game_code,
      } : null,
    })
  } catch (error: any) {
    console.error('League settings API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch league settings' },
      { status: 500 }
    )
  }
}
