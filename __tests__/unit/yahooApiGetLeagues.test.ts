import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YahooOAuth2 } from '@/lib/yahoo/oauth2'
import { YahooFantasyAPI } from '@/lib/yahoo/api'

/**
 * These tests pin down the league-discovery behavior that broke real users:
 * the API must query Yahoo by game CODE (so Yahoo resolves the current season)
 * rather than a hardcoded numeric game id, and must fall back to an all-seasons
 * query when the current-season lookup is empty.
 */

function leagueXML(leagueKey: string, name: string, season: string) {
  return `
    <league>
      <league_key>${leagueKey}</league_key>
      <league_id>${leagueKey.split('.').pop()}</league_id>
      <name>${name}</name>
      <url>https://yahoo.com/${leagueKey}</url>
      <num_teams>12</num_teams>
      <scoring_type>head</scoring_type>
      <league_type>private</league_type>
      <season>${season}</season>
      <game_code>mlb</game_code>
      <draft_status>postdraft</draft_status>
    </league>`
}

describe('YahooFantasyAPI.getLeagues', () => {
  let requests: string[]

  beforeEach(() => {
    // getLeagues -> YahooOAuth2 constructor requires credentials
    process.env.YAHOO_CONSUMER_KEY = 'test_key'
    process.env.YAHOO_CONSUMER_SECRET = 'test_secret'
    requests = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockYahoo(responder: (endpoint: string) => string) {
    vi.spyOn(YahooOAuth2.prototype, 'makeRequest').mockImplementation(
      async (_method: string, endpoint: string) => {
        requests.push(endpoint)
        return { raw: `<fantasy_content>${responder(endpoint)}</fantasy_content>` }
      },
    )
  }

  it('queries by game CODE (not a hardcoded numeric id) for a sport alias', async () => {
    mockYahoo(() => leagueXML('469.l.111', 'Current League', '2026'))

    const api = new YahooFantasyAPI()
    api.setAccessToken('token')
    const { leagues } = await api.getLeagues('mlb')

    expect(requests).toHaveLength(1)
    expect(requests[0]).toBe('/users;use_login=1/games;game_keys=mlb/leagues')
    expect(requests[0]).not.toContain('469')
    expect(leagues).toHaveLength(1)
    expect(leagues[0].league_key).toBe('469.l.111')
  })

  it('maps "baseball"/"football" aliases to Yahoo game codes', async () => {
    mockYahoo(() => leagueXML('469.l.1', 'L', '2026'))

    const api = new YahooFantasyAPI()
    api.setAccessToken('token')

    await api.getLeagues('baseball')
    await api.getLeagues('football')

    expect(requests[0]).toBe('/users;use_login=1/games;game_keys=mlb/leagues')
    expect(requests[1]).toBe('/users;use_login=1/games;game_keys=nfl/leagues')
  })

  it('falls back to an all-seasons game_codes query when the current season is empty', async () => {
    mockYahoo((endpoint) => {
      // Current-season query returns no leagues...
      if (endpoint.includes('game_keys=mlb')) return ''
      // ...but the all-seasons query for the sport surfaces the league.
      if (endpoint.includes('game_codes=mlb')) return leagueXML('469.l.222', 'Keeper League', '2026')
      return ''
    })

    const api = new YahooFantasyAPI()
    api.setAccessToken('token')
    const { leagues } = await api.getLeagues('mlb')

    expect(requests).toEqual([
      '/users;use_login=1/games;game_keys=mlb/leagues',
      '/users;use_login=1/games;game_codes=mlb/leagues',
    ])
    expect(leagues).toHaveLength(1)
    expect(leagues[0].league_key).toBe('469.l.222')
  })

  it('does not run the fallback for explicit numeric (past-season) game ids', async () => {
    mockYahoo(() => '') // no leagues for this past season

    const api = new YahooFantasyAPI()
    api.setAccessToken('token')
    const { leagues } = await api.getLeagues('458')

    expect(requests).toEqual(['/users;use_login=1/games;game_keys=458/leagues'])
    expect(leagues).toEqual([])
  })

  it('queries every game for "all"', async () => {
    mockYahoo(() => leagueXML('458.l.9', 'Old League', '2025'))

    const api = new YahooFantasyAPI()
    api.setAccessToken('token')
    await api.getLeagues('all')

    expect(requests).toEqual(['/users;use_login=1/games/leagues'])
  })

  it('throws when no access token is set', async () => {
    const api = new YahooFantasyAPI()
    await expect(api.getLeagues('mlb')).rejects.toThrow('Access token not set')
  })
})
