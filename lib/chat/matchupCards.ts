import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { STAT_ID_MAP } from '@/lib/statFormatters'

export async function buildMatchupCards(
  api: YahooFantasyAPI,
  leagueKey: string,
  userTeamKey: string,
  week?: number,
): Promise<any[]> {
  const { scoreboard } = await api.getMatchups(leagueKey, week)
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
  } catch { /* non-critical */ }

  let statIdMap: Record<string, string> = { ...STAT_ID_MAP }
  try {
    const gameKey = leagueKey.split('.')[0]
    const { categories } = await api.getStatCategories(gameKey)
    for (const [id, cat] of Object.entries(categories)) {
      statIdMap[id] = cat.displayName || cat.name
    }
  } catch { /* use fallback */ }

  const mapStats = (raw?: Record<string, number | string>): Record<string, number | string> => {
    if (!raw) return {}
    const mapped: Record<string, number | string> = {}
    for (const [id, val] of Object.entries(raw)) {
      const name = statIdMap[id] || `stat_${id}`
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
