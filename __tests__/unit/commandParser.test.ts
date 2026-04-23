import { describe, it, expect } from 'vitest'
import { parseIntent, findPlayerByNameApprox } from '@/lib/commandParser'

// ── Helper: assert exactly one intent flag is true ──────────────────────────

function activeIntents(result: ReturnType<typeof parseIntent>): string[] {
  const flags = [
    'isHelp', 'isSetLineup', 'isShowLineup', 'isMatchup', 'isWaivers',
    'isAddDrop', 'isTrade', 'isDraft', 'isPlayerLookup', 'isCompare',
    'isViewTeams', 'isShowBatters', 'isShowPitchers', 'isLeagueSettings',
    'isArchetypeQuery',
  ] as const
  return flags.filter((f) => result[f])
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY / EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — edge cases', () => {
  it('returns all-false intent for empty string', () => {
    const r = parseIntent('')
    expect(activeIntents(r)).toEqual([])
  })

  it('returns all-false intent for whitespace-only', () => {
    const r = parseIntent('   ')
    expect(activeIntents(r)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HELP
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — help', () => {
  it.each([
    'help',
    '/help',
    'what can you do',
    'how do you work',
    'what do you do',
    'capabilities',
    'commands',
    'features',
  ])('recognizes help intent: "%s"', (msg) => {
    expect(parseIntent(msg).isHelp).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SET LINEUP
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — set lineup', () => {
  it.each([
    'set my lineup',
    'optimize my lineup',
    'optimise my roster',
    'lock in my lineup',
    'who should i start',
    'who should I play',
    'who should i sit',
    'who do i start',
    'who to start',
    'who goes in',
    '/lineup',
    'set my best lineup',
    'fix my roster',
    'adjust my starters',
    'configure my lineup',
  ])('recognizes set-lineup intent: "%s"', (msg) => {
    expect(parseIntent(msg).isSetLineup).toBe(true)
  })

  it('does not fire for "show my lineup"', () => {
    expect(parseIntent('show my lineup').isSetLineup).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SHOW LINEUP
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — show lineup', () => {
  it.each([
    'show my lineup',
    'view my roster',
    'see my starters',
    'pull up my lineup',
    'bring up my roster',
    'my lineup',
    'current lineup',
    'lineup',
    'roster',
    'my roster',
    'check my lineup',
    'display my lineup',
  ])('recognizes show-lineup intent: "%s"', (msg) => {
    expect(parseIntent(msg).isShowLineup).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MATCHUP
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — matchup', () => {
  it.each([
    'show my matchup',
    'who am i playing',
    'who am i facing',
    'who am i up against',
    'my opponent',
    'matchup analysis',
    'matchup preview',
    'weekly matchup',
    'playing against',
  ])('recognizes matchup intent: "%s"', (msg) => {
    expect(parseIntent(msg).isMatchup).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// WAIVERS
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — waivers', () => {
  it.each([
    'show me waivers',
    'waiver wire',
    'free agents',
    'who should i pick up',
    'who should i add',
    'who should i grab',
    'best available',
    "who's available",
    'whos available',
    'available players',
    '/waivers',
    'pick up someone',
  ])('recognizes waivers intent: "%s"', (msg) => {
    expect(parseIntent(msg).isWaivers).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ADD / DROP
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — add/drop', () => {
  it.each([
    'add Mike Trout',
    'drop Aaron Judge',
    'drop Judge for Trout',
    'swap for Ohtani',
    'replace with Soto',
    'swap out Realmuto',
  ])('recognizes add/drop intent: "%s"', (msg) => {
    expect(parseIntent(msg).isAddDrop).toBe(true)
  })

  it('extracts drop player name', () => {
    const r = parseIntent('drop Aaron Judge for Mike Trout')
    expect(r.dropPlayer).toContain('aaron judge')
  })

  it('extracts add player name from drop-for', () => {
    const r = parseIntent('drop Aaron Judge for Mike Trout')
    expect(r.addPlayer).toContain('mike trout')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// TRADE
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — trade', () => {
  it.each([
    'propose a trade',
    'suggest trade ideas',
    'trade for Judge',
    'should i trade',
    'trade analysis',
    'trade value',
    'trade targets',
    '/trade',
    'make a trade',
    'evaluate trade',
  ])('recognizes trade intent: "%s"', (msg) => {
    expect(parseIntent(msg).isTrade).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// DRAFT
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — draft', () => {
  it.each([
    'draft advice',
    'who should i draft',
    'who to draft',
    'draft strategy',
    'draft picks',
    'draft board',
    'draft rankings',
    'mock draft',
    '/draft',
    'draft prep',
  ])('recognizes draft intent: "%s"', (msg) => {
    expect(parseIntent(msg).isDraft).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// VIEW TEAMS / STANDINGS
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — view teams', () => {
  it.each([
    'show all teams',
    'view standings',
    'league standings',
    'list teams',
    'teams',
    'standings',
    'who is in my league',
    "who's in my league",
    'show teams',
    'all the teams',
    'every team',
  ])('recognizes view-teams intent: "%s"', (msg) => {
    expect(parseIntent(msg).isViewTeams).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SHOW BATTERS / PITCHERS
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — show batters', () => {
  it.each([
    'batters',
    'hitters',
    'show my batters',
    'view my hitters',
    'all batters',
    'list hitters',
    'my batters',
  ])('recognizes show-batters intent: "%s"', (msg) => {
    expect(parseIntent(msg).isShowBatters).toBe(true)
  })
})

describe('parseIntent — show pitchers', () => {
  it.each([
    'pitchers',
    'show my pitchers',
    'view my pitchers',
    'all pitchers',
    'list pitchers',
    'my pitchers',
    'show me pitching staff',
  ])('recognizes show-pitchers intent: "%s"', (msg) => {
    expect(parseIntent(msg).isShowPitchers).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// LEAGUE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — league settings', () => {
  it.each([
    'league settings',
    'what stats count',
    'which categories',
    'scoring categories',
    'stat categories',
    'league rules',
    'how is scoring',
    'what are the categories',
    'roster positions',
    'how many bench',
    'playoff format',
    'trade deadline',
    'waiver rules',
    'league format',
  ])('recognizes league-settings intent: "%s"', (msg) => {
    expect(parseIntent(msg).isLeagueSettings).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// COMPARE
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — compare', () => {
  it('recognizes "compare Mike Trout vs Aaron Judge"', () => {
    const r = parseIntent('compare Mike Trout vs Aaron Judge')
    expect(r.isCompare).toBe(true)
    expect(r.comparePlayerA).toBe('Mike Trout')
    expect(r.comparePlayerB).toBe('Aaron Judge')
  })

  it('recognizes "Mike Trout versus Aaron Judge"', () => {
    const r = parseIntent('Mike Trout versus Aaron Judge')
    expect(r.isCompare).toBe(true)
    expect(r.comparePlayerA).toBe('Mike Trout')
    expect(r.comparePlayerB).toBe('Aaron Judge')
  })

  it('recognizes "who\'s better Mike Trout or Aaron Judge"', () => {
    const r = parseIntent("who's better Mike Trout or Aaron Judge")
    expect(r.isCompare).toBe(true)
  })

  it('recognizes "Soto vs Acuna"', () => {
    const r = parseIntent('Soto vs Acuna')
    expect(r.isCompare).toBe(true)
    expect(r.comparePlayerA).toBe('Soto')
    expect(r.comparePlayerB).toBe('Acuna')
  })

  it('handles dash separator: "who\'s better - trout or judge?"', () => {
    const r = parseIntent("who's better - trout or judge?")
    expect(r.isCompare).toBe(true)
    expect(r.comparePlayerA?.toLowerCase()).toBe('trout')
    expect(r.comparePlayerB?.toLowerCase()).toBe('judge')
  })

  it('handles semicolon typo: "who;s better - trout or judge?"', () => {
    const r = parseIntent('who;s better - trout or judge?')
    expect(r.isCompare).toBe(true)
    expect(r.comparePlayerA?.toLowerCase()).toBe('trout')
    expect(r.comparePlayerB?.toLowerCase()).toBe('judge')
  })

  it('handles em-dash separator: "who\'s better — Soto or Acuna"', () => {
    const r = parseIntent("who's better — Soto or Acuna")
    expect(r.isCompare).toBe(true)
    expect(r.comparePlayerA).toBe('Soto')
    expect(r.comparePlayerB).toBe('Acuna')
  })

  it('does not trigger player lookup when compare fires', () => {
    const r = parseIntent('compare Trout vs Judge')
    expect(r.isPlayerLookup).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER LOOKUP (fallback intent)
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIntent — player lookup', () => {
  it.each([
    'Mike Trout',
    'Aaron Judge',
    'tell me about Shohei Ohtani',
    'stats for Juan Soto',
    'how is Mookie Betts doing',
    'Aaron Judge stats',
    'show me Gerrit Cole',
    'pull up Ronald Acuna',
    'what do you think about Trea Turner',
  ])('recognizes player lookup: "%s"', (msg) => {
    const r = parseIntent(msg)
    expect(r.isPlayerLookup).toBe(true)
    expect(r.playerName).toBeTruthy()
  })

  it('extracts clean player name from "tell me about Mike Trout"', () => {
    const r = parseIntent('tell me about Mike Trout')
    expect(r.playerName).toBe('Mike Trout')
  })

  it('extracts clean player name from "Aaron Judge stats"', () => {
    const r = parseIntent('Aaron Judge stats')
    expect(r.playerName).toBe('Aaron Judge')
  })

  it('does not fire for generic structural words', () => {
    expect(parseIntent('lineup').isPlayerLookup).toBe(false)
    expect(parseIntent('help').isPlayerLookup).toBe(false)
    expect(parseIntent('standings').isPlayerLookup).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// findPlayerByNameApprox
// ═══════════════════════════════════════════════════════════════════════════

describe('findPlayerByNameApprox', () => {
  const players = [
    { name: 'Mike Trout', projectedPoints: 16 },
    { name: 'Aaron Judge', projectedPoints: 15 },
    { name: 'Shohei Ohtani', projectedPoints: 18 },
    { name: 'Vladimir Guerrero Jr.', projectedPoints: 14 },
    { name: 'Ronald Acuna Jr.', projectedPoints: 17 },
  ]

  it('returns exact match', () => {
    expect(findPlayerByNameApprox('Mike Trout', players)?.name).toBe('Mike Trout')
  })

  it('matches case-insensitively', () => {
    expect(findPlayerByNameApprox('mike trout', players)?.name).toBe('Mike Trout')
  })

  it('matches last name only', () => {
    expect(findPlayerByNameApprox('Trout', players)?.name).toBe('Mike Trout')
  })

  it('matches partial name', () => {
    expect(findPlayerByNameApprox('Ohtani', players)?.name).toBe('Shohei Ohtani')
  })

  it('returns null for non-matching query', () => {
    expect(findPlayerByNameApprox('xyz', players)).toBeNull()
  })

  it('returns null for empty inputs', () => {
    expect(findPlayerByNameApprox('', players)).toBeNull()
    expect(findPlayerByNameApprox('Mike', [])).toBeNull()
    expect(findPlayerByNameApprox('', [])).toBeNull()
  })

  it('returns null when players is null/undefined', () => {
    expect(findPlayerByNameApprox('Mike', null as any)).toBeNull()
    expect(findPlayerByNameApprox('Mike', undefined as any)).toBeNull()
  })

  it('handles names with suffixes (Jr.)', () => {
    expect(findPlayerByNameApprox('Guerrero', players)?.name).toBe('Vladimir Guerrero Jr.')
  })
})
