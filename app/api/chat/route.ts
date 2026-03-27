import { NextRequest, NextResponse } from 'next/server'
import { fantasyAI } from '@/lib/ai'
import { leagueDB, teamDB, rosterDB, playerDB } from '@/lib/db'
import { LeagueManager } from '@/lib/league'
import { parseIntent, findPlayerByNameApprox } from '@/lib/commandParser'
import { setupBaseballLeague } from '@/lib/setupBaseballLeague'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { searchPlayerInLeague, searchPlayerInFreeAgents, getPlayerOwnership, getPlayerOwnershipPair } from '@/lib/yahoo/playerSearch'
import { buildRosterContext, buildRosterSummary, buildLeagueSettingsContext } from '@/lib/rosterContext'
import { fetchLeaguePlayers } from '@/lib/yahoo/leaguePlayers'
import { getDefaultScoringType } from '@/lib/sports'
import { cookies } from 'next/headers'
import { League, Sport } from '@/types'
import { buildCardsForIntent, getStatCategoriesForCompare, remapStatsForCompare, isPitcherPosition } from '@/lib/chat/cardBuilder'
import { buildMatchupCards } from '@/lib/chat/matchupCards'

const rosterContextCache: Record<string, { context: string; timestamp: number }> = {}
const ROSTER_CACHE_TTL = 5 * 60 * 1000

const leagueSettingsCache: Record<string, { context: string; timestamp: number }> = {}
const LEAGUE_SETTINGS_CACHE_TTL = 30 * 60 * 1000

async function getOptimalLineup(teamId: string, leagueId: string) {
  const league = await leagueDB.get(leagueId)
  if (!league) return null
  return await LeagueManager.optimizeLineup(teamId, league)
}

async function setOptimalLineup(teamId: string, leagueId: string) {
  const league = await leagueDB.get(leagueId)
  if (!league) return null
  const optimal = await LeagueManager.optimizeLineup(teamId, league)
  await LeagueManager.setLineup(teamId, league)
  return optimal
}

/** Create a league directly instead of self-fetching /api/leagues. */
async function createLeague(data: any, currentSport: Sport, userId: string): Promise<League> {
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
  return await leagueDB.create(league)
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, leagueId, userId, sport, conversationHistory, stream: wantStream, yahooLeagueKey: requestedYahooLeagueKey, originTab } = body

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
    const TAB_LABELS: Record<string, string> = {
      league: 'League Standings',
      roster: 'My Roster',
      matchups: 'My Matchup',
      players: 'Players',
      draft: 'Draft Results',
      settings: 'League Settings',
    }

    const context: any = {
      userId: userId || 'user_1',
      leagueId,
      sport: currentSport,
      ...(originTab && TAB_LABELS[originTab] ? { originTab: TAB_LABELS[originTab] } : {}),
    }

    // If no leagueId provided, try to get the first baseball league
    let effectiveLeagueId = leagueId
    if (!effectiveLeagueId) {
      const allLeagues = await leagueDB.getAll()
      const baseballLeague = allLeagues.find((l) => l.sport === 'baseball')
      if (baseballLeague) {
        effectiveLeagueId = baseballLeague.id
        context.leagueId = effectiveLeagueId
      }
    }

    if (effectiveLeagueId) {
      const league = await leagueDB.get(effectiveLeagueId)
      if (league) {
        context.league = league
        context.leagueId = effectiveLeagueId

        if (userId) {
          const allTeams = await teamDB.getByLeague(effectiveLeagueId)
          const userTeam = allTeams.find((t) => t.ownerId === userId)
          if (userTeam) {
            context.team = userTeam
            context.teamId = userTeam.id
            const roster = await rosterDB.get(userTeam.id)
            if (roster) {
              context.roster = roster
            }
          }
        }
      }
    }

    // ─── Inject Yahoo Roster + Stats + League Settings Context ──────────────
    const cookieStore = await cookies()
    const yahooAccessToken = cookieStore.get('yahoo_access_token')?.value ?? undefined

    if (yahooAccessToken) {
      context.hasYahooConnection = true
      try {
        const api = new YahooFantasyAPI()
        api.setAccessToken(yahooAccessToken)

        const { leagues } = await api.getLeagues('mlb')
        // Use the league the user selected in the UI, or fall back to first active league
        const yahooLeague = (requestedYahooLeagueKey
          ? leagues.find(l => l.league_key === requestedYahooLeagueKey)
          : undefined
        ) || leagues.find(l => l.is_finished !== '1') || leagues[0]

        if (yahooLeague?.league_key) {
          context.yahooLeagueKey = yahooLeague.league_key
          context.yahooLeagueName = yahooLeague.name

          // ── Fetch league settings (stat categories, roster positions) ──
          const settingsCacheKey = yahooLeague.league_key
          const cachedSettings = leagueSettingsCache[settingsCacheKey]

          if (cachedSettings && Date.now() - cachedSettings.timestamp < LEAGUE_SETTINGS_CACHE_TTL) {
            context.yahooLeagueSettingsContext = cachedSettings.context
          } else {
            try {
              const { settings } = await api.getLeagueSettings(yahooLeague.league_key)
              const settingsContext = buildLeagueSettingsContext(
                settings,
                yahooLeague.name,
                yahooLeague.num_teams,
              )
              context.yahooLeagueSettingsContext = settingsContext
              leagueSettingsCache[settingsCacheKey] = {
                context: settingsContext,
                timestamp: Date.now(),
              }
            } catch {
              // Non-critical — league settings are nice-to-have
            }
          }

          // ── Fetch roster context ──
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
        // Don't fail the whole chat if context fetch fails — just skip it
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
        const optimal = await getOptimalLineup(context.teamId, context.league.id)
        if (optimal) {
          const slots = await Promise.all(optimal.starters.map(async (s: any) => ({
            slot: s.position,
            player: {
              name: (await playerDB.get(s.playerId))?.name || 'Unknown',
              position: (await playerDB.get(s.playerId))?.position || '',
              team: (await playerDB.get(s.playerId))?.team || '',
              projectedPoints: s.projectedPoints,
            },
          })))
          
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
      if (yahooAccessToken && context.yahooLeagueKey) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)

          if (context.yahooLeagueKey) {
            const { standings } = await api.getStandings(context.yahooLeagueKey)
            if (standings.length > 0) {
              // Compute games back relative to 1st-place team
              const leader = standings[0]
              const leaderWinPct = parseFloat(leader.percentage) || 0

              response.cards.push({
                type: 'teams',
                title: 'League Standings',
                payload: {
                  leagueName: context.yahooLeagueName || 'League',
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
              response.message = `Here are the current standings for **${context.yahooLeagueName || 'your league'}**:`
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
            const allLeagues = await leagueDB.getAll()
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

          const allTeams = await teamDB.getByLeague(leagueIdToUse)
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

    // League settings / stat categories
    if (intent.isLeagueSettings && yahooAccessToken && context.yahooLeagueKey) {
      if (context.yahooLeagueSettingsContext) {
        // If the LLM didn't already give a good answer, provide the settings directly
        if (response.message.includes("can ask me to") || response.message.includes("What would you like")) {
          response.message = `Here are your league's scoring categories and settings:\n\n${context.yahooLeagueSettingsContext}`
        }
      }
    }

    // Show all batters or pitchers — direct call via fetchLeaguePlayers
    if (intent.isShowBatters || intent.isShowPitchers) {
      if (yahooAccessToken && context.yahooLeagueKey) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)

          const positionType = intent.isShowBatters ? 'B' : 'P'
          const label = intent.isShowBatters ? 'Batters' : 'Pitchers'

          const data = await fetchLeaguePlayers(api, {
            leagueKey: context.yahooLeagueKey,
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
              leagueKey: context.yahooLeagueKey,
            },
          })
          response.message = `Here are all ${data.total} ${label.toLowerCase()} across every team in your league:`
        } catch {
          response.message = "Sorry, I couldn't fetch the player list. Please make sure you're connected to Yahoo Fantasy."
        }
      } else {
        response.message = 'Please connect your Yahoo Fantasy account first to view league players.'
      }
    }

    // ─── Waivers / Free Agents ─────────────────────────────────────────────
    if (intent.isWaivers) {
      if (yahooAccessToken && context.yahooLeagueKey) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)

          const data = await fetchLeaguePlayers(api, {
            leagueKey: context.yahooLeagueKey,
            status: 'A',
          })

          response.cards.push({
            type: 'roster_list',
            title: 'Waiver Wire — Available Players',
            payload: {
              players: data.players,
              total: data.total,
              label: 'Available',
              leagueKey: context.yahooLeagueKey,
              defaultStatus: 'A',
            },
          })
          response.message = `There are ${data.total} available players on the waiver wire. Here are the top available players ranked by average draft position:`
        } catch {
          response.message = "Sorry, I couldn't fetch the waiver wire. Please make sure you're connected to Yahoo Fantasy."
        }
      } else {
        response.message = 'Please connect your Yahoo Fantasy account first to view available players.'
      }
    }

    // ─── Player comparison ──────────────────────────────────────────────────
    if (intent.isCompare && intent.comparePlayerA && intent.comparePlayerB) {
      if (yahooAccessToken && context.yahooLeagueKey) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)

          const [ownershipA, ownershipB] = await getPlayerOwnershipPair(
            api, context.yahooLeagueKey, intent.comparePlayerA, intent.comparePlayerB,
          )

          if (ownershipA && ownershipB) {
            const playerKeyA = ownershipA.player.player_key
            const playerKeyB = ownershipB.player.player_key

            const [statsA, statsB] = await Promise.all([
              api.getPlayerStats(playerKeyA, context.yahooLeagueKey).catch(() => ({ stats: null })),
              api.getPlayerStats(playerKeyB, context.yahooLeagueKey).catch(() => ({ stats: null })),
            ])

            const gameKey = playerKeyA.split('.')[0]
            const categories = await getStatCategoriesForCompare(api, gameKey)

            const remappedA = remapStatsForCompare(statsA.stats, categories)
            const remappedB = remapStatsForCompare(statsB.stats, categories)

            const posTypeA = ownershipA.player.position_type || (isPitcherPosition(ownershipA.player.eligible_positions) ? 'P' : 'B')
            const posTypeB = ownershipB.player.position_type || (isPitcherPosition(ownershipB.player.eligible_positions) ? 'P' : 'B')

            const isMixed = posTypeA !== posTypeB
            const bothPitchers = posTypeA === 'P' && posTypeB === 'P'

            let statKeys: string[]
            if (isMixed) {
              statKeys = ['GP', 'K']
              const universalStats = ['GP', 'K', 'BB']
              statKeys = universalStats.filter(k => 
                (remappedA[k] !== undefined || remappedB[k] !== undefined)
              )
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
              statKeys = ['GP', 'AVG', 'OBP', 'OPS', 'R', 'HR', 'RBI', 'SB', 'BB', 'K'].filter(k =>
                remappedA[k] !== undefined || remappedB[k] !== undefined
              )
            }

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
                leagueKey: context.yahooLeagueKey,
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
      
      if (yahooAccessToken && context.yahooLeagueKey) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)
          
          yahooLeagueKey = context.yahooLeagueKey

          if (embeddedPlayerKey) {
            try {
              const { stats } = await api.getPlayerStats(embeddedPlayerKey, context.yahooLeagueKey)
              if (stats) {
                yahooPlayerKey = stats.player_key || embeddedPlayerKey
                const playerName = stats.name?.full || playerQuery

                const ownership = await getPlayerOwnership(api, context.yahooLeagueKey, playerName)
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
          
          if (!player) {
            const ownership = await getPlayerOwnership(api, context.yahooLeagueKey, playerQuery)
            
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
        } catch {
          // Fall through to mock database
        }
      }
      
      if (!player) {
        const players = (await playerDB.getAll()).filter((p) => p.sport === currentSport)
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
          const newLeague = await createLeague(response.action.data, currentSport, context.userId)
          response.message += `\n\n✅ League created! Your league ID is: ${newLeague.id}`
          response.action.data = { ...response.action.data, leagueId: newLeague.id }
        } catch {
          // silently skip
        }
      } else if (response.action.type === 'set_lineup' && context.teamId && context.league) {
        try {
          const optimal = await setOptimalLineup(context.teamId, context.league.id)
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
          const optimal = await getOptimalLineup(context.teamId, context.league.id)
          if (optimal) {
            const slots = await Promise.all(optimal.starters.map(async (s: any) => ({
              slot: s.position,
              player: {
                name: (await playerDB.get(s.playerId))?.name || 'Unknown',
                position: (await playerDB.get(s.playerId))?.position || '',
                team: (await playerDB.get(s.playerId))?.team || '',
                projectedPoints: s.projectedPoints,
              },
            })))
            
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
          const optimal = await getOptimalLineup(context.teamId, context.league.id)
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
        // Waivers card is already generated via intent parsing above
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

