import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { withYahooAuth } from '@/lib/yahoo/auth'
import type { ParsedMatchup } from '@/lib/yahoo/xmlParser'

export const dynamic = 'force-dynamic'

/** Align with app/api/yahoo/matchup/route.ts */
const STAT_ID_FALLBACK: Record<string, string> = {
  '60': 'H/AB',
  '7': 'R',
  '8': 'H',
  '12': 'HR',
  '13': 'RBI',
  '16': 'SB',
  '18': 'BB',
  '21': 'K',
  '3': 'AVG',
  '4': 'OBP',
  '5': 'SLG',
  '55': 'OPS',
  '6': 'AB',
  '1': 'GP',
  '28': 'W',
  '29': 'L',
  '32': 'SV',
  '42': 'K',
  '26': 'ERA',
  '27': 'WHIP',
  '50': 'IP',
  '39': 'IP',
  '34': 'QS',
  '48': 'HLD',
  '37': 'BB',
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
  } catch {
    return {}
  }
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function compareCategory(
  v1: number | string | undefined,
  v2: number | string | undefined,
  lowerBetter: boolean,
): 'W' | 'L' | 'T' | '-' {
  if (v1 == null && v2 == null) return '-'
  const n1 = num(v1)
  const n2 = num(v2)
  if (n1 == null || n2 == null) return '-'
  if (n1 === n2) return 'T'
  if (lowerBetter) return n1 < n2 ? 'W' : 'L'
  return n1 > n2 ? 'W' : 'L'
}

function mapStatsById(
  raw: Record<string, number | string> | undefined,
  scoringStatIds: Set<string>,
): Record<string, number | string> {
  if (!raw) return {}
  const out: Record<string, number | string> = {}
  for (const [id, val] of Object.entries(raw)) {
    if (scoringStatIds.size > 0 && !scoringStatIds.has(id)) continue
    out[id] = val
  }
  return out
}

function mapStatsToDisplay(
  raw: Record<string, number | string> | undefined,
  scoringStatIds: Set<string>,
  resolveDisplayName: (id: string) => string,
): Record<string, number | string> {
  const byId = mapStatsById(raw, scoringStatIds)
  const mapped: Record<string, number | string> = {}
  for (const [id, val] of Object.entries(byId)) {
    mapped[resolveDisplayName(id)] = val
  }
  return mapped
}

function computeSeasonTotals(
  weekly: Array<{ statsById: Record<string, number | string> }>,
  categories: Array<{ statId: string; displayName: string }>,
): Record<string, number | string> {
  const sumId = (id: string) => {
    let s = 0
    for (const w of weekly) {
      const v = num(w.statsById[id])
      if (v != null) s += v
    }
    return s
  }

  const out: Record<string, number | string> = {}

  for (const c of categories) {
    const id = c.statId
    const dname = c.displayName

    if (id === '3') {
      const ab = sumId('6')
      const h = sumId('8')
      out[dname] = ab > 0 ? h / ab : '-'
      continue
    }

    if (id === '26') {
      let erSum = 0
      let ipSum = 0
      for (const w of weekly) {
        const era = num(w.statsById['26'])
        const ip = num(w.statsById['39'] ?? w.statsById['50'])
        if (era != null && ip != null && ip > 0) {
          erSum += (era * ip) / 9
          ipSum += ip
        }
      }
      out[dname] = ipSum > 0 ? (9 * erSum) / ipSum : '-'
      continue
    }

    if (id === '27') {
      let numSum = 0
      let ipSum = 0
      for (const w of weekly) {
        const whip = num(w.statsById['27'])
        const ip = num(w.statsById['39'] ?? w.statsById['50'])
        if (whip != null && ip != null && ip > 0) {
          numSum += whip * ip
          ipSum += ip
        }
      }
      out[dname] = ipSum > 0 ? numSum / ipSum : '-'
      continue
    }

    if (id === '4' || id === '5' || id === '55') {
      let sum = 0
      let n = 0
      for (const w of weekly) {
        const v = num(w.statsById[id])
        if (v != null) {
          sum += v
          n++
        }
      }
      out[dname] = n > 0 ? sum / n : '-'
      continue
    }

    const total = sumId(id)
    out[dname] = total
  }

  return out
}

export interface TeamStatsCategory {
  statId: string
  displayName: string
  positionType: string
  sortOrder: string
}

export interface TeamStatsWeek {
  week: number
  weekStart?: string
  weekEnd?: string
  opponentTeamKey: string
  opponentName: string
  stats: Record<string, number | string>
  statsById: Record<string, number | string>
  results: Record<string, 'W' | 'L' | 'T' | '-'>
}

export interface TeamStatsResponse {
  teamKey: string
  teamName: string
  leagueKey: string
  startWeek: number
  endWeek: number
  currentWeek: number
  categories: TeamStatsCategory[]
  weekly: TeamStatsWeek[]
  seasonWL: Record<string, { w: number; l: number; t: number }>
  seasonTotals: Record<string, number | string>
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withYahooAuth()
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueKey = searchParams.get('leagueKey')
    const teamKeyParam = searchParams.get('teamKey')

    if (!leagueKey) {
      return NextResponse.json({ error: 'leagueKey parameter is required' }, { status: 400 })
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)

    const [teamsResult, leaguesResult, leagueSettingsResult, dynamicCats] = await Promise.all([
      api.getLeagueTeams(leagueKey),
      api.getLeagues('mlb').catch(() => ({ leagues: [] as { league_key: string; current_week?: string; start_week?: string; end_week?: string }[] })),
      api.getLeagueSettings(leagueKey),
      getCachedStatCategories(api, leagueKey.split('.')[0]),
    ])

    const { teams: allTeams } = teamsResult
    const userTeam = allTeams.find((t) => t.managers?.some((m) => m.is_current_login === '1'))
    const resolvedTeamKey = teamKeyParam || userTeam?.team_key
    if (!resolvedTeamKey) {
      return NextResponse.json({ error: 'Could not resolve team. Pass teamKey or ensure you manage a team in this league.' }, { status: 400 })
    }

    const teamRow = allTeams.find((t) => t.team_key === resolvedTeamKey)
    const teamName = teamRow?.name || 'Your team'

    const leagueMeta = leaguesResult.leagues.find((l) => l.league_key === leagueKey)
    const startWeek = leagueMeta?.start_week ? parseInt(leagueMeta.start_week, 10) : 1
    const endWeek = leagueMeta?.end_week ? parseInt(leagueMeta.end_week, 10) : 24
    const currentWeek = leagueMeta?.current_week ? parseInt(leagueMeta.current_week, 10) : endWeek

    const scoringStatIds = new Set<string>()
    const displayNameCounts = new Map<string, number>()
    if (leagueSettingsResult?.settings?.statCategories) {
      for (const c of leagueSettingsResult.settings.statCategories) {
        if (!c.isOnlyDisplayStat) {
          scoringStatIds.add(c.statId)
          displayNameCounts.set(c.displayName, (displayNameCounts.get(c.displayName) || 0) + 1)
        }
      }
    }

    const duplicateNames = new Set(
      [...displayNameCounts.entries()].filter(([, n]) => n > 1).map(([name]) => name),
    )

    const resolveDisplayName = (id: string): string => {
      const cat = dynamicCats[id]
      let name = cat?.displayName || STAT_ID_FALLBACK[id] || `stat_${id}`
      if (duplicateNames.has(name)) {
        const leagueStat = leagueSettingsResult?.settings?.statCategories?.find((c) => c.statId === id)
        const posType = leagueStat?.positionType || cat?.positionType
        if (posType === 'B') name = `${name}(B)`
        else if (posType === 'P') name = `${name}(P)`
      }
      return name
    }

    const categories: TeamStatsCategory[] = []
    if (leagueSettingsResult?.settings?.statCategories) {
      for (const c of leagueSettingsResult.settings.statCategories) {
        if (c.isOnlyDisplayStat) continue
        categories.push({
          statId: c.statId,
          displayName: resolveDisplayName(c.statId),
          positionType: c.positionType,
          sortOrder: c.sortOrder,
        })
      }
    }

    const weekNumbers: number[] = []
    for (let w = startWeek; w <= currentWeek; w++) weekNumbers.push(w)

    const scoreboards = await Promise.all(weekNumbers.map((w) => api.getMatchups(leagueKey, w)))

    const weekly: TeamStatsWeek[] = []
    const seasonWL: Record<string, { w: number; l: number; t: number }> = {}

    for (const c of categories) {
      seasonWL[c.displayName] = { w: 0, l: 0, t: 0 }
    }

    for (let i = 0; i < weekNumbers.length; i++) {
      const weekNum = weekNumbers[i]
      const { scoreboard } = scoreboards[i]

      const matchup: ParsedMatchup | undefined = scoreboard.matchups.find((m) =>
        m.teams.some((t) => t.team_key === resolvedTeamKey),
      )

      if (!matchup || matchup.teams.length < 2) {
        weekly.push({
          week: weekNum,
          opponentTeamKey: '',
          opponentName: '—',
          stats: {},
          statsById: {},
          results: {},
        })
        continue
      }

      const us = matchup.teams.find((t) => t.team_key === resolvedTeamKey)
      const them = matchup.teams.find((t) => t.team_key !== resolvedTeamKey)
      if (!us || !them) {
        weekly.push({
          week: weekNum,
          weekStart: matchup.week_start,
          weekEnd: matchup.week_end,
          opponentTeamKey: '',
          opponentName: '—',
          stats: {},
          statsById: {},
          results: {},
        })
        continue
      }

      const statsByIdUs = mapStatsById(us.stats, scoringStatIds)
      const statsByIdThem = mapStatsById(them.stats, scoringStatIds)

      const stats = mapStatsToDisplay(us.stats, scoringStatIds, resolveDisplayName)
      const results: Record<string, 'W' | 'L' | 'T' | '-'> = {}

      for (const cat of categories) {
        const lowerBetter = cat.sortOrder === '0'
        const r = compareCategory(statsByIdUs[cat.statId], statsByIdThem[cat.statId], lowerBetter)
        results[cat.displayName] = r
        if (r === 'W') seasonWL[cat.displayName].w++
        else if (r === 'L') seasonWL[cat.displayName].l++
        else if (r === 'T') seasonWL[cat.displayName].t++
      }

      weekly.push({
        week: weekNum,
        weekStart: matchup.week_start,
        weekEnd: matchup.week_end,
        opponentTeamKey: them.team_key,
        opponentName: them.name,
        stats,
        statsById: statsByIdUs,
        results,
      })
    }

    const seasonTotals = computeSeasonTotals(weekly, categories)

    const response: TeamStatsResponse = {
      teamKey: resolvedTeamKey,
      teamName,
      leagueKey,
      startWeek,
      endWeek,
      currentWeek,
      categories,
      weekly,
      seasonWL,
      seasonTotals,
    }

    return auth.json(response, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error: unknown) {
    console.error('Error in team-stats API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch team stats' },
      { status: 500 },
    )
  }
}
