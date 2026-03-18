// Yahoo Fantasy Sports API Service
// Handles fetching data from Yahoo Fantasy Sports API

import { YahooOAuth2 } from './oauth2'
import { MLB_SEASON_TO_GAME_KEY } from './config'
import { parseLeaguesXML, parseTeamsXML, parseRosterXML, parsePlayerStatsXML, parseStandingsXML, parseScoreboardXML, parseLeagueSettingsXML, parseDraftResultsXML, ParsedLeague, ParsedTeam, ParsedRosterPlayer, ParsedStandingsTeam, ParsedScoreboard, ParsedLeagueSettings, ParsedDraftResults } from './xmlParser'

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
  async getTeamRoster(teamKey: string, options?: { out?: string }): Promise<{ players: ParsedRosterPlayer[]; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    let endpoint = `/team/${teamKey}/roster`
    if (options?.out) {
      endpoint += `/players;out=${options.out}`
    }
    
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
   * Get matchups for a league (parsed)
   * @param leagueKey  Full league key, e.g. 469.l.12345
   * @param week       Optional week number. Omit for the current week.
   */
  async getMatchups(leagueKey: string, week?: number): Promise<{ scoreboard: ParsedScoreboard; raw?: string }> {
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

    let scoreboard: ParsedScoreboard = { week: week || 0, matchups: [] }
    if (response.raw) {
      scoreboard = parseScoreboardXML(response.raw)
    }

    return { scoreboard, raw: response.raw }
  }

  /**
   * Get standings for a league (parsed)
   * @param leagueKey - Full league key in format: 469.l.LEAGUE_ID
   */
  async getStandings(leagueKey: string): Promise<{ standings: ParsedStandingsTeam[]; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/league/${leagueKey}/standings`

    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    let standings: ParsedStandingsTeam[] = []
    if (response.raw) {
      standings = parseStandingsXML(response.raw)
    }

    return { standings, raw: response.raw }
  }

  /**
   * Get league settings (stat categories used for scoring, roster positions, etc.)
   * @param leagueKey - Full league key in format: 469.l.LEAGUE_ID
   */
  async getLeagueSettings(leagueKey: string): Promise<{ settings: ParsedLeagueSettings; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/league/${leagueKey}/settings`

    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    let settings: ParsedLeagueSettings = { statCategories: [], rosterPositions: [] }
    if (response.raw) {
      settings = parseLeagueSettingsXML(response.raw)
    }

    return { settings, raw: response.raw }
  }

  /**
   * Get stat categories for a game (maps stat IDs to display names)
   * @param gameKey - Yahoo game key (e.g., '469' for MLB 2026)
   */
  async getStatCategories(gameKey: string): Promise<{ categories: Record<string, { name: string; displayName: string; positionType: string }>; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/game/${gameKey}/stat_categories`
    
    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Parse stat categories from XML
    const categories: Record<string, { name: string; displayName: string; positionType: string }> = {}
    
    if (response.raw) {
      // Extract the stat_categories section first to avoid matching stat_modifiers
      const catSection = response.raw.match(/<stat_categories>([\s\S]*?)<\/stat_categories>/)
      const xmlToParse = catSection ? catSection[1] : response.raw
      
      const statRegex = /<stat>([\s\S]*?)<\/stat>/g
      let statMatch
      
      while ((statMatch = statRegex.exec(xmlToParse)) !== null) {
        const statBlock = statMatch[1]
        
        const extractVal = (tag: string): string | undefined => {
          const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
          const match = statBlock.match(regex)
          return match ? match[1].trim() : undefined
        }
        
        const statId = extractVal('stat_id')
        const name = extractVal('name')
        const displayName = extractVal('display_name') || extractVal('abbr') || name
        // position_type can be directly on stat or nested inside position_types
        const positionType = extractVal('position_type') || 'unknown'
        
        if (statId && name) {
          categories[statId] = {
            name,
            displayName: displayName || name,
            positionType // 'B' for batter, 'P' for pitcher
          }
        }
      }
      
    }

    return { categories, raw: response.raw }
  }

  /**
   * Get league players with optional filters
   * @param leagueKey - League key
   * @param options - Filtering / pagination options
   */
  async getPlayers(
    leagueKey: string,
    options: {
      start?: number
      count?: number
      position?: string   // 'B' for batters, 'P' for pitchers, or specific position like 'C','1B','SP' etc.
      status?: string     // 'A' = all, 'FA' = free agents, 'T' = taken, 'W' = waivers
      sort?: string       // 'AR' = average rank, 'PTS' = points, 'OR' = overall rank
      out?: string        // Sub-resources: 'stats', 'ownership', 'percent_owned', etc.
    } = {}
  ): Promise<{ players: ParsedRosterPlayer[]; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const { start = 0, count = 25, position, status, sort, out } = options
    let filters = `;start=${start};count=${count}`
    if (position) filters += `;position=${position}`
    if (status) filters += `;status=${status}`
    if (sort) filters += `;sort=${sort}`
    if (out) filters += `;out=${out}`

    const endpoint = `/league/${leagueKey}/players${filters}`

    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    // Reuse the roster XML parser — it extracts <player> blocks generically
    let players: ParsedRosterPlayer[] = []
    if (response.raw) {
      players = parseRosterXML(response.raw)
    }

    return { players, raw: response.raw }
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
      const gameKey = MLB_SEASON_TO_GAME_KEY[season] || '469'
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
   * Yahoo API doesn't support arbitrary date ranges well, so we'll just fetch season and week stats
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
    // Yahoo API primarily provides season and week stats
    // We'll fetch the main stats and return them in all time period fields for now
    const seasonStats = await this.getPlayerStats(playerKey, leagueKey, season)

    // Return the same stats for all periods since Yahoo doesn't provide granular date ranges
    // The season_stats will have full season, and week_stats (if available) will have recent performance
    return {
      season: seasonStats.stats,
      lastMonth: seasonStats.stats, // Same as season for now
      lastTwoWeeks: seasonStats.stats, // Same as season for now
      lastWeek: seasonStats.stats, // Week stats are in the stats object
      today: null // Yahoo doesn't provide same-day stats reliably
    }
  }

  /**
   * Get draft results for a league (with player details)
   * @param leagueKey - Full league key in format: 469.l.LEAGUE_ID
   */
  async getDraftResults(leagueKey: string): Promise<{ draftResults: ParsedDraftResults; raw?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authenticate first.')
    }

    const endpoint = `/league/${leagueKey}/draftresults/players`

    const response = await this.oauth2.makeRequest(
      'GET',
      endpoint,
      this.accessToken
    )

    let draftResults: ParsedDraftResults = { picks: [] }
    if (response.raw) {
      draftResults = parseDraftResultsXML(response.raw)
    }

    return { draftResults, raw: response.raw }
  }

  // Helper methods to parse XML responses (simplified for MVP)
  private parseLeaguesResponse(response: any): YahooLeague[] {
    // Yahoo returns XML - for now, return empty array
    // The raw XML is in response.raw
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
