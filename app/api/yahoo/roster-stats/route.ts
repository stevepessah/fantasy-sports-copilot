import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { YahooFantasyAPI } from '@/lib/yahoo/api'

export const dynamic = 'force-dynamic'

export interface RosterPlayerEntry {
  playerKey: string
  playerId: string
  name: string
  team: string
  positions: string[]
  positionType: string
  displayPosition: string
  selectedPosition: string
  imageUrl?: string
  status?: string
  injuryStatus?: string
  stats: Record<string, number | string>
}

export interface LeagueStatCategory {
  displayName: string
  positionType: string
  sortOrder: string
}

const statCatCache: Record<string, { categories: Record<string, { name: string; displayName: string; positionType: string }>; ts: number }> = {}
const CACHE_TTL = 60 * 60 * 1000

async function getCachedStatCategories(
  api: YahooFantasyAPI,
  gameKey: string,
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
    const teamKey = searchParams.get('teamKey')
    const leagueKey = searchParams.get('leagueKey')
    if (!teamKey) {
      return NextResponse.json({ error: 'teamKey parameter is required' }, { status: 400 })
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)

    const [rosterResult, leagueSettings] = await Promise.all([
      api.getTeamRoster(teamKey, { out: 'stats' }),
      leagueKey
        ? api.getLeagueSettings(leagueKey).catch(() => null)
        : Promise.resolve(null),
    ])

    const { players } = rosterResult

    const gameKey = teamKey.split('.')[0]
    const categories = await getCachedStatCategories(api, gameKey)

    const entries: RosterPlayerEntry[] = players.map((p) => {
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
        selectedPosition: p.selected_position?.position || '',
        imageUrl: p.image_url,
        status: p.status,
        injuryStatus: p.injury_status,
        stats: remapped,
      }
    })

    // Build league scoring categories if league settings were fetched
    let leagueCategories: LeagueStatCategory[] | undefined
    if (leagueSettings?.settings?.statCategories) {
      leagueCategories = leagueSettings.settings.statCategories
        .filter((c) => !c.isOnlyDisplayStat)
        .map((c) => ({
          displayName: c.displayName,
          positionType: c.positionType,
          sortOrder: c.sortOrder,
        }))
    }

    return NextResponse.json(
      {
        players: entries,
        teamKey,
        count: entries.length,
        leagueCategories: leagueCategories ?? null,
      },
      { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (error: any) {
    console.error('Error in roster-stats API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch roster stats' },
      { status: 500 },
    )
  }
}
