// Core data models for Fantasy Sports Copilot

export type Sport = 'football' | 'baseball'
export type LeagueType = 'redraft'
export type DraftType = 'snake'
export type FootballScoringType = 'standard' | 'ppr' | 'half-ppr'
export type BaseballScoringType = 'roto' | 'points' | 'head-to-head'
export type ScoringType = FootballScoringType | BaseballScoringType

export interface League {
  id: string
  name: string
  commissionerId: string
  sport: Sport
  type: LeagueType
  numTeams: number
  scoringType: ScoringType
  draftType: DraftType
  status: 'setup' | 'draft' | 'active' | 'playoffs' | 'completed'
  createdAt: string
  draftDate?: string
  week?: number // For football
  period?: number // For baseball (weeks/periods)
  season?: number
}

export interface Team {
  id: string
  leagueId: string
  ownerId: string
  name: string
  draftPosition: number
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
}

export type FootballPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'
export type BaseballPosition = 'C' | '1B' | '2B' | '3B' | 'SS' | 'OF' | 'SP' | 'RP' | 'UTIL'
export type PlayerPosition = FootballPosition | BaseballPosition

export interface Player {
  id: string
  name: string
  sport: Sport
  position: PlayerPosition
  team: string // Team abbreviation
  injuryStatus?: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'IL' // IL for baseball injured list
  projectedPoints?: number
  actualPoints?: number
  adp?: number // Average draft position
  // Baseball-specific stats
  projectedStats?: {
    avg?: number
    hr?: number
    rbi?: number
    runs?: number
    sb?: number
    wins?: number
    era?: number
    whip?: number
    strikeouts?: number
    saves?: number
  }
}

export interface Roster {
  teamId: string
  players: {
    playerId: string
    position: string
    isStarter: boolean
    slot?: string // 'QB', 'RB1', 'RB2', 'WR1', 'WR2', 'WR3', 'TE', 'FLEX', 'K', 'DEF', 'BN'
  }[]
}

export interface DraftPick {
  id: string
  leagueId: string
  round: number
  pick: number
  teamId: string
  playerId: string
  timestamp: string
}

export interface Trade {
  id: string
  leagueId: string
  team1Id: string
  team2Id: string
  player1Id: string
  player2Id: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  proposedAt: string
  message?: string
}

export interface Matchup {
  id: string
  leagueId: string
  week?: number // For football
  period?: number // For baseball
  team1Id: string
  team2Id: string
  team1Score: number
  team2Score: number
  status: 'upcoming' | 'live' | 'completed'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    action?: string
    leagueId?: string
    teamId?: string
    playerId?: string
    [key: string]: any
  }
}

export interface AIResponse {
  message: string
  action?: {
    type: 'create_league' | 'set_lineup' | 'show_lineup' | 'add_player' | 'drop_player' | 'propose_trade' | 'draft_pick' | 'view_teams' | 'show_matchup' | 'show_waivers'
    data?: any
  }
  cards?: {
    type: 'lineup' | 'player' | 'matchup' | 'draft_board' | 'waivers' | 'trade' | 'draft' | 'teams'
    title: string
    payload: any
  }[]
}
