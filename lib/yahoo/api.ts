// Yahoo Fantasy Sports API Service
// Handles fetching data from Yahoo Fantasy Sports API

import { YahooOAuth2 } from './oauth2'
import { parseLeaguesXML, parseTeamsXML, parseRosterXML, parsePlayerStatsXML, ParsedLeague, ParsedTeam, ParsedRosterPlayer } from './xmlParser'

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
   * @param gameKey - Yahoo game key: '414' for NFL, '423' for MLB, etc.
   *                  If 'all' or empty, queries all available games
   */
  async getLeagues(gameKey: string = '469'): Promise<{ leagues: ParsedLeague[]; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    let endpoint: string
    let allLeagues: ParsedLeague[] = []

    // If 'all', query all games without filtering
    if (gameKey === 'all' || gameKey === '') {
      endpoint = `/users;use_login=1/games/leagues`
    } else {
      // Convert sport names to game keys
      // Note: Game keys change by season/year
      // 469 = MLB (baseball) - 2026 season (current)
      // 458 = MLB (baseball) - 2025 season
      // 431 = MLB (baseball) - 2024 season
      // 422 = MLB (baseball) - 2023 season
      // 461 = NFL (football) - 2025 season (current)
      // 449 = NFL (football) - 2024 season
      // 414 = NFL (football) - 2022 season
      const gameKeyMap: Record<string, string> = {
        'mlb': '469', // 2026 season (current)
        'baseball': '469',
        'nfl': '461', // 2025 season (current)
        'football': '461',
      }
      const yahooGameKey = gameKeyMap[gameKey.toLowerCase()] || gameKey
      
      console.log(`[Yahoo API] getLeagues called with gameKey="${gameKey}", mapped to yahooGameKey="${yahooGameKey}"`)
      
      endpoint = `/users;use_login=1/games;game_keys=${yahooGameKey}/leagues`
    }
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Parse XML response
    if (response.raw) {
      allLeagues = parseLeaguesXML(response.raw)
    }

    return { leagues: allLeagues, raw: response.raw }
  }

  /**
   * Get teams in a league
   * @param leagueKey - Full league key in format: 469.l.LEAGUE_ID
   */
  async getLeagueTeams(leagueKey: string): Promise<{ teams: ParsedTeam[]; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/league/${leagueKey}/teams`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Parse XML response
    let teams: ParsedTeam[] = []
    if (response.raw) {
      teams = parseTeamsXML(response.raw)
    }

    return { teams, raw: response.raw }
  }

  /**
   * Get roster for a specific team
   * @param teamKey - Full team key in format: 469.l.45462.t.1
   */
  async getTeamRoster(teamKey: string): Promise<{ players: ParsedRosterPlayer[]; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/team/${teamKey}/roster`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Parse XML response
    let players: ParsedRosterPlayer[] = []
    if (response.raw) {
      players = parseRosterXML(response.raw)
    }

    return { players, raw: response.raw }
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
    
    const response = this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    return response
  }

  /**
   * Get player statistics
   * @param playerKey - Full player key in format: 469.p.12345
   * @param leagueKey - Optional league key for league-specific stats
   * @param season - Optional season year (e.g., 2024, 2025). If provided, will construct player key for that season
   * @param dateRange - Optional date range for stats. Format: 'date=YYYY-MM-DD' or 'lastweek', 'lastmonth', etc.
   */
  async getPlayerStats(
    playerKey: string, 
    leagueKey?: string, 
    season?: number,
    dateRange?: string
  ): Promise<{ stats: any; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    // If season is provided, construct player key for that season
    // Player key format: {game_key}.p.{player_id}
    // Extract player_id from current playerKey
    let finalPlayerKey = playerKey
    if (season) {
      const playerIdMatch = playerKey.match(/\.p\.(\d+)$/)
      if (playerIdMatch) {
        const playerId = playerIdMatch[1]
        // Map season to game key
        const seasonToGameKey: Record<number, string> = {
          2026: '469',
          2025: '458',
          2024: '431',
          2023: '422',
          2022: '414',
        }
        const gameKey = seasonToGameKey[season] || '469'
        finalPlayerKey = `${gameKey}.p.${playerId}`
      }
    }

    // Build endpoint with optional parameters
    let endpoint = `/player/${finalPlayerKey}/stats`
    const params: string[] = []
    
    if (leagueKey) {
      params.push(`league_key=${leagueKey}`)
    }
    
    if (dateRange) {
      params.push(`type=${dateRange}`)
    }
    
    if (params.length > 0) {
      endpoint += `;${params.join(';')}`
    }
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Parse XML response
    let stats: any = null
    if (response.raw) {
      stats = parsePlayerStatsXML(response.raw)
    }

    return { stats, raw: response.raw }
  }

  /**
   * Get player statistics for multiple date ranges
   * @param playerKey - Full player key
   * @param leagueKey - Optional league key
   * @param season - Optional season year
   */
  async getPlayerStatsMultipleRanges(
    playerKey: string,
    leagueKey?: string,
    season?: number
  ): Promise<{
    season: any
    lastMonth: any
    lastTwoWeeks: any
    lastWeek: any
    today: any
  }> {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // Calculate date ranges
    const lastWeekDate = new Date(now)
    lastWeekDate.setDate(lastWeekDate.getDate() - 7)
    
    const twoWeeksAgoDate = new Date(now)
    twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14)
    
    const lastMonthDate = new Date(now)
    lastMonthDate.setDate(lastMonthDate.getDate() - 30)

    // Fetch stats for different ranges
    const [seasonStats, lastMonthStats, lastTwoWeeksStats, lastWeekStats, todayStats] = await Promise.all([
      this.getPlayerStats(playerKey, leagueKey, season),
      this.getPlayerStats(playerKey, leagueKey, season, `date=${lastMonthDate.toISOString().split('T')[0]}`),
      this.getPlayerStats(playerKey, leagueKey, season, `date=${twoWeeksAgoDate.toISOString().split('T')[0]}`),
      this.getPlayerStats(playerKey, leagueKey, season, `date=${lastWeekDate.toISOString().split('T')[0]}`),
      this.getPlayerStats(playerKey, leagueKey, season, `date=${today}`)
    ])

    return {
      season: seasonStats.stats,
      lastMonth: lastMonthStats.stats,
      lastTwoWeeks: lastTwoWeeksStats.stats,
      lastWeek: lastWeekStats.stats,
      today: todayStats.stats
    }
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
