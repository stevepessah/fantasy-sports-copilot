import { NextRequest, NextResponse } from 'next/server'
import { setupBaseballLeague, REGULAR_SEASON_WEEKS, PLAYOFF_WEEKS, TOTAL_WEEKS } from '@/lib/setupBaseballLeague'

export async function POST(request: NextRequest) {
  try {
    const result = setupBaseballLeague()

    return NextResponse.json({
      success: true,
      league: result.league,
      teams: result.teams.map(t => ({ id: t.id, name: t.name })),
      matchups: result.matchups.length,
      regularSeasonWeeks: REGULAR_SEASON_WEEKS,
      playoffWeeks: PLAYOFF_WEEKS,
      totalWeeks: TOTAL_WEEKS,
    }, { status: 201 })
  } catch (error) {
    console.error('League setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
