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

    const [draftResponse, teamsResponse] = await Promise.all([
      api.getDraftResults(leagueKey),
      api.getLeagueTeams(leagueKey),
    ])

    const teamMap = Object.fromEntries(
      teamsResponse.teams.map((t) => [t.team_key, { name: t.name, logo_url: t.logo_url, team_id: t.team_id }])
    )

    const picks = draftResponse.draftResults.picks.map((p) => ({
      ...p,
      team_name: teamMap[p.team_key]?.name || p.team_key,
      team_logo: teamMap[p.team_key]?.logo_url,
      team_id: teamMap[p.team_key]?.team_id,
    }))

    return NextResponse.json(
      {
        picks,
        teams: teamsResponse.teams.map((t) => ({
          team_key: t.team_key,
          team_id: t.team_id,
          name: t.name,
          logo_url: t.logo_url,
        })),
        totalPicks: picks.length,
      },
      { headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch draft results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
