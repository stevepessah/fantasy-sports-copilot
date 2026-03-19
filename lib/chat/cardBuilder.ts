import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { leagueDB, teamDB, playerDB } from '@/lib/db'
import { LeagueManager } from '@/lib/league'
import { parseIntent } from '@/lib/commandParser'
import { setupBaseballLeague } from '@/lib/setupBaseballLeague'
import { fetchLeaguePlayers } from '@/lib/yahoo/leaguePlayers'
import { getPlayerOwnership } from '@/lib/yahoo/playerSearch'
import { buildMatchupCards } from './matchupCards'

async function getOptimalLineup(teamId: string, leagueId: string) {
  const league = await leagueDB.get(leagueId)
  if (!league) return null
  return await LeagueManager.optimizeLineup(teamId, league)
}

export async function buildCardsForIntent(
  intent: ReturnType<typeof parseIntent>,
  context: any,
  message: string,
  currentSport: string,
  yahooAccessToken: string | undefined,
  embeddedPlayerKey?: string,
): Promise<any[]> {
  const cards: any[] = []

  try {
    if ((intent.isShowLineup || intent.isSetLineup) && context.teamId && context.league) {
      const optimal = await getOptimalLineup(context.teamId, context.league.id)
      if (optimal) {
        cards.push({
          type: 'lineup',
          title: intent.isSetLineup ? 'Your Lineup (Optimized)' : 'Your Lineup',
          payload: {
            teamName: context.team?.name || 'Your Team',
            week: context.league.week || 1,
            slots: await Promise.all(optimal.starters.map(async (s: any) => ({
              slot: s.position,
              player: {
                name: (await playerDB.get(s.playerId))?.name || 'Unknown',
                position: (await playerDB.get(s.playerId))?.position || '',
                team: (await playerDB.get(s.playerId))?.team || '',
                projectedPoints: s.projectedPoints,
              },
            }))),
            projectedTotal: optimal.totalProjected,
          },
        })
      }
    }

    if (intent.isMatchup && yahooAccessToken && context.yahooLeagueKey) {
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)
        const { teams: yahooTeams } = await api.getLeagueTeams(context.yahooLeagueKey)
        const userTeam = yahooTeams.find((t: any) => t.managers?.some((m: any) => m.is_current_login === '1'))
        if (userTeam?.team_key) {
          const weekMatch = message.match(/week\s*(\d+)/i)
          const requestedWeek = weekMatch ? parseInt(weekMatch[1], 10) : undefined
          const matchupCards = await buildMatchupCards(api, context.yahooLeagueKey, userTeam.team_key, requestedWeek)
          cards.push(...matchupCards)
        }
      } catch { /* skip */ }
    }

    if (intent.isViewTeams) {
      let standingsDone = false
      if (yahooAccessToken) {
        try {
          const api2 = new YahooFantasyAPI()
          api2.setAccessToken(yahooAccessToken)
          const { leagues: ls } = await api2.getLeagues('mlb')
          const yl = ls.find((l: any) => l.is_finished !== '1') || ls[0]
          if (yl?.league_key) {
            const { standings: st } = await api2.getStandings(yl.league_key)
            if (st.length > 0) {
              cards.push({
                type: 'teams',
                title: 'League Standings',
                payload: {
                  leagueName: yl.name || 'League',
                  teams: st.map((t) => ({
                    rank: t.rank, name: t.name,
                    wins: t.wins, losses: t.losses, ties: t.ties,
                    winPercentage: t.percentage || '.000',
                    gamesBack: t.games_back ?? (t.rank === 1 ? '-' : undefined),
                    waiverPriority: t.waiver_priority,
                    moves: t.number_of_moves,
                  })),
                },
              })
              standingsDone = true
            }
          }
        } catch { /* fall through */ }
      }
      if (!standingsDone) {
        let leagueIdToUse = context.leagueId
        if (!leagueIdToUse) {
          const allLeagues = await leagueDB.getAll()
          const baseballLeague = allLeagues.find((l: any) => l.sport === 'baseball')
          if (baseballLeague) { leagueIdToUse = baseballLeague.id }
          else if (yahooAccessToken) {
            try {
              const setupResult = await setupBaseballLeague(yahooAccessToken)
              leagueIdToUse = setupResult.league.id
            } catch { /* skip */ }
          }
        }
        if (leagueIdToUse) {
          const allTeams = await teamDB.getByLeague(leagueIdToUse)
          if (allTeams.length > 0) {
            const sorted = [...allTeams].sort((a, b) =>
              b.wins !== a.wins ? b.wins - a.wins : b.pointsFor - a.pointsFor
            )
            cards.push({
              type: 'teams',
              title: 'League Standings',
              payload: {
                leagueName: context.league?.name || 'League',
                teams: sorted.map((t, i) => ({
                  rank: i + 1, name: t.name, wins: t.wins, losses: t.losses,
                  ties: t.ties,
                  winPercentage: t.wins + t.losses + t.ties > 0
                    ? ((t.wins + t.ties * 0.5) / (t.wins + t.losses + t.ties)).toFixed(3) : '.000',
                  gamesBack: undefined, waiverPriority: undefined, moves: undefined,
                })),
              },
            })
          }
        }
      }
    }

    if ((intent.isShowBatters || intent.isShowPitchers) && yahooAccessToken) {
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)
        const { leagues } = await api.getLeagues('mlb')
        const yahooLeague = leagues.find((l: any) => l.is_finished !== '1') || leagues[0]
        if (yahooLeague?.league_key) {
          const positionType = intent.isShowBatters ? 'B' : 'P'
          const label = intent.isShowBatters ? 'Batters' : 'Pitchers'
          const data = await fetchLeaguePlayers(api, { leagueKey: yahooLeague.league_key, positionType })
          cards.push({
            type: 'roster_list',
            title: `All ${label} in Your League`,
            payload: { players: data.players, total: data.total, positionType, label, leagueKey: yahooLeague.league_key },
          })
        }
      } catch { /* skip */ }
    }

    if (intent.isWaivers && yahooAccessToken) {
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)
        const { leagues } = await api.getLeagues('mlb')
        const yahooLeague = leagues.find((l: any) => l.is_finished !== '1') || leagues[0]
        if (yahooLeague?.league_key) {
          const data = await fetchLeaguePlayers(api, { leagueKey: yahooLeague.league_key, status: 'A' })
          cards.push({
            type: 'roster_list',
            title: 'Waiver Wire — Available Players',
            payload: { players: data.players, total: data.total, label: 'Available', leagueKey: yahooLeague.league_key, defaultStatus: 'A' },
          })
        }
      } catch { /* skip */ }
    }

    if ((intent.isPlayerLookup || embeddedPlayerKey) && yahooAccessToken) {
      const playerQuery = intent.playerName || message
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)
        const { leagues } = await api.getLeagues('mlb')
        const yahooLeague = leagues.find((l: any) => l.is_finished !== '1') || leagues[0]
        if (yahooLeague?.league_key) {
          let foundPlayer = false

          if (embeddedPlayerKey) {
            try {
              const { stats } = await api.getPlayerStats(embeddedPlayerKey, yahooLeague.league_key)
              if (stats) {
                const playerName = stats.name?.full || playerQuery
                const ownership = await getPlayerOwnership(api, yahooLeague.league_key, playerName)
                if (ownership) {
                  const yp = ownership.player
                  cards.push({
                    type: 'player',
                    title: 'Player Snapshot',
                    payload: {
                      player: {
                        id: yp.player_id, name: yp.name.full, sport: 'baseball',
                        position: yp.display_position || yp.eligible_positions?.[0] || 'UTIL',
                        team: yp.editorial_team_abbr || 'FA',
                        yahooPlayerKey: yp.player_key || embeddedPlayerKey,
                      },
                      leagueKey: yahooLeague.league_key,
                      eligiblePositions: yp.eligible_positions || [],
                      ownershipStatus: ownership.ownershipStatus,
                      owningTeamName: ownership.owningTeam?.name,
                      insights: ['No injury concerns.'],
                      actions: [
                        { label: 'Add', command: `add ${yp.name.full}` },
                        { label: 'Drop', command: `drop ${yp.name.full}` },
                        { label: 'Trade idea', command: `suggest a trade involving ${yp.name.full}` },
                      ],
                    },
                  })
                  foundPlayer = true
                } else {
                  const statsPosition = stats.display_position || stats.eligible_positions?.[0] || 'UTIL'
                  cards.push({
                    type: 'player',
                    title: 'Player Snapshot',
                    payload: {
                      player: {
                        id: stats.player_id || embeddedPlayerKey, name: playerName, sport: 'baseball',
                        position: statsPosition, team: stats.editorial_team_abbr || 'Unknown',
                        yahooPlayerKey: embeddedPlayerKey,
                      },
                      leagueKey: yahooLeague.league_key,
                      eligiblePositions: stats.eligible_positions || [],
                      ownershipStatus: 'unknown',
                      insights: [],
                      actions: [
                        { label: 'Add', command: `add ${playerName}` },
                        { label: 'Drop', command: `drop ${playerName}` },
                      ],
                    },
                  })
                  foundPlayer = true
                }
              }
            } catch { /* fall through to name search */ }
          }

          if (!foundPlayer) {
            const ownership = await getPlayerOwnership(api, yahooLeague.league_key, playerQuery)
            if (ownership) {
              const yp = ownership.player
              cards.push({
                type: 'player',
                title: 'Player Snapshot',
                payload: {
                  player: {
                    id: yp.player_id, name: yp.name.full, sport: 'baseball',
                    position: yp.display_position || yp.eligible_positions?.[0] || 'UTIL',
                    team: yp.editorial_team_abbr || 'FA',
                    yahooPlayerKey: yp.player_key,
                  },
                  leagueKey: yahooLeague.league_key,
                  eligiblePositions: yp.eligible_positions || [],
                  ownershipStatus: ownership.ownershipStatus,
                  owningTeamName: ownership.owningTeam?.name,
                  insights: ['No injury concerns.'],
                  actions: [
                    { label: 'Add', command: `add ${yp.name.full}` },
                    { label: 'Drop', command: `drop ${yp.name.full}` },
                    { label: 'Trade idea', command: `suggest a trade involving ${yp.name.full}` },
                  ],
                },
              })
            }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* fail gracefully */ }

  return cards
}

// ── Compare helpers ─────────────────────────────────────────────────────────

const compareCategoriesCache: Record<string, { categories: Record<string, { name: string; displayName: string; positionType: string }>; timestamp: number }> = {}
const COMPARE_CACHE_TTL = 60 * 60 * 1000

export async function getStatCategoriesForCompare(
  api: YahooFantasyAPI,
  gameKey: string
): Promise<Record<string, { name: string; displayName: string; positionType: string }>> {
  const cached = compareCategoriesCache[gameKey]
  if (cached && Date.now() - cached.timestamp < COMPARE_CACHE_TTL) {
    return cached.categories
  }
  try {
    const result = await api.getStatCategories(gameKey)
    compareCategoriesCache[gameKey] = { categories: result.categories, timestamp: Date.now() }
    return result.categories
  } catch {
    return {}
  }
}

export function remapStatsForCompare(
  rawStats: any,
  categories: Record<string, { name: string; displayName: string; positionType: string }>
): Record<string, number | string> {
  if (!rawStats) return {}

  const sections = ['season_stats', 'ytd_stats', 'week_stats'] as const
  let chosen: Record<string, any> | undefined
  for (const section of sections) {
    if (rawStats[section] && Object.keys(rawStats[section]).length > 0) {
      chosen = rawStats[section]
      break
    }
  }
  if (!chosen) return {}

  const result: Record<string, number | string> = {}
  for (const [key, value] of Object.entries(chosen)) {
    if (!/^\d+$/.test(key)) continue
    const category = categories[key]
    if (category) {
      result[category.displayName] = value as number | string
    }
  }
  return result
}

export function isPitcherPosition(positions: string[]): boolean {
  if (!positions || positions.length === 0) return false
  const pitcherPos = ['SP', 'RP', 'P']
  return positions.some(p => pitcherPos.includes(p.toUpperCase()))
}
