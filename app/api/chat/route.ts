import { NextRequest, NextResponse } from 'next/server'
import { fantasyAI } from '@/lib/ai'
import { leagueDB, teamDB, rosterDB, playerDB } from '@/lib/db'
import { LeagueManager } from '@/lib/league'
import { parseIntent, findPlayerByNameApprox } from '@/lib/commandParser'
import { setupBaseballLeague } from '@/lib/setupBaseballLeague'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { searchPlayerInLeague, searchPlayerInFreeAgents, getPlayerOwnership } from '@/lib/yahoo/playerSearch'
import { buildRosterContext, buildRosterSummary } from '@/lib/rosterContext'
import { fetchLeaguePlayers } from '@/lib/yahoo/leaguePlayers'
import { getDefaultScoringType } from '@/lib/sports'
import { cookies } from 'next/headers'
import { League, Sport } from '@/types'

// Simple in-memory cache for roster context to avoid re-fetching on every message
const rosterContextCache: Record<string, { context: string; timestamp: number }> = {}
const ROSTER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ── Stat ID → abbreviation fallback map (same as rosterContext.ts) ──
const STAT_ID_TO_ABBR: Record<string, string> = {
  '60': 'H/AB', '7': 'R', '8': 'H', '9': '2B', '10': '3B',
  '12': 'HR', '13': 'RBI', '16': 'SB', '18': 'BB', '21': 'K',
  '3': 'AVG', '4': 'OBP', '5': 'SLG', '55': 'OPS', '6': 'AB', '1': 'GP',
  '28': 'W', '29': 'L', '32': 'SV', '42': 'HLD', '26': 'ERA',
  '27': 'WHIP', '39': 'IP', '34': 'K(P)', '37': 'BB(P)', '48': 'QS', '25': 'GS',
}

/** Build a rich matchup card payload from Yahoo scoreboard data. */
async function buildMatchupCards(
  api: YahooFantasyAPI,
  leagueKey: string,
  userTeamKey: string,
  week?: number,
): Promise<any[]> {
  const { scoreboard } = await api.getMatchups(leagueKey, week)
  if (!scoreboard || !scoreboard.matchups.length) return []

  // Identify the user's matchup
  const userMatchup = scoreboard.matchups.find(m =>
    m.teams.some(t => t.team_key === userTeamKey)
  )

  // Try to get league metadata for current_week / end_week
  let currentWeek = scoreboard.week
  let totalWeeks: number | undefined

  try {
    const { leagues } = await api.getLeagues('mlb')
    const league = leagues.find((l: any) => l.league_key === leagueKey)
    if (league) {
      if (league.current_week) currentWeek = parseInt(league.current_week, 10)
      if (league.end_week) totalWeeks = parseInt(league.end_week, 10)
    }
  } catch { /* non-critical */ }

  // Resolve stat IDs to display names (try dynamic first, fall back to static map)
  let statIdMap: Record<string, string> = { ...STAT_ID_TO_ABBR }
  try {
    const gameKey = leagueKey.split('.')[0] // e.g. '469'
    const { categories } = await api.getStatCategories(gameKey)
    for (const [id, cat] of Object.entries(categories)) {
      statIdMap[id] = cat.displayName || cat.name
    }
  } catch { /* use fallback */ }

  // Helper: convert raw stat map { stat_id: value } → { displayName: value }
  const mapStats = (raw?: Record<string, number | string>): Record<string, number | string> => {
    if (!raw) return {}
    const mapped: Record<string, number | string> = {}
    for (const [id, val] of Object.entries(raw)) {
      const name = statIdMap[id] || `stat_${id}`
      mapped[name] = val
    }
    return mapped
  }

  // Format a single matchup for the card payload
  const formatMatchup = (m: any) => {
    const t1 = m.teams[0]
    const t2 = m.teams[1]
    return {
      week: m.week,
      weekStart: m.week_start,
      weekEnd: m.week_end,
      status: m.status, // 'midevent' | 'postevent' | 'preevent'
      isTied: m.is_tied,
      winnerTeamKey: m.winner_team_key,
      teams: [
        {
          teamKey: t1.team_key,
          name: t1.name,
          logoUrl: t1.logo_url,
          points: t1.points,
          winProbability: t1.win_probability != null ? Math.round(t1.win_probability * 100) : undefined,
          stats: mapStats(t1.stats),
          isUser: t1.team_key === userTeamKey,
        },
        {
          teamKey: t2.team_key,
          name: t2.name,
          logoUrl: t2.logo_url,
          points: t2.points,
          winProbability: t2.win_probability != null ? Math.round(t2.win_probability * 100) : undefined,
          stats: mapStats(t2.stats),
          isUser: t2.team_key === userTeamKey,
        },
      ],
    }
  }

  const cards: any[] = []

  if (userMatchup) {
    const userTeam = userMatchup.teams.find(t => t.team_key === userTeamKey)
    const oppTeam = userMatchup.teams.find(t => t.team_key !== userTeamKey)

    cards.push({
      type: 'matchup',
      title: `⚾ Week ${scoreboard.week}: ${userTeam?.name || 'Your Team'} vs ${oppTeam?.name || 'Opponent'}`,
      payload: {
        leagueKey,
        userTeamKey,
        currentWeek,
        displayedWeek: scoreboard.week,
        totalWeeks,
        userMatchup: formatMatchup(userMatchup),
        otherMatchups: scoreboard.matchups
          .filter(m => m !== userMatchup)
          .map(formatMatchup),
      },
    })
  }

  return cards
}

// ── Helpers (avoid self-fetch) ──────────────────────────────────────────────

/** Optimise lineup via direct function call instead of HTTP round-trip. */
function getOptimalLineup(teamId: string, leagueId: string) {
  const league = leagueDB.get(leagueId)
  if (!league) return null
  return LeagueManager.optimizeLineup(teamId, league)
}

/** Set lineup via direct function call. */
function setOptimalLineup(teamId: string, leagueId: string) {
  const league = leagueDB.get(leagueId)
  if (!league) return null
  const optimal = LeagueManager.optimizeLineup(teamId, league)
  LeagueManager.setLineup(teamId, league)
  return optimal
}

/** Create a league directly instead of self-fetching /api/leagues. */
function createLeague(data: any, currentSport: Sport, userId: string): League {
  const league: League = {
    id: `league_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name:
      data.name ||
      `${currentSport === 'football' ? 'Fantasy Football' : 'Fantasy Baseball'} League ${new Date().getFullYear()}`,
    commissionerId: userId,
    sport: currentSport,
    type: 'redraft',
    numTeams: data.numTeams || 12,
    scoringType: data.scoringType || getDefaultScoringType(currentSport),
    draftType: data.draftType || 'snake',
    status: 'setup',
    createdAt: new Date().toISOString(),
    season: new Date().getFullYear(),
  }
  return leagueDB.create(league)
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, leagueId, userId, sport, conversationHistory, stream: wantStream } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Extract embedded player key tag [pk:422.p.12345] if present
    const pkMatch = message.match(/\[pk:([^\]]+)\]/)
    const embeddedPlayerKey = pkMatch ? pkMatch[1] : undefined
    // Strip the tag so AI and intent parsing see clean text
    const cleanMessage = message.replace(/\s*\[pk:[^\]]*\]/g, '').trim()

    const currentSport = sport || 'baseball'

    // Build context
    const context: any = {
      userId: userId || 'user_1',
      leagueId,
      sport: currentSport,
    }

    // If no leagueId provided, try to get the first baseball league
    let effectiveLeagueId = leagueId
    if (!effectiveLeagueId) {
      const allLeagues = leagueDB.getAll()
      const baseballLeague = allLeagues.find((l) => l.sport === 'baseball')
      if (baseballLeague) {
        effectiveLeagueId = baseballLeague.id
        context.leagueId = effectiveLeagueId
      }
    }

    if (effectiveLeagueId) {
      const league = leagueDB.get(effectiveLeagueId)
      if (league) {
        context.league = league
        context.leagueId = effectiveLeagueId

        if (userId) {
          const allTeams = teamDB.getByLeague(effectiveLeagueId)
          const userTeam = allTeams.find((t) => t.ownerId === userId)
          if (userTeam) {
            context.team = userTeam
            context.teamId = userTeam.id
            const roster = rosterDB.get(userTeam.id)
            if (roster) {
              context.roster = roster
            }
          }
        }
      }
    }

    // ─── Inject Yahoo Roster + Stats Context ────────────────────────────────
    const cookieStore = await cookies()
    const yahooAccessToken = cookieStore.get('yahoo_access_token')?.value ?? undefined

    if (yahooAccessToken) {
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)

        const { leagues } = await api.getLeagues('mlb')
        const yahooLeague = leagues.find(l => l.is_finished !== '1') || leagues[0]

        if (yahooLeague?.league_key) {
          context.yahooLeagueKey = yahooLeague.league_key

          const { teams: yahooTeams } = await api.getLeagueTeams(yahooLeague.league_key)
          const userTeam = yahooTeams.find(t =>
            t.managers?.some(m => m.is_current_login === '1')
          )

          if (userTeam?.team_key) {
            const cacheKey = `${userTeam.team_key}:${yahooLeague.league_key}`
            const cached = rosterContextCache[cacheKey]

            if (cached && Date.now() - cached.timestamp < ROSTER_CACHE_TTL) {
              context.yahooRosterContext = cached.context
            } else {
              const intent = parseIntent(cleanMessage)
              const needsFullStats = !intent.isViewTeams && !intent.isHelp

              if (needsFullStats) {
                const rosterResult = await buildRosterContext(
                  api,
                  userTeam.team_key,
                  yahooLeague.league_key
                )
                context.yahooRosterContext = rosterResult.contextString

                rosterContextCache[cacheKey] = {
                  context: rosterResult.contextString,
                  timestamp: Date.now(),
                }
              } else {
                const summary = await buildRosterSummary(api, userTeam.team_key)
                context.yahooRosterContext = summary
              }
            }
          }
        }
      } catch {
        // Don't fail the whole chat if roster context fails — just skip it
      }
    }

    // Parse intent for better card generation
    const intent = parseIntent(cleanMessage)

    // ─── STREAMING PATH ──────────────────────────────────────────────────────
    if (wantStream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Stream AI text tokens
            const gen = fantasyAI.streamMessage(
              cleanMessage,
              context,
              conversationHistory || []
            )
            let action: any = undefined
            let done = false
            while (!done) {
              const { value, done: genDone } = await gen.next()
              if (genDone) {
                // The return value is the action
                action = value
                done = true
              } else {
                // value is a text chunk
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: value })}\n\n`))
              }
            }

            // After text is done, build cards (same logic as non-streaming path)
            const cards = await buildCardsForIntent(intent, context, cleanMessage, currentSport, yahooAccessToken, embeddedPlayerKey)
            
            // Send final event with cards + action
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', cards, action })}\n\n`))
            controller.close()
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong.' })}\n\n`))
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // ─── NON-STREAMING PATH (unchanged) ──────────────────────────────────────
    
    // Process message with AI (use clean message without metadata tags)
    const response = await fantasyAI.processMessage(
      cleanMessage,
      context,
      conversationHistory || []
    )

    // Enhance response with cards based on intent
    if (!response.cards) {
      response.cards = []
    }

    // ─── Generate cards for specific intents (direct calls, no self-fetch) ──

    if ((intent.isShowLineup || intent.isSetLineup) && context.teamId && context.league) {
      try {
        const optimal = getOptimalLineup(context.teamId, context.league.id)
        if (optimal) {
          const slots = optimal.starters.map((s: any) => ({
            slot: s.position,
            player: {
              name: playerDB.get(s.playerId)?.name || 'Unknown',
              position: playerDB.get(s.playerId)?.position || '',
              team: playerDB.get(s.playerId)?.team || '',
              projectedPoints: s.projectedPoints,
            },
          }))
          
          response.cards.push({
            type: 'lineup',
            title: intent.isSetLineup ? 'Your Lineup (Optimized)' : 'Your Lineup',
            payload: {
              teamName: context.team?.name || 'Your Team',
              week: context.league.week || 1,
              slots,
              projectedTotal: optimal.totalProjected,
            },
          })
        }
      } catch {
        // silently skip
      }
    }

    // ─── Yahoo roster fallback: show roster card from Yahoo when no local league ──
    if (intent.isShowLineup && !context.teamId && yahooAccessToken && context.yahooLeagueKey) {
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)
        const { teams: yahooTeams } = await api.getLeagueTeams(context.yahooLeagueKey)
        const userTeam = yahooTeams.find((t: any) => t.managers?.some((m: any) => m.is_current_login === '1'))

        if (userTeam?.team_key) {
          const { players } = await api.getTeamRoster(userTeam.team_key)

          if (players && players.length > 0) {
            const slots = players.map((p: any) => ({
              slot: p.selected_position?.position || '?',
              player: {
                name: p.name?.full || 'Unknown',
                position: p.display_position || p.eligible_positions?.[0] || '',
                team: p.editorial_team_abbr || '',
                injuryStatus: p.injury_status || undefined,
              },
            }))

            response.cards.push({
              type: 'lineup',
              title: `📋 ${userTeam.name} — Your Roster`,
              payload: {
                teamName: userTeam.name,
                slots,
                // No projections from Yahoo basic roster
                projectedTotal: null,
              },
            })
            response.message = `Here's your current roster for **${userTeam.name}**:`
          }
        }
      } catch {
        // silently skip — AI text response still goes through
      }
    }

    if (intent.isMatchup && yahooAccessToken && context.yahooLeagueKey) {
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)
        const { teams: yahooTeams } = await api.getLeagueTeams(context.yahooLeagueKey)
        const userTeam = yahooTeams.find((t: any) => t.managers?.some((m: any) => m.is_current_login === '1'))
        if (userTeam?.team_key) {
          // Extract optional week number from the message
          const weekMatch = cleanMessage.match(/week\s*(\d+)/i)
          const requestedWeek = weekMatch ? parseInt(weekMatch[1], 10) : undefined
          const matchupCards = await buildMatchupCards(api, context.yahooLeagueKey, userTeam.team_key, requestedWeek)
          response.cards.push(...matchupCards)
        }
      } catch {
        // silently skip
      }
    }

    if (intent.isViewTeams) {
      let standingsHandled = false

      // ── Prefer Yahoo standings (live data with GB, waiver, moves) ──
      if (yahooAccessToken) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)
          const { leagues } = await api.getLeagues('mlb')
          const yahooLeague = leagues.find(l => l.is_finished !== '1') || leagues[0]

          if (yahooLeague?.league_key) {
            const { standings } = await api.getStandings(yahooLeague.league_key)
            if (standings.length > 0) {
              // Compute games back relative to 1st-place team
              const leader = standings[0]
              const leaderWinPct = parseFloat(leader.percentage) || 0

              response.cards.push({
                type: 'teams',
                title: 'League Standings',
                payload: {
                  leagueName: yahooLeague.name || 'League',
                  teams: standings.map((t) => ({
                    rank: t.rank,
                    name: t.name,
                    wins: t.wins,
                    losses: t.losses,
                    ties: t.ties,
                    winPercentage: t.percentage || '.000',
                    gamesBack: t.games_back ?? (t.rank === 1 ? '-' : undefined),
                    waiverPriority: t.waiver_priority,
                    moves: t.number_of_moves,
                  })),
                },
              })
              response.message = `Here are the current standings for **${yahooLeague.name}**:`
              standingsHandled = true
            }
          }
        } catch {
          // Fall through to local DB
        }
      }

      // ── Fallback: local DB standings ──
      if (!standingsHandled) {
        try {
          let leagueIdToUse = context.leagueId
          if (!leagueIdToUse) {
            const allLeagues = leagueDB.getAll()
            const baseballLeague = allLeagues.find((l) => l.sport === 'baseball')
            if (baseballLeague) {
              leagueIdToUse = baseballLeague.id
              context.leagueId = leagueIdToUse
              context.league = baseballLeague
            } else if (yahooAccessToken) {
              try {
                const setupResult = await setupBaseballLeague(yahooAccessToken)
                leagueIdToUse = setupResult.league.id
                context.leagueId = leagueIdToUse
                context.league = setupResult.league
              } catch {
                response.message = "No league found. Please connect your Yahoo account and make sure you have an active Fantasy Baseball league."
                return NextResponse.json(response)
              }
            } else {
              response.message = "No league found. Please connect your Yahoo account to get started."
              return NextResponse.json(response)
            }
          }

          const allTeams = teamDB.getByLeague(leagueIdToUse)
          if (allTeams.length > 0) {
            const sortedTeams = [...allTeams].sort((a, b) => {
              if (b.wins !== a.wins) return b.wins - a.wins
              if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor
              return a.losses - b.losses
            })

            response.cards.push({
              type: 'teams',
              title: 'League Standings',
              payload: {
                leagueName: context.league?.name || 'League',
                teams: sortedTeams.map((team, index) => ({
                  rank: index + 1,
                  name: team.name,
                  wins: team.wins,
                  losses: team.losses,
                  ties: team.ties,
                  winPercentage: team.wins + team.losses + team.ties > 0 
                    ? ((team.wins + team.ties * 0.5) / (team.wins + team.losses + team.ties)).toFixed(3)
                    : '.000',
                  gamesBack: undefined,
                  waiverPriority: undefined,
                  moves: undefined,
                })),
              },
            })
            response.message = `Here are all ${allTeams.length} teams in your league:`
          } else {
            response.message = "No teams found in this league."
          }
        } catch {
          // silently skip
        }
      }
    }

    // Show all batters or pitchers — direct call via fetchLeaguePlayers
    if (intent.isShowBatters || intent.isShowPitchers) {
      if (yahooAccessToken) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)
          const { leagues } = await api.getLeagues('mlb')
          const yahooLeague = leagues.find(l => l.is_finished !== '1') || leagues[0]

          if (yahooLeague?.league_key) {
            const positionType = intent.isShowBatters ? 'B' : 'P'
            const label = intent.isShowBatters ? 'Batters' : 'Pitchers'

            const data = await fetchLeaguePlayers(api, {
              leagueKey: yahooLeague.league_key,
              positionType,
            })

            response.cards.push({
              type: 'roster_list',
              title: `All ${label} in Your League`,
              payload: {
                players: data.players,
                total: data.total,
                positionType,
                label,
                leagueKey: yahooLeague.league_key,
              },
            })
            response.message = `Here are all ${data.total} ${label.toLowerCase()} across every team in your league:`
          }
        } catch {
          response.message = "Sorry, I couldn't fetch the player list. Please make sure you're connected to Yahoo Fantasy."
        }
      } else {
        response.message = 'Please connect your Yahoo Fantasy account first to view league players.'
      }
    }

    // ─── Player comparison ──────────────────────────────────────────────────
    if (intent.isCompare && intent.comparePlayerA && intent.comparePlayerB) {
      if (yahooAccessToken) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)
          const { leagues } = await api.getLeagues('mlb')
          const yahooLeague = leagues.find(l => l.is_finished !== '1') || leagues[0]

          if (yahooLeague?.league_key) {
            // Look up both players in parallel by name
            const [ownershipA, ownershipB] = await Promise.all([
              getPlayerOwnership(api, yahooLeague.league_key, intent.comparePlayerA).catch(() => null),
              getPlayerOwnership(api, yahooLeague.league_key, intent.comparePlayerB).catch(() => null),
            ])

            if (ownershipA && ownershipB) {
              const playerKeyA = ownershipA.player.player_key
              const playerKeyB = ownershipB.player.player_key

              // Fetch stats for both players in parallel
              const [statsA, statsB] = await Promise.all([
                api.getPlayerStats(playerKeyA, yahooLeague.league_key).catch(() => ({ stats: null })),
                api.getPlayerStats(playerKeyB, yahooLeague.league_key).catch(() => ({ stats: null })),
              ])

              // Remap stats from numeric IDs to display names
              const gameKey = playerKeyA.split('.')[0]
              const categories = await getStatCategoriesForCompare(api, gameKey)

              const remappedA = remapStatsForCompare(statsA.stats, categories)
              const remappedB = remapStatsForCompare(statsB.stats, categories)

              const posTypeA = ownershipA.player.position_type || (isPitcherPosition(ownershipA.player.eligible_positions) ? 'P' : 'B')
              const posTypeB = ownershipB.player.position_type || (isPitcherPosition(ownershipB.player.eligible_positions) ? 'P' : 'B')

              const isMixed = posTypeA !== posTypeB
              const bothPitchers = posTypeA === 'P' && posTypeB === 'P'

              // Choose stat keys based on position types
              let statKeys: string[]
              if (isMixed) {
                // Option B: Fantasy-oriented universal metrics for mixed types
                statKeys = ['GP', 'K']
                // Add batter-specific stats they might share
                const universalStats = ['GP', 'K', 'BB']
                statKeys = universalStats.filter(k => 
                  (remappedA[k] !== undefined || remappedB[k] !== undefined)
                )
                // If very few shared stats, just show all available stats from both
                const allKeysA = Object.keys(remappedA)
                const allKeysB = Object.keys(remappedB)
                if (statKeys.length < 3) {
                  statKeys = [...new Set([...allKeysA, ...allKeysB])].filter(k => k !== 'H' && k !== 'AB')
                }
              } else if (bothPitchers) {
                statKeys = ['GP', 'IP', 'W', 'L', 'SV', 'HLD', 'K', 'ERA', 'WHIP', 'QS'].filter(k =>
                  remappedA[k] !== undefined || remappedB[k] !== undefined
                )
              } else {
                // Both batters
                statKeys = ['GP', 'AVG', 'OBP', 'OPS', 'R', 'HR', 'RBI', 'SB', 'BB', 'K'].filter(k =>
                  remappedA[k] !== undefined || remappedB[k] !== undefined
                )
              }

              // Ensure we have at least some stat keys
              if (statKeys.length === 0) {
                const allKeys = [...new Set([...Object.keys(remappedA), ...Object.keys(remappedB)])]
                statKeys = allKeys.filter(k => k !== 'H' && k !== 'AB').slice(0, 10)
              }

              const nameA = ownershipA.player.name.full
              const nameB = ownershipB.player.name.full

              response.cards.push({
                type: 'compare',
                title: `⚖️ ${nameA} vs ${nameB}`,
                payload: {
                  playerA: {
                    name: nameA,
                    team: ownershipA.player.editorial_team_abbr || 'FA',
                    position: ownershipA.player.display_position || ownershipA.player.eligible_positions?.[0] || 'UTIL',
                    stats: remappedA,
                    positionType: posTypeA,
                  },
                  playerB: {
                    name: nameB,
                    team: ownershipB.player.editorial_team_abbr || 'FA',
                    position: ownershipB.player.display_position || ownershipB.player.eligible_positions?.[0] || 'UTIL',
                    stats: remappedB,
                    positionType: posTypeB,
                  },
                  statKeys,
                  isMixed,
                  leagueKey: yahooLeague.league_key,
                  playerKeyA,
                  playerKeyB,
                },
              })

              if (!response.message || response.message.includes('can ask me to')) {
                if (isMixed) {
                  response.message = `Here's the comparison between ${nameA} (${posTypeA === 'P' ? 'Pitcher' : 'Batter'}) and ${nameB} (${posTypeB === 'P' ? 'Pitcher' : 'Batter'}). Since they play different positions, I'm showing all available stats for a broader view.`
                } else {
                  response.message = `Here's the head-to-head comparison between ${nameA} and ${nameB}:`
                }
              }
            } else {
              const notFound = []
              if (!ownershipA) notFound.push(intent.comparePlayerA)
              if (!ownershipB) notFound.push(intent.comparePlayerB)
              response.message = `Sorry, I couldn't find ${notFound.join(' or ')} in your league. Make sure the names are correct.`
            }
          }
        } catch (e) {
          console.error('Compare handler error:', e)
          response.message = `Sorry, I had trouble comparing those players. Please try again.`
        }
      } else {
        response.message = 'Please connect your Yahoo Fantasy account first to compare players.'
      }
    }

    if (intent.isPlayerLookup || embeddedPlayerKey) {
      const playerQuery = intent.playerName || cleanMessage
      let player = null
      let yahooPlayerKey: string | undefined = embeddedPlayerKey
      let yahooLeagueKey: string | undefined = undefined
      let eligiblePositions: string[] = []
      let ownershipStatus: 'free_agent' | 'taken' | 'unknown' = 'unknown'
      let owningTeamName: string | undefined = undefined
      
      if (yahooAccessToken) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)
          
          const { leagues } = await api.getLeagues('mlb')
          const yahooLeague = leagues.find(l => l.is_finished !== '1') || leagues[0]
          
          if (yahooLeague && yahooLeague.league_key) {
            yahooLeagueKey = yahooLeague.league_key

            // If we have an embedded player key, fetch the player directly by key
            // This is MUCH faster than searching through all rosters
            if (embeddedPlayerKey) {
              try {
                const { stats, raw } = await api.getPlayerStats(embeddedPlayerKey, yahooLeague.league_key)
                if (stats) {
                  yahooPlayerKey = stats.player_key || embeddedPlayerKey
                  const playerName = stats.name?.full || playerQuery

                  // Also try to find ownership info
                  const ownership = await getPlayerOwnership(api, yahooLeague.league_key, playerName)
                  if (ownership) {
                    eligiblePositions = ownership.player.eligible_positions || []
                    ownershipStatus = ownership.ownershipStatus
                    owningTeamName = ownership.owningTeam?.name
                    
                    player = {
                      id: ownership.player.player_id || stats.player_id,
                      name: ownership.player.name.full,
                      sport: 'baseball' as const,
                      position: (ownership.player.display_position || ownership.player.selected_position?.position || ownership.player.eligible_positions[0] || 'UTIL') as any,
                      team: ownership.player.editorial_team_abbr || 'FA',
                      injuryStatus: ownership.player.injury_status === 'DTD' ? 'questionable' : 
                                   ownership.player.injury_status === 'O' ? 'out' :
                                   ownership.player.injury_status === 'IL' ? 'IL' : 'healthy',
                      yahooPlayerKey: yahooPlayerKey,
                    }
                  } else {
                    // Ownership search failed — use position data from the stats response
                    const statsPosition = stats.display_position || stats.eligible_positions?.[0] || 'UTIL'
                    if (stats.eligible_positions && stats.eligible_positions.length > 0) {
                      eligiblePositions = stats.eligible_positions
                    }
                    player = {
                      id: stats.player_id || embeddedPlayerKey,
                      name: playerName,
                      sport: 'baseball' as const,
                      position: statsPosition as any,
                      team: stats.editorial_team_abbr || 'Unknown',
                      yahooPlayerKey: yahooPlayerKey,
                    }
                  }
                }
              } catch {
                // Fall through to name-based search
              }
            }
            
            // If we still don't have a player (no embedded key or direct lookup failed),
            // fall back to the name-based search
            if (!player) {
              const ownership = await getPlayerOwnership(api, yahooLeague.league_key, playerQuery)
              
              if (ownership) {
                const yahooPlayer = ownership.player
                yahooPlayerKey = yahooPlayer.player_key
                eligiblePositions = yahooPlayer.eligible_positions || []
                ownershipStatus = ownership.ownershipStatus
                owningTeamName = ownership.owningTeam?.name
                
                player = {
                  id: yahooPlayer.player_id,
                  name: yahooPlayer.name.full,
                  sport: 'baseball' as const,
                  position: (yahooPlayer.display_position || yahooPlayer.selected_position?.position || yahooPlayer.eligible_positions[0] || 'UTIL') as any,
                  team: yahooPlayer.editorial_team_abbr || 'FA',
                  injuryStatus: yahooPlayer.injury_status === 'DTD' ? 'questionable' : 
                               yahooPlayer.injury_status === 'O' ? 'out' :
                               yahooPlayer.injury_status === 'IL' ? 'IL' : 'healthy',
                  yahooPlayerKey: yahooPlayer.player_key,
                }
              }
            }
          }
        } catch {
          // Fall through to mock database
        }
      }
      
      if (!player) {
        const players = playerDB.getAll().filter((p) => p.sport === currentSport)
        const foundPlayer = findPlayerByNameApprox(playerQuery, players)
        if (foundPlayer) {
          player = foundPlayer
          if (yahooAccessToken && yahooLeagueKey && !player.yahooPlayerKey) {
            try {
              const api = new YahooFantasyAPI()
              api.setAccessToken(yahooAccessToken)
              const ownership = await getPlayerOwnership(api, yahooLeagueKey, player.name)
              if (ownership) {
                yahooPlayerKey = ownership.player.player_key
                eligiblePositions = ownership.player.eligible_positions || []
                ownershipStatus = ownership.ownershipStatus
                owningTeamName = ownership.owningTeam?.name
              }
            } catch {
              // silently skip
            }
          }
        }
      }
      
      if (player) {
        response.cards.push({
          type: 'player',
          title: 'Player Snapshot',
          payload: {
            player: {
              ...player,
              yahooPlayerKey: yahooPlayerKey || player.yahooPlayerKey,
            },
            leagueKey: yahooLeagueKey || undefined,
            eligiblePositions,
            ownershipStatus,
            owningTeamName,
            insights: [
              `Projected ${player.projectedPoints?.toFixed(1) || '0.0'} points this week.`,
              player.injuryStatus && player.injuryStatus !== 'healthy' 
                ? `Status: ${player.injuryStatus}` 
                : 'No injury concerns.',
            ],
            actions: [
              { label: 'Add', command: `add ${player.name}` },
              { label: 'Drop', command: `drop ${player.name}` },
              { label: 'Trade idea', command: `suggest a trade involving ${player.name}` },
            ],
          },
        })
      }
    }

    // Handle actions immediately if needed — all via direct calls
    if (response.action) {
      if (response.action.type === 'create_league' && response.action.data) {
        try {
          const newLeague = createLeague(response.action.data, currentSport, context.userId)
          response.message += `\n\n✅ League created! Your league ID is: ${newLeague.id}`
          response.action.data = { ...response.action.data, leagueId: newLeague.id }
        } catch {
          // silently skip
        }
      } else if (response.action.type === 'set_lineup' && context.teamId && context.league) {
        try {
          const optimal = setOptimalLineup(context.teamId, context.league.id)
          if (optimal) {
            response.message += `\n\n✅ Lineup updated! ${optimal.totalProjected.toFixed(1)} projected points with ${optimal.starters.length} starters.`
          } else {
            response.message += '\n\n⚠️ Could not set lineup. Make sure you have players on your roster.'
          }
        } catch {
          response.message += '\n\n⚠️ Could not set lineup. Make sure you have players on your roster.'
        }
      } else if (response.action.type === 'add_player' && context.teamId) {
        response.message += '\n\n💡 Use the waivers API to complete this action, or ask me to help you find available players.'
      } else if (response.action.type === 'propose_trade' && context.teamId) {
        response.message += '\n\n💡 I can help evaluate trades. Tell me the specific players involved.'
      } else if (response.action.type === 'view_teams') {
        // Teams card is already generated via intent parsing
      } else if (response.action.type === 'show_lineup' && context.teamId && context.league) {
        try {
          const optimal = getOptimalLineup(context.teamId, context.league.id)
          if (optimal) {
            const slots = optimal.starters.map((s: any) => ({
              slot: s.position,
              player: {
                name: playerDB.get(s.playerId)?.name || 'Unknown',
                position: playerDB.get(s.playerId)?.position || '',
                team: playerDB.get(s.playerId)?.team || '',
                projectedPoints: s.projectedPoints,
              },
            }))
            
            if (!response.cards) response.cards = []
            response.cards.push({
              type: 'lineup',
              title: 'Your Current Lineup',
              payload: {
                teamName: context.team?.name || 'Your Team',
                week: context.league.week || 1,
                slots,
                projectedTotal: optimal.totalProjected,
              },
            })
          }
        } catch {
          // silently skip
        }
      } else if (response.action.type === 'show_matchup' && context.teamId && context.league) {
        try {
          const optimal = getOptimalLineup(context.teamId, context.league.id)
          if (optimal) {
            const myProj = optimal.totalProjected
            const oppProj = myProj * 0.95 + Math.random() * 5
            const diff = myProj - oppProj
            const winProb = Math.max(5, Math.min(95, 50 + diff * 2.6))

            if (!response.cards) response.cards = []
            response.cards.push({
              type: 'matchup',
              title: `Matchup: ${context.team?.name || 'Your Team'} vs Opponent`,
              payload: {
                week: context.league.week || 1,
                home: { team: context.team?.name || 'Your Team', projected: myProj },
                away: { team: 'Opponent', projected: oppProj },
                winProbHome: winProb,
                notes: [
                  diff > 6 ? 'You have a solid projected edge — prioritize stability.' :
                  diff < -6 ? 'You\'re trailing — consider upside plays.' :
                  'Toss-up — small moves can swing it.',
                ],
              },
            })
          }
        } catch {
          // silently skip
        }
      } else if (response.action.type === 'show_waivers') {
        response.message += '\n\n💡 I can help you find the best available players. Let me check the waiver wire...'
      }
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error', message: 'Sorry, something went wrong.' },
      { status: 500 }
    )
  }
}

// ─── Card builder for streaming path ────────────────────────────────────────

async function buildCardsForIntent(
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
      const optimal = getOptimalLineup(context.teamId, context.league.id)
      if (optimal) {
        cards.push({
          type: 'lineup',
          title: intent.isSetLineup ? 'Your Lineup (Optimized)' : 'Your Lineup',
          payload: {
            teamName: context.team?.name || 'Your Team',
            week: context.league.week || 1,
            slots: optimal.starters.map((s: any) => ({
              slot: s.position,
              player: {
                name: playerDB.get(s.playerId)?.name || 'Unknown',
                position: playerDB.get(s.playerId)?.position || '',
                team: playerDB.get(s.playerId)?.team || '',
                projectedPoints: s.projectedPoints,
              },
            })),
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
      // Prefer Yahoo live standings
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
      // Fallback: local DB
      if (!standingsDone) {
        let leagueIdToUse = context.leagueId
        if (!leagueIdToUse) {
          const allLeagues = leagueDB.getAll()
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
          const allTeams = teamDB.getByLeague(leagueIdToUse)
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

    if ((intent.isPlayerLookup || embeddedPlayerKey) && yahooAccessToken) {
      const playerQuery = intent.playerName || message
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)
        const { leagues } = await api.getLeagues('mlb')
        const yahooLeague = leagues.find((l: any) => l.is_finished !== '1') || leagues[0]
        if (yahooLeague?.league_key) {
          let foundPlayer = false

          // If we have an embedded player key, try direct lookup first
          if (embeddedPlayerKey) {
            try {
              const { stats } = await api.getPlayerStats(embeddedPlayerKey, yahooLeague.league_key)
              if (stats) {
                const playerName = stats.name?.full || playerQuery
                // Try to get ownership info by name
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
                  // Ownership search failed — use position data from the stats response
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

          // Fall back to name-based search if direct lookup didn't work
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

// ─── Compare helpers ─────────────────────────────────────────────────────────

/** Cache stat categories to avoid repeated API calls within the same request lifecycle */
const compareCategoriesCache: Record<string, { categories: Record<string, { name: string; displayName: string; positionType: string }>; timestamp: number }> = {}
const COMPARE_CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function getStatCategoriesForCompare(
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

/**
 * Remap raw Yahoo stats (numeric IDs) into a flat { displayName: value } dict.
 * Uses season_stats if available, falls back to ytd_stats or week_stats.
 */
function remapStatsForCompare(
  rawStats: any,
  categories: Record<string, { name: string; displayName: string; positionType: string }>
): Record<string, number | string> {
  if (!rawStats) return {}

  // Pick the best available section
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

function isPitcherPosition(positions: string[]): boolean {
  if (!positions || positions.length === 0) return false
  const pitcherPos = ['SP', 'RP', 'P']
  return positions.some(p => pitcherPos.includes(p.toUpperCase()))
}
