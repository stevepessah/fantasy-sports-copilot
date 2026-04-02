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

// Cache keyed by "season|statsType|dateArgs" to separate different time ranges
const hittingStatsCaches = new Map<string, { stats: Map<number, MlbHittingStats>; timestamp: number }>()
const HITTING_STATS_TTL = 10 * 60 * 1000 // 10 minutes

// Yahoo team abbr → MLB team ID mapping
const TEAM_ABBR_TO_MLB_ID: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112,
  CWS: 145, CIN: 113, CLE: 114, COL: 115, DET: 116,
  HOU: 117, KC: 118, LAA: 108, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYM: 121, NYY: 147, OAK: 133,
  PHI: 143, PIT: 134, SD: 135, SF: 137, SEA: 136,
  STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
  AZ: 109, CHW: 145, WAS: 120,
}

// ── Date range helpers ──────────────────────────────────────────────────────

interface MlbStatsQuery {
  hydrateArgs: string // e.g. "type=[season],season=2026" — goes inside stats()
  cacheKey: string
}

function buildMlbStatsQuery(season: number, dateRange?: string): MlbStatsQuery {
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`

  if (!dateRange) {
    return {
      hydrateArgs: `type=[season],season=${season}`,
      cacheKey: `${season}|season`,
    }
  }

  // Yahoo date range: "date=YYYY-MM-DD" (single day)
  const dateMatch = dateRange.match(/^date=(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    const mlbDate = `${dateMatch[2]}/${dateMatch[3]}/${dateMatch[1]}`
    return {
      hydrateArgs: `type=[byDateRange],startDate=${mlbDate},endDate=${mlbDate}`,
      cacheKey: `${season}|date|${dateMatch[0]}`,
    }
  }

  // Yahoo: "lastweek" → last 7 days
  if (dateRange === 'lastweek') {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    return {
      hydrateArgs: `type=[byDateRange],startDate=${fmt(start)},endDate=${fmt(end)}`,
      cacheKey: `${season}|lastweek|${end.toISOString().slice(0, 10)}`,
    }
  }

  // Yahoo: "lastmonth" → last 30 days
  if (dateRange === 'lastmonth') {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 30)
    return {
      hydrateArgs: `type=[byDateRange],startDate=${fmt(start)},endDate=${fmt(end)}`,
      cacheKey: `${season}|lastmonth|${end.toISOString().slice(0, 10)}`,
    }
  }

  return {
    hydrateArgs: `type=[season],season=${season}`,
    cacheKey: `${season}|season`,
  }
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
  query: MlbStatsQuery,
): Promise<Map<number, MlbHittingStats>> {
  if (mlbIds.length === 0) return new Map()

  const cached = hittingStatsCaches.get(query.cacheKey)
  if (cached && Date.now() - cached.timestamp < HITTING_STATS_TTL) {
    const allCached = mlbIds.every((id) => cached.stats.has(id))
    if (allCached) return cached.stats
  }

  const result = new Map<number, MlbHittingStats>(cached?.stats)

  const BATCH = 50
  for (let i = 0; i < mlbIds.length; i += BATCH) {
    const batch = mlbIds.slice(i, i + BATCH)
    const uncached = batch.filter((id) => !result.has(id))
    if (uncached.length === 0) continue

    try {
      const ids = uncached.join(',')
      const url = `${MLB_API_BASE}/people?personIds=${ids}&hydrate=stats(group=[hitting],${query.hydrateArgs})&fields=people,id,stats,splits,stat,hits,atBats`
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
        } else {
          // No stats for this date range — player didn't play
          result.set(person.id, { hits: 0, atBats: 0 })
        }
      }
    } catch (err) {
      console.error('[mlbStats] Failed to fetch hitting stats batch:', err)
    }
  }

  hittingStatsCaches.set(query.cacheKey, { stats: result, timestamp: Date.now() })
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
 *
 * @param dateRange - Yahoo-style date range: "date=YYYY-MM-DD", "lastweek", "lastmonth", or undefined for full season
 */
export async function supplementHitsAndAtBats(
  players: { name: string; team?: string; stats: Record<string, number | string> }[],
  season?: number,
  dateRange?: string,
): Promise<void> {
  const year = season || new Date().getFullYear()

  const needsData = players.filter(
    (p) => p.stats['H'] === undefined && p.stats['AB'] === undefined,
  )
  if (needsData.length === 0) return

  const mlbPlayers = await fetchMlbPlayerList(year)
  if (mlbPlayers.length === 0) return

  const playerMlbIds: { player: typeof needsData[0]; mlbId: number }[] = []
  for (const p of needsData) {
    const mlbId = findMlbId(p.name, p.team, mlbPlayers)
    if (mlbId) playerMlbIds.push({ player: p, mlbId })
  }
  if (playerMlbIds.length === 0) return

  const query = buildMlbStatsQuery(year, dateRange)
  const allMlbIds = playerMlbIds.map((pm) => pm.mlbId)
  const statsMap = await fetchBulkHittingStats(allMlbIds, query)

  for (const { player, mlbId } of playerMlbIds) {
    const hitting = statsMap.get(mlbId)
    if (hitting) {
      player.stats['H'] = hitting.hits
      player.stats['AB'] = hitting.atBats
    }
  }
}
