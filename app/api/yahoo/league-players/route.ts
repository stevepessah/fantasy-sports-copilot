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
  stats: Record<string, number | string>
  ownershipType?: string      // 'team' | 'freeagents' | 'waivers'
  ownerTeamKey?: string
  ownerTeamName?: string
}

const PAGE_SIZE = 25
const MAX_PLAYERS = 500   // safety cap

// Map season → Yahoo game key
const seasonToGameKey: Record<number, string> = {
  2026: '469',
  2025: '458',
  2024: '431',
  2023: '422',
}

// Cache stat categories per game key
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
    const seasonParam = searchParams.get('season')
    const season = seasonParam ? parseInt(seasonParam, 10) : undefined
    const status = searchParams.get('status') || 'A' // 'A' = all, 'FA' = free agents, 'W' = waivers, 'T' = taken

    if (!leagueKey) {
      return NextResponse.json({ error: 'leagueKey is required' }, { status: 400 })
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)

    // Determine game key — current league key for current season, or mapped key for historical
    const currentGameKey = leagueKey.split('.')[0]
    const gameKey = season && seasonToGameKey[season] ? seasonToGameKey[season] : currentGameKey

    // For historical seasons we need a league key from that season's game.
    // Yahoo players endpoint needs a league key. For historical, we look up the user's league from that season.
    let effectiveLeagueKey = leagueKey
    if (season && seasonToGameKey[season] && seasonToGameKey[season] !== currentGameKey) {
      try {
        const { leagues } = await api.getLeagues(seasonToGameKey[season])
        if (leagues.length > 0) {
          effectiveLeagueKey = leagues[0].league_key
        }
      } catch {
        // Fall back to current league key — stats may not work for historical
        console.warn(`Could not find league for season ${season}, using current league`)
      }
    }

    // Fetch stat categories first (needed for remapping)
    const categories = await getCachedStatCategories(api, gameKey)

    // Fetch all pages of players. Yahoo returns max 25/page.
    // Strategy: fetch first page, then keep fetching in batches until we get < PAGE_SIZE results.
    const fetchPage = (start: number) =>
      api.getPlayers(effectiveLeagueKey, {
        start,
        count: PAGE_SIZE,
        position: positionType || undefined,
        status,
        sort: 'AR',
        out: 'stats,ownership',
      }).catch(() => ({ players: [], raw: undefined }))

    const firstPage = await fetchPage(0)
    const allRaw = [...firstPage.players]

    // Try to extract total from XML: <players ... total="500"> or count="500"
    let totalAvailable = 0
    if (firstPage.raw) {
      const totalMatch = firstPage.raw.match(/<players[^>]*\btotal="(\d+)"/)
      const countMatch = firstPage.raw.match(/<players[^>]*\bcount="(\d+)"/)
      if (totalMatch) {
        totalAvailable = parseInt(totalMatch[1], 10)
      } else if (countMatch) {
        const n = parseInt(countMatch[1], 10)
        // If count > PAGE_SIZE it's likely the total; otherwise keep fetching
        totalAvailable = n > PAGE_SIZE ? n : 0
      }
    }

    if (totalAvailable > 0) {
      // We know the total — fetch remaining pages in parallel
      const cap = Math.min(totalAvailable, MAX_PLAYERS)
      if (allRaw.length < cap) {
        const remaining = Math.ceil((cap - PAGE_SIZE) / PAGE_SIZE)
        const fetches = []
        for (let i = 1; i <= remaining; i++) {
          fetches.push(fetchPage(i * PAGE_SIZE))
        }
        const results = await Promise.all(fetches)
        for (const r of results) allRaw.push(...r.players)
      }
    } else if (firstPage.players.length >= PAGE_SIZE) {
      // Total unknown — fetch in small batches until we get a short page
      let start = PAGE_SIZE
      while (allRaw.length < MAX_PLAYERS) {
        // Fetch next batch of 4 pages in parallel for speed
        const batchSize = 4
        const fetches = []
        for (let i = 0; i < batchSize && start < MAX_PLAYERS; i++) {
          fetches.push(fetchPage(start))
          start += PAGE_SIZE
        }
        const results = await Promise.all(fetches)
        let gotShortPage = false
        for (const r of results) {
          allRaw.push(...r.players)
          if (r.players.length < PAGE_SIZE) {
            gotShortPage = true
            break
          }
        }
        if (gotShortPage) break
      }
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
        ownershipType: p.ownership_type,
        ownerTeamKey: p.owner_team_key,
        ownerTeamName: p.owner_team_name,
      }
    })

    return NextResponse.json({
      players: entries,
      total: entries.length,
      totalAvailable: totalAvailable || entries.length,
      positionType: positionType || 'all',
      season: season || null,
    })
  } catch (error: any) {
    console.error('Error in league-players API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch league players' },
      { status: 500 }
    )
  }
}
