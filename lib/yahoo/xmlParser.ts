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
  start_week?: string
  end_week?: string
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
    is_current_login?: string
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
  // Stats (present when fetched with ;out=stats)
  player_stats?: Record<string, string | number>  // stat_id → value
  // Ownership (present when fetched with ;out=ownership)
  ownership_type?: string      // 'team' | 'freeagents' | 'waivers'
  owner_team_key?: string
  owner_team_name?: string
  // Percent owned (present when fetched with ;out=percent_owned)
  percent_owned?: number
  percent_owned_delta?: number
  // Draft analysis (present when fetched with ;out=draft_analysis)
  average_draft_pick?: number
  average_draft_round?: number
  average_draft_cost?: number
  percent_drafted?: number
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
    league.start_week = extractValue('start_week')
    league.end_week = extractValue('end_week')
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
          is_current_login: extractManagerValue('is_current_login'),
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

    // Extract ownership (present when fetched with ;out=ownership)
    const ownershipBlock = playerBlock.match(/<ownership>([\s\S]*?)<\/ownership>/)?.[1]
    if (ownershipBlock) {
      player.ownership_type = extractValue('ownership_type', ownershipBlock)
      player.owner_team_key = extractValue('owner_team_key', ownershipBlock)
      player.owner_team_name = extractValue('owner_team_name', ownershipBlock)
    }

    // Extract percent_owned (present when fetched with ;out=percent_owned)
    const percentOwnedBlock = playerBlock.match(/<percent_owned>([\s\S]*?)<\/percent_owned>/)?.[1]
    if (percentOwnedBlock) {
      const val = extractValue('value', percentOwnedBlock)
      if (val) player.percent_owned = parseFloat(val)
      const delta = extractValue('delta', percentOwnedBlock)
      if (delta) player.percent_owned_delta = parseFloat(delta)
    }

    // Extract draft_analysis (present when fetched with ;out=draft_analysis)
    const draftAnalysisBlock = playerBlock.match(/<draft_analysis>([\s\S]*?)<\/draft_analysis>/)?.[1]
    if (draftAnalysisBlock) {
      const avgPick = extractValue('average_pick', draftAnalysisBlock)
      if (avgPick) player.average_draft_pick = parseFloat(avgPick)
      const avgRound = extractValue('average_round', draftAnalysisBlock)
      if (avgRound) player.average_draft_round = parseFloat(avgRound)
      const avgCost = extractValue('average_cost', draftAnalysisBlock)
      if (avgCost) player.average_draft_cost = parseFloat(avgCost)
      const pctDrafted = extractValue('percent_drafted', draftAnalysisBlock)
      if (pctDrafted) player.percent_drafted = parseFloat(pctDrafted)
    }

    // Extract player_stats (present when fetched with ;out=stats)
    const playerStatsBlock = playerBlock.match(/<player_stats>([\s\S]*?)<\/player_stats>/)?.[1]
    if (playerStatsBlock) {
      const statsMap: Record<string, string | number> = {}
      const statRegex = /<stat>\s*<stat_id>(\d+)<\/stat_id>\s*<value>(.*?)<\/value>\s*<\/stat>/gs
      let sm
      while ((sm = statRegex.exec(playerStatsBlock)) !== null) {
        const id = sm[1]
        const raw = sm[2].trim()
        // Parse numeric values, keep strings for non-numeric
        const num = parseFloat(raw)
        statsMap[id] = isNaN(num) ? raw : num
      }
      if (Object.keys(statsMap).length > 0) {
        player.player_stats = statsMap
      }
    }

    if (player.player_key) {
      players.push(player as ParsedRosterPlayer)
    }
  }
  
  return players
}

// ── Standings ──

export interface ParsedStandingsTeam {
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
    is_current_login?: string
  }>
  // Standings data
  rank: number
  wins: number
  losses: number
  ties: number
  percentage: string
  games_back?: string
  points_for?: number
  points_against?: number
  points_change?: number
  waiver_priority?: number
  number_of_moves?: number
  number_of_trades?: number
  outcome_totals?: {
    wins: number
    losses: number
    ties: number
    percentage: string
  }
  streak?: {
    type: string  // 'win' or 'loss'
    value: number
  }
  playoff_seed?: number
  clinched_playoffs?: boolean
}

/**
 * Parse standings XML from Yahoo API
 * The /league/{key}/standings endpoint returns teams with <team_standings> blocks
 */
export function parseStandingsXML(xml: string): ParsedStandingsTeam[] {
  const teams: ParsedStandingsTeam[] = []

  const teamRegex = /<team>([\s\S]*?)<\/team>/g
  let teamMatch

  while ((teamMatch = teamRegex.exec(xml)) !== null) {
    const teamBlock = teamMatch[1]

    const extractValue = (tag: string, block: string = teamBlock): string | undefined => {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
      const match = block.match(regex)
      return match ? match[1].trim() : undefined
    }

    const team: Partial<ParsedStandingsTeam> = {}
    team.team_key = extractValue('team_key') || ''
    team.team_id = extractValue('team_id') || ''
    team.name = extractValue('name') || ''
    team.url = extractValue('url') || ''
    team.logo_url = extractValue('logo_url')

    // Extract managers
    const managersBlock = teamBlock.match(/<managers>([\s\S]*?)<\/managers>/)?.[1]
    if (managersBlock) {
      const managerRegex = /<manager>([\s\S]*?)<\/manager>/g
      const managers: NonNullable<ParsedStandingsTeam['managers']> = []
      let mm
      while ((mm = managerRegex.exec(managersBlock)) !== null) {
        const mb = mm[1]
        managers.push({
          manager_id: extractValue('manager_id', mb) || '',
          nickname: extractValue('nickname', mb),
          guid: extractValue('guid', mb) || '',
          is_commissioner: extractValue('is_commissioner', mb),
          is_current_login: extractValue('is_current_login', mb),
        })
      }
      if (managers.length > 0) team.managers = managers
    }

    // Extract standings block
    const standingsBlock = teamBlock.match(/<team_standings>([\s\S]*?)<\/team_standings>/)?.[1]
    if (standingsBlock) {
      team.rank = parseInt(extractValue('rank', standingsBlock) || '0', 10)
      team.playoff_seed = parseInt(extractValue('playoff_seed', standingsBlock) || '0', 10) || undefined
      team.clinched_playoffs = extractValue('clinched_playoffs', standingsBlock) === '1'

      const outcomeTotals = standingsBlock.match(/<outcome_totals>([\s\S]*?)<\/outcome_totals>/)?.[1]
      if (outcomeTotals) {
        team.wins = parseInt(extractValue('wins', outcomeTotals) || '0', 10)
        team.losses = parseInt(extractValue('losses', outcomeTotals) || '0', 10)
        team.ties = parseInt(extractValue('ties', outcomeTotals) || '0', 10)
        team.percentage = extractValue('percentage', outcomeTotals) || '.000'
        team.outcome_totals = {
          wins: team.wins,
          losses: team.losses,
          ties: team.ties,
          percentage: team.percentage,
        }
      }

      const gb = extractValue('games_back', standingsBlock)
      if (gb != null) team.games_back = gb

      const streakBlock = standingsBlock.match(/<streak>([\s\S]*?)<\/streak>/)?.[1]
      if (streakBlock) {
        team.streak = {
          type: extractValue('type', streakBlock) || 'win',
          value: parseInt(extractValue('value', streakBlock) || '0', 10),
        }
      }
    }

    // Extract team-level roster/transaction fields
    const wp = extractValue('waiver_priority')
    if (wp) team.waiver_priority = parseInt(wp, 10)
    const nm = extractValue('number_of_moves')
    if (nm) team.number_of_moves = parseInt(nm, 10)
    const nt = extractValue('number_of_trades')
    if (nt) team.number_of_trades = parseInt(nt, 10)

    // Extract team_points if available
    const pointsBlock = teamBlock.match(/<team_points>([\s\S]*?)<\/team_points>/)?.[1]
    if (pointsBlock) {
      team.points_for = parseFloat(extractValue('total', pointsBlock) || '0')
    }

    // Some formats use <points_for> and <points_against> directly
    if (!team.points_for) {
      const pf = extractValue('points_for')
      if (pf) team.points_for = parseFloat(pf)
    }
    const pa = extractValue('points_against')
    if (pa) team.points_against = parseFloat(pa)

    // Default wins/losses to 0 if standings block wasn't present
    if (team.wins === undefined) team.wins = 0
    if (team.losses === undefined) team.losses = 0
    if (team.ties === undefined) team.ties = 0
    if (team.rank === undefined) team.rank = 0
    if (!team.percentage) team.percentage = '.000'

    if (team.team_key) {
      teams.push(team as ParsedStandingsTeam)
    }
  }

  // Sort by rank
  teams.sort((a, b) => a.rank - b.rank)

  return teams
}

// ── Scoreboard / Matchups ──

export interface ParsedMatchupTeam {
  team_key: string
  team_id: string
  name: string
  logo_url?: string
  managers?: Array<{
    manager_id: string
    nickname?: string
    guid: string
    is_current_login?: string
  }>
  /** Points-based leagues: total points for this matchup period */
  points?: number
  /** Category-based leagues: per-stat values keyed by stat_id */
  stats?: Record<string, number | string>
  /** Win probability (0-1) if Yahoo provides it */
  win_probability?: number
}

export interface ParsedMatchup {
  week: number
  week_start?: string
  week_end?: string
  /** 'midevent' (live), 'postevent' (done), 'preevent' (upcoming) */
  status?: string
  is_tied?: boolean
  winner_team_key?: string
  teams: ParsedMatchupTeam[]
}

export interface ParsedScoreboard {
  league_key?: string
  week: number
  matchups: ParsedMatchup[]
}

/**
 * Parse scoreboard XML returned by /league/{key}/scoreboard;week=N
 *
 * Yahoo wraps the response in <fantasy_content><league>...<scoreboard>...</scoreboard></league>…
 * Each <matchup> block contains two <team> blocks with optional <team_stats> and <team_points>.
 */
export function parseScoreboardXML(xml: string): ParsedScoreboard {
  const extractValue = (tag: string, block: string): string | undefined => {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
    const m = block.match(regex)
    return m ? m[1].trim() : undefined
  }

  // Pull week from the <scoreboard> wrapper or first <matchup>
  const scoreboardBlock = xml.match(/<scoreboard>([\s\S]*)<\/scoreboard>/)?.[1] ?? xml
  const leagueKey = extractValue('league_key', xml)
  const sbWeek = parseInt(extractValue('week', scoreboardBlock) || '0', 10)

  const matchups: ParsedMatchup[] = []

  // Iterate <matchup> blocks — use a non-greedy regex
  const matchupRegex = /<matchup>([\s\S]*?)<\/matchup>/g
  let mm
  while ((mm = matchupRegex.exec(scoreboardBlock)) !== null) {
    const mBlock = mm[1]

    const week = parseInt(extractValue('week', mBlock) || String(sbWeek), 10)
    const week_start = extractValue('week_start', mBlock)
    const week_end = extractValue('week_end', mBlock)
    const status = extractValue('status', mBlock) // 'midevent', 'postevent', 'preevent'
    const is_tied = extractValue('is_tied', mBlock) === '1'
    const winner_team_key = extractValue('winner_team_key', mBlock)

    const teams: ParsedMatchupTeam[] = []

    // Each matchup has exactly two <team> blocks
    const teamRegex = /<team>([\s\S]*?)<\/team>/g
    let tm
    while ((tm = teamRegex.exec(mBlock)) !== null) {
      const tBlock = tm[1]

      const team: ParsedMatchupTeam = {
        team_key: extractValue('team_key', tBlock) || '',
        team_id: extractValue('team_id', tBlock) || '',
        name: extractValue('name', tBlock) || '',
        logo_url: extractValue('logo_url', tBlock),
      }

      // Managers
      const managersBlock = tBlock.match(/<managers>([\s\S]*?)<\/managers>/)?.[1]
      if (managersBlock) {
        const managers: NonNullable<ParsedMatchupTeam['managers']> = []
        const mgrRegex = /<manager>([\s\S]*?)<\/manager>/g
        let mg
        while ((mg = mgrRegex.exec(managersBlock)) !== null) {
          managers.push({
            manager_id: extractValue('manager_id', mg[1]) || '',
            nickname: extractValue('nickname', mg[1]),
            guid: extractValue('guid', mg[1]) || '',
            is_current_login: extractValue('is_current_login', mg[1]),
          })
        }
        if (managers.length) team.managers = managers
      }

      // Points
      const pointsBlock = tBlock.match(/<team_points>([\s\S]*?)<\/team_points>/)?.[1]
      if (pointsBlock) {
        const total = extractValue('total', pointsBlock)
        if (total) team.points = parseFloat(total)
      }

      // Win probability
      const wp = extractValue('win_probability', tBlock)
      if (wp) team.win_probability = parseFloat(wp)

      // Category stats
      const statsBlock = tBlock.match(/<team_stats>([\s\S]*?)<\/team_stats>/)?.[1]
      if (statsBlock) {
        const statMap: Record<string, number | string> = {}
        const statRegex = /<stat>\s*<stat_id>(\d+)<\/stat_id>\s*<value>([\s\S]*?)<\/value>\s*<\/stat>/g
        let sm
        while ((sm = statRegex.exec(statsBlock)) !== null) {
          const id = sm[1]
          const raw = sm[2].trim()
          const num = parseFloat(raw)
          statMap[id] = isNaN(num) ? raw : num
        }
        if (Object.keys(statMap).length) team.stats = statMap
      }

      if (team.team_key) teams.push(team)
    }

    matchups.push({
      week,
      week_start,
      week_end,
      status,
      is_tied,
      winner_team_key,
      teams,
    })
  }

  return {
    league_key: leagueKey,
    week: sbWeek || matchups[0]?.week || 0,
    matchups,
  }
}

// ── League Settings ──

export interface ParsedStatCategory {
  statId: string
  name: string
  displayName: string
  positionType: string  // 'B' for batter, 'P' for pitcher
  sortOrder: string     // '1' = higher is better, '0' = lower is better
  isOnlyDisplayStat?: boolean
}

export interface ParsedRosterPosition {
  position: string
  positionType?: string
  count: number
}

export interface ParsedLeagueSettings {
  statCategories: ParsedStatCategory[]
  rosterPositions: ParsedRosterPosition[]
  maxTeams?: number
  maxInnings?: number
  maxGamesPlayed?: number
  tradeEndDate?: string
  draftType?: string
  scoringType?: string
  usesPlayoffReseeding?: boolean
  playoffStartWeek?: number
  numPlayoffTeams?: number
  waiverType?: string
  waiverRule?: string
  maxAcquisitions?: number
  maxAcquisitionsPerWeek?: number
  maxTrades?: number
  tradeRejectTime?: number
  tradeReview?: string
  playerUniverse?: string
  postDraftPlayers?: string
  waiverTime?: number
  allowDraftPickTrades?: boolean
  lockEliminatedTeams?: boolean
  playoffReseeding?: boolean
  minInningsPerWeek?: number
  usesLockEliminatedTeams?: boolean
  weeklyDeadline?: string
  startScoringOn?: string
  canTradeDraftPicks?: string
  sendUnownedReminders?: boolean
}

/**
 * Parse league settings XML from Yahoo API /league/{key}/settings
 * Extracts stat categories used for scoring, roster positions, and misc settings.
 */
export function parseLeagueSettingsXML(xml: string): ParsedLeagueSettings {
  const extractValue = (tag: string, block: string): string | undefined => {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
    const m = block.match(regex)
    return m ? m[1].trim() : undefined
  }

  const settings: ParsedLeagueSettings = {
    statCategories: [],
    rosterPositions: [],
  }

  // Extract settings block
  const settingsBlock = xml.match(/<settings>([\s\S]*?)<\/settings>/)?.[1] ?? xml

  // Extract stat categories
  const statCatsBlock = settingsBlock.match(/<stat_categories>([\s\S]*?)<\/stat_categories>/)?.[1]
  if (statCatsBlock) {
    const statRegex = /<stat>([\s\S]*?)<\/stat>/g
    let sm
    while ((sm = statRegex.exec(statCatsBlock)) !== null) {
      const sBlock = sm[1]
      const statId = extractValue('stat_id', sBlock)
      const name = extractValue('name', sBlock)
      const displayName = extractValue('display_name', sBlock) || extractValue('abbr', sBlock) || name
      const positionType = extractValue('position_type', sBlock) || 'unknown'
      const sortOrder = extractValue('sort_order', sBlock) || '1'
      const isOnlyDisplayStat = extractValue('is_only_display_stat', sBlock) === '1'

      if (statId && name) {
        settings.statCategories.push({
          statId,
          name,
          displayName: displayName || name,
          positionType,
          sortOrder,
          isOnlyDisplayStat,
        })
      }
    }
  }

  // Extract roster positions
  const rosterPosBlock = settingsBlock.match(/<roster_positions>([\s\S]*?)<\/roster_positions>/)?.[1]
  if (rosterPosBlock) {
    const posRegex = /<roster_position>([\s\S]*?)<\/roster_position>/g
    let pm
    while ((pm = posRegex.exec(rosterPosBlock)) !== null) {
      const pBlock = pm[1]
      const position = extractValue('position', pBlock)
      const positionType = extractValue('position_type', pBlock)
      const count = parseInt(extractValue('count', pBlock) || '1', 10)

      if (position) {
        settings.rosterPositions.push({ position, positionType, count })
      }
    }
  }

  // Extract miscellaneous settings
  settings.scoringType = extractValue('scoring_type', settingsBlock)
  settings.draftType = extractValue('draft_type', settingsBlock)
  settings.tradeEndDate = extractValue('trade_end_date', settingsBlock)
  const maxTeams = extractValue('max_teams', settingsBlock)
  if (maxTeams) settings.maxTeams = parseInt(maxTeams, 10)
  const playoffStart = extractValue('playoff_start_week', settingsBlock)
  if (playoffStart) settings.playoffStartWeek = parseInt(playoffStart, 10)
  const numPlayoff = extractValue('num_playoff_teams', settingsBlock)
  if (numPlayoff) settings.numPlayoffTeams = parseInt(numPlayoff, 10)
  settings.waiverType = extractValue('waiver_type', settingsBlock)
  settings.waiverRule = extractValue('waiver_rule', settingsBlock)

  const maxAcq = extractValue('max_acquisitions', settingsBlock)
  if (maxAcq) settings.maxAcquisitions = parseInt(maxAcq, 10)
  const maxAcqWeek = extractValue('max_weekly_adds', settingsBlock)
  if (maxAcqWeek) settings.maxAcquisitionsPerWeek = parseInt(maxAcqWeek, 10)
  const maxTrades = extractValue('max_trades', settingsBlock)
  if (maxTrades) settings.maxTrades = parseInt(maxTrades, 10)
  const tradeRejectTime = extractValue('trade_reject_time', settingsBlock)
  if (tradeRejectTime) settings.tradeRejectTime = parseInt(tradeRejectTime, 10)
  settings.tradeReview = extractValue('trade_ratify_type', settingsBlock)
  settings.playerUniverse = extractValue('player_pool', settingsBlock)
  settings.postDraftPlayers = extractValue('post_draft_players', settingsBlock)
  const waiverTime = extractValue('waiver_time', settingsBlock)
  if (waiverTime) settings.waiverTime = parseInt(waiverTime, 10)
  settings.canTradeDraftPicks = extractValue('can_trade_draft_picks', settingsBlock)
  const minIP = extractValue('max_innings_pitched', settingsBlock)
  if (minIP) settings.minInningsPerWeek = parseInt(minIP, 10)
  settings.weeklyDeadline = extractValue('weekly_deadline', settingsBlock)
  settings.startScoringOn = extractValue('start_week', settingsBlock)
  settings.usesPlayoffReseeding = extractValue('uses_playoff_reseeding', settingsBlock) === '1'
  settings.usesLockEliminatedTeams = extractValue('uses_lock_eliminated_teams', settingsBlock) === '1'
  settings.sendUnownedReminders = extractValue('send_unowned_reminders', settingsBlock) === '1'

  return settings
}

// ── Draft Results ──

export interface ParsedDraftResult {
  pick: number
  round: number
  team_key: string
  player_key: string
  is_keeper?: boolean
  player?: {
    player_key: string
    player_id: string
    name: { full: string; first: string; last: string }
    editorial_team_abbr?: string
    display_position?: string
    headshot_url?: string
  }
}

export interface ParsedDraftResults {
  league_key?: string
  picks: ParsedDraftResult[]
}

/**
 * Parse draft results XML from Yahoo API /league/{key}/draftresults
 */
export function parseDraftResultsXML(xml: string): ParsedDraftResults {
  const extractValue = (tag: string, block: string): string | undefined => {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
    const m = block.match(regex)
    return m ? m[1].trim() : undefined
  }

  const leagueKey = extractValue('league_key', xml)
  const picks: ParsedDraftResult[] = []

  const draftResultRegex = /<draft_result>([\s\S]*?)<\/draft_result>/g
  let dm
  while ((dm = draftResultRegex.exec(xml)) !== null) {
    const block = dm[1]

    const pick: ParsedDraftResult = {
      pick: parseInt(extractValue('pick', block) || '0', 10),
      round: parseInt(extractValue('round', block) || '0', 10),
      team_key: extractValue('team_key', block) || '',
      player_key: extractValue('player_key', block) || '',
      is_keeper: extractValue('is_keeper', block) === '1',
    }

    const playerBlock = block.match(/<player>([\s\S]*?)<\/player>/)?.[1]
    if (playerBlock) {
      const nameBlock = playerBlock.match(/<name>([\s\S]*?)<\/name>/)?.[1]
      pick.player = {
        player_key: extractValue('player_key', playerBlock) || pick.player_key,
        player_id: extractValue('player_id', playerBlock) || '',
        name: {
          full: nameBlock ? (extractValue('full', nameBlock) || '') : '',
          first: nameBlock ? (extractValue('first', nameBlock) || '') : '',
          last: nameBlock ? (extractValue('last', nameBlock) || '') : '',
        },
        editorial_team_abbr: extractValue('editorial_team_abbr', playerBlock),
        display_position: extractValue('display_position', playerBlock),
        headshot_url: extractValue('url', playerBlock.match(/<headshot>([\s\S]*?)<\/headshot>/)?.[1] || ''),
      }
    }

    if (pick.team_key) {
      picks.push(pick)
    }
  }

  picks.sort((a, b) => a.pick - b.pick)

  return { league_key: leagueKey, picks }
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
  position_type?: string           // 'P' for pitcher, 'B' for batter
  display_position?: string        // e.g. 'SP,P' or '1B,2B'
  eligible_positions?: string[]    // e.g. ['SP', 'P']
  editorial_team_abbr?: string     // e.g. 'LAA'
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

  // Extract position info
  stats.position_type = extractValue('position_type') || undefined
  stats.display_position = extractValue('display_position') || undefined
  stats.editorial_team_abbr = extractValue('editorial_team_abbr') || undefined

  // Extract eligible positions
  const eligPosBlock = playerBlock.match(/<eligible_positions>(.*?)<\/eligible_positions>/s)?.[1]
  if (eligPosBlock) {
    const posRegex = /<position>(.*?)<\/position>/g
    const positions: string[] = []
    let posMatch
    while ((posMatch = posRegex.exec(eligPosBlock)) !== null) {
      positions.push(posMatch[1].trim())
    }
    if (positions.length > 0) {
      stats.eligible_positions = positions
    }
  }

  // Extract stats - Yahoo provides stats in <player_stats> blocks
  // Also check for <stats> blocks as alternative format
  let statsBlocks = playerBlock.match(/<player_stats>(.*?)<\/player_stats>/gs)
  if (!statsBlocks) {
    // Try alternative format
    statsBlocks = playerBlock.match(/<stats>(.*?)<\/stats>/gs)
  }
  
  if (statsBlocks) {
    stats.season_stats = {}
    stats.week_stats = {}
    stats.ytd_stats = {}

    for (const statsBlock of statsBlocks) {
      // Extract coverage type (season, week, etc.)
      const coverageTypeMatch = statsBlock.match(/<coverage_type>(.*?)<\/coverage_type>/s)
      const coverageType = coverageTypeMatch ? coverageTypeMatch[1].trim().toLowerCase() : 'season'

      // Extract stat values
      const statRegex = /<stat>(.*?)<\/stat>/gs
      let statMatch
      const statMap: Record<string, number | string> = {}

      while ((statMatch = statRegex.exec(statsBlock)) !== null) {
        const statBlock = statMatch[1]
        const statId = extractValue('stat_id', statBlock)
        const value = extractValue('value', statBlock)
        const name = extractValue('name', statBlock)

        if (statId && value !== undefined && value !== '') {
          // Try to parse as number, otherwise keep as string
          const numValue = parseFloat(value)
          const finalValue = isNaN(numValue) ? value : numValue
          statMap[statId] = finalValue
          
          // Also store by name for easier access
          if (name) {
            const nameKey = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            statMap[nameKey] = finalValue
            // Also store uppercase version for common stats
            statMap[name.toUpperCase().replace(/\s+/g, '_')] = finalValue
          }
        }
      }

      // Store stats by coverage type
      if (coverageType === 'season' || coverageType === 'date' || coverageType === '') {
        stats.season_stats = { ...stats.season_stats, ...statMap }
      } else if (coverageType === 'week') {
        stats.week_stats = { ...stats.week_stats, ...statMap }
      } else if (coverageType === 'ytd' || coverageType === 'year') {
        stats.ytd_stats = { ...stats.ytd_stats, ...statMap }
      } else {
        // Default to season stats if unknown type
        stats.season_stats = { ...stats.season_stats, ...statMap }
      }
    }
  } else {
    // Log if no stats blocks found for debugging
    // No player_stats blocks found — likely an empty stats response
  }

  return stats as ParsedPlayerStats
}
