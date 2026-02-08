// Yahoo Fantasy Sports API Service
// Handles fetching data from Yahoo Fantasy Sports API

import { YahooOAuth2 } from './oauth2'

// Simple XML parser (for MVP - consider using xml2js in production)
function parseXML(xml: string): any {
  // This is a simplified parser - for production, use a proper XML library
  const result: any = {}
  
  // Extract basic data using regex (simplified approach)
  // In production, use xml2js or similar
  const tagRegex = /<(\w+)>(.*?)<\/\1>/g
  let match
  
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, tag, content] = match
    if (!result[tag]) {
      result[tag] = []
    }
    result[tag].push(content.trim())
  }
  
  return result
}

export interface YahooLeague {
  league_key: string
  league_id: string
  name: string
  url: string
  logo_url?: string
  draft_status: string
  num_teams: number
  edit_key: number
  weekly_deadline?: string
  league_update_timestamp: string
  scoring_type: string
  league_type: string
  renew?: string
  renewed?: string
  iris_group_chat_id?: string
  allow_add_to_dl_extra_pos?: number
  is_pro_league?: string
  is_cash_league?: string
  current_week?: string
  start_week?: string
  start_date?: string
  end_week?: string
  end_date?: string
  is_finished?: number
}

export interface YahooTeam {
  team_key: string
  team_id: string
  name: string
  url?: string
  team_logos?: Array<{ size: string; url: string }>
  waiver_priority?: number
  number_of_moves?: string
  number_of_trades?: string
  clinched_playoffs?: number
  managers?: Array<{
    manager_id: string
    nickname?: string
    guid?: string
    is_commissioner?: string
    is_current_login?: string
  }>
}

export interface YahooPlayer {
  player_key: string
  player_id: string
  name: {
    full: string
    first: string
    last: string
    ascii_first: string
    ascii_last: string
  }
  editorial_player_key?: string
  editorial_team_key?: string
  editorial_team_full_name?: string
  editorial_team_abbr?: string
  uniform_number?: string
  display_position: string
  headshot?: {
    url: string
    size: string
  }
  image_url?: string
  is_undroppable?: string
  position_type?: string
  eligible_positions?: Array<{ position: string }>
  has_player_notes?: number
  player_notes_last_timestamp?: number
}

export class YahooFantasyAPI {
  private oauth2: YahooOAuth2
  private accessToken: string | null = null

  constructor() {
    this.oauth2 = new YahooOAuth2()
  }

  /**
   * Set access token (after OAuth 2.0 flow)
   */
  setAccessToken(token: string) {
    this.accessToken = token
  }

  /**
   * Get all games for the logged-in user
   */
  async getGames(gameKeys?: string[]): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const gameFilter = gameKeys ? `;game_keys=${gameKeys.join(',')}` : ''
    const endpoint = `/users;use_login=1/games${gameFilter}`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    return response
  }

  /**
   * Get all leagues for the logged-in user
   * @param gameKey - Yahoo game key: '414' for MLB, '331' for NFL, etc.
   */
  async getLeagues(gameKey: string = '414'): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    // Convert 'mlb' to game key '414' if needed
    const yahooGameKey = gameKey === 'mlb' ? '414' : gameKey === 'nfl' ? '331' : gameKey
    
    const endpoint = `/users;use_login=1/games;game_keys=${yahooGameKey}/leagues`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Return raw XML response for now - we'll parse it in the route
    return response
  }

  /**
   * Get teams in a league
   * @param leagueKey - Full league key in format: 414.l.LEAGUE_ID
   */
  async getLeagueTeams(leagueKey: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/league/${leagueKey}/teams`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Return raw XML response
    return response
  }

  /**
   * Get roster for a specific team
   */
  async getTeamRoster(teamKey: string): Promise<YahooPlayer[]> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/team/${teamKey}/roster`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    return this.parsePlayersResponse(response)
  }

  /**
   * Get matchups for a league
   */
  async getMatchups(leagueKey: string, week?: number): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const weekFilter = week ? `;week=${week}` : ''
    const endpoint = `/league/${leagueKey}/scoreboard${weekFilter}`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    return response
  }

  /**
   * Get standings for a league
   */
  async getStandings(leagueKey: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/league/${leagueKey}/standings`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    return response
  }

  /**
   * Get available players (free agents)
   */
  async getPlayers(leagueKey: string, start: number = 0, count: number = 25): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/league/${leagueKey}/players;start=${start};count=${count}`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    return response
  }

  // Helper methods to parse XML responses (simplified for MVP)
  private parseLeaguesResponse(response: any): YahooLeague[] {
    // Yahoo returns XML - for now, return empty array
    // The raw XML is in response.raw
    // TODO: Implement proper XML parsing with xml2js or similar
    console.log('Yahoo API Response (raw XML):', response.raw?.substring(0, 500))
    return []
  }

  private parseTeamsResponse(response: any): YahooTeam[] {
    // Simplified parsing
    return []
  }

  private parsePlayersResponse(response: any): YahooPlayer[] {
    // Simplified parsing
    return []
  }
}
