import { NextRequest, NextResponse } from 'next/server'
import { LeagueManager } from '@/lib/league'
import { leagueDB, rosterDB } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { teamId, leagueId } = await request.json()

    if (!teamId || !leagueId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const league = leagueDB.get(leagueId)
    if (!league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    const optimal = LeagueManager.optimizeLineup(teamId, league)
    const updatedRoster = LeagueManager.setLineup(teamId, league)

    return NextResponse.json({
      success: true,
      roster: updatedRoster,
      optimal,
      message: optimal.explanation,
    })
  } catch (error) {
    console.error('Lineup optimization error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const leagueId = searchParams.get('leagueId')

    if (!teamId || !leagueId) {
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

    const league = leagueDB.get(leagueId)
    if (!league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    const optimal = LeagueManager.optimizeLineup(teamId, league)

    return NextResponse.json({
      roster,
      optimal,
    })
  } catch (error) {
    console.error('Lineup fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
