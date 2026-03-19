import { NextRequest, NextResponse } from 'next/server'
import { leagueDB, teamDB } from '@/lib/db'
import { League, Team } from '@/types'
import { getDefaultScoringType } from '@/lib/sports'
import { Sport } from '@/types'
import { requireYahooAuth } from '@/lib/yahoo/auth'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireYahooAuth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { numTeams, scoringType, draftType, name, commissionerId, sport } = await request.json()

    if (!numTeams || !draftType || !commissionerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const currentSport: Sport = sport || 'football'
    const defaultScoringType = scoringType || getDefaultScoringType(currentSport)

    if (numTeams < 10 || numTeams > 12) {
      return NextResponse.json(
        { error: 'League must have 10-12 teams' },
        { status: 400 }
      )
    }

    const league: League = {
      id: `league_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name || `${currentSport === 'football' ? 'Fantasy Football' : 'Fantasy Baseball'} League ${new Date().getFullYear()}`,
      commissionerId,
      sport: currentSport,
      type: 'redraft',
      numTeams,
      scoringType: defaultScoringType,
      draftType,
      status: 'setup',
      createdAt: new Date().toISOString(),
      season: new Date().getFullYear(),
    }

    const createdLeague = leagueDB.create(league)

    return NextResponse.json(createdLeague, { status: 201 })
  } catch (error) {
    console.error('League creation error:', error)
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
    const leagueId = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (leagueId) {
      const league = leagueDB.get(leagueId)
      if (!league) {
        return NextResponse.json(
          { error: 'League not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(league)
    }

    if (userId) {
      // Get leagues where user is commissioner or team owner
      const allLeagues = leagueDB.getAll()
      const userLeagues = allLeagues.filter(
        (l) => l.commissionerId === userId
      )
      return NextResponse.json(userLeagues)
    }

    // Return all leagues (for MVP - in production, add pagination)
    const allLeagues = leagueDB.getAll()
    return NextResponse.json(allLeagues)
  } catch (error) {
    console.error('League fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
