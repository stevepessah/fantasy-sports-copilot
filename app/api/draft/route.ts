import { NextRequest, NextResponse } from 'next/server'
import { draftDB, playerDB, leagueDB, teamDB, rosterDB } from '@/lib/db'
import { DraftPick } from '@/types'
import { requireYahooAuth } from '@/lib/yahoo/auth'

export async function POST(request: NextRequest) {
  try {
    const token = await requireYahooAuth()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leagueId, teamId, playerId } = await request.json()

    if (!leagueId || !teamId || !playerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const league = await leagueDB.get(leagueId)
    if (!league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    const player = await playerDB.get(playerId)
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    // Verify player matches league sport
    if (player.sport !== league.sport) {
      return NextResponse.json(
        { error: 'Player does not match league sport' },
        { status: 400 }
      )
    }

    // Get existing picks to calculate round and pick number
    const existingPicks = await draftDB.getByLeague(leagueId)
    const totalPicks = existingPicks.length
    const round = Math.floor(totalPicks / league.numTeams) + 1
    const pickInRound = (totalPicks % league.numTeams) + 1

    // Create draft pick
    const draftPick: DraftPick = {
      id: `pick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      leagueId,
      round,
      pick: totalPicks + 1,
      teamId,
      playerId,
      timestamp: new Date().toISOString(),
    }

    await draftDB.create(draftPick)

    // Add player to roster
    let roster = await rosterDB.get(teamId)
    if (!roster) {
      roster = {
        teamId,
        players: [],
      }
    }

    roster.players.push({
      playerId,
      position: player.position,
      isStarter: false,
      slot: 'BN',
    })

    await rosterDB.update(teamId, roster)

    return NextResponse.json(draftPick, { status: 201 })
  } catch (error) {
    console.error('Draft pick error:', error)
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

    if (teamId) {
      const picks = await draftDB.getByTeam(teamId)
      return NextResponse.json(picks)
    }

    const picks = await draftDB.getByLeague(leagueId)
    return NextResponse.json(picks)
  } catch (error) {
    console.error('Draft fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
