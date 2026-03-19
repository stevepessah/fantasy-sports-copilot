import { NextRequest, NextResponse } from 'next/server'
import { rosterDB, playerDB, teamDB, leagueDB } from '@/lib/db'
import { requireYahooAuth } from '@/lib/yahoo/auth'

export async function POST(request: NextRequest) {
  try {
    const token = await requireYahooAuth()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { teamId, action, playerId, dropPlayerId, leagueId } = await request.json()

    if (!teamId || !action || !playerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const roster = rosterDB.get(teamId)
    if (!roster) {
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      )
    }

    const player = playerDB.get(playerId)
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    // Get league to verify sport match
    if (leagueId) {
      const league = leagueDB.get(leagueId)
      if (league && player.sport !== league.sport) {
        return NextResponse.json(
          { error: 'Player does not match league sport' },
          { status: 400 }
        )
      }
    }

    if (action === 'add') {
      // Check if roster has space (simplified - assume 15 player limit)
      if (roster.players.length >= 15 && !dropPlayerId) {
        return NextResponse.json(
          { error: 'Roster is full. Please drop a player first.' },
          { status: 400 }
        )
      }

      // Drop player if specified
      if (dropPlayerId) {
        roster.players = roster.players.filter((p) => p.playerId !== dropPlayerId)
      }

      // Add new player
      roster.players.push({
        playerId,
        position: player.position,
        isStarter: false,
        slot: 'BN',
      })

      rosterDB.update(teamId, roster)

      return NextResponse.json({
        success: true,
        message: `Added ${player.name} to your team${dropPlayerId ? ' and dropped the specified player' : ''}`,
      })
    }

    if (action === 'drop') {
      const playerIndex = roster.players.findIndex((p) => p.playerId === playerId)
      if (playerIndex === -1) {
        return NextResponse.json(
          { error: 'Player not on roster' },
          { status: 400 }
        )
      }

      roster.players.splice(playerIndex, 1)
      rosterDB.update(teamId, roster)

      return NextResponse.json({
        success: true,
        message: `Dropped ${player.name} from your team`,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Waiver action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = await requireYahooAuth()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const position = searchParams.get('position')

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      )
    }

    const roster = rosterDB.get(teamId)
    if (!roster) {
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      )
    }

    // Get league to filter by sport
    const leagueId = searchParams.get('leagueId')
    let availablePlayers = playerDB.getAll()

    // Filter by sport if league is provided
    if (leagueId) {
      const league = leagueDB.get(leagueId)
      if (league) {
        availablePlayers = availablePlayers.filter((p) => p.sport === league.sport)
      }
    }

    // Filter out players already on roster
    const rosterPlayerIds = new Set(roster.players.map((p) => p.playerId))
    availablePlayers = availablePlayers.filter((p) => !rosterPlayerIds.has(p.id))

    // Filter by position if specified
    if (position) {
      availablePlayers = availablePlayers.filter((p) => p.position === position)
    }

    // Sort by projected points
    availablePlayers.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))

    return NextResponse.json(availablePlayers)
  } catch (error) {
    console.error('Waivers fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
