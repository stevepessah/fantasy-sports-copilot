import { describe, it, expect } from 'vitest'
import {
  parseLeaguesXML,
  parseTeamsXML,
  parseRosterXML,
  parseStandingsXML,
  parseScoreboardXML,
  parseLeagueSettingsXML,
  parseDraftResultsXML,
  parsePlayerStatsXML,
  parseGamesXML,
} from '@/lib/yahoo/xmlParser'

// ═══════════════════════════════════════════════════════════════════════════
// parseLeaguesXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseLeaguesXML', () => {
  const sampleXML = `
    <fantasy_content>
      <league>
        <league_key>422.l.12345</league_key>
        <league_id>12345</league_id>
        <name>Test League</name>
        <url>https://yahoo.com/league/12345</url>
        <num_teams>12</num_teams>
        <scoring_type>head</scoring_type>
        <league_type>private</league_type>
        <season>2025</season>
        <game_code>mlb</game_code>
        <draft_status>postdraft</draft_status>
        <current_week>5</current_week>
        <start_week>1</start_week>
        <end_week>24</end_week>
        <start_date>2025-03-27</start_date>
        <end_date>2025-09-28</end_date>
      </league>
    </fantasy_content>`

  it('parses a single league correctly', () => {
    const leagues = parseLeaguesXML(sampleXML)
    expect(leagues).toHaveLength(1)
    expect(leagues[0]).toMatchObject({
      league_key: '422.l.12345',
      league_id: '12345',
      name: 'Test League',
      num_teams: 12,
      scoring_type: 'head',
      season: '2025',
      game_code: 'mlb',
      draft_status: 'postdraft',
      current_week: '5',
      start_week: '1',
      end_week: '24',
    })
  })

  it('parses multiple leagues', () => {
    const xml = `
      <fantasy_content>
        <league><league_key>1.l.1</league_key><league_id>1</league_id><name>League A</name><url>/</url><num_teams>10</num_teams><scoring_type>roto</scoring_type><league_type>public</league_type><season>2025</season><game_code>mlb</game_code><draft_status>predraft</draft_status></league>
        <league><league_key>1.l.2</league_key><league_id>2</league_id><name>League B</name><url>/</url><num_teams>8</num_teams><scoring_type>head</scoring_type><league_type>private</league_type><season>2025</season><game_code>mlb</game_code><draft_status>postdraft</draft_status></league>
      </fantasy_content>`
    const leagues = parseLeaguesXML(xml)
    expect(leagues).toHaveLength(2)
    expect(leagues[0].name).toBe('League A')
    expect(leagues[1].name).toBe('League B')
  })

  it('returns empty array for XML with no leagues', () => {
    expect(parseLeaguesXML('<fantasy_content></fantasy_content>')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseLeaguesXML('')).toEqual([])
  })

  it('skips leagues without league_key', () => {
    const xml = `<league><league_id>1</league_id><name>No Key</name></league>`
    expect(parseLeaguesXML(xml)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseTeamsXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseTeamsXML', () => {
  const sampleXML = `
    <fantasy_content>
      <team>
        <team_key>422.l.12345.t.1</team_key>
        <team_id>1</team_id>
        <name>Test Team</name>
        <url>https://yahoo.com/team/1</url>
        <logo_url>https://yahoo.com/logo.png</logo_url>
        <managers>
          <manager>
            <manager_id>1</manager_id>
            <nickname>Steve</nickname>
            <guid>abc123</guid>
            <is_commissioner>1</is_commissioner>
            <is_current_login>1</is_current_login>
          </manager>
        </managers>
      </team>
    </fantasy_content>`

  it('parses team with manager info', () => {
    const teams = parseTeamsXML(sampleXML)
    expect(teams).toHaveLength(1)
    expect(teams[0].team_key).toBe('422.l.12345.t.1')
    expect(teams[0].name).toBe('Test Team')
    expect(teams[0].managers).toHaveLength(1)
    expect(teams[0].managers![0]).toMatchObject({
      manager_id: '1',
      nickname: 'Steve',
      guid: 'abc123',
      is_commissioner: '1',
      is_current_login: '1',
    })
  })

  it('returns empty array for no teams', () => {
    expect(parseTeamsXML('')).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseRosterXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseRosterXML', () => {
  const sampleXML = `
    <roster>
      <player>
        <player_key>422.p.10001</player_key>
        <player_id>10001</player_id>
        <name>
          <full>Mike Trout</full>
          <first>Mike</first>
          <last>Trout</last>
          <ascii_first>Mike</ascii_first>
          <ascii_last>Trout</ascii_last>
        </name>
        <position_type>B</position_type>
        <display_position>CF</display_position>
        <eligible_positions>
          <position>CF</position>
          <position>OF</position>
          <position>UTIL</position>
        </eligible_positions>
        <selected_position>
          <position>OF</position>
        </selected_position>
        <editorial_team_abbr>LAA</editorial_team_abbr>
        <editorial_team_full_name>Los Angeles Angels</editorial_team_full_name>
        <status>DTD</status>
        <uniform_number>27</uniform_number>
      </player>
    </roster>`

  it('parses a roster player correctly', () => {
    const players = parseRosterXML(sampleXML)
    expect(players).toHaveLength(1)

    const p = players[0]
    expect(p.player_key).toBe('422.p.10001')
    expect(p.name.full).toBe('Mike Trout')
    expect(p.name.first).toBe('Mike')
    expect(p.name.last).toBe('Trout')
    expect(p.position_type).toBe('B')
    expect(p.display_position).toBe('CF')
    expect(p.eligible_positions).toEqual(['CF', 'OF', 'UTIL'])
    expect(p.selected_position.position).toBe('OF')
    expect(p.editorial_team_abbr).toBe('LAA')
    expect(p.status).toBe('DTD')
    expect(p.uniform_number).toBe('27')
  })

  it('parses player with stats', () => {
    const xml = `
      <roster>
        <player>
          <player_key>422.p.10002</player_key>
          <player_id>10002</player_id>
          <name><full>Aaron Judge</full><first>Aaron</first><last>Judge</last></name>
          <position_type>B</position_type>
          <eligible_positions><position>OF</position></eligible_positions>
          <selected_position><position>OF</position></selected_position>
          <player_stats>
            <stat><stat_id>12</stat_id><value>45</value></stat>
            <stat><stat_id>3</stat_id><value>.310</value></stat>
          </player_stats>
        </player>
      </roster>`
    const players = parseRosterXML(xml)
    expect(players[0].player_stats).toEqual({ '12': 45, '3': 0.31 })
  })

  it('parses player with ownership data', () => {
    const xml = `
      <roster>
        <player>
          <player_key>422.p.10003</player_key>
          <player_id>10003</player_id>
          <name><full>Juan Soto</full><first>Juan</first><last>Soto</last></name>
          <position_type>B</position_type>
          <eligible_positions><position>OF</position></eligible_positions>
          <selected_position><position>OF</position></selected_position>
          <ownership>
            <ownership_type>team</ownership_type>
            <owner_team_key>422.l.12345.t.3</owner_team_key>
            <owner_team_name>Sluggers</owner_team_name>
          </ownership>
        </player>
      </roster>`
    const players = parseRosterXML(xml)
    expect(players[0].ownership_type).toBe('team')
    expect(players[0].owner_team_key).toBe('422.l.12345.t.3')
    expect(players[0].owner_team_name).toBe('Sluggers')
  })

  it('returns empty for no players', () => {
    expect(parseRosterXML('')).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseGamesXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseGamesXML', () => {
  it('parses game entries', () => {
    const xml = `
      <fantasy_content>
        <game>
          <game_key>422</game_key>
          <game_id>422</game_id>
          <name>Baseball</name>
          <code>mlb</code>
          <season>2025</season>
        </game>
      </fantasy_content>`
    const games = parseGamesXML(xml)
    expect(games).toHaveLength(1)
    expect(games[0]).toEqual({
      game_key: '422',
      game_id: '422',
      name: 'Baseball',
      code: 'mlb',
      season: '2025',
    })
  })

  it('returns empty for missing fields', () => {
    const xml = `<game><game_key>1</game_key></game>`
    expect(parseGamesXML(xml)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseStandingsXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseStandingsXML', () => {
  it('parses standings with records and ranks', () => {
    const xml = `
      <standings>
        <team>
          <team_key>422.l.12345.t.1</team_key>
          <team_id>1</team_id>
          <name>First Place</name>
          <url>/team/1</url>
          <team_standings>
            <rank>1</rank>
            <outcome_totals>
              <wins>50</wins>
              <losses>30</losses>
              <ties>5</ties>
              <percentage>.625</percentage>
            </outcome_totals>
            <games_back>-</games_back>
            <streak><type>win</type><value>5</value></streak>
            <playoff_seed>1</playoff_seed>
          </team_standings>
          <waiver_priority>10</waiver_priority>
          <number_of_moves>15</number_of_moves>
          <number_of_trades>2</number_of_trades>
        </team>
        <team>
          <team_key>422.l.12345.t.2</team_key>
          <team_id>2</team_id>
          <name>Second Place</name>
          <url>/team/2</url>
          <team_standings>
            <rank>2</rank>
            <outcome_totals>
              <wins>45</wins>
              <losses>35</losses>
              <ties>5</ties>
              <percentage>.563</percentage>
            </outcome_totals>
            <games_back>5</games_back>
          </team_standings>
        </team>
      </standings>`

    const teams = parseStandingsXML(xml)
    expect(teams).toHaveLength(2)

    expect(teams[0]).toMatchObject({
      team_key: '422.l.12345.t.1',
      name: 'First Place',
      rank: 1,
      wins: 50,
      losses: 30,
      ties: 5,
      percentage: '.625',
      waiver_priority: 10,
      number_of_moves: 15,
      number_of_trades: 2,
    })
    expect(teams[0].streak).toEqual({ type: 'win', value: 5 })
    expect(teams[0].playoff_seed).toBe(1)

    expect(teams[1].rank).toBe(2)
    expect(teams[1].games_back).toBe('5')
  })

  it('sorts teams by rank', () => {
    const xml = `
      <standings>
        <team><team_key>t.3</team_key><team_id>3</team_id><name>C</name><url>/</url><team_standings><rank>3</rank><outcome_totals><wins>0</wins><losses>0</losses><ties>0</ties><percentage>.000</percentage></outcome_totals></team_standings></team>
        <team><team_key>t.1</team_key><team_id>1</team_id><name>A</name><url>/</url><team_standings><rank>1</rank><outcome_totals><wins>0</wins><losses>0</losses><ties>0</ties><percentage>.000</percentage></outcome_totals></team_standings></team>
        <team><team_key>t.2</team_key><team_id>2</team_id><name>B</name><url>/</url><team_standings><rank>2</rank><outcome_totals><wins>0</wins><losses>0</losses><ties>0</ties><percentage>.000</percentage></outcome_totals></team_standings></team>
      </standings>`
    const teams = parseStandingsXML(xml)
    expect(teams.map((t) => t.rank)).toEqual([1, 2, 3])
  })

  it('returns empty for no teams', () => {
    expect(parseStandingsXML('')).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseScoreboardXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseScoreboardXML', () => {
  it('parses a matchup with two teams', () => {
    const xml = `
      <fantasy_content>
        <league>
          <league_key>422.l.12345</league_key>
          <scoreboard>
            <week>5</week>
            <matchup>
              <week>5</week>
              <week_start>2025-04-28</week_start>
              <week_end>2025-05-04</week_end>
              <status>midevent</status>
              <is_tied>0</is_tied>
              <team>
                <team_key>422.l.12345.t.1</team_key>
                <team_id>1</team_id>
                <name>Team Alpha</name>
                <team_points><total>85.5</total></team_points>
              </team>
              <team>
                <team_key>422.l.12345.t.2</team_key>
                <team_id>2</team_id>
                <name>Team Beta</name>
                <team_points><total>72.3</total></team_points>
              </team>
            </matchup>
          </scoreboard>
        </league>
      </fantasy_content>`

    const scoreboard = parseScoreboardXML(xml)
    expect(scoreboard.league_key).toBe('422.l.12345')
    expect(scoreboard.week).toBe(5)
    expect(scoreboard.matchups).toHaveLength(1)

    const m = scoreboard.matchups[0]
    expect(m.week).toBe(5)
    expect(m.status).toBe('midevent')
    expect(m.teams).toHaveLength(2)
    expect(m.teams[0].name).toBe('Team Alpha')
    expect(m.teams[0].points).toBe(85.5)
    expect(m.teams[1].name).toBe('Team Beta')
    expect(m.teams[1].points).toBe(72.3)
  })

  it('parses matchup with category stats', () => {
    const xml = `
      <scoreboard>
        <week>3</week>
        <matchup>
          <week>3</week>
          <status>postevent</status>
          <winner_team_key>t.1</winner_team_key>
          <team>
            <team_key>t.1</team_key>
            <team_id>1</team_id>
            <name>A</name>
            <team_stats>
              <stat><stat_id>7</stat_id><value>25</value></stat>
              <stat><stat_id>12</stat_id><value>8</value></stat>
            </team_stats>
          </team>
          <team>
            <team_key>t.2</team_key>
            <team_id>2</team_id>
            <name>B</name>
            <team_stats>
              <stat><stat_id>7</stat_id><value>20</value></stat>
              <stat><stat_id>12</stat_id><value>6</value></stat>
            </team_stats>
          </team>
        </matchup>
      </scoreboard>`
    const sb = parseScoreboardXML(xml)
    expect(sb.matchups[0].winner_team_key).toBe('t.1')
    expect(sb.matchups[0].teams[0].stats).toEqual({ '7': 25, '12': 8 })
    expect(sb.matchups[0].teams[1].stats).toEqual({ '7': 20, '12': 6 })
  })

  it('returns zero-week scoreboard for empty XML', () => {
    const sb = parseScoreboardXML('')
    expect(sb.matchups).toEqual([])
    expect(sb.week).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseLeagueSettingsXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseLeagueSettingsXML', () => {
  it('parses stat categories and roster positions', () => {
    const xml = `
      <settings>
        <scoring_type>head</scoring_type>
        <draft_type>live</draft_type>
        <max_teams>12</max_teams>
        <num_playoff_teams>6</num_playoff_teams>
        <stat_categories>
          <stat>
            <stat_id>7</stat_id>
            <name>Runs</name>
            <display_name>R</display_name>
            <position_type>B</position_type>
            <sort_order>1</sort_order>
          </stat>
          <stat>
            <stat_id>26</stat_id>
            <name>Earned Run Average</name>
            <display_name>ERA</display_name>
            <position_type>P</position_type>
            <sort_order>0</sort_order>
          </stat>
        </stat_categories>
        <roster_positions>
          <roster_position>
            <position>C</position>
            <position_type>B</position_type>
            <count>1</count>
          </roster_position>
          <roster_position>
            <position>SP</position>
            <position_type>P</position_type>
            <count>2</count>
          </roster_position>
          <roster_position>
            <position>BN</position>
            <count>5</count>
          </roster_position>
        </roster_positions>
      </settings>`

    const settings = parseLeagueSettingsXML(xml)
    expect(settings.scoringType).toBe('head')
    expect(settings.draftType).toBe('live')
    expect(settings.maxTeams).toBe(12)
    expect(settings.numPlayoffTeams).toBe(6)

    expect(settings.statCategories).toHaveLength(2)
    expect(settings.statCategories[0]).toMatchObject({
      statId: '7',
      name: 'Runs',
      displayName: 'R',
      positionType: 'B',
      sortOrder: '1',
    })
    expect(settings.statCategories[1].positionType).toBe('P')
    expect(settings.statCategories[1].sortOrder).toBe('0')

    expect(settings.rosterPositions).toHaveLength(3)
    expect(settings.rosterPositions[0]).toMatchObject({ position: 'C', count: 1 })
    expect(settings.rosterPositions[1]).toMatchObject({ position: 'SP', count: 2 })
    expect(settings.rosterPositions[2]).toMatchObject({ position: 'BN', count: 5 })
  })

  it('returns empty arrays for minimal XML', () => {
    const settings = parseLeagueSettingsXML('')
    expect(settings.statCategories).toEqual([])
    expect(settings.rosterPositions).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseDraftResultsXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parseDraftResultsXML', () => {
  it('parses draft picks with player data', () => {
    const xml = `
      <fantasy_content>
        <league>
          <league_key>422.l.12345</league_key>
          <draft_result>
            <pick>1</pick>
            <round>1</round>
            <team_key>422.l.12345.t.3</team_key>
            <player_key>422.p.10001</player_key>
            <player>
              <player_key>422.p.10001</player_key>
              <player_id>10001</player_id>
              <name><full>Ronald Acuna Jr.</full><first>Ronald</first><last>Acuna Jr.</last></name>
              <editorial_team_abbr>ATL</editorial_team_abbr>
              <display_position>OF</display_position>
            </player>
          </draft_result>
          <draft_result>
            <pick>2</pick>
            <round>1</round>
            <team_key>422.l.12345.t.7</team_key>
            <player_key>422.p.10002</player_key>
          </draft_result>
        </league>
      </fantasy_content>`

    const results = parseDraftResultsXML(xml)
    expect(results.league_key).toBe('422.l.12345')
    expect(results.picks).toHaveLength(2)

    expect(results.picks[0]).toMatchObject({
      pick: 1,
      round: 1,
      team_key: '422.l.12345.t.3',
      player_key: '422.p.10001',
    })
    expect(results.picks[0].player?.name.full).toBe('Ronald Acuna Jr.')
    expect(results.picks[0].player?.editorial_team_abbr).toBe('ATL')

    expect(results.picks[1].pick).toBe(2)
    expect(results.picks[1].player).toBeUndefined()
  })

  it('sorts picks by pick number', () => {
    const xml = `
      <draft_result><pick>3</pick><round>1</round><team_key>t.3</team_key><player_key>p.3</player_key></draft_result>
      <draft_result><pick>1</pick><round>1</round><team_key>t.1</team_key><player_key>p.1</player_key></draft_result>
      <draft_result><pick>2</pick><round>1</round><team_key>t.2</team_key><player_key>p.2</player_key></draft_result>`
    const results = parseDraftResultsXML(xml)
    expect(results.picks.map((p) => p.pick)).toEqual([1, 2, 3])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parsePlayerStatsXML
// ═══════════════════════════════════════════════════════════════════════════

describe('parsePlayerStatsXML', () => {
  it('parses player with season stats', () => {
    const xml = `
      <fantasy_content>
        <player>
          <player_key>422.p.10001</player_key>
          <player_id>10001</player_id>
          <name><full>Mike Trout</full><first>Mike</first><last>Trout</last></name>
          <position_type>B</position_type>
          <display_position>CF,OF</display_position>
          <editorial_team_abbr>LAA</editorial_team_abbr>
          <eligible_positions><position>CF</position><position>OF</position></eligible_positions>
          <player_stats>
            <coverage_type>season</coverage_type>
            <stat><stat_id>7</stat_id><value>80</value></stat>
            <stat><stat_id>12</stat_id><value>35</value></stat>
            <stat><stat_id>3</stat_id><value>.280</value></stat>
          </player_stats>
        </player>
      </fantasy_content>`

    const stats = parsePlayerStatsXML(xml)
    expect(stats).not.toBeNull()
    expect(stats!.player_key).toBe('422.p.10001')
    expect(stats!.name?.full).toBe('Mike Trout')
    expect(stats!.position_type).toBe('B')
    expect(stats!.display_position).toBe('CF,OF')
    expect(stats!.editorial_team_abbr).toBe('LAA')
    expect(stats!.eligible_positions).toEqual(['CF', 'OF'])
    expect(stats!.season_stats?.['7']).toBe(80)
    expect(stats!.season_stats?.['12']).toBe(35)
    expect(stats!.season_stats?.['3']).toBe(0.28)
  })

  it('returns null for XML with no player', () => {
    expect(parsePlayerStatsXML('<fantasy_content></fantasy_content>')).toBeNull()
    expect(parsePlayerStatsXML('')).toBeNull()
  })
})
