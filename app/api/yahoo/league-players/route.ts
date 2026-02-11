import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { YahooFantasyAPI } from '@/lib/yahoo/api'

export interface LeaguePlayerEntry {
  playerKey: string
  playerId: string
  name: string
  team: string
  positions: string[]
  positionType: string
  displayPosition: string
  status?: string
  stats: Record<string, number | string>  // displayName → value (already remapped)
}

const PAGE_SIZE = 25

// Cache stat categories (same approach as player-stats route)
const statCatCache: Record<string, { categories: Record<string, { name: string; displayName: string; positionType: string }>; ts: number }> = {}
const CACHE_TTL = 60 * 60 * 1000

async function getCachedStatCategories(
  api: YahooFantasyAPI,
  gameKey: string
): Promise<Record<string, { name: string; displayName: string; positionType: string }>> {
  const c = statCatCache[gameKey]
  if (c && Date.now() - c.ts < CACHE_TTL) return c.categories
  try {
    const result = await api.getStatCategories(gameKey)
    statCatCache[gameKey] = { categories: result.categories, ts: Date.now() }
    return result.categories
  } catch (err) {
    console.error(`Failed to fetch stat categories for ${gameKey}:`, err)
    return {}
  }
}

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

    // Extract game key from league key (e.g. "469.l.45462" → "469")
    const gameKey = leagueKey.split('.')[0]

    // Fetch stat categories and first page of players (with stats) in parallel
    const [categories, firstPage] = await Promise.all([
      getCachedStatCategories(api, gameKey),
      api.getPlayers(leagueKey, {
        start: 0,
        count: PAGE_SIZE,
        position: positionType || undefined,
        status: 'A',
        sort: 'AR',
        out: 'stats',
      }),
    ])

    const allRaw = [...firstPage.players]

    // Determine total available from XML
    let totalAvailable = firstPage.players.length
    if (firstPage.raw) {
      const m = firstPage.raw.match(/<players[^>]*count="(\d+)"/)
      if (m) totalAvailable = parseInt(m[1], 10)
    }

    // Fetch remaining pages in parallel (cap at 250 for performance)
    const MAX = 250
    const cap = Math.min(totalAvailable, MAX)
    if (firstPage.players.length >= PAGE_SIZE && cap > PAGE_SIZE) {
      const pages = Math.ceil((cap - PAGE_SIZE) / PAGE_SIZE)
      const fetches = []
      for (let i = 1; i <= pages; i++) {
        fetches.push(
          api.getPlayers(leagueKey, {
            start: i * PAGE_SIZE,
            count: PAGE_SIZE,
            position: positionType || undefined,
            status: 'A',
            sort: 'AR',
            out: 'stats',
          }).catch(() => ({ players: [] }))
        )
      }
      const results = await Promise.all(fetches)
      for (const r of results) allRaw.push(...r.players)
    }

    // Remap stat IDs → display names for each player
    const entries: LeaguePlayerEntry[] = allRaw.map((p) => {
      const remapped: Record<string, number | string> = {}
      if (p.player_stats && categories) {
        for (const [statId, value] of Object.entries(p.player_stats)) {
          const cat = categories[statId]
          if (cat) {
            remapped[cat.displayName] = value
          }
        }
      }

      return {
        playerKey: p.player_key,
        playerId: p.player_id,
        name: p.name?.full || `${p.name?.first || ''} ${p.name?.last || ''}`.trim(),
        team: p.editorial_team_abbr || '',
        positions: p.eligible_positions || [],
        positionType: p.position_type || '',
        displayPosition: p.display_position || p.eligible_positions?.[0] || '',
        status: p.injury_status || p.status,
        stats: remapped,
      }
    })

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
