import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { YahooFantasyAPI } from '@/lib/yahoo/api'

export interface LeaguePlayerEntry {
  playerKey: string
  playerId: string
  name: string
  team: string           // MLB team abbreviation
  positions: string[]    // eligible positions
  positionType: string   // 'B' for batter, 'P' for pitcher
  displayPosition: string
  status?: string        // injury / roster status
}

const PAGE_SIZE = 25 // Yahoo API max per request

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueKey = searchParams.get('leagueKey')
    const positionType = searchParams.get('positionType') // 'B' or 'P'

    if (!leagueKey) {
      return NextResponse.json({ error: 'leagueKey is required' }, { status: 400 })
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)

    // Yahoo API returns max 25 players per request.
    // Fetch multiple pages in parallel to build the full list.
    // First, fetch page 0 to see how many players exist.
    const firstPage = await api.getPlayers(leagueKey, {
      start: 0,
      count: PAGE_SIZE,
      position: positionType || undefined,
      status: 'A', // All players (rostered + free agents)
      sort: 'AR',  // Sort by average rank
    })

    const allPlayers = [...firstPage.players]

    // Check the raw XML for total count to know how many more pages to fetch
    // Yahoo includes <count> in the <players> tag: <players count="500">
    let totalAvailable = firstPage.players.length
    if (firstPage.raw) {
      const countMatch = firstPage.raw.match(/<players[^>]*count="(\d+)"/)
      if (countMatch) {
        totalAvailable = parseInt(countMatch[1], 10)
      }
    }

    // If there are more pages, fetch them in parallel (cap at 500 players total to stay responsive)
    const MAX_PLAYERS = 500
    const maxToFetch = Math.min(totalAvailable, MAX_PLAYERS)

    if (firstPage.players.length >= PAGE_SIZE && maxToFetch > PAGE_SIZE) {
      const remainingPages = Math.ceil((maxToFetch - PAGE_SIZE) / PAGE_SIZE)
      const pagePromises = []

      for (let i = 1; i <= remainingPages; i++) {
        pagePromises.push(
          api.getPlayers(leagueKey, {
            start: i * PAGE_SIZE,
            count: PAGE_SIZE,
            position: positionType || undefined,
            status: 'A',
            sort: 'AR',
          }).catch(err => {
            console.error(`Error fetching player page ${i}:`, err)
            return { players: [] }
          })
        )
      }

      const pageResults = await Promise.all(pagePromises)
      for (const result of pageResults) {
        allPlayers.push(...result.players)
      }
    }

    // Map to our response format
    const entries: LeaguePlayerEntry[] = allPlayers.map((p) => ({
      playerKey: p.player_key,
      playerId: p.player_id,
      name: p.name?.full || `${p.name?.first || ''} ${p.name?.last || ''}`.trim(),
      team: p.editorial_team_abbr || '',
      positions: p.eligible_positions || [],
      positionType: p.position_type || '',
      displayPosition: p.display_position || p.eligible_positions?.[0] || '',
      status: p.injury_status || p.status,
    }))

    return NextResponse.json({
      players: entries,
      total: entries.length,
      totalAvailable,
      positionType: positionType || 'all',
    })
  } catch (error: any) {
    console.error('Error in league-players API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch league players' },
      { status: 500 }
    )
  }
}
