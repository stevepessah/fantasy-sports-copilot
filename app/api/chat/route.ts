import { NextRequest, NextResponse } from 'next/server'
import { fantasyAI } from '@/lib/ai'
import { leagueDB, teamDB, rosterDB, playerDB } from '@/lib/db'
import { LeagueManager } from '@/lib/league'
import { parseIntent, findPlayerByNameApprox } from '@/lib/commandParser'

export async function POST(request: NextRequest) {
  try {
    const { message, leagueId, userId, sport, conversationHistory } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const currentSport = sport || 'football'

    // Build context
    const context: any = {
      userId: userId || 'user_1', // For MVP, use default user
      leagueId,
      sport: currentSport,
    }

    if (leagueId) {
      const league = leagueDB.get(leagueId)
      if (league) {
        context.league = league

        // Get user's team if available
        if (userId) {
          const allTeams = teamDB.getByLeague(leagueId)
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

    if (intent.isPlayerLookup && intent.playerName) {
      const players = playerDB.getAll().filter((p) => p.sport === currentSport)
      const player = findPlayerByNameApprox(intent.playerName, players)
      if (player) {
        response.cards.push({
          type: 'player',
          title: 'Player Snapshot',
          payload: {
            player,
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
