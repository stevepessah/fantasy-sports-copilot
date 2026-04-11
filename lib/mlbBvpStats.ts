/**
 * Fetches career Batter vs Pitcher (BvP) stats from the MLB Stats API.
 *
 * Uses the vsPlayer stat type:
 *   GET /api/v1/people/{batterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId={pitcherId}
 *
 * The MLB Stats API is free and unauthenticated.
 */

import { MLB_API_BASE, TEAM_ABBR_TO_MLB_ID, normalizeName } from './mlbShared'

export interface BvpStats {
  ab: number
  h: number
  hr: number
  bb: number
  k: number
  avg: string
  ops: string
  rbi: number
}

interface MlbPlayerRef {
  id: number
  fullName: string
  teamId?: number
}

let playerListCache: { players: MlbPlayerRef[]; timestamp: number } | null = null
const PLAYER_LIST_TTL = 24 * 60 * 60 * 1000

const bvpCache = new Map<string, { stats: BvpStats | null; timestamp: number }>()
const BVP_CACHE_TTL = 30 * 60 * 1000

async function fetchMlbPlayerList(season: number): Promise<MlbPlayerRef[]> {
  if (playerListCache && Date.now() - playerListCache.timestamp < PLAYER_LIST_TTL) {
    return playerListCache.players
  }

  try {
    const url = `${MLB_API_BASE}/sports/1/players?season=${season}&gameType=R&fields=people,id,fullName,currentTeam,id`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return playerListCache?.players ?? []

    const data = await res.json()
    const players: MlbPlayerRef[] = (data.people || []).map((p: any) => ({
      id: p.id,
      fullName: p.fullName,
      teamId: p.currentTeam?.id,
    }))

    playerListCache = { players, timestamp: Date.now() }
    return players
  } catch (err) {
    console.error('[mlbBvpStats] Failed to fetch MLB player list:', err)
    return playerListCache?.players ?? []
  }
}

function findMlbId(
  playerName: string,
  teamAbbr: string | undefined,
  mlbPlayers: MlbPlayerRef[],
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

async function fetchBvpForPair(
  batterId: number,
  pitcherId: number,
): Promise<BvpStats | null> {
  const key = `${batterId}|${pitcherId}`
  const cached = bvpCache.get(key)
  if (cached && Date.now() - cached.timestamp < BVP_CACHE_TTL) {
    return cached.stats
  }

  try {
    const url =
      `${MLB_API_BASE}/people/${batterId}/stats` +
      `?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}` +
      `&fields=stats,type,displayName,splits,stat,atBats,hits,homeRuns,baseOnBalls,strikeOuts,avg,ops,rbi`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) {
      bvpCache.set(key, { stats: null, timestamp: Date.now() })
      return null
    }

    const data = await res.json()
    const allStats = data.stats ?? []
    const totalGroup = allStats.find((s: any) => s.type?.displayName === 'vsPlayerTotal')
    const split = (totalGroup ?? allStats[allStats.length - 1])?.splits?.[0]?.stat
    if (!split || split.atBats === undefined) {
      bvpCache.set(key, { stats: null, timestamp: Date.now() })
      return null
    }

    const stats: BvpStats = {
      ab: split.atBats ?? 0,
      h: split.hits ?? 0,
      hr: split.homeRuns ?? 0,
      bb: split.baseOnBalls ?? 0,
      k: split.strikeOuts ?? 0,
      avg: split.avg ?? '.000',
      ops: split.ops ?? '.000',
      rbi: split.rbi ?? 0,
    }

    bvpCache.set(key, { stats, timestamp: Date.now() })
    return stats
  } catch (err) {
    console.error(`[mlbBvpStats] Failed to fetch BvP for ${batterId} vs ${pitcherId}:`, err)
    bvpCache.set(key, { stats: null, timestamp: Date.now() })
    return null
  }
}

export interface BatterBvpRequest {
  playerKey: string
  batterName: string
  batterTeam?: string
  opposingPitcherFullName?: string
}

/**
 * Fetch career BvP stats for a batch of batters against their respective
 * opposing probable starters (from today's schedule).
 * Returns a map keyed by playerKey → BvpStats (or null if no data).
 */
export async function getBatterVsPitcherStats(
  batters: BatterBvpRequest[],
): Promise<Map<string, BvpStats>> {
  const result = new Map<string, BvpStats>()

  const withPitcher = batters.filter((b) => b.opposingPitcherFullName)
  if (withPitcher.length === 0) return result

  const season = new Date().getFullYear()
  const mlbPlayers = await fetchMlbPlayerList(season)
  if (mlbPlayers.length === 0) return result

  const tasks: { playerKey: string; batterId: number; pitcherId: number }[] = []

  for (const b of withPitcher) {
    const batterId = findMlbId(b.batterName, b.batterTeam, mlbPlayers)
    const pitcherId = findMlbId(b.opposingPitcherFullName!, undefined, mlbPlayers)
    if (batterId && pitcherId) {
      tasks.push({ playerKey: b.playerKey, batterId, pitcherId })
    }
  }

  if (tasks.length === 0) return result

  const CONCURRENCY = 6
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (t) => {
        const stats = await fetchBvpForPair(t.batterId, t.pitcherId)
        return { playerKey: t.playerKey, stats }
      }),
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.stats) {
        result.set(r.value.playerKey, r.value.stats)
      }
    }
  }

  return result
}
