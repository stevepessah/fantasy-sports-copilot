// Persistent database layer with in-memory fallback.
// Uses Redis (via REDIS_URL) when configured; falls back to
// in-memory Maps for local dev without Redis.

import { League, Team, Player, Roster, DraftPick, Trade, Matchup } from '@/types'
import Redis from 'ioredis'
import { loadMLBPlayersFromCSV } from './loadPlayersFromCSV'
import { reportError } from '@/lib/errors'

// ── Redis client (lazy, singleton) ──────────────────────────────────────────

let _redis: Redis | null = null
let _redisReady = false

function getRedis(): Redis | null {
  if (_redis) return _redisReady ? _redis : null
  const url = process.env.REDIS_URL
  if (!url) return null
  _redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    lazyConnect: true,
  })
  _redis.on('ready', () => { _redisReady = true })
  _redis.on('error', (err) => { console.warn('[redis] connection error:', err.message) })
  _redis.connect().catch((error) => { reportError(error, { source: 'db.redisConnect' }, 'warning') })
  return null // not ready yet on first call; next call will return it
}

// ── In-memory fallback stores ───────────────────────────────────────────────

const memLeagues: Map<string, League> = new Map()
const memTeams: Map<string, Team> = new Map()
const memRosters: Map<string, Roster> = new Map()
const memPlayers: Map<string, Player> = new Map()
const memDraftPicks: Map<string, DraftPick> = new Map()
const memTrades: Map<string, Trade> = new Map()
const memMatchups: Map<string, Matchup> = new Map()

// ── Generic hash store helpers ──────────────────────────────────────────────
// Each entity type gets a Redis hash: "db:{collection}" with field = id.

async function kvGet<T>(collection: string, id: string, fallback: Map<string, T>): Promise<T | undefined> {
  const redis = getRedis()
  if (!redis) return fallback.get(id)
  try {
    const raw = await redis.hget(`db:${collection}`, id)
    if (raw == null) return fallback.get(id)
    return JSON.parse(raw) as T
  } catch (error) {
    reportError(error, { source: 'db.kvGet', metadata: { collection, id } }, 'warning')
    return fallback.get(id)
  }
}

async function kvSet<T>(collection: string, id: string, value: T, fallback: Map<string, T>): Promise<void> {
  fallback.set(id, value)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.hset(`db:${collection}`, id, JSON.stringify(value))
  } catch (error) { reportError(error, { source: 'db.kvSet', metadata: { collection, id } }, 'warning') }
}

async function kvDel(collection: string, id: string, fallback: Map<string, unknown>): Promise<boolean> {
  const had = fallback.delete(id)
  const redis = getRedis()
  if (!redis) return had
  try {
    const removed = await redis.hdel(`db:${collection}`, id)
    return removed > 0 || had
  } catch (error) {
    reportError(error, { source: 'db.kvDel', metadata: { collection, id } }, 'warning')
    return had
  }
}

async function kvGetAll<T>(collection: string, fallback: Map<string, T>): Promise<T[]> {
  const redis = getRedis()
  if (!redis) return Array.from(fallback.values())
  try {
    const hash = await redis.hgetall(`db:${collection}`)
    if (!hash || Object.keys(hash).length === 0) return Array.from(fallback.values())
    return Object.values(hash).map((v) => JSON.parse(v) as T)
  } catch (error) {
    reportError(error, { source: 'db.kvGetAll', metadata: { collection } }, 'warning')
    return Array.from(fallback.values())
  }
}

// ── League operations ───────────────────────────────────────────────────────

export const leagueDB = {
  async create(league: League): Promise<League> {
    await kvSet('leagues', league.id, league, memLeagues)
    return league
  },

  async get(id: string): Promise<League | undefined> {
    return kvGet('leagues', id, memLeagues)
  },

  async getAll(): Promise<League[]> {
    return kvGetAll('leagues', memLeagues)
  },

  async update(id: string, updates: Partial<League>): Promise<League | undefined> {
    const league = await this.get(id)
    if (!league) return undefined
    const updated = { ...league, ...updates }
    await kvSet('leagues', id, updated, memLeagues)
    return updated
  },

  async delete(id: string): Promise<boolean> {
    return kvDel('leagues', id, memLeagues as Map<string, unknown>)
  },
}

// ── Team operations ─────────────────────────────────────────────────────────

export const teamDB = {
  async create(team: Team): Promise<Team> {
    await kvSet('teams', team.id, team, memTeams)
    return team
  },

  async get(id: string): Promise<Team | undefined> {
    return kvGet('teams', id, memTeams)
  },

  async getByLeague(leagueId: string): Promise<Team[]> {
    const all = await kvGetAll('teams', memTeams)
    return all.filter((t) => t.leagueId === leagueId)
  },

  async update(id: string, updates: Partial<Team>): Promise<Team | undefined> {
    const team = await this.get(id)
    if (!team) return undefined
    const updated = { ...team, ...updates }
    await kvSet('teams', id, updated, memTeams)
    return updated
  },
}

// ── Roster operations ───────────────────────────────────────────────────────

export const rosterDB = {
  async create(roster: Roster): Promise<Roster> {
    await kvSet('rosters', roster.teamId, roster, memRosters)
    return roster
  },

  async get(teamId: string): Promise<Roster | undefined> {
    return kvGet('rosters', teamId, memRosters)
  },

  async update(teamId: string, updates: Partial<Roster>): Promise<Roster | undefined> {
    const roster = await this.get(teamId)
    if (!roster) return undefined
    const updated = { ...roster, ...updates }
    await kvSet('rosters', teamId, updated, memRosters)
    return updated
  },
}

// ── Player operations ───────────────────────────────────────────────────────

export const playerDB = {
  async create(player: Player): Promise<Player> {
    await kvSet('players', player.id, player, memPlayers)
    return player
  },

  async get(id: string): Promise<Player | undefined> {
    return kvGet('players', id, memPlayers)
  },

  async getAll(): Promise<Player[]> {
    return kvGetAll('players', memPlayers)
  },

  async getByPosition(position: Player['position']): Promise<Player[]> {
    const all = await this.getAll()
    return all.filter((p) => p.position === position)
  },

  async search(query: string): Promise<Player[]> {
    const lowerQuery = query.toLowerCase()
    const all = await this.getAll()
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.team.toLowerCase().includes(lowerQuery)
    )
  },
}

// ── Draft operations ────────────────────────────────────────────────────────

export const draftDB = {
  async create(pick: DraftPick): Promise<DraftPick> {
    await kvSet('draftPicks', pick.id, pick, memDraftPicks)
    return pick
  },

  async getByLeague(leagueId: string): Promise<DraftPick[]> {
    const all = await kvGetAll('draftPicks', memDraftPicks)
    return all
      .filter((p) => p.leagueId === leagueId)
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        return a.pick - b.pick
      })
  },

  async getByTeam(teamId: string): Promise<DraftPick[]> {
    const all = await kvGetAll('draftPicks', memDraftPicks)
    return all
      .filter((p) => p.teamId === teamId)
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        return a.pick - b.pick
      })
  },
}

// ── Trade operations ────────────────────────────────────────────────────────

export const tradeDB = {
  async create(trade: Trade): Promise<Trade> {
    await kvSet('trades', trade.id, trade, memTrades)
    return trade
  },

  async get(id: string): Promise<Trade | undefined> {
    return kvGet('trades', id, memTrades)
  },

  async getByLeague(leagueId: string): Promise<Trade[]> {
    const all = await kvGetAll('trades', memTrades)
    return all.filter((t) => t.leagueId === leagueId)
  },

  async update(id: string, updates: Partial<Trade>): Promise<Trade | undefined> {
    const trade = await this.get(id)
    if (!trade) return undefined
    const updated = { ...trade, ...updates }
    await kvSet('trades', id, updated, memTrades)
    return updated
  },
}

// ── Matchup operations ──────────────────────────────────────────────────────

export const matchupDB = {
  async create(matchup: Matchup): Promise<Matchup> {
    await kvSet('matchups', matchup.id, matchup, memMatchups)
    return matchup
  },

  async getByLeague(leagueId: string, week?: number): Promise<Matchup[]> {
    const all = await kvGetAll('matchups', memMatchups)
    let results = all.filter((m) => m.leagueId === leagueId)
    if (week !== undefined) {
      results = results.filter((m) => m.week === week)
    }
    return results
  },
}

// ── Sample data initializer ─────────────────────────────────────────────────

let baseballPlayersLoaded = false

export async function initializeSampleData(sport?: 'football' | 'baseball') {
  if (sport === 'baseball') {
    await initializeBaseballPlayers()
  }
}

async function initializeBaseballPlayers() {
  if (baseballPlayersLoaded) return

  try {
    const csvPlayers = loadMLBPlayersFromCSV()
    if (csvPlayers.length > 0) {
      for (const player of csvPlayers) {
        await playerDB.create(player)
      }
      baseballPlayersLoaded = true
      return
    }
  } catch (error) {
    console.warn('Could not load players from CSV, falling back to sample data:', error)
  }

  const samplePlayers: Player[] = [
    { id: 'b1', name: 'Adley Rutschman', sport: 'baseball', position: 'C', team: 'BAL', projectedPoints: 12.5, adp: 45 },
    { id: 'b2', name: 'J.T. Realmuto', sport: 'baseball', position: 'C', team: 'PHI', projectedPoints: 11.8, adp: 60 },
    { id: 'b3', name: 'Will Smith', sport: 'baseball', position: 'C', team: 'LAD', projectedPoints: 11.5, adp: 55 },
    { id: 'b4', name: 'Vladimir Guerrero Jr.', sport: 'baseball', position: '1B', team: 'TOR', projectedPoints: 15.2, adp: 25 },
    { id: 'b5', name: 'Freddie Freeman', sport: 'baseball', position: '1B', team: 'LAD', projectedPoints: 14.8, adp: 20 },
    { id: 'b6', name: 'Pete Alonso', sport: 'baseball', position: '1B', team: 'NYM', projectedPoints: 14.5, adp: 22 },
    { id: 'b7', name: 'Jose Altuve', sport: 'baseball', position: '2B', team: 'HOU', projectedPoints: 13.5, adp: 30 },
    { id: 'b8', name: 'Marcus Semien', sport: 'baseball', position: '2B', team: 'TEX', projectedPoints: 13.2, adp: 35 },
    { id: 'b9', name: 'Ozzie Albies', sport: 'baseball', position: '2B', team: 'ATL', projectedPoints: 12.8, adp: 40 },
    { id: 'b10', name: 'Jose Ramirez', sport: 'baseball', position: '3B', team: 'CLE', projectedPoints: 15.5, adp: 15 },
    { id: 'b11', name: 'Manny Machado', sport: 'baseball', position: '3B', team: 'SD', projectedPoints: 14.2, adp: 28 },
    { id: 'b12', name: 'Rafael Devers', sport: 'baseball', position: '3B', team: 'BOS', projectedPoints: 14.0, adp: 32 },
    { id: 'b13', name: 'Trea Turner', sport: 'baseball', position: 'SS', team: 'PHI', projectedPoints: 16.2, adp: 8 },
    { id: 'b14', name: 'Bo Bichette', sport: 'baseball', position: 'SS', team: 'TOR', projectedPoints: 15.8, adp: 12 },
    { id: 'b15', name: 'Fernando Tatis Jr.', sport: 'baseball', position: 'SS', team: 'SD', projectedPoints: 15.5, adp: 10 },
    { id: 'b16', name: 'Ronald Acuna Jr.', sport: 'baseball', position: 'OF', team: 'ATL', projectedPoints: 17.5, adp: 1 },
    { id: 'b17', name: 'Juan Soto', sport: 'baseball', position: 'OF', team: 'NYY', projectedPoints: 16.8, adp: 3 },
    { id: 'b18', name: 'Mookie Betts', sport: 'baseball', position: 'OF', team: 'LAD', projectedPoints: 16.5, adp: 5 },
    { id: 'b19', name: 'Aaron Judge', sport: 'baseball', position: 'OF', team: 'NYY', projectedPoints: 16.2, adp: 4 },
    { id: 'b20', name: 'Mike Trout', sport: 'baseball', position: 'OF', team: 'LAA', projectedPoints: 15.8, adp: 7 },
    { id: 'b21', name: 'Kyle Tucker', sport: 'baseball', position: 'OF', team: 'HOU', projectedPoints: 15.5, adp: 9 },
    { id: 'b22', name: 'Julio Rodriguez', sport: 'baseball', position: 'OF', team: 'SEA', projectedPoints: 15.2, adp: 11 },
    { id: 'b23', name: 'Yordan Alvarez', sport: 'baseball', position: 'OF', team: 'HOU', projectedPoints: 15.0, adp: 13 },
    { id: 'b24', name: 'Gerrit Cole', sport: 'baseball', position: 'SP', team: 'NYY', projectedPoints: 18.5, adp: 18 },
    { id: 'b25', name: 'Spencer Strider', sport: 'baseball', position: 'SP', team: 'ATL', projectedPoints: 18.2, adp: 16 },
    { id: 'b26', name: 'Corbin Burnes', sport: 'baseball', position: 'SP', team: 'MIL', projectedPoints: 17.8, adp: 19 },
    { id: 'b27', name: 'Jacob deGrom', sport: 'baseball', position: 'SP', team: 'TEX', projectedPoints: 17.5, adp: 21 },
    { id: 'b28', name: 'Shane McClanahan', sport: 'baseball', position: 'SP', team: 'TB', projectedPoints: 17.2, adp: 24 },
    { id: 'b29', name: 'Zac Gallen', sport: 'baseball', position: 'SP', team: 'ARI', projectedPoints: 16.8, adp: 26 },
    { id: 'b30', name: 'Josh Hader', sport: 'baseball', position: 'RP', team: 'HOU', projectedPoints: 14.5, adp: 50 },
    { id: 'b31', name: 'Emmanuel Clase', sport: 'baseball', position: 'RP', team: 'CLE', projectedPoints: 14.2, adp: 52 },
    { id: 'b32', name: 'Devin Williams', sport: 'baseball', position: 'RP', team: 'MIL', projectedPoints: 13.8, adp: 58 },
  ]

  for (const player of samplePlayers) {
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
    await playerDB.create(player)
  }

  baseballPlayersLoaded = true
}
