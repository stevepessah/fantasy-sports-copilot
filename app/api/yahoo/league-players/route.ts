import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { ParsedRosterPlayer } from '@/lib/yahoo/xmlParser'

export interface LeaguePlayerEntry {
  playerKey: string
  playerId: string
  name: string
  team: string           // MLB team abbreviation
  positions: string[]    // eligible positions
  positionType: string   // 'B' for batter, 'P' for pitcher
  fantasyTeam: string    // owning fantasy team name
  fantasyTeamKey: string
  status?: string        // injury status
  selectedPosition: string
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueKey = searchParams.get('leagueKey')
    const positionType = searchParams.get('positionType') // 'B' or 'P'

    if (!leagueKey) {
      return NextResponse.json({ error: 'leagueKey is required' }, { status: 400 })
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)

    // 1. Get all teams in the league
    const { teams } = await api.getLeagueTeams(leagueKey)

    if (!teams || teams.length === 0) {
      return NextResponse.json({ players: [], total: 0 })
    }

    // 2. Fetch rosters for all teams in parallel
    const rosterPromises = teams.map(async (team) => {
      try {
        const { players } = await api.getTeamRoster(team.team_key)
        return { team, players }
      } catch (err) {
        console.error(`Error fetching roster for team ${team.name}:`, err)
        return { team, players: [] as ParsedRosterPlayer[] }
      }
    })

    const rosterResults = await Promise.all(rosterPromises)

    // 3. Aggregate and filter players
    const allPlayers: LeaguePlayerEntry[] = []

    for (const { team, players } of rosterResults) {
      for (const player of players) {
        // Filter by position type if specified
        if (positionType && player.position_type && player.position_type.toUpperCase() !== positionType.toUpperCase()) {
          continue
        }

        allPlayers.push({
          playerKey: player.player_key,
          playerId: player.player_id,
          name: player.name?.full || `${player.name?.first || ''} ${player.name?.last || ''}`.trim(),
          team: player.editorial_team_abbr || '',
          positions: player.eligible_positions || [],
          positionType: player.position_type || '',
          fantasyTeam: team.name,
          fantasyTeamKey: team.team_key,
          status: player.injury_status || player.status,
          selectedPosition: player.selected_position?.position || '',
        })
      }
    }

    // Sort alphabetically by last name, then first name
    allPlayers.sort((a, b) => {
      const aLast = a.name.split(' ').slice(-1)[0] || ''
      const bLast = b.name.split(' ').slice(-1)[0] || ''
      if (aLast !== bLast) return aLast.localeCompare(bLast)
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      players: allPlayers,
      total: allPlayers.length,
      positionType: positionType || 'all',
    })
  } catch (error: any) {
    console.error('Error in league-players API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch league players' },
      { status: 500 }
    )
  }
}
