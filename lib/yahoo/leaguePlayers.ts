/**
 * Core logic for fetching all players in a Yahoo league.
 * Extracted so it can be called from both the API route and the chat route
 * without a self-fetch.
 */

import { YahooFantasyAPI } from './api'
import { MLB_SEASON_TO_GAME_KEY as SEASON_TO_GAME_KEY } from './config'

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
  ownershipType?: string
  ownerTeamKey?: string
  ownerTeamName?: string
  rank: number
  percentOwned?: number
  percentOwnedDelta?: number
  averageDraftPick?: number
  averageDraftRound?: number
  percentDrafted?: number
}

const PAGE_SIZE = 25
const MAX_PLAYERS = 500

// Cache stat categories per game key
const statCatCache: Record<
  string,
  { categories: Record<string, { name: string; displayName: string; positionType: string }>; ts: number }
> = {}
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
  } catch {
    return {}
  }
}

export interface FetchLeaguePlayersOptions {
  leagueKey: string
  positionType?: string // 'B' | 'P'
  status?: string       // 'A' = all, 'FA' = free agents, 'T' = taken, 'W' = waivers
  season?: number
}

export async function fetchLeaguePlayers(
  api: YahooFantasyAPI,
  options: FetchLeaguePlayersOptions,
): Promise<{ players: LeaguePlayerEntry[]; total: number; totalAvailable: number }> {
  const { leagueKey, positionType, status, season } = options

  const currentGameKey = leagueKey.split('.')[0]
  const gameKey =
    season && SEASON_TO_GAME_KEY[season] ? SEASON_TO_GAME_KEY[season] : currentGameKey

  // For historical seasons we need a league key from that season's game.
  let effectiveLeagueKey = leagueKey
  if (season && SEASON_TO_GAME_KEY[season] && SEASON_TO_GAME_KEY[season] !== currentGameKey) {
    try {
      const { leagues } = await api.getLeagues(SEASON_TO_GAME_KEY[season])
      if (leagues.length > 0) {
        effectiveLeagueKey = leagues[0].league_key
      }
    } catch {
      // Fall back to current league key
    }
  }

  const categories = await getCachedStatCategories(api, gameKey)

  const fetchPage = (start: number) =>
    api
      .getPlayers(effectiveLeagueKey, {
        start,
        count: PAGE_SIZE,
        position: positionType || undefined,
        status: status || undefined,
        sort: 'AR',
        out: 'stats,ownership,percent_owned,draft_analysis',
      })
      .catch(() => ({ players: [] as any[], raw: undefined as string | undefined }))

  const firstPage = await fetchPage(0)
  const allRaw = [...firstPage.players]

  // Try to extract total from XML
  let totalAvailable = 0
  if (firstPage.raw) {
    const totalMatch = firstPage.raw.match(/<players[^>]*\btotal="(\d+)"/)
    const countMatch = firstPage.raw.match(/<players[^>]*\bcount="(\d+)"/)
    if (totalMatch) {
      totalAvailable = parseInt(totalMatch[1], 10)
    } else if (countMatch) {
      const n = parseInt(countMatch[1], 10)
      totalAvailable = n > PAGE_SIZE ? n : 0
    }
  }

  if (totalAvailable > 0) {
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
    let start = PAGE_SIZE
    while (allRaw.length < MAX_PLAYERS) {
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

  const FALLBACK_STAT_NAMES: Record<string, string> = {
    '1': 'GP', '6': 'AB', '8': 'H', '18': 'BB',
  }

  // Remap stat IDs → display names and assign rank from sort position
  const entries: LeaguePlayerEntry[] = allRaw.map((p: any, index: number) => {
    const remapped: Record<string, number | string> = {}
    if (p.player_stats && categories) {
      for (const [statId, value] of Object.entries(p.player_stats)) {
        const displayName = categories[statId]?.displayName ?? FALLBACK_STAT_NAMES[statId]
        if (displayName) {
          remapped[displayName] = value as number | string
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
      rank: index + 1,
      percentOwned: p.percent_owned,
      percentOwnedDelta: p.percent_owned_delta,
      averageDraftPick: p.average_draft_pick,
      averageDraftRound: p.average_draft_round,
      percentDrafted: p.percent_drafted,
    }
  })

  return {
    players: entries,
    total: entries.length,
    totalAvailable: totalAvailable || entries.length,
  }
}
