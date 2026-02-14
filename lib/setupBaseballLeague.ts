// Utility function to set up the baseball league from Yahoo API data
import { leagueDB, teamDB, matchupDB, rosterDB } from '@/lib/db'
import { League, Team } from '@/types'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { ParsedLeague, ParsedStandingsTeam } from '@/lib/yahoo/xmlParser'

export const REGULAR_SEASON_WEEKS = 22
export const PLAYOFF_WEEKS = 3
export const TOTAL_WEEKS = 25

/**
 * Set up the baseball league by fetching real data from the Yahoo Fantasy API.
 * Populates the in-memory DB with the authenticated user's league, teams, and standings.
 *
 * @param accessToken  Yahoo OAuth2 access token
 * @param gameKey      Yahoo game key (defaults to 'mlb' → current season)
 * @returns The hydrated league, teams list, and the user's team key
 */
export async function setupBaseballLeague(accessToken: string, gameKey: string = 'mlb') {
  const api = new YahooFantasyAPI()
  api.setAccessToken(accessToken)

  // 1. Fetch the user's leagues for this game key
  const { leagues: yahooLeagues } = await api.getLeagues(gameKey)

  // Pick the active (not finished) league, or fall back to the first one
  const yahooLeague: ParsedLeague | undefined =
    yahooLeagues.find(l => l.is_finished !== '1') || yahooLeagues[0]

  if (!yahooLeague) {
    throw new Error('No Yahoo Fantasy Baseball league found for the authenticated user.')
  }

  // Avoid re-creating if this Yahoo league is already in the in-memory DB
  const existing = leagueDB.get(yahooLeague.league_key)
  if (existing) {
    const teams = teamDB.getByLeague(existing.id)
    return { league: existing, teams, yahooLeagueKey: yahooLeague.league_key }
  }

  // 2. Create the League record from Yahoo data
  const league: League = {
    id: yahooLeague.league_key,
    name: yahooLeague.name,
    commissionerId: '', // filled below if we can identify
    sport: 'baseball',
    type: 'redraft',
    numTeams: yahooLeague.num_teams,
    scoringType: mapScoringType(yahooLeague.scoring_type),
    draftType: 'snake',
    status: mapLeagueStatus(yahooLeague),
    createdAt: new Date().toISOString(),
    period: yahooLeague.current_week ? parseInt(yahooLeague.current_week, 10) : 1,
    season: yahooLeague.season ? parseInt(yahooLeague.season, 10) : new Date().getFullYear(),
  }

  const createdLeague = leagueDB.create(league)

  // 3. Fetch standings (includes team records, wins/losses, etc.)
  let standingsTeams: ParsedStandingsTeam[] = []
  try {
    const { standings } = await api.getStandings(yahooLeague.league_key)
    standingsTeams = standings
  } catch {
    // If standings aren't available (e.g. pre-season), fall back to plain teams
  }

  // 4. If we got standings, use those (they include W/L data). Otherwise fetch plain teams.
  let teams: Team[] = []

  if (standingsTeams.length > 0) {
    teams = standingsTeams.map((st, index) => {
      const isCommissioner = st.managers?.some(m => m.is_commissioner === '1')
      if (isCommissioner && !createdLeague.commissionerId) {
        const commMgr = st.managers!.find(m => m.is_commissioner === '1')
        createdLeague.commissionerId = commMgr?.guid || commMgr?.manager_id || ''
        leagueDB.update(createdLeague.id, { commissionerId: createdLeague.commissionerId })
      }

      const ownerId = st.managers?.[0]?.guid || st.managers?.[0]?.manager_id || `owner_${index + 1}`
      const team: Team = {
        id: st.team_key,
        leagueId: createdLeague.id,
        ownerId,
        name: st.name,
        draftPosition: index + 1,
        wins: st.wins ?? 0,
        losses: st.losses ?? 0,
        ties: st.ties ?? 0,
        pointsFor: st.points_for ?? 0,
        pointsAgainst: st.points_against ?? 0,
      }

      teamDB.create(team)

      // Create empty roster for each team (will be populated on demand)
      rosterDB.create({ teamId: team.id, players: [] })

      return team
    })
  } else {
    // Fallback: use plain team list (no W/L data yet)
    const { teams: yahooTeams } = await api.getLeagueTeams(yahooLeague.league_key)

    teams = yahooTeams.map((yt, index) => {
      const isCommissioner = yt.managers?.some(m => m.is_commissioner === '1')
      if (isCommissioner && !createdLeague.commissionerId) {
        const commMgr = yt.managers!.find(m => m.is_commissioner === '1')
        createdLeague.commissionerId = commMgr?.guid || commMgr?.manager_id || ''
        leagueDB.update(createdLeague.id, { commissionerId: createdLeague.commissionerId })
      }

      const ownerId = yt.managers?.[0]?.guid || yt.managers?.[0]?.manager_id || `owner_${index + 1}`
      const team: Team = {
        id: yt.team_key,
        leagueId: createdLeague.id,
        ownerId,
        name: yt.name,
        draftPosition: index + 1,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      }

      teamDB.create(team)
      rosterDB.create({ teamId: team.id, players: [] })

      return team
    })
  }

  return {
    league: createdLeague,
    teams,
    yahooLeagueKey: yahooLeague.league_key,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapScoringType(yahoScoringType: string): League['scoringType'] {
  const lower = yahoScoringType.toLowerCase()
  if (lower.includes('roto')) return 'roto'
  if (lower.includes('point')) return 'points'
  if (lower.includes('head')) return 'head-to-head'
  return 'head-to-head'
}

function mapLeagueStatus(yahooLeague: ParsedLeague): League['status'] {
  if (yahooLeague.is_finished === '1') return 'completed'
  if (yahooLeague.draft_status === 'predraft') return 'setup'
  if (yahooLeague.draft_status === 'draft') return 'draft'
  return 'active'
}
