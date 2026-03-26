import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { withYahooAuth } from '@/lib/yahoo/auth'

export const dynamic = 'force-dynamic'

export interface MatchupTeamPayload {
  teamKey: string
  name: string
  logoUrl?: string
  points?: number
  winProbability?: number
  stats: Record<string, number | string>
  isUser: boolean
}

export interface MatchupPayload {
  week: number
  weekStart?: string
  weekEnd?: string
  status?: string
  isTied?: boolean
  winnerTeamKey?: string
  teams: MatchupTeamPayload[]
}

export interface MatchupResponse {
  currentWeek: number
  displayedWeek: number
  totalWeeks?: number
  userMatchup: MatchupPayload | null
  otherMatchups: MatchupPayload[]
  leagueCategories: { displayName: string; positionType: string; sortOrder: string }[] | null
}

const STAT_ID_FALLBACK: Record<string, string> = {
  '60': 'H/AB', '7': 'R', '8': 'H', '12': 'HR', '13': 'RBI',
  '16': 'SB', '18': 'BB', '21': 'K', '3': 'AVG', '4': 'OBP',
  '5': 'SLG', '55': 'OPS', '6': 'AB', '1': 'GP',
  '28': 'W', '29': 'L', '32': 'SV', '42': 'K', '26': 'ERA',
  '27': 'WHIP', '50': 'IP', '34': 'QS', '48': 'HLD',
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

export async function GET(request: NextRequest) {
  try {
    const auth = await withYahooAuth()
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueKey = searchParams.get('leagueKey')
    const weekParam = searchParams.get('week')
    const week = weekParam ? parseInt(weekParam, 10) : undefined

    if (!leagueKey) {
      return NextResponse.json({ error: 'leagueKey parameter is required' }, { status: 400 })
    }

    const api = new YahooFantasyAPI()
    api.setAccessToken(auth.accessToken)

    const [scoreboardResult, teamsResult, leaguesResult, leagueSettingsResult] = await Promise.all([
      api.getMatchups(leagueKey, week),
      api.getLeagueTeams(leagueKey),
      api.getLeagues('mlb').catch(() => ({ leagues: [] })),
      api.getLeagueSettings(leagueKey).catch(() => null),
    ])

    const { scoreboard } = scoreboardResult
    const { teams: allTeams } = teamsResult

    const userTeam = allTeams.find((t) =>
      t.managers?.some((m) => m.is_current_login === '1'),
    )
    const userTeamKey = userTeam?.team_key ?? ''

    let currentWeek = scoreboard.week
    let totalWeeks: number | undefined
    const league = leaguesResult.leagues.find((l: any) => l.league_key === leagueKey)
    if (league) {
      if (league.current_week) currentWeek = parseInt(league.current_week, 10)
      if (league.end_week) totalWeeks = parseInt(league.end_week, 10)
    }

    const gameKey = leagueKey.split('.')[0]
    const dynamicCats = await getCachedStatCategories(api, gameKey)

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

    const mapStats = (raw?: Record<string, number | string>): Record<string, number | string> => {
      if (!raw) return {}
      const mapped: Record<string, number | string> = {}
      for (const [id, val] of Object.entries(raw)) {
        if (scoringStatIds.size > 0 && !scoringStatIds.has(id)) continue
        mapped[resolveDisplayName(id)] = val
      }
      return mapped
    }

    const formatMatchup = (m: any): MatchupPayload => {
      const t1 = m.teams[0]
      const t2 = m.teams[1]
      return {
        week: m.week,
        weekStart: m.week_start,
        weekEnd: m.week_end,
        status: m.status,
        isTied: m.is_tied,
        winnerTeamKey: m.winner_team_key,
        teams: [
          {
            teamKey: t1.team_key,
            name: t1.name,
            logoUrl: t1.logo_url,
            points: t1.points,
            winProbability: t1.win_probability != null ? Math.round(t1.win_probability * 100) : undefined,
            stats: mapStats(t1.stats),
            isUser: t1.team_key === userTeamKey,
          },
          {
            teamKey: t2.team_key,
            name: t2.name,
            logoUrl: t2.logo_url,
            points: t2.points,
            winProbability: t2.win_probability != null ? Math.round(t2.win_probability * 100) : undefined,
            stats: mapStats(t2.stats),
            isUser: t2.team_key === userTeamKey,
          },
        ],
      }
    }

    const userMatchupRaw = scoreboard.matchups.find((m) =>
      m.teams.some((t) => t.team_key === userTeamKey),
    )

    let leagueCategories: MatchupResponse['leagueCategories'] = null
    if (leagueSettingsResult?.settings?.statCategories) {
      leagueCategories = leagueSettingsResult.settings.statCategories
        .filter((c) => !c.isOnlyDisplayStat)
        .map((c) => ({
          displayName: resolveDisplayName(c.statId),
          positionType: c.positionType,
          sortOrder: c.sortOrder,
        }))
    }

    const response: MatchupResponse = {
      currentWeek,
      displayedWeek: scoreboard.week || currentWeek,
      totalWeeks,
      userMatchup: userMatchupRaw ? formatMatchup(userMatchupRaw) : null,
      otherMatchups: scoreboard.matchups
        .filter((m) => m !== userMatchupRaw)
        .map(formatMatchup),
      leagueCategories,
    }

    return auth.json(response, {
      headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=120' },
    })
  } catch (error: any) {
    console.error('Error in matchup API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch matchup data' },
      { status: 500 },
    )
  }
}
