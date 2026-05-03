import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { STAT_ID_MAP } from '@/lib/statFormatters'
import { reportError } from '@/lib/errors'

export async function buildMatchupCards(
  api: YahooFantasyAPI,
  leagueKey: string,
  userTeamKey: string,
  week?: number,
): Promise<any[]> {
  const [{ scoreboard }, leagueSettingsResult] = await Promise.all([
    api.getMatchups(leagueKey, week),
    api.getLeagueSettings(leagueKey).catch(() => null),
  ])
  if (!scoreboard || !scoreboard.matchups.length) return []

  const userMatchup = scoreboard.matchups.find(m =>
    m.teams.some(t => t.team_key === userTeamKey)
  )

  let currentWeek = scoreboard.week
  let totalWeeks: number | undefined

  try {
    const { leagues } = await api.getLeagues('mlb')
    const league = leagues.find((l: any) => l.league_key === leagueKey)
    if (league) {
      if (league.current_week) currentWeek = parseInt(league.current_week, 10)
      if (league.end_week) totalWeeks = parseInt(league.end_week, 10)
    }
  } catch (error) { reportError(error, { source: 'matchupCards.leagueInfo' }, 'warning') }

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

  let statIdMap: Record<string, string> = { ...STAT_ID_MAP }
  try {
    const gameKey = leagueKey.split('.')[0]
    const { categories } = await api.getStatCategories(gameKey)
    for (const [id, cat] of Object.entries(categories)) {
      statIdMap[id] = cat.displayName || cat.name
    }
  } catch (error) { reportError(error, { source: 'matchupCards.statCategories' }, 'warning') }

  const mapStats = (raw?: Record<string, number | string>): Record<string, number | string> => {
    if (!raw) return {}
    const mapped: Record<string, number | string> = {}
    for (const [id, val] of Object.entries(raw)) {
      if (scoringStatIds.size > 0 && !scoringStatIds.has(id)) continue
      let name = statIdMap[id] || `stat_${id}`
      if (duplicateNames.has(name)) {
        const leagueStat = leagueSettingsResult?.settings?.statCategories?.find((c) => c.statId === id)
        const posType = leagueStat?.positionType
        if (posType === 'B') name = `${name}(B)`
        else if (posType === 'P') name = `${name}(P)`
      }
      mapped[name] = val
    }
    return mapped
  }

  const formatMatchup = (m: any) => {
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

  const cards: any[] = []

  if (userMatchup) {
    const userTeam = userMatchup.teams.find(t => t.team_key === userTeamKey)
    const oppTeam = userMatchup.teams.find(t => t.team_key !== userTeamKey)

    cards.push({
      type: 'matchup',
      title: `⚾ Week ${scoreboard.week}: ${userTeam?.name || 'Your Team'} vs ${oppTeam?.name || 'Opponent'}`,
      payload: {
        leagueKey,
        userTeamKey,
        currentWeek,
        displayedWeek: scoreboard.week,
        totalWeeks,
        userMatchup: formatMatchup(userMatchup),
        otherMatchups: scoreboard.matchups
          .filter(m => m !== userMatchup)
          .map(formatMatchup),
      },
    })
  }

  return cards
}
