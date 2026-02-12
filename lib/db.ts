// Simple in-memory database for MVP
// In production, replace with PostgreSQL, MongoDB, or similar

import { League, Team, Player, Roster, DraftPick, Trade, Matchup } from '@/types'
import { loadMLBPlayersFromCSV } from './loadPlayersFromCSV'

// In-memory stores
const leagues: Map<string, League> = new Map()
const teams: Map<string, Team> = new Map()
const rosters: Map<string, Roster> = new Map()
const players: Map<string, Player> = new Map()
const draftPicks: Map<string, DraftPick> = new Map()
const trades: Map<string, Trade> = new Map()
const matchups: Map<string, Matchup> = new Map()

// League operations
export const leagueDB = {
  create: (league: League): League => {
    leagues.set(league.id, league)
    return league
  },

  get: (id: string): League | undefined => {
    return leagues.get(id)
  },

  getAll: (): League[] => {
    return Array.from(leagues.values())
  },

  update: (id: string, updates: Partial<League>): League | undefined => {
    const league = leagues.get(id)
    if (!league) return undefined
    const updated = { ...league, ...updates }
    leagues.set(id, updated)
    return updated
  },

  delete: (id: string): boolean => {
    return leagues.delete(id)
  },
}

// Team operations
export const teamDB = {
  create: (team: Team): Team => {
    teams.set(team.id, team)
    return team
  },

  get: (id: string): Team | undefined => {
    return teams.get(id)
  },

  getByLeague: (leagueId: string): Team[] => {
    return Array.from(teams.values()).filter((t) => t.leagueId === leagueId)
  },

  update: (id: string, updates: Partial<Team>): Team | undefined => {
    const team = teams.get(id)
    if (!team) return undefined
    const updated = { ...team, ...updates }
    teams.set(id, updated)
    return updated
  },
}

// Roster operations
export const rosterDB = {
  create: (roster: Roster): Roster => {
    rosters.set(roster.teamId, roster)
    return roster
  },

  get: (teamId: string): Roster | undefined => {
    return rosters.get(teamId)
  },

  update: (teamId: string, updates: Partial<Roster>): Roster | undefined => {
    const roster = rosters.get(teamId)
    if (!roster) return undefined
    const updated = { ...roster, ...updates }
    rosters.set(teamId, updated)
    return updated
  },
}

// Player operations
export const playerDB = {
  create: (player: Player): Player => {
    players.set(player.id, player)
    return player
  },

  get: (id: string): Player | undefined => {
    return players.get(id)
  },

  getAll: (): Player[] => {
    return Array.from(players.values())
  },

  getByPosition: (position: Player['position']): Player[] => {
    return Array.from(players.values()).filter((p) => p.position === position)
  },

  search: (query: string): Player[] => {
    const lowerQuery = query.toLowerCase()
    return Array.from(players.values()).filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.team.toLowerCase().includes(lowerQuery)
    )
  },
}

// Draft operations
export const draftDB = {
  create: (pick: DraftPick): DraftPick => {
    draftPicks.set(pick.id, pick)
    return pick
  },

  getByLeague: (leagueId: string): DraftPick[] => {
    return Array.from(draftPicks.values())
      .filter((p) => p.leagueId === leagueId)
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        return a.pick - b.pick
      })
  },

  getByTeam: (teamId: string): DraftPick[] => {
    return Array.from(draftPicks.values())
      .filter((p) => p.teamId === teamId)
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        return a.pick - b.pick
      })
  },
}

// Trade operations
export const tradeDB = {
  create: (trade: Trade): Trade => {
    trades.set(trade.id, trade)
    return trade
  },

  get: (id: string): Trade | undefined => {
    return trades.get(id)
  },

  getByLeague: (leagueId: string): Trade[] => {
    return Array.from(trades.values()).filter((t) => t.leagueId === leagueId)
  },

  update: (id: string, updates: Partial<Trade>): Trade | undefined => {
    const trade = trades.get(id)
    if (!trade) return undefined
    const updated = { ...trade, ...updates }
    trades.set(id, updated)
    return updated
  },
}

// Matchup operations
export const matchupDB = {
  create: (matchup: Matchup): Matchup => {
    matchups.set(matchup.id, matchup)
    return matchup
  },

  getByLeague: (leagueId: string, week?: number): Matchup[] => {
    let results = Array.from(matchups.values()).filter(
      (m) => m.leagueId === leagueId
    )
    if (week !== undefined) {
      results = results.filter((m) => m.week === week)
    }
    return results
  },
}

// Initialize sample player data
export function initializeSampleData(sport?: 'football' | 'baseball') {
  if (sport === 'baseball') {
    initializeBaseballPlayers()
  }
}

// Track if baseball players have been loaded from CSV
let baseballPlayersLoaded = false

function initializeBaseballPlayers() {
  // Only load once to avoid duplicates
  if (baseballPlayersLoaded) {
    return
  }

  try {
    // Try to load from CSV first
    const csvPlayers = loadMLBPlayersFromCSV()
    
    if (csvPlayers.length > 0) {
      csvPlayers.forEach((player) => {
        playerDB.create(player)
      })
      baseballPlayersLoaded = true
      return
    }
  } catch (error) {
    console.warn('Could not load players from CSV, falling back to sample data:', error)
  }

  // Fallback to sample data if CSV loading fails
  const samplePlayers: Player[] = [
    // Catchers
    { id: 'b1', name: 'Adley Rutschman', sport: 'baseball', position: 'C', team: 'BAL', projectedPoints: 12.5, adp: 45 },
    { id: 'b2', name: 'J.T. Realmuto', sport: 'baseball', position: 'C', team: 'PHI', projectedPoints: 11.8, adp: 60 },
    { id: 'b3', name: 'Will Smith', sport: 'baseball', position: 'C', team: 'LAD', projectedPoints: 11.5, adp: 55 },
    
    // First Base
    { id: 'b4', name: 'Vladimir Guerrero Jr.', sport: 'baseball', position: '1B', team: 'TOR', projectedPoints: 15.2, adp: 25 },
    { id: 'b5', name: 'Freddie Freeman', sport: 'baseball', position: '1B', team: 'LAD', projectedPoints: 14.8, adp: 20 },
    { id: 'b6', name: 'Pete Alonso', sport: 'baseball', position: '1B', team: 'NYM', projectedPoints: 14.5, adp: 22 },
    
    // Second Base
    { id: 'b7', name: 'Jose Altuve', sport: 'baseball', position: '2B', team: 'HOU', projectedPoints: 13.5, adp: 30 },
    { id: 'b8', name: 'Marcus Semien', sport: 'baseball', position: '2B', team: 'TEX', projectedPoints: 13.2, adp: 35 },
    { id: 'b9', name: 'Ozzie Albies', sport: 'baseball', position: '2B', team: 'ATL', projectedPoints: 12.8, adp: 40 },
    
    // Third Base
    { id: 'b10', name: 'Jose Ramirez', sport: 'baseball', position: '3B', team: 'CLE', projectedPoints: 15.5, adp: 15 },
    { id: 'b11', name: 'Manny Machado', sport: 'baseball', position: '3B', team: 'SD', projectedPoints: 14.2, adp: 28 },
    { id: 'b12', name: 'Rafael Devers', sport: 'baseball', position: '3B', team: 'BOS', projectedPoints: 14.0, adp: 32 },
    
    // Shortstop
    { id: 'b13', name: 'Trea Turner', sport: 'baseball', position: 'SS', team: 'PHI', projectedPoints: 16.2, adp: 8 },
    { id: 'b14', name: 'Bo Bichette', sport: 'baseball', position: 'SS', team: 'TOR', projectedPoints: 15.8, adp: 12 },
    { id: 'b15', name: 'Fernando Tatis Jr.', sport: 'baseball', position: 'SS', team: 'SD', projectedPoints: 15.5, adp: 10 },
    
    // Outfielders
    { id: 'b16', name: 'Ronald Acuna Jr.', sport: 'baseball', position: 'OF', team: 'ATL', projectedPoints: 17.5, adp: 1 },
    { id: 'b17', name: 'Juan Soto', sport: 'baseball', position: 'OF', team: 'NYY', projectedPoints: 16.8, adp: 3 },
    { id: 'b18', name: 'Mookie Betts', sport: 'baseball', position: 'OF', team: 'LAD', projectedPoints: 16.5, adp: 5 },
    { id: 'b19', name: 'Aaron Judge', sport: 'baseball', position: 'OF', team: 'NYY', projectedPoints: 16.2, adp: 4 },
    { id: 'b20', name: 'Mike Trout', sport: 'baseball', position: 'OF', team: 'LAA', projectedPoints: 15.8, adp: 7 },
    { id: 'b21', name: 'Kyle Tucker', sport: 'baseball', position: 'OF', team: 'HOU', projectedPoints: 15.5, adp: 9 },
    { id: 'b22', name: 'Julio Rodriguez', sport: 'baseball', position: 'OF', team: 'SEA', projectedPoints: 15.2, adp: 11 },
    { id: 'b23', name: 'Yordan Alvarez', sport: 'baseball', position: 'OF', team: 'HOU', projectedPoints: 15.0, adp: 13 },
    
    // Starting Pitchers
    { id: 'b24', name: 'Gerrit Cole', sport: 'baseball', position: 'SP', team: 'NYY', projectedPoints: 18.5, adp: 18 },
    { id: 'b25', name: 'Spencer Strider', sport: 'baseball', position: 'SP', team: 'ATL', projectedPoints: 18.2, adp: 16 },
    { id: 'b26', name: 'Corbin Burnes', sport: 'baseball', position: 'SP', team: 'MIL', projectedPoints: 17.8, adp: 19 },
    { id: 'b27', name: 'Jacob deGrom', sport: 'baseball', position: 'SP', team: 'TEX', projectedPoints: 17.5, adp: 21 },
    { id: 'b28', name: 'Shane McClanahan', sport: 'baseball', position: 'SP', team: 'TB', projectedPoints: 17.2, adp: 24 },
    { id: 'b29', name: 'Zac Gallen', sport: 'baseball', position: 'SP', team: 'ARI', projectedPoints: 16.8, adp: 26 },
    
    // Relief Pitchers
    { id: 'b30', name: 'Josh Hader', sport: 'baseball', position: 'RP', team: 'HOU', projectedPoints: 14.5, adp: 50 },
    { id: 'b31', name: 'Emmanuel Clase', sport: 'baseball', position: 'RP', team: 'CLE', projectedPoints: 14.2, adp: 52 },
    { id: 'b32', name: 'Devin Williams', sport: 'baseball', position: 'RP', team: 'MIL', projectedPoints: 13.8, adp: 58 },
  ]

  samplePlayers.forEach((player) => {
    // Add some projected stats for baseball
    if (player.position === 'SP' || player.position === 'RP') {
      player.projectedStats = {
        wins: player.position === 'SP' ? 15 : 0,
        era: player.position === 'SP' ? 3.2 : 2.8,
        whip: player.position === 'SP' ? 1.05 : 0.95,
        strikeouts: player.position === 'SP' ? 200 : 80,
        saves: player.position === 'RP' ? 35 : 0,
      }
    } else {
      player.projectedStats = {
        avg: 0.280,
        hr: 25,
        rbi: 85,
        runs: 90,
        sb: 15,
      }
    }
    playerDB.create(player)
  })
  
  baseballPlayersLoaded = true
}
