/**
 * Fetches probable starting pitcher data from the MLB Stats API schedule endpoint.
 * Returns a lookup of pitcher name+team → next scheduled start (date, opponent, home/away).
 *
 * The MLB schedule endpoint is free, unauthenticated, and reliably returns
 * probable pitchers once they're announced (~1-2 days before game time).
 */

import {
  MLB_API_BASE,
  TEAM_ABBR_TO_MLB_ID,
  MLB_ID_TO_TEAM_ABBR,
  normalizeName,
} from './mlbShared'

export interface ProbableStart {
  date: string        // "2026-04-03"
  gameDate: string    // ISO timestamp "2026-04-03T01:40:00Z"
  opponent: string    // team abbreviation, e.g. "BOS"
  homeAway: 'home' | 'away'
}

interface ScheduleCache {
  starts: Map<string, ProbableStart> // key: "normalizedname|mlbTeamId"
  timestamp: number
}

let scheduleCache: ScheduleCache | null = null
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

function dateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

async function fetchDaySchedule(date: string): Promise<any[]> {
  try {
    const url = `${MLB_API_BASE}/schedule?sportId=1&date=${date}&hydrate=probablePitcher`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    return data.dates?.[0]?.games ?? []
  } catch (err) {
    console.error(`[probableStarters] Failed to fetch schedule for ${date}:`, err)
    return []
  }
}

function cacheKey(pitcherName: string, mlbTeamId: number): string {
  return `${normalizeName(pitcherName)}|${mlbTeamId}`
}

async function buildStartsMap(): Promise<Map<string, ProbableStart>> {
  const starts = new Map<string, ProbableStart>()

  const dates = Array.from({ length: 7 }, (_, i) => dateStr(i))
  const dayResults = await Promise.all(dates.map(fetchDaySchedule))

  for (let dayIdx = 0; dayIdx < dayResults.length; dayIdx++) {
    const games = dayResults[dayIdx]
    for (const game of games) {
      if (game.status?.detailedState === 'Postponed') continue

      for (const side of ['away', 'home'] as const) {
        const pitcher = game.teams?.[side]?.probablePitcher
        const teamId = game.teams?.[side]?.team?.id
        if (!pitcher?.fullName || !teamId) continue

        const key = cacheKey(pitcher.fullName, teamId)
        if (starts.has(key)) continue // keep earliest start only

        const otherSide = side === 'home' ? 'away' : 'home'
        const opponentId = game.teams?.[otherSide]?.team?.id
        const opponentAbbr = opponentId
          ? MLB_ID_TO_TEAM_ABBR.get(opponentId) ?? '???'
          : '???'

        starts.set(key, {
          date: game.officialDate ?? dates[dayIdx],
          gameDate: game.gameDate ?? '',
          opponent: opponentAbbr,
          homeAway: side,
        })
      }
    }
  }

  return starts
}

async function getStartsMap(): Promise<Map<string, ProbableStart>> {
  if (scheduleCache && Date.now() - scheduleCache.timestamp < CACHE_TTL) {
    return scheduleCache.starts
  }

  const starts = await buildStartsMap()
  scheduleCache = { starts, timestamp: Date.now() }
  return starts
}

/**
 * Look up the next probable start for each pitcher.
 * Returns a map keyed by a caller-chosen identifier (playerKey or name)
 * so the caller can merge results into their own data structures.
 */
export async function getProbableStarts(
  pitchers: { id: string; name: string; team?: string }[],
): Promise<Map<string, ProbableStart>> {
  if (pitchers.length === 0) return new Map()

  const starts = await getStartsMap()
  const result = new Map<string, ProbableStart>()

  for (const p of pitchers) {
    const mlbTeamId = p.team ? TEAM_ABBR_TO_MLB_ID[p.team.toUpperCase()] : undefined
    if (!mlbTeamId) continue

    const key = cacheKey(p.name, mlbTeamId)
    const start = starts.get(key)
    if (start) {
      result.set(p.id, start)
    }
  }

  return result
}
