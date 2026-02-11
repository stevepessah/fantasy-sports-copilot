import { NextRequest, NextResponse } from 'next/server'
import { fantasyAI } from '@/lib/ai'
import { leagueDB, teamDB, rosterDB, playerDB } from '@/lib/db'
import { LeagueManager } from '@/lib/league'
import { parseIntent, findPlayerByNameApprox } from '@/lib/commandParser'
import { setupBaseballLeague } from '@/lib/setupBaseballLeague'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { searchPlayerInLeague, searchPlayerInFreeAgents, getPlayerOwnership } from '@/lib/yahoo/playerSearch'
import { cookies } from 'next/headers'

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
      userId: userId || 'user_1', // For MVP, use default user
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

        // Get user's team if available
        if (userId) {
          const allTeams = teamDB.getByLeague(effectiveLeagueId)
          const userTeam = allTeams.find((t) => t.ownerId === userId)
          if (userTeam) {
            context.team = userTeam
            context.teamId = userTeam.id

            // Get roster if available
            const roster = rosterDB.get(userTeam.id)
            if (roster) {
              context.roster = roster
            }
          }
        }
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

    // Generate cards for specific intents
    if ((intent.isShowLineup || intent.isSetLineup) && context.teamId && context.league) {
      if (context.teamId && context.league) {
        try {
          const lineupResponse = await fetch(`${request.nextUrl.origin}/api/lineup?teamId=${context.teamId}&leagueId=${context.league.id}`)
          if (lineupResponse.ok) {
            const lineupData = await lineupResponse.json()
            const slots = lineupData.optimal.starters.map((s: any) => ({
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
                projectedTotal: lineupData.optimal.totalProjected,
              },
            })
          }
        } catch (error) {
          console.error('Error generating lineup card:', error)
        }
      }
    }

    if (intent.isMatchup && context.teamId && context.league) {
      try {
        const lineupResponse = await fetch(`${request.nextUrl.origin}/api/lineup?teamId=${context.teamId}&leagueId=${context.league.id}`)
        if (lineupResponse.ok) {
          const lineupData = await lineupResponse.json()
          const myProj = lineupData.optimal.totalProjected
          const oppProj = myProj * 0.95 + Math.random() * 5 // Mock opponent projection
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
      } catch (error) {
        console.error('Error generating matchup card:', error)
      }
    }

    if (intent.isViewTeams) {
      try {
        // Use the leagueId from context (which may have been auto-detected)
        let leagueIdToUse = context.leagueId
        if (!leagueIdToUse) {
          // Try to get any baseball league
          const allLeagues = leagueDB.getAll()
          const baseballLeague = allLeagues.find((l) => l.sport === 'baseball')
          if (baseballLeague) {
            leagueIdToUse = baseballLeague.id
            context.leagueId = leagueIdToUse
            context.league = baseballLeague
          } else {
            // Auto-create the league if it doesn't exist
            try {
              const setupResult = setupBaseballLeague()
              leagueIdToUse = setupResult.league.id
              context.leagueId = leagueIdToUse
              context.league = setupResult.league
            } catch (setupError) {
              console.error('Error auto-creating league:', setupError)
              response.message = "No league found and could not create one automatically. Please create a league first."
              return NextResponse.json(response)
            }
          }
        }

        const allTeams = teamDB.getByLeague(leagueIdToUse)
        if (allTeams.length > 0) {
          // Sort teams by wins (descending), then by points for
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
      } catch (error) {
        console.error('Error generating teams card:', error)
      }
    }

    // Show all batters or pitchers
    if (intent.isShowBatters || intent.isShowPitchers) {
      const cookieStore = await cookies()
      const yahooAccessToken = cookieStore.get('yahoo_access_token')?.value

      if (yahooAccessToken) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)
          const { leagues } = await api.getLeagues('mlb')
          const yahooLeague = leagues.find(l => l.is_finished !== '1') || leagues[0]

          if (yahooLeague?.league_key) {
            const positionType = intent.isShowBatters ? 'B' : 'P'
            const label = intent.isShowBatters ? 'Batters' : 'Pitchers'

            // Fetch players via internal API
            const url = new URL(`${request.nextUrl.origin}/api/yahoo/league-players`)
            url.searchParams.set('leagueKey', yahooLeague.league_key)
            url.searchParams.set('positionType', positionType)

            const res = await fetch(url.toString(), {
              headers: { Cookie: `yahoo_access_token=${yahooAccessToken}` },
            })

            if (res.ok) {
              const data = await res.json()
              response.cards.push({
                type: 'roster_list',
                title: `All ${label} in Your League`,
                payload: {
                  players: data.players || [],
                  total: data.total || 0,
                  positionType,
                  label,
                  leagueKey: yahooLeague.league_key,
                },
              })
              response.message = `Here are all ${data.total} ${label.toLowerCase()} across every team in your league:`
            }
          }
        } catch (error) {
          console.error('Error fetching roster list:', error)
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
      
      // First, try to find player in Yahoo if authenticated
      const cookieStore = await cookies()
      const yahooAccessToken = cookieStore.get('yahoo_access_token')?.value
      
      if (yahooAccessToken) {
        try {
          const api = new YahooFantasyAPI()
          api.setAccessToken(yahooAccessToken)
          
          // Get leagues to find an active league
          const { leagues } = await api.getLeagues('mlb')
          // Find the first active (not finished) league
          const yahooLeague = leagues.find(l => l.is_finished !== '1') || leagues[0]
          
          if (yahooLeague && yahooLeague.league_key) {
            yahooLeagueKey = yahooLeague.league_key
            
            // Get player ownership information
            const ownership = await getPlayerOwnership(api, yahooLeague.league_key, playerQuery)
            
            if (ownership) {
              const yahooPlayer = ownership.player
              yahooPlayerKey = yahooPlayer.player_key
              eligiblePositions = yahooPlayer.eligible_positions || []
              ownershipStatus = ownership.ownershipStatus
              owningTeamName = ownership.owningTeam?.name
              
              // Convert Yahoo player to our Player format
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
        } catch (error) {
          console.error('Error searching Yahoo for player:', error)
          // Fall through to mock database
        }
      }
      
      // Fallback to mock database if not found in Yahoo
      if (!player) {
        const players = playerDB.getAll().filter((p) => p.sport === currentSport)
        const foundPlayer = findPlayerByNameApprox(playerQuery, players)
        if (foundPlayer) {
          player = foundPlayer
          // Even if using mock player, try to get Yahoo player key if we have a league
          if (yahooAccessToken && yahooLeagueKey && !player.yahooPlayerKey) {
            try {
              const api = new YahooFantasyAPI()
              api.setAccessToken(yahooAccessToken)
              // Try one more search with the mock player name
              const ownership = await getPlayerOwnership(api, yahooLeagueKey, player.name)
              if (ownership) {
                yahooPlayerKey = ownership.player.player_key
                eligiblePositions = ownership.player.eligible_positions || []
                ownershipStatus = ownership.ownershipStatus
                owningTeamName = ownership.owningTeam?.name
              }
            } catch (error) {
              console.error('Error searching for Yahoo player key:', error)
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

    // Handle actions immediately if needed
    if (response.action) {
      if (response.action.type === 'create_league' && response.action.data) {
        // Create league via API
        const leagueResponse = await fetch(`${request.nextUrl.origin}/api/leagues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...response.action.data,
            sport: currentSport,
            commissionerId: context.userId,
          }),
        })

        if (leagueResponse.ok) {
          const newLeague = await leagueResponse.json()
          response.message += `\n\n✅ League created! Your league ID is: ${newLeague.id}`
          response.action.data = { ...response.action.data, leagueId: newLeague.id }
        }
      } else if (response.action.type === 'set_lineup' && context.teamId && context.league) {
        try {
          const lineupResponse = await fetch(`${request.nextUrl.origin}/api/lineup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teamId: context.teamId,
              leagueId: context.league.id,
            }),
          })

          if (lineupResponse.ok) {
            const lineupData = await lineupResponse.json()
            response.message += `\n\n✅ Lineup updated! ${lineupData.optimal.totalProjected.toFixed(1)} projected points with ${lineupData.optimal.starters.length} starters.`
          } else {
            response.message += '\n\n⚠️ Could not set lineup. Make sure you have players on your roster.'
          }
        } catch (error) {
          response.message += '\n\n⚠️ Could not set lineup. Make sure you have players on your roster.'
        }
      } else if (response.action.type === 'add_player' && context.teamId) {
        // Handle add/drop actions
        response.message += '\n\n💡 Use the waivers API to complete this action, or ask me to help you find available players.'
      } else if (response.action.type === 'propose_trade' && context.teamId) {
        // Handle trade actions
        response.message += '\n\n💡 I can help evaluate trades. Tell me the specific players involved.'
      } else if (response.action.type === 'view_teams') {
        // Teams card is already generated via intent parsing, so this is handled
        // The action is just for consistency
      } else if (response.action.type === 'show_lineup' && context.teamId && context.league) {
        // Show current lineup - similar to set_lineup but read-only
        try {
          const lineupResponse = await fetch(`${request.nextUrl.origin}/api/lineup?teamId=${context.teamId}&leagueId=${context.league.id}`)
          if (lineupResponse.ok) {
            const lineupData = await lineupResponse.json()
            const slots = lineupData.optimal.starters.map((s: any) => ({
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
                projectedTotal: lineupData.optimal.totalProjected,
              },
            })
          }
        } catch (error) {
          console.error('Error generating lineup card:', error)
        }
      } else if (response.action.type === 'show_matchup' && context.teamId && context.league) {
        // Show matchup - similar to existing matchup handling
        try {
          const lineupResponse = await fetch(`${request.nextUrl.origin}/api/lineup?teamId=${context.teamId}&leagueId=${context.league.id}`)
          if (lineupResponse.ok) {
            const lineupData = await lineupResponse.json()
            const myProj = lineupData.optimal.totalProjected
            const oppProj = myProj * 0.95 + Math.random() * 5 // Mock opponent projection
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
        } catch (error) {
          console.error('Error generating matchup card:', error)
        }
      } else if (response.action.type === 'show_waivers') {
        // Waivers - could be enhanced with actual waiver wire data
        response.message += '\n\n💡 I can help you find the best available players. Let me check the waiver wire...'
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Sorry, something went wrong.' },
      { status: 500 }
    )
  }
}
