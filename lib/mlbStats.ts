/**
 * Supplementary MLB Stats API integration for fetching base stats (H, AB)
 * that Yahoo's league-level player stats may not include.
 *
 * MLB Stats API is free, unauthenticated, and returns comprehensive stats.
 * We use it as a fallback when Yahoo doesn't provide H and AB individually.
 */

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1'

interface MlbPlayer {
  id: number
  fullName: string
  teamId?: number
}

interface MlbHittingStats {
  hits: number
  atBats: number
}

// ── Caches ──────────────────────────────────────────────────────────────────

let playerListCache: { players: MlbPlayer[]; timestamp: number } | null = null
const PLAYER_LIST_TTL = 24 * 60 * 60 * 1000 // 24 hours

let hittingStatsCache: { stats: Map<number, MlbHittingStats>; timestamp: number } | null = null
const HITTING_STATS_TTL = 10 * 60 * 1000 // 10 minutes

// Yahoo team abbr → MLB team ID mapping
const TEAM_ABBR_TO_MLB_ID: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112,
  CWS: 145, CIN: 113, CLE: 114, COL: 115, DET: 116,
  HOU: 117, KC: 118, LAA: 108, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYM: 121, NYY: 147, OAK: 133,
  PHI: 143, PIT: 134, SD: 135, SF: 137, SEA: 136,
  STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
  // Aliases Yahoo sometimes uses
  AZ: 109, CHW: 145, WAS: 120,
}

// ── Player list fetching ────────────────────────────────────────────────────

async function fetchMlbPlayerList(season: number): Promise<MlbPlayer[]> {
  if (playerListCache && Date.now() - playerListCache.timestamp < PLAYER_LIST_TTL) {
    return playerListCache.players
  }

  try {
    const url = `${MLB_API_BASE}/sports/1/players?season=${season}&gameType=R&fields=people,id,fullName,currentTeam,id`
    const res = await fetch(url)
    if (!res.ok) return playerListCache?.players ?? []

    const data = await res.json()
    const players: MlbPlayer[] = (data.people || []).map((p: any) => ({
      id: p.id,
      fullName: p.fullName,
      teamId: p.currentTeam?.id,
    }))

    playerListCache = { players, timestamp: Date.now() }
    return players
  } catch (err) {
    console.error('[mlbStats] Failed to fetch MLB player list:', err)
    return playerListCache?.players ?? []
  }
}

// ── Bulk hitting stats fetching ─────────────────────────────────────────────

async function fetchBulkHittingStats(
  mlbIds: number[],
  season: number,
): Promise<Map<number, MlbHittingStats>> {
  if (mlbIds.length === 0) return new Map()

  // Return from cache if fresh
  if (hittingStatsCache && Date.now() - hittingStatsCache.timestamp < HITTING_STATS_TTL) {
    const allCached = mlbIds.every((id) => hittingStatsCache!.stats.has(id))
    if (allCached) return hittingStatsCache.stats
  }

  const result = new Map<number, MlbHittingStats>(hittingStatsCache?.stats)

  // Batch in groups of 50 to avoid overly long URLs
  const BATCH = 50
  for (let i = 0; i < mlbIds.length; i += BATCH) {
    const batch = mlbIds.slice(i, i + BATCH)
    const uncached = batch.filter((id) => !result.has(id))
    if (uncached.length === 0) continue

    try {
      const ids = uncached.join(',')
      const url = `${MLB_API_BASE}/people?personIds=${ids}&hydrate=stats(group=[hitting],type=[season],season=${season})&fields=people,id,stats,splits,stat,hits,atBats`
      const res = await fetch(url)
      if (!res.ok) continue

      const data = await res.json()
      for (const person of data.people || []) {
        const split = person.stats?.[0]?.splits?.[0]?.stat
        if (split && split.atBats !== undefined) {
          result.set(person.id, {
            hits: split.hits ?? 0,
            atBats: split.atBats ?? 0,
          })
        }
      }
    } catch (err) {
      console.error('[mlbStats] Failed to fetch hitting stats batch:', err)
    }
  }

  hittingStatsCache = { stats: result, timestamp: Date.now() }
  return result
}

// ── Name matching ───────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.''-]/g, '')
    .toLowerCase()
    .trim()
}

function findMlbId(
  playerName: string,
  teamAbbr: string | undefined,
  mlbPlayers: MlbPlayer[],
): number | null {
  const normalized = normalizeName(playerName)
  const mlbTeamId = teamAbbr ? TEAM_ABBR_TO_MLB_ID[teamAbbr.toUpperCase()] : undefined

  // Exact name match with team preference
  const matches = mlbPlayers.filter((p) => normalizeName(p.fullName) === normalized)
  if (matches.length === 1) return matches[0].id
  if (matches.length > 1 && mlbTeamId) {
    const teamMatch = matches.find((p) => p.teamId === mlbTeamId)
    if (teamMatch) return teamMatch.id
  }
  if (matches.length > 0) return matches[0].id

  return null
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * For players whose stats are missing H and AB, supplement from the MLB Stats API.
 * Mutates the stats objects in place by adding 'H' and 'AB' keys.
 */
export async function supplementHitsAndAtBats(
  players: { name: string; team?: string; stats: Record<string, number | string> }[],
  season?: number,
): Promise<void> {
  const year = season || new Date().getFullYear()

  // Only process batters missing both H and AB
  const needsData = players.filter(
    (p) => p.stats['H'] === undefined && p.stats['AB'] === undefined,
  )
  if (needsData.length === 0) return

  const mlbPlayers = await fetchMlbPlayerList(year)
  if (mlbPlayers.length === 0) return

  // Map each player to their MLB ID
  const playerMlbIds: { player: typeof needsData[0]; mlbId: number }[] = []
  for (const p of needsData) {
    const mlbId = findMlbId(p.name, p.team, mlbPlayers)
    if (mlbId) playerMlbIds.push({ player: p, mlbId })
  }
  if (playerMlbIds.length === 0) return

  // Fetch stats in bulk
  const allMlbIds = playerMlbIds.map((pm) => pm.mlbId)
  const statsMap = await fetchBulkHittingStats(allMlbIds, year)

  // Merge H and AB into each player's stats
  for (const { player, mlbId } of playerMlbIds) {
    const hitting = statsMap.get(mlbId)
    if (hitting) {
      player.stats['H'] = hitting.hits
      player.stats['AB'] = hitting.atBats
    }
  }
}
