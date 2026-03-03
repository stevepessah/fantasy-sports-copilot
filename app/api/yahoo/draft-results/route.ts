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

    // If draft hasn't happened yet, fetch rosters to find keepers
    let keepers: Array<{
      team_key: string
      team_name: string
      team_logo?: string
      team_id: string
      player_key: string
      player_name: string
      display_position?: string
      editorial_team_abbr?: string
      headshot_url?: string
    }> = []

    if (picks.length === 0 && teamsResponse.teams.length > 0) {
      const rosterPromises = teamsResponse.teams.map((t) =>
        api.getTeamRoster(t.team_key).catch(() => ({ players: [] }))
      )
      const rosters = await Promise.all(rosterPromises)

      for (let i = 0; i < teamsResponse.teams.length; i++) {
        const team = teamsResponse.teams[i]
        const roster = rosters[i]
        for (const player of roster.players) {
          keepers.push({
            team_key: team.team_key,
            team_name: teamMap[team.team_key]?.name || team.team_key,
            team_logo: teamMap[team.team_key]?.logo_url,
            team_id: teamMap[team.team_key]?.team_id || team.team_id,
            player_key: player.player_key,
            player_name: player.name?.full || `${player.name?.first} ${player.name?.last}`,
            display_position: player.display_position || player.eligible_positions?.[0],
            editorial_team_abbr: player.editorial_team_abbr,
            headshot_url: player.headshot?.url || player.image_url,
          })
        }
      }
    }

    return NextResponse.json(
      {
        picks,
        keepers,
        teams: teamsResponse.teams.map((t) => ({
          team_key: t.team_key,
          team_id: t.team_id,
          name: t.name,
          logo_url: t.logo_url,
        })),
        totalPicks: picks.length,
        draftComplete: picks.length > 0,
      },
      { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    console.error('Draft results error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch draft results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
