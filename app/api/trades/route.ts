import { NextRequest, NextResponse } from 'next/server'
import { tradeDB, rosterDB, playerDB, teamDB } from '@/lib/db'
import { Trade } from '@/types'
import { requireYahooAuth } from '@/lib/yahoo/auth'

export async function POST(request: NextRequest) {
  try {
    const token = await requireYahooAuth()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leagueId, team1Id, team2Id, player1Id, player2Id, message } = await request.json()

    if (!leagueId || !team1Id || !team2Id || !player1Id || !player2Id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate players exist
    const player1 = playerDB.get(player1Id)
    const player2 = playerDB.get(player2Id)

    if (!player1 || !player2) {
      return NextResponse.json(
        { error: 'One or more players not found' },
        { status: 404 }
      )
    }

    // Validate players are on correct teams
    const roster1 = rosterDB.get(team1Id)
    const roster2 = rosterDB.get(team2Id)

    if (!roster1 || !roster2) {
      return NextResponse.json(
        { error: 'One or more rosters not found' },
        { status: 404 }
      )
    }

    const player1OnTeam1 = roster1.players.some((p) => p.playerId === player1Id)
    const player2OnTeam2 = roster2.players.some((p) => p.playerId === player2Id)

    if (!player1OnTeam1 || !player2OnTeam2) {
      return NextResponse.json(
        { error: 'Players must be on the correct teams' },
        { status: 400 }
      )
    }

    // Create trade
    const trade: Trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      leagueId,
      team1Id,
      team2Id,
      player1Id,
      player2Id,
      status: 'pending',
      proposedAt: new Date().toISOString(),
      message: message || undefined,
    }

    tradeDB.create(trade)

    return NextResponse.json(trade, { status: 201 })
  } catch (error) {
    console.error('Trade creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await requireYahooAuth()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tradeId, status } = await request.json()

    if (!tradeId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['accepted', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const trade = tradeDB.get(tradeId)
    if (!trade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      )
    }

    const updatedTrade = tradeDB.update(tradeId, { status: status as any })

    // If accepted, execute the trade
    if (status === 'accepted') {
      const roster1 = rosterDB.get(trade.team1Id)
      const roster2 = rosterDB.get(trade.team2Id)

      if (roster1 && roster2) {
        // Remove player1 from team1, add player2
        roster1.players = roster1.players.filter((p) => p.playerId !== trade.player1Id)
        const player2 = playerDB.get(trade.player2Id)
        if (player2) {
          roster1.players.push({
            playerId: trade.player2Id,
            position: player2.position,
            isStarter: false,
            slot: 'BN',
          })
        }

        // Remove player2 from team2, add player1
        roster2.players = roster2.players.filter((p) => p.playerId !== trade.player2Id)
        const player1 = playerDB.get(trade.player1Id)
        if (player1) {
          roster2.players.push({
            playerId: trade.player1Id,
            position: player1.position,
            isStarter: false,
            slot: 'BN',
          })
        }

        rosterDB.update(trade.team1Id, roster1)
        rosterDB.update(trade.team2Id, roster2)
      }
    }

    return NextResponse.json(updatedTrade)
  } catch (error) {
    console.error('Trade update error:', error)
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
    const leagueId = searchParams.get('leagueId')
    const teamId = searchParams.get('teamId')

    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      )
    }

    let trades = tradeDB.getByLeague(leagueId)

    if (teamId) {
      trades = trades.filter(
        (t) => t.team1Id === teamId || t.team2Id === teamId
      )
    }

    return NextResponse.json(trades)
  } catch (error) {
    console.error('Trade fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
