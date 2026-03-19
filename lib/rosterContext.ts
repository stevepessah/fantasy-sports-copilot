// Builds structured roster + stats context for the LLM
// This module fetches the user's Yahoo roster and stats, then formats them
// into a concise text block that gets injected into the system prompt.

import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { ParsedRosterPlayer, ParsedLeagueSettings } from '@/lib/yahoo/xmlParser'
import {
  BATTER_STAT_IDS,
  PITCHER_STAT_IDS,
  BATTER_DISPLAY_STATS,
  PITCHER_DISPLAY_STATS,
  formatStatValue as baseFormatStatValue,
} from '@/lib/statFormatters'

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

function formatStatValue(value: number | string, statName: string): string {
  if (value === undefined || value === null || value === '') return '  -  '
  const formatted = baseFormatStatValue(value, statName)
  return formatted === '-' ? '  -  ' : formatted.padStart(5)
}

/**
 * Build a structured league settings context string for LLM injection.
 * Includes stat categories (what stats count), roster positions, and league config.
 */
export function buildLeagueSettingsContext(
  settings: ParsedLeagueSettings,
  leagueName?: string,
  numTeams?: number,
): string {
  let context = ''

  if (leagueName) {
    context += `League: ${leagueName}\n`
  }
  if (numTeams) {
    context += `Teams: ${numTeams}\n`
  }
  if (settings.scoringType) {
    context += `Scoring Type: ${settings.scoringType}\n`
  }
  if (settings.draftType) {
    context += `Draft Type: ${settings.draftType}\n`
  }

  // Stat categories — this is what the user's league actually scores
  const scoringCats = settings.statCategories.filter(c => !c.isOnlyDisplayStat)
  const displayOnlyCats = settings.statCategories.filter(c => c.isOnlyDisplayStat)

  if (scoringCats.length > 0) {
    const batterCats = scoringCats.filter(c => c.positionType === 'B')
    const pitcherCats = scoringCats.filter(c => c.positionType === 'P')

    context += `\n### Scoring Categories (THESE STATS COUNT for standings/scoring)\n`

    if (batterCats.length > 0) {
      context += `**Batting:** ${batterCats.map(c => c.displayName).join(', ')}\n`
    }
    if (pitcherCats.length > 0) {
      context += `**Pitching:** ${pitcherCats.map(c => c.displayName).join(', ')}\n`
    }
  }

  if (displayOnlyCats.length > 0) {
    context += `\n### Display-Only Stats (tracked but NOT scored)\n`
    context += displayOnlyCats.map(c => c.displayName).join(', ') + '\n'
  }

  // Roster positions
  if (settings.rosterPositions.length > 0) {
    context += `\n### Roster Positions\n`
    const activePositions = settings.rosterPositions.filter(p =>
      p.position !== 'BN' && p.position !== 'IL' && p.position !== 'IL+' && p.position !== 'NA' && p.position !== 'DL'
    )
    const benchPositions = settings.rosterPositions.filter(p =>
      p.position === 'BN' || p.position === 'IL' || p.position === 'IL+' || p.position === 'NA' || p.position === 'DL'
    )

    if (activePositions.length > 0) {
      context += `Active: ${activePositions.map(p => `${p.position}${p.count > 1 ? ` x${p.count}` : ''}`).join(', ')}\n`
    }
    if (benchPositions.length > 0) {
      context += `Bench/IL: ${benchPositions.map(p => `${p.position}${p.count > 1 ? ` x${p.count}` : ''}`).join(', ')}\n`
    }
  }

  // Misc settings
  if (settings.playoffStartWeek) {
    context += `\nPlayoffs start: Week ${settings.playoffStartWeek}`
    if (settings.numPlayoffTeams) {
      context += ` (${settings.numPlayoffTeams} teams)`
    }
    context += '\n'
  }
  if (settings.tradeEndDate) {
    context += `Trade deadline: ${settings.tradeEndDate}\n`
  }
  if (settings.waiverType) {
    context += `Waiver type: ${settings.waiverType}\n`
  }

  return context
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
