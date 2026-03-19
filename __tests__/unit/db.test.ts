import { describe, it, expect, beforeEach, vi } from 'vitest'

// Force the in-memory fallback path by ensuring REDIS_URL is unset
vi.stubEnv('REDIS_URL', '')

// Must import AFTER env stub so the module sees no REDIS_URL
const { leagueDB, teamDB, rosterDB, playerDB, draftDB, tradeDB, matchupDB } = await import('@/lib/db')

const sampleLeague = () => ({
  id: `lg_${Date.now()}`,
  name: 'Test League',
  commissionerId: 'user1',
  sport: 'baseball' as const,
  type: 'redraft' as const,
  numTeams: 12,
  scoringType: 'roto' as const,
  draftType: 'snake' as const,
  status: 'active' as const,
  createdAt: new Date().toISOString(),
})

// ═══════════════════════════════════════════════════════════════════════════
// leagueDB
// ═══════════════════════════════════════════════════════════════════════════

describe('leagueDB', () => {
  it('creates and retrieves a league', async () => {
    const league = sampleLeague()
    await leagueDB.create(league)
    const fetched = await leagueDB.get(league.id)
    expect(fetched).toMatchObject({ id: league.id, name: 'Test League' })
  })

  it('returns undefined for non-existent league', async () => {
    expect(await leagueDB.get('no-such-id')).toBeUndefined()
  })

  it('lists all leagues', async () => {
    const l1 = sampleLeague()
    const l2 = { ...sampleLeague(), id: `lg_other_${Date.now()}` }
    await leagueDB.create(l1)
    await leagueDB.create(l2)
    const all = await leagueDB.getAll()
    expect(all.length).toBeGreaterThanOrEqual(2)
  })

  it('updates a league', async () => {
    const league = sampleLeague()
    await leagueDB.create(league)
    const updated = await leagueDB.update(league.id, { name: 'Renamed' })
    expect(updated?.name).toBe('Renamed')
    expect((await leagueDB.get(league.id))?.name).toBe('Renamed')
  })

  it('update returns undefined for non-existent league', async () => {
    expect(await leagueDB.update('ghost', { name: 'x' })).toBeUndefined()
  })

  it('deletes a league', async () => {
    const league = sampleLeague()
    await leagueDB.create(league)
    const deleted = await leagueDB.delete(league.id)
    expect(deleted).toBe(true)
    expect(await leagueDB.get(league.id)).toBeUndefined()
  })

  it('delete returns false for non-existent league', async () => {
    expect(await leagueDB.delete('never-existed')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// teamDB
// ═══════════════════════════════════════════════════════════════════════════

describe('teamDB', () => {
  it('creates and retrieves a team', async () => {
    const team = {
      id: 't1', leagueId: 'lg1', ownerId: 'u1', name: 'Sluggers',
      draftPosition: 1, wins: 10, losses: 5, ties: 0, pointsFor: 500, pointsAgainst: 400,
    }
    await teamDB.create(team)
    expect((await teamDB.get('t1'))?.name).toBe('Sluggers')
  })

  it('filters teams by league', async () => {
    await teamDB.create({
      id: 't_a', leagueId: 'lgA', ownerId: 'u1', name: 'A',
      draftPosition: 1, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
    })
    await teamDB.create({
      id: 't_b', leagueId: 'lgB', ownerId: 'u2', name: 'B',
      draftPosition: 1, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
    })
    const lgATeams = await teamDB.getByLeague('lgA')
    expect(lgATeams.every((t) => t.leagueId === 'lgA')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// playerDB
// ═══════════════════════════════════════════════════════════════════════════

describe('playerDB', () => {
  it('creates and searches players', async () => {
    await playerDB.create({
      id: 'p1', name: 'Mike Trout', sport: 'baseball', position: 'OF', team: 'LAA',
    })
    const results = await playerDB.search('Trout')
    expect(results.some((p) => p.name === 'Mike Trout')).toBe(true)
  })

  it('filters by position', async () => {
    await playerDB.create({
      id: 'p_sp1', name: 'Gerrit Cole', sport: 'baseball', position: 'SP', team: 'NYY',
    })
    const pitchers = await playerDB.getByPosition('SP')
    expect(pitchers.some((p) => p.name === 'Gerrit Cole')).toBe(true)
  })

  it('search is case-insensitive', async () => {
    await playerDB.create({
      id: 'p_ci', name: 'Aaron Judge', sport: 'baseball', position: 'OF', team: 'NYY',
    })
    const results = await playerDB.search('aaron judge')
    expect(results.some((p) => p.name === 'Aaron Judge')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// tradeDB
// ═══════════════════════════════════════════════════════════════════════════

describe('tradeDB', () => {
  it('creates, retrieves, and updates a trade', async () => {
    const trade = {
      id: 'tr1', leagueId: 'lg1', team1Id: 't1', team2Id: 't2',
      player1Id: 'p1', player2Id: 'p2', status: 'pending' as const,
      proposedAt: new Date().toISOString(),
    }
    await tradeDB.create(trade)
    expect((await tradeDB.get('tr1'))?.status).toBe('pending')

    const updated = await tradeDB.update('tr1', { status: 'accepted' })
    expect(updated?.status).toBe('accepted')
  })

  it('filters trades by league', async () => {
    await tradeDB.create({
      id: 'tr_x', leagueId: 'lgX', team1Id: 't1', team2Id: 't2',
      player1Id: 'p1', player2Id: 'p2', status: 'pending',
      proposedAt: new Date().toISOString(),
    })
    const lgXTrades = await tradeDB.getByLeague('lgX')
    expect(lgXTrades.every((t) => t.leagueId === 'lgX')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// matchupDB
// ═══════════════════════════════════════════════════════════════════════════

describe('matchupDB', () => {
  it('creates matchups and filters by league/week', async () => {
    await matchupDB.create({
      id: 'm1', leagueId: 'lg1', week: 5, team1Id: 't1', team2Id: 't2',
      team1Score: 80, team2Score: 75, status: 'completed',
    })
    await matchupDB.create({
      id: 'm2', leagueId: 'lg1', week: 6, team1Id: 't1', team2Id: 't3',
      team1Score: 0, team2Score: 0, status: 'upcoming',
    })
    const week5 = await matchupDB.getByLeague('lg1', 5)
    expect(week5).toHaveLength(1)
    expect(week5[0].week).toBe(5)

    const allLg1 = await matchupDB.getByLeague('lg1')
    expect(allLg1.length).toBeGreaterThanOrEqual(2)
  })
})
