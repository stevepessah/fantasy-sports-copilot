export interface MatchupRecapCategoryRow {
  stat: string
  userVal: number | string | null
  oppVal: number | string | null
  winner: 'user' | 'opp' | 'tie'
}

export interface MatchupRecapRequest {
  userTeamName: string
  opponentName: string
  week: number
  status: string
  categoryResults?: {
    userWins: number
    oppWins: number
    ties: number
    rows: MatchupRecapCategoryRow[]
  }
  userPoints?: number
  opponentPoints?: number
  userWinProbability?: number
  opponentWinProbability?: number
}

export function buildMatchupPrompt(req: MatchupRecapRequest): string {
  let ctx = `Week ${req.week} matchup: ${req.userTeamName} vs ${req.opponentName}\n`
  ctx += `Status: ${req.status === 'midevent' ? 'In progress' : req.status === 'postevent' ? 'Final' : 'Upcoming'}\n\n`

  if (req.categoryResults) {
    const { userWins, oppWins, ties, rows } = req.categoryResults
    ctx += `Category tally: ${req.userTeamName} ${userWins}, ${req.opponentName} ${oppWins}`
    if (ties > 0) ctx += `, Tied ${ties}`
    ctx += '\n\n'

    ctx += 'CATEGORY BREAKDOWN:\n'
    for (const row of rows) {
      const userStr = row.userVal != null ? String(row.userVal) : '-'
      const oppStr = row.oppVal != null ? String(row.oppVal) : '-'
      const marker = row.winner === 'user' ? ' ← winning' : row.winner === 'opp' ? ' ← losing' : ' (tied)'
      ctx += `- ${row.stat}: ${req.userTeamName} ${userStr} vs ${req.opponentName} ${oppStr}${marker}\n`
    }
  } else if (req.userPoints != null && req.opponentPoints != null) {
    ctx += `Points: ${req.userTeamName} ${req.userPoints.toFixed(1)} vs ${req.opponentName} ${req.opponentPoints.toFixed(1)}\n`
  }

  if (req.userWinProbability != null) {
    ctx += `\nWin probability: ${req.userTeamName} ${req.userWinProbability}%`
    if (req.opponentWinProbability != null) ctx += `, ${req.opponentName} ${req.opponentWinProbability}%`
    ctx += '\n'
  }

  return ctx
}

export function hasMatchupData(req: MatchupRecapRequest): boolean {
  if (req.categoryResults && req.categoryResults.rows.length > 0) return true
  if (req.userPoints != null && req.opponentPoints != null) return true
  return false
}
