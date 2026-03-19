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

    if (!leagueKey) {
      return NextResponse.json(
        { error: 'leagueKey parameter is required' },
        { status: 400 }
      )
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)

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

    // If draft hasn't happened yet, fetch owned players (keepers) via the
    // league players endpoint with status=T (taken) + ownership sub-resource.
    // This is the same data source the Players tab uses successfully.
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
      const PAGE_SIZE = 25
      const MAX_PAGES = 10

      const fetchPage = (start: number) =>
        api.getPlayers(leagueKey, {
          start,
          count: PAGE_SIZE,
          status: 'T',
          sort: 'AR',
          out: 'ownership',
        }).catch(() => ({ players: [] }))

      const firstPage = await fetchPage(0)
      const allPlayers = [...firstPage.players]

      // Fetch remaining pages if needed
      if (firstPage.players.length >= PAGE_SIZE) {
        for (let page = 1; page < MAX_PAGES; page++) {
          const result = await fetchPage(page * PAGE_SIZE)
          allPlayers.push(...result.players)
          if (result.players.length < PAGE_SIZE) break
        }
      }

      for (const player of allPlayers) {
        if (player.owner_team_key) {
          keepers.push({
            team_key: player.owner_team_key,
            team_name: teamMap[player.owner_team_key]?.name || player.owner_team_name || player.owner_team_key,
            team_logo: teamMap[player.owner_team_key]?.logo_url,
            team_id: teamMap[player.owner_team_key]?.team_id || '',
            player_key: player.player_key,
            player_name: player.name?.full || `${player.name?.first || ''} ${player.name?.last || ''}`.trim(),
            display_position: player.display_position || player.eligible_positions?.[0],
            editorial_team_abbr: player.editorial_team_abbr,
            headshot_url: player.headshot?.url || player.image_url,
          })
        }
      }
    }

    return auth.json(
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
