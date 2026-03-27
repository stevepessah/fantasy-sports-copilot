import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { withYahooAuth } from '@/lib/yahoo/auth'
import { MLB_SEASON_TO_GAME_KEY } from '@/lib/yahoo/config'
import { BATTER_STAT_IDS, PITCHER_STAT_IDS } from '@/lib/statFormatters'

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
    let effectiveLeagueKey = leagueKey
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
          effectiveLeagueKey = historicalLeagueKey
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

    // 1) Fetch roster (positions + metadata) and league settings in parallel
    const [rosterResult, leagueSettings] = await Promise.all([
      api.getTeamRoster(effectiveTeamKey),
      leagueKey
        ? api.getLeagueSettings(leagueKey).catch(() => null)
        : Promise.resolve(null),
    ])
    const rosterPlayers = rosterResult.players
    const playerKeys = rosterPlayers.map((p) => p.player_key).filter(Boolean)

    // 2) Fetch actual stats from the league/players endpoint (same source the Players tab uses).
    //    The roster/players;out=stats endpoint returns limited data; the league/players endpoint
    //    returns full stats including all counting and rate categories.
    let statsPlayers: Awaited<ReturnType<typeof api.getPlayers>>['players'] = []
    if (playerKeys.length > 0 && effectiveLeagueKey) {
      try {
        const statsResult = await api.getPlayers(effectiveLeagueKey, {
          playerKeys,
          out: 'stats',
          dateRange: dateRange || undefined,
        })
        statsPlayers = statsResult.players
      } catch (err) {
        console.error('[roster-stats] Failed to fetch player stats from league endpoint:', err)
      }
    }

    // 3) Build a map of stats keyed by player_key
    const statsMap = new Map<string, Record<string, string | number>>()
    for (const sp of statsPlayers) {
      if (sp.player_key && sp.player_stats) {
        statsMap.set(sp.player_key, sp.player_stats)
      }
    }

    // 4) Merge: roster positions + metadata from getTeamRoster, stats from getPlayers
    const players = rosterPlayers.map((p) => ({
      ...p,
      player_stats: statsMap.get(p.player_key) ?? p.player_stats,
    }))

    const gameKey = effectiveTeamKey.split('.')[0]
    const categories = await getCachedStatCategories(api, gameKey)

    const CANONICAL_STAT_NAMES: Record<string, string> = {
      ...BATTER_STAT_IDS,
      ...PITCHER_STAT_IDS,
    }

    const entries: RosterPlayerEntry[] = players.map((p) => {
      const remapped: Record<string, number | string> = {}
      if (p.player_stats) {
        for (const [statId, value] of Object.entries(p.player_stats)) {
          const canonicalName = CANONICAL_STAT_NAMES[statId]
          const yahooName = categories[statId]?.displayName

          if (canonicalName) {
            remapped[canonicalName] = value
          }
          if (yahooName && yahooName !== canonicalName) {
            remapped[yahooName] = value
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
