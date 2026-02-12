// Builds structured roster + stats context for the LLM
// This module fetches the user's Yahoo roster and stats, then formats them
// into a concise text block that gets injected into the system prompt.

import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { ParsedRosterPlayer } from '@/lib/yahoo/xmlParser'

// ─── Stat ID → Display Name Mapping ─────────────────────────────────────────
// These are the standard Yahoo stat IDs for MLB. We maintain a fallback map
// in case the dynamic stat_categories fetch fails.
const BATTER_STAT_IDS: Record<string, string> = {
  '60': 'H/AB',
  '7': 'R',
  '8': 'H',
  '9': '2B',
  '10': '3B',
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
}

const PITCHER_STAT_IDS: Record<string, string> = {
  '28': 'W',
  '29': 'L',
  '32': 'SV',
  '42': 'HLD',
  '26': 'ERA',
  '27': 'WHIP',
  '39': 'IP',
  '34': 'K',
  '37': 'BB',
  '48': 'QS',
  '25': 'GP',
}

// Key stats to include in the LLM context (keeps token count manageable)
const BATTER_DISPLAY_STATS = ['GP', 'AVG', 'OBP', 'OPS', 'HR', 'R', 'RBI', 'SB', 'H', 'AB', 'BB', 'K']
const PITCHER_DISPLAY_STATS = ['GP', 'IP', 'ERA', 'WHIP', 'W', 'L', 'SV', 'HLD', 'K', 'BB', 'QS']

interface RosterContextResult {
  contextString: string
  playerCount: number
  batterCount: number
  pitcherCount: number
}

/**
 * Build a structured text context of the user's roster + stats for LLM injection.
 * Fetches roster from Yahoo, then fetches current-season stats for each player.
 * Returns a formatted string ready to be inserted into the system prompt.
 */
export async function buildRosterContext(
  api: YahooFantasyAPI,
  teamKey: string,
  leagueKey: string,
  statCategories?: Record<string, { name: string; displayName: string; positionType: string }>
): Promise<RosterContextResult> {
  try {
    // Fetch roster
    const { players } = await api.getTeamRoster(teamKey)

    if (!players || players.length === 0) {
      return {
        contextString: 'No players on roster.\n',
        playerCount: 0,
        batterCount: 0,
        pitcherCount: 0,
      }
    }

    // Separate batters and pitchers
    const batters: ParsedRosterPlayer[] = []
    const pitchers: ParsedRosterPlayer[] = []

    for (const player of players) {
      if (player.position_type === 'P') {
        pitchers.push(player)
      } else {
        batters.push(player)
      }
    }

    // Fetch stats for all players in parallel (current season)
    const statsPromises = players.map(async (player) => {
      try {
        const { stats } = await api.getPlayerStats(player.player_key, leagueKey)
        return { playerKey: player.player_key, stats }
      } catch (err) {
        console.error(`Failed to fetch stats for ${player.name.full}:`, err)
        return { playerKey: player.player_key, stats: null }
      }
    })

    const allStats = await Promise.all(statsPromises)
    const statsMap = new Map(allStats.map(s => [s.playerKey, s.stats]))

    // Build context string
    let context = ''

    // Batters section
    if (batters.length > 0) {
      context += '### BATTERS\n'
      context += formatHeaderRow(BATTER_DISPLAY_STATS)
      
      for (const player of batters) {
        const playerStats = statsMap.get(player.player_key)
        context += formatPlayerRow(player, playerStats, 'B', statCategories)
      }
      context += '\n'
    }

    // Pitchers section
    if (pitchers.length > 0) {
      context += '### PITCHERS\n'
      context += formatHeaderRow(PITCHER_DISPLAY_STATS)
      
      for (const player of pitchers) {
        const playerStats = statsMap.get(player.player_key)
        context += formatPlayerRow(player, playerStats, 'P', statCategories)
      }
      context += '\n'
    }

    return {
      contextString: context,
      playerCount: players.length,
      batterCount: batters.length,
      pitcherCount: pitchers.length,
    }
  } catch (error) {
    console.error('Error building roster context:', error)
    return {
      contextString: 'Error loading roster data.\n',
      playerCount: 0,
      batterCount: 0,
      pitcherCount: 0,
    }
  }
}

/**
 * Format the header row for a stats table
 */
function formatHeaderRow(statNames: string[]): string {
  const padded = statNames.map(s => s.padStart(5))
  return `${'Player'.padEnd(22)} Pos  Team  Slot   ${padded.join(' ')}\n`
       + `${'─'.repeat(22)} ${'───'.padEnd(4)} ${'───'.padEnd(5)} ${'───'.padEnd(5)}  ${statNames.map(() => '─────').join(' ')}\n`
}

/**
 * Format a single player row with their stats
 */
function formatPlayerRow(
  player: ParsedRosterPlayer,
  rawStats: any,
  posType: 'B' | 'P',
  statCategories?: Record<string, { name: string; displayName: string; positionType: string }>
): string {
  const name = player.name.full.substring(0, 21).padEnd(22)
  const pos = (player.display_position || player.eligible_positions?.[0] || '?').padEnd(4)
  const team = (player.editorial_team_abbr || '???').padEnd(5)
  const slot = (player.selected_position?.position || '?').padEnd(5)
  const injury = player.injury_status ? ` [${player.injury_status}]` : ''

  const displayStats = posType === 'P' ? PITCHER_DISPLAY_STATS : BATTER_DISPLAY_STATS
  const statIdMap = posType === 'P' ? PITCHER_STAT_IDS : BATTER_STAT_IDS

  // Resolve stats from the raw stats object
  const seasonStats = rawStats?.season_stats || {}
  
  const statValues = displayStats.map(statName => {
    // First try to find the stat by display name directly
    const byName = seasonStats[statName]
    if (byName !== undefined && byName !== null) {
      return formatStatValue(byName, statName)
    }

    // Try via stat categories mapping (dynamic from Yahoo)
    if (statCategories) {
      for (const [statId, cat] of Object.entries(statCategories)) {
        if (cat.displayName === statName && seasonStats[statId] !== undefined) {
          return formatStatValue(seasonStats[statId], statName)
        }
      }
    }

    // Try via our fallback stat ID map
    for (const [statId, displayName] of Object.entries(statIdMap)) {
      if (displayName === statName && seasonStats[statId] !== undefined) {
        return formatStatValue(seasonStats[statId], statName)
      }
    }

    return '  -  '
  })

  return `${name} ${pos} ${team} ${slot}  ${statValues.join(' ')}${injury}\n`
}

/**
 * Format a stat value for display in the context string
 */
function formatStatValue(value: number | string, statName: string): string {
  if (value === undefined || value === null || value === '') return '  -  '
  
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return String(value).padStart(5)

  const upper = statName.toUpperCase()
  
  // Rate stats: 3 decimal places
  if (['AVG', 'OBP', 'SLG', 'OPS', 'BAA'].includes(upper)) {
    if (num >= 0 && num < 1) {
      return num.toFixed(3).replace(/^0/, '').padStart(5)
    }
    return num.toFixed(3).padStart(5)
  }

  // ERA, WHIP: 2 decimal places
  if (['ERA', 'WHIP'].includes(upper)) {
    return num.toFixed(2).padStart(5)
  }

  // IP: 1 decimal place
  if (upper === 'IP') {
    return num.toFixed(1).padStart(5)
  }

  // Counting stats: whole numbers
  return Math.round(num).toString().padStart(5)
}

/**
 * Build a lightweight roster summary (fewer tokens) for when full stats aren't needed.
 * Just lists players with positions — useful for general conversation context.
 */
export async function buildRosterSummary(
  api: YahooFantasyAPI,
  teamKey: string,
): Promise<string> {
  try {
    const { players } = await api.getTeamRoster(teamKey)
    if (!players || players.length === 0) return 'Empty roster.\n'

    const batters = players.filter(p => p.position_type !== 'P')
    const pitchers = players.filter(p => p.position_type === 'P')

    let summary = ''
    
    if (batters.length > 0) {
      summary += 'Batters: '
      summary += batters.map(p => 
        `${p.name.full} (${p.display_position || p.eligible_positions?.[0] || '?'}, ${p.editorial_team_abbr || '?'})`
      ).join(', ')
      summary += '\n'
    }

    if (pitchers.length > 0) {
      summary += 'Pitchers: '
      summary += pitchers.map(p => 
        `${p.name.full} (${p.display_position || p.eligible_positions?.[0] || '?'}, ${p.editorial_team_abbr || '?'})`
      ).join(', ')
      summary += '\n'
    }

    return summary
  } catch (error) {
    console.error('Error building roster summary:', error)
    return 'Could not load roster.\n'
  }
}
