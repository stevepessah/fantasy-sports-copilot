import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { withYahooAuth } from '@/lib/yahoo/auth'
import { MLB_SEASON_TO_GAME_KEY } from '@/lib/yahoo/config'

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
    const auth = await withYahooAuth()
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamKey = searchParams.get('teamKey')
    const leagueKey = searchParams.get('leagueKey')
    const dateRange = searchParams.get('dateRange') || undefined
    const seasonParam = searchParams.get('season')
    if (!teamKey) {
      return NextResponse.json({ error: 'teamKey parameter is required' }, { status: 400 })
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)

    // For historical seasons, discover the user's league & team from that year
    let effectiveTeamKey = teamKey
    if (seasonParam) {
      const season = parseInt(seasonParam, 10)
      const historicalGameKey = MLB_SEASON_TO_GAME_KEY[season]
      if (historicalGameKey) {
        try {
          const { leagues } = await api.getLeagues(historicalGameKey)
          if (leagues.length === 0) {
            return NextResponse.json(
              { error: `No leagues found for the ${season} season` },
              { status: 404 },
            )
          }
          const historicalLeagueKey = leagues[0].league_key
          const { teams } = await api.getLeagueTeams(historicalLeagueKey)
          const userTeam = teams.find((t) =>
            t.managers?.some((m) => m.is_current_login === '1'),
          )
          if (!userTeam) {
            return NextResponse.json(
              { error: `Could not find your team in the ${season} season` },
              { status: 404 },
            )
          }
          effectiveTeamKey = userTeam.team_key
        } catch (err: any) {
          console.error(`Failed to resolve ${season} season team:`, err)
          return NextResponse.json(
            { error: `Unable to load the ${season} season — ${err.message || 'unknown error'}` },
            { status: 500 },
          )
        }
      }
    }

    const leagueSettingsPromise = leagueKey
      ? api.getLeagueSettings(leagueKey).catch(() => null)
      : Promise.resolve(null)

    let players: Awaited<ReturnType<typeof api.getTeamRoster>>['players']
    let leagueSettings: Awaited<ReturnType<typeof api.getLeagueSettings>> | null

    if (dateRange) {
      // Fetch roster metadata + date-range stats in parallel.
      // The metadata call always includes full player info (name, image, etc.).
      // The stats call uses the /stats sub-resource path so ;type= is scoped correctly.
      const [metaResult, statsResult, ls] = await Promise.all([
        api.getTeamRoster(effectiveTeamKey, { out: 'stats' }),
        api.getTeamRoster(effectiveTeamKey, { out: 'stats', dateRange }),
        leagueSettingsPromise,
      ])
      leagueSettings = ls

      // Build a map of date-range stats keyed by player_key
      const statsMap = new Map<string, typeof statsResult.players[0]['player_stats']>()
      for (const sp of statsResult.players) {
        if (sp.player_key && sp.player_stats) {
          statsMap.set(sp.player_key, sp.player_stats)
        }
      }

      // Merge: use full metadata from metaResult, overlay stats from statsResult
      players = metaResult.players.map((p) => ({
        ...p,
        player_stats: statsMap.get(p.player_key) ?? p.player_stats,
      }))
    } else {
      const [rosterResult, ls] = await Promise.all([
        api.getTeamRoster(effectiveTeamKey, { out: 'stats' }),
        leagueSettingsPromise,
      ])
      leagueSettings = ls
      players = rosterResult.players
    }

    const gameKey = effectiveTeamKey.split('.')[0]
    const categories = await getCachedStatCategories(api, gameKey)

    const FALLBACK_STAT_NAMES: Record<string, string> = {
      '1': 'GP', '6': 'AB', '8': 'H', '18': 'BB',
    }

    const entries: RosterPlayerEntry[] = players.map((p) => {
      const remapped: Record<string, number | string> = {}
      if (p.player_stats && categories) {
        for (const [statId, value] of Object.entries(p.player_stats)) {
          const displayName = categories[statId]?.displayName ?? FALLBACK_STAT_NAMES[statId]
          if (displayName) {
            remapped[displayName] = value
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

    return auth.json(
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
