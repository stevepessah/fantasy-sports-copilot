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
    const { message, leagueId, userId, sport, conversationHistory } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

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
    const yahooAccessToken = cookieStore.get('yahoo_access_token')?.value

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
              const intent = parseIntent(message)
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
    const intent = parseIntent(message)
    
    // Process message with AI
    const response = await fantasyAI.processMessage(
      message,
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

    if (intent.isMatchup && context.teamId && context.league) {
      try {
        const optimal = getOptimalLineup(context.teamId, context.league.id)
        if (optimal) {
          const myProj = optimal.totalProjected
          const oppProj = myProj * 0.95 + Math.random() * 5
          const diff = myProj - oppProj
          const winProb = Math.max(5, Math.min(95, 50 + diff * 2.6))

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
    }

    if (intent.isViewTeams) {
      try {
        let leagueIdToUse = context.leagueId
        if (!leagueIdToUse) {
          const allLeagues = leagueDB.getAll()
          const baseballLeague = allLeagues.find((l) => l.sport === 'baseball')
          if (baseballLeague) {
            leagueIdToUse = baseballLeague.id
            context.leagueId = leagueIdToUse
            context.league = baseballLeague
          } else {
            try {
              const setupResult = setupBaseballLeague()
              leagueIdToUse = setupResult.league.id
              context.leagueId = leagueIdToUse
              context.league = setupResult.league
            } catch {
              response.message = "No league found and could not create one automatically. Please create a league first."
              return NextResponse.json(response)
            }
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
                pointsFor: team.pointsFor,
                pointsAgainst: team.pointsAgainst,
                winPercentage: team.wins + team.losses + team.ties > 0 
                  ? ((team.wins + team.ties * 0.5) / (team.wins + team.losses + team.ties)).toFixed(3)
                  : '0.000',
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

    if (intent.isPlayerLookup) {
      const playerQuery = intent.playerName || message
      let player = null
      let yahooPlayerKey: string | undefined = undefined
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
