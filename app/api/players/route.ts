import { NextRequest, NextResponse } from 'next/server'
import { playerDB, initializeSampleData } from '@/lib/db'
import { Sport } from '@/types'

// Track initialized sports
const initializedSports = new Set<Sport>()

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position')
    const search = searchParams.get('search')
    const sport = (searchParams.get('sport') as Sport) || 'baseball'

    // Initialize data for the requested sport if not already done
    if (!initializedSports.has(sport)) {
      initializeSampleData(sport)
      initializedSports.add(sport)
    }

    let players = playerDB.getAll().filter((p) => p.sport === sport)

    if (position) {
      const positionPlayers = playerDB.getByPosition(position as any)
      players = positionPlayers.filter((p) => p.sport === sport)
    }

    if (search) {
      const searchPlayers = playerDB.search(search)
      players = searchPlayers.filter((p) => p.sport === sport)
    }

    return NextResponse.json(players)
  } catch (error) {
    console.error('Players fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
