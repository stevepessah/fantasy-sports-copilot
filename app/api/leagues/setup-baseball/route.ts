import { NextRequest, NextResponse } from 'next/server'
import { setupBaseballLeague } from '@/lib/setupBaseballLeague'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect your Yahoo account first.' },
        { status: 401 }
      )
    }

    const result = await setupBaseballLeague(accessToken)

    return NextResponse.json({
      success: true,
      league: result.league,
      teams: result.teams.map(t => ({ id: t.id, name: t.name, wins: t.wins, losses: t.losses })),
      yahooLeagueKey: result.yahooLeagueKey,
    }, { status: 201 })
  } catch (error) {
    console.error('League setup error:', error)
    return NextResponse.json(
      { error: 'Failed to set up league from Yahoo', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
