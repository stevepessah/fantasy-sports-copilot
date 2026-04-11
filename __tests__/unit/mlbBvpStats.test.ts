import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const MOCK_PLAYER_LIST = {
  people: [
    { id: 660271, fullName: 'Shohei Ohtani', currentTeam: { id: 119 } },
    { id: 592450, fullName: 'Aaron Judge', currentTeam: { id: 147 } },
    { id: 664034, fullName: 'Ty France', currentTeam: { id: 136 } },
    { id: 543037, fullName: 'Gerrit Cole', currentTeam: { id: 147 } },
  ],
}

const MOCK_BVP_RESPONSE = {
  stats: [
    {
      splits: [
        {
          stat: {
            atBats: 8,
            hits: 3,
            homeRuns: 1,
            baseOnBalls: 2,
            strikeOuts: 1,
            avg: '.375',
            ops: '1.125',
            rbi: 2,
          },
        },
      ],
    },
  ],
}

const MOCK_BVP_EMPTY = {
  stats: [{ splits: [] }],
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

function mockFetchResponses(responses: Record<string, unknown>) {
  fetchMock.mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    for (const [pattern, body] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return {
          ok: true,
          json: async () => body,
        }
      }
    }
    return { ok: false, json: async () => ({}) }
  })
}

describe('mlbBvpStats', () => {
  it('fetches BvP stats for a batter-pitcher pair', async () => {
    mockFetchResponses({
      '/sports/1/players': MOCK_PLAYER_LIST,
      'stats=vsPlayer': MOCK_BVP_RESPONSE,
    })

    const { getBatterVsPitcherStats } = await import('@/lib/mlbBvpStats')

    const result = await getBatterVsPitcherStats([
      {
        playerKey: 'key1',
        batterName: 'Aaron Judge',
        batterTeam: 'NYY',
        opposingPitcherFullName: 'Shohei Ohtani',
      },
    ])

    expect(result.size).toBe(1)
    const stats = result.get('key1')
    expect(stats).toBeDefined()
    expect(stats!.ab).toBe(8)
    expect(stats!.h).toBe(3)
    expect(stats!.hr).toBe(1)
    expect(stats!.bb).toBe(2)
    expect(stats!.k).toBe(1)
    expect(stats!.avg).toBe('.375')
    expect(stats!.ops).toBe('1.125')
    expect(stats!.rbi).toBe(2)
  })

  it('returns empty map when no batters have opposing pitchers', async () => {
    const { getBatterVsPitcherStats } = await import('@/lib/mlbBvpStats')

    const result = await getBatterVsPitcherStats([
      {
        playerKey: 'key1',
        batterName: 'Aaron Judge',
        batterTeam: 'NYY',
      },
    ])

    expect(result.size).toBe(0)
  })

  it('returns empty map for empty input', async () => {
    const { getBatterVsPitcherStats } = await import('@/lib/mlbBvpStats')

    const result = await getBatterVsPitcherStats([])
    expect(result.size).toBe(0)
  })

  it('handles API returning no splits (no at-bats vs pitcher)', async () => {
    mockFetchResponses({
      '/sports/1/players': MOCK_PLAYER_LIST,
      'stats=vsPlayer': MOCK_BVP_EMPTY,
    })

    const { getBatterVsPitcherStats } = await import('@/lib/mlbBvpStats')

    const result = await getBatterVsPitcherStats([
      {
        playerKey: 'key1',
        batterName: 'Ty France',
        batterTeam: 'SEA',
        opposingPitcherFullName: 'Gerrit Cole',
      },
    ])

    expect(result.size).toBe(0)
  })

  it('handles multiple batters in a batch', async () => {
    mockFetchResponses({
      '/sports/1/players': MOCK_PLAYER_LIST,
      'stats=vsPlayer': MOCK_BVP_RESPONSE,
    })

    const { getBatterVsPitcherStats } = await import('@/lib/mlbBvpStats')

    const result = await getBatterVsPitcherStats([
      {
        playerKey: 'key1',
        batterName: 'Aaron Judge',
        batterTeam: 'NYY',
        opposingPitcherFullName: 'Shohei Ohtani',
      },
      {
        playerKey: 'key2',
        batterName: 'Ty France',
        batterTeam: 'SEA',
        opposingPitcherFullName: 'Gerrit Cole',
      },
    ])

    expect(result.size).toBe(2)
    expect(result.has('key1')).toBe(true)
    expect(result.has('key2')).toBe(true)
  })

  it('skips batters whose names cannot be resolved to MLB IDs', async () => {
    mockFetchResponses({
      '/sports/1/players': MOCK_PLAYER_LIST,
      'stats=vsPlayer': MOCK_BVP_RESPONSE,
    })

    const { getBatterVsPitcherStats } = await import('@/lib/mlbBvpStats')

    const result = await getBatterVsPitcherStats([
      {
        playerKey: 'key1',
        batterName: 'Nonexistent Player',
        batterTeam: 'NYY',
        opposingPitcherFullName: 'Shohei Ohtani',
      },
    ])

    expect(result.size).toBe(0)
  })

  it('handles fetch failures gracefully', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('Network error')
    })

    const { getBatterVsPitcherStats } = await import('@/lib/mlbBvpStats')

    const result = await getBatterVsPitcherStats([
      {
        playerKey: 'key1',
        batterName: 'Aaron Judge',
        batterTeam: 'NYY',
        opposingPitcherFullName: 'Shohei Ohtani',
      },
    ])

    expect(result.size).toBe(0)
  })
})
