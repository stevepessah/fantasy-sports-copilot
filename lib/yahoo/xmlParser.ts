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
        const manager: ParsedTeam['managers']![0] = {
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
