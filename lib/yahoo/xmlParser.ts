// XML Parser for Yahoo Fantasy Sports API responses
// Converts Yahoo's XML format to JSON

export interface ParsedLeague {
  league_key: string
  league_id: string
  name: string
  url: string
  logo_url?: string
  num_teams: number
  scoring_type: string
  league_type: string
  season: string
  game_code: string
  draft_status: string
  is_finished?: string
  current_week?: string
  start_date?: string
  end_date?: string
}

export interface ParsedTeam {
  team_key: string
  team_id: string
  name: string
  url: string
  logo_url?: string
  managers?: Array<{
    manager_id: string
    nickname?: string
    guid: string
    is_commissioner?: string
  }>
}

export interface ParsedRosterPlayer {
  player_key: string
  player_id: string
  name: {
    full: string
    first: string
    last: string
    ascii_first?: string
    ascii_last?: string
  }
  position_type: string
  eligible_positions: string[]
  selected_position: {
    position: string
    is_flex?: string
  }
  status?: string
  injury_status?: string
  editorial_player_key?: string
  editorial_team_key?: string
  editorial_team_full_name?: string
  editorial_team_abbr?: string
  uniform_number?: string
  display_position?: string
  headshot?: {
    url?: string
    size?: string
  }
  image_url?: string
  is_undroppable?: string
  position?: string
}

/**
 * Simple XML parser for Yahoo Fantasy Sports API
 * For production, consider using a proper XML library like 'xml2js'
 */
export function parseLeaguesXML(xml: string): ParsedLeague[] {
  const leagues: ParsedLeague[] = []
  
  // Extract all league blocks
  const leagueRegex = /<league>(.*?)<\/league>/gs
  let leagueMatch
  
  while ((leagueMatch = leagueRegex.exec(xml)) !== null) {
    const leagueBlock = leagueMatch[1]
    const league: Partial<ParsedLeague> = {}
    
    // Extract league properties - helper function scoped to leagueBlock
    const extractValue = (tag: string, block: string = leagueBlock): string | undefined => {
      const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
      const match = block.match(regex)
      return match ? match[1].trim() : undefined
    }
    
    league.league_key = extractValue('league_key') || ''
    league.league_id = extractValue('league_id') || ''
    league.name = extractValue('name') || ''
    league.url = extractValue('url') || ''
    league.logo_url = extractValue('logo_url')
    league.num_teams = parseInt(extractValue('num_teams') || '0', 10)
    league.scoring_type = extractValue('scoring_type') || ''
    league.league_type = extractValue('league_type') || ''
    league.season = extractValue('season') || ''
    league.game_code = extractValue('game_code') || ''
    league.draft_status = extractValue('draft_status') || ''
    league.is_finished = extractValue('is_finished')
    league.current_week = extractValue('current_week')
    league.start_date = extractValue('start_date')
    league.end_date = extractValue('end_date')
    
    if (league.league_key) {
      leagues.push(league as ParsedLeague)
    }
  }
  
  return leagues
}

export function parseTeamsXML(xml: string): ParsedTeam[] {
  const teams: ParsedTeam[] = []
  
  // Extract all team blocks
  const teamRegex = /<team>(.*?)<\/team>/gs
  let teamMatch
  
  while ((teamMatch = teamRegex.exec(xml)) !== null) {
    const teamBlock = teamMatch[1]
    const team: Partial<ParsedTeam> = {}
    
    // Extract team properties
    const extractValue = (tag: string): string | undefined => {
      const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
      const match = teamBlock.match(regex)
      return match ? match[1].trim() : undefined
    }
    
    team.team_key = extractValue('team_key') || ''
    team.team_id = extractValue('team_id') || ''
    team.name = extractValue('name') || ''
    team.url = extractValue('url') || ''
    team.logo_url = extractValue('logo_url')
    
    // Extract managers
    const managersRegex = /<managers>(.*?)<\/managers>/s
    const managersMatch = teamBlock.match(managersRegex)
    if (managersMatch) {
      const managersBlock = managersMatch[1]
      const managerRegex = /<manager>(.*?)<\/manager>/gs
      const managers: ParsedTeam['managers'] = []
      let managerMatch
      
      while ((managerMatch = managerRegex.exec(managersBlock)) !== null) {
        const managerBlock = managerMatch[1]
        const extractManagerValue = (tag: string): string | undefined => {
          const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
          const match = managerBlock.match(regex)
          return match ? match[1].trim() : undefined
        }
        const manager = {
          manager_id: extractManagerValue('manager_id') || '',
          nickname: extractManagerValue('nickname'),
          guid: extractManagerValue('guid') || '',
          is_commissioner: extractManagerValue('is_commissioner'),
        }
        managers.push(manager)
      }
      
      if (managers.length > 0) {
        team.managers = managers
      }
    }
    
    if (team.team_key) {
      teams.push(team as ParsedTeam)
    }
  }
  
  return teams
}

/**
 * Extract game information from XML
 */
export function parseGamesXML(xml: string): Array<{ game_key: string; game_id: string; name: string; code: string; season: string }> {
  const games: Array<{ game_key: string; game_id: string; name: string; code: string; season: string }> = []
  
  const gameRegex = /<game>(.*?)<\/game>/gs
  let gameMatch
  
  while ((gameMatch = gameRegex.exec(xml)) !== null) {
    const gameBlock = gameMatch[1]
    
    const extractValue = (tag: string): string | undefined => {
      const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
      const match = gameBlock.match(regex)
      return match ? match[1].trim() : undefined
    }
    
    const game_key = extractValue('game_key')
    const game_id = extractValue('game_id')
    const name = extractValue('name')
    const code = extractValue('code')
    const season = extractValue('season')
    
    if (game_key && game_id && name && code && season) {
      games.push({ game_key, game_id, name, code, season })
    }
  }
  
  return games
}

/**
 * Parse roster XML from Yahoo API
 */
export function parseRosterXML(xml: string): ParsedRosterPlayer[] {
  const players: ParsedRosterPlayer[] = []
  
  // Extract all player blocks
  const playerRegex = /<player>(.*?)<\/player>/gs
  let playerMatch
  
  while ((playerMatch = playerRegex.exec(xml)) !== null) {
    const playerBlock = playerMatch[1]
    const player: Partial<ParsedRosterPlayer> = {}
    
    // Extract player properties
    const extractValue = (tag: string, block: string = playerBlock): string | undefined => {
      const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
      const match = block.match(regex)
      return match ? match[1].trim() : undefined
    }
    
    player.player_key = extractValue('player_key') || ''
    player.player_id = extractValue('player_id') || ''
    
    // Extract name
    const nameBlock = playerBlock.match(/<name>(.*?)<\/name>/s)?.[1]
    if (nameBlock) {
      player.name = {
        full: extractValue('full', nameBlock) || '',
        first: extractValue('first', nameBlock) || '',
        last: extractValue('last', nameBlock) || '',
        ascii_first: extractValue('ascii_first', nameBlock),
        ascii_last: extractValue('ascii_last', nameBlock),
      }
    }
    
    // Extract position info
    player.position_type = extractValue('position_type') || ''
    player.position = extractValue('position')
    player.display_position = extractValue('display_position')
    
    // Extract eligible positions
    const eligiblePositionsBlock = playerBlock.match(/<eligible_positions>(.*?)<\/eligible_positions>/s)?.[1]
    if (eligiblePositionsBlock) {
      const positionRegex = /<position>(.*?)<\/position>/g
      const positions: string[] = []
      let posMatch
      while ((posMatch = positionRegex.exec(eligiblePositionsBlock)) !== null) {
        positions.push(posMatch[1].trim())
      }
      player.eligible_positions = positions
    }
    
    // Extract selected position
    const selectedPositionBlock = playerBlock.match(/<selected_position>(.*?)<\/selected_position>/s)?.[1]
    if (selectedPositionBlock) {
      player.selected_position = {
        position: extractValue('position', selectedPositionBlock) || '',
        is_flex: extractValue('is_flex', selectedPositionBlock),
      }
    }
    
    player.status = extractValue('status')
    player.injury_status = extractValue('injury_status')
    player.editorial_player_key = extractValue('editorial_player_key')
    player.editorial_team_key = extractValue('editorial_team_key')
    player.editorial_team_full_name = extractValue('editorial_team_full_name')
    player.editorial_team_abbr = extractValue('editorial_team_abbr')
    player.uniform_number = extractValue('uniform_number')
    player.is_undroppable = extractValue('is_undroppable')
    player.image_url = extractValue('image_url')
    
    if (player.player_key) {
      players.push(player as ParsedRosterPlayer)
    }
  }
  
  return players
}

/**
 * Player statistics interface
 */
export interface ParsedPlayerStats {
  player_key: string
  player_id: string
  name?: {
    full: string
    first: string
    last: string
  }
  // Season stats
  season_stats?: {
    [statName: string]: number | string
  }
  // Recent stats (last 7/14/30 days)
  recent_stats?: {
    [statName: string]: number | string
  }
  // Week stats
  week_stats?: {
    [statName: string]: number | string
  }
  // Year-to-date stats
  ytd_stats?: {
    [statName: string]: number | string
  }
}

/**
 * Parse player statistics XML from Yahoo API
 */
export function parsePlayerStatsXML(xml: string): ParsedPlayerStats | null {
  // Extract player block
  const playerMatch = xml.match(/<player>(.*?)<\/player>/s)
  if (!playerMatch) {
    return null
  }

  const playerBlock = playerMatch[1]
  const stats: Partial<ParsedPlayerStats> = {}

  // Extract player properties
  const extractValue = (tag: string, block: string = playerBlock): string | undefined => {
    const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's')
    const match = block.match(regex)
    return match ? match[1].trim() : undefined
  }

  stats.player_key = extractValue('player_key') || ''
  stats.player_id = extractValue('player_id') || ''

  // Extract name if present
  const nameBlock = playerBlock.match(/<name>(.*?)<\/name>/s)?.[1]
  if (nameBlock) {
    stats.name = {
      full: extractValue('full', nameBlock) || '',
      first: extractValue('first', nameBlock) || '',
      last: extractValue('last', nameBlock) || '',
    }
  }

  // Extract stats - Yahoo provides stats in <player_stats> blocks
  const statsBlocks = playerBlock.match(/<player_stats>(.*?)<\/player_stats>/gs)
  if (statsBlocks) {
    stats.season_stats = {}
    stats.week_stats = {}
    stats.ytd_stats = {}

    for (const statsBlock of statsBlocks) {
      // Extract coverage type (season, week, etc.)
      const coverageTypeMatch = statsBlock.match(/<coverage_type>(.*?)<\/coverage_type>/s)
      const coverageType = coverageTypeMatch ? coverageTypeMatch[1].trim() : 'season'

      // Extract stat values
      const statRegex = /<stat>(.*?)<\/stat>/gs
      let statMatch
      const statMap: Record<string, number | string> = {}

      while ((statMatch = statRegex.exec(statsBlock)) !== null) {
        const statBlock = statMatch[1]
        const statId = extractValue('stat_id', statBlock)
        const value = extractValue('value', statBlock)
        const name = extractValue('name', statBlock)

        if (statId && value !== undefined) {
          // Try to parse as number, otherwise keep as string
          const numValue = parseFloat(value)
          statMap[statId] = isNaN(numValue) ? value : numValue
          
          // Also store by name for easier access
          if (name) {
            statMap[name.toLowerCase().replace(/\s+/g, '_')] = isNaN(numValue) ? value : numValue
          }
        }
      }

      // Store stats by coverage type
      if (coverageType === 'season' || coverageType === 'date') {
        stats.season_stats = { ...stats.season_stats, ...statMap }
      } else if (coverageType === 'week') {
        stats.week_stats = { ...stats.week_stats, ...statMap }
      } else if (coverageType === 'ytd') {
        stats.ytd_stats = { ...stats.ytd_stats, ...statMap }
      }
    }
  }

  return stats as ParsedPlayerStats
}
