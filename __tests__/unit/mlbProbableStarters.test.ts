import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const MOCK_SCHEDULE = {
  dates: [
    {
      games: [
        {
          officialDate: '2026-04-11',
          gameDate: '2026-04-11T18:10:00Z',
          status: { detailedState: 'Scheduled' },
          teams: {
            away: {
              team: { id: 147 },
              probablePitcher: { id: 543037, fullName: 'Gerrit Cole' },
            },
            home: {
              team: { id: 111 },
              probablePitcher: { id: 601713, fullName: 'Brayan Bello' },
            },
          },
        },
      ],
    },
  ],
}

const MOCK_PEOPLE = {
  people: [
    { id: 543037, pitchHand: { code: 'R' } },
    { id: 601713, pitchHand: { code: 'R' } },
  ],
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getTodayMatchups', () => {
  it('includes opposingPitcherFull in matchup data', async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/schedule')) {
        return { ok: true, json: async () => MOCK_SCHEDULE }
      }
      if (url.includes('/people')) {
        return { ok: true, json: async () => MOCK_PEOPLE }
      }
      return { ok: false, json: async () => ({}) }
    })

    const { getTodayMatchups } = await import('@/lib/mlbProbableStarters')
    const matchups = await getTodayMatchups()

    // Away team (NYY, id=147) faces home pitcher Brayan Bello
    const nyyMatchup = matchups.get(147)
    expect(nyyMatchup).toBeDefined()
    expect(nyyMatchup!.opposingPitcher).toBe('B. Bello')
    expect(nyyMatchup!.opposingPitcherFull).toBe('Brayan Bello')

    // Home team (BOS, id=111) faces away pitcher Gerrit Cole
    const bosMatchup = matchups.get(111)
    expect(bosMatchup).toBeDefined()
    expect(bosMatchup!.opposingPitcher).toBe('G. Cole')
    expect(bosMatchup!.opposingPitcherFull).toBe('Gerrit Cole')
  })

  it('sets opposingPitcherFull to undefined when no pitcher announced', async () => {
    const scheduleNoPitcher = {
      dates: [
        {
          games: [
            {
              officialDate: '2026-04-11',
              gameDate: '2026-04-11T18:10:00Z',
              status: { detailedState: 'Scheduled' },
              teams: {
                away: { team: { id: 147 } },
                home: { team: { id: 111 } },
              },
            },
          ],
        },
      ],
    }

    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/schedule')) {
        return { ok: true, json: async () => scheduleNoPitcher }
      }
      if (url.includes('/people')) {
        return { ok: true, json: async () => ({ people: [] }) }
      }
      return { ok: false, json: async () => ({}) }
    })

    const { getTodayMatchups } = await import('@/lib/mlbProbableStarters')
    const matchups = await getTodayMatchups()

    const nyyMatchup = matchups.get(147)
    expect(nyyMatchup).toBeDefined()
    expect(nyyMatchup!.opposingPitcher).toBeUndefined()
    expect(nyyMatchup!.opposingPitcherFull).toBeUndefined()
  })
})
