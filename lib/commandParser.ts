import { detectArchetype } from './statArchetypes'

// ── Flexible intent parser ──────────────────────────────────────────────────
//
// Instead of rigid exact-phrase matching, this uses CONCEPT VOCABULARIES:
//   • "View" verbs: show, see, view, bring up, pull up, check, look at …
//   • "Set" verbs:  set, optimize, lock in, fix, adjust …
//   • Subject nouns: lineup, matchup, teams, batters, pitchers …
//
// An intent fires when the right *combination* of concepts is present,
// so "bring up my lineup" works just as well as "show lineup".
//
// Player lookup is the most permissive intent — it fires when no structural
// intent matched AND the message looks like it references a person's name.
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedIntent {
  isHelp: boolean
  isSetLineup: boolean
  isShowLineup: boolean
  isMatchup: boolean
  isWaivers: boolean
  isAddDrop: boolean
  isTrade: boolean
  isDraft: boolean
  isPlayerLookup: boolean
  isCompare: boolean
  isViewTeams: boolean
  isShowBatters: boolean
  isShowPitchers: boolean
  isLeagueSettings: boolean
  isArchetypeQuery: boolean
  archetypeKey?: string
  playerName?: string
  comparePlayerA?: string
  comparePlayerB?: string
  dropPlayer?: string
  addPlayer?: string
  tradePlayer?: string
}

// ── Concept vocabularies ────────────────────────────────────────────────────

/** Words/phrases that mean "show me" / "I want to view" */
const VIEW_TOKENS = [
  'show', 'see', 'view', 'display', 'check', 'get', 'give',
  'find', 'fetch', 'load', 'open', 'reveal',
]
const VIEW_PHRASES = [
  'pull up', 'bring up', 'look at', 'look up',
  'want to see', 'wanna see', 'let me see', 'i want to see',
  'can you show', 'could you show', 'show me', 'give me',
  'let me check', 'i wanna see', 'i need to see',
]

/** Words/phrases that mean "set / optimize / change" */
const SET_TOKENS = ['set', 'optimize', 'optimise', 'fix', 'configure', 'adjust', 'update']
const SET_PHRASES = ['lock in', 'lock down']

/** "Best / optimal" modifiers */
const BEST_TOKENS = ['best', 'optimal', 'ideal', 'perfect', 'optimized', 'optimised', 'top']

/** Lineup / roster subjects */
const LINEUP_TOKENS = ['lineup', 'lineups', 'starters', 'roster']
const LINEUP_PHRASES = ['line up', 'line-up', 'starting lineup', 'starting roster']

/** Matchup / opponent subjects */
const MATCHUP_TOKENS = ['matchup', 'opponent', 'opponents']
const MATCHUP_PHRASES = [
  'match up', 'match-up', 'win probability', 'playing against',
  'who am i playing', 'who am i facing', 'who do i play',
  'who do i face', 'who am i up against', 'my opponent',
  'matchup analysis', 'matchup preview', 'weekly matchup',
]

/** Waiver / free-agent subjects */
const WAIVER_TOKENS = ['waiver', 'waivers', 'pickup', 'claim']
const WAIVER_PHRASES = [
  'waiver wire', 'free agent', 'free agents', 'pick up',
  'who should i pick up', 'who should i add', 'who should i grab',
  'who should i claim', 'who to pick up', 'who to add',
  'who to grab', 'who to claim', 'available players',
  'best available', 'who is available', "who's available",
  'whos available', 'what players are available',
]

/** Trade subjects */
const TRADE_TOKENS = ['trade', 'trades', 'trading', 'swap', 'exchange']
const TRADE_PHRASES = [
  'propose trade', 'suggest trade', 'trade idea', 'trade for',
  'should i trade', 'trade analysis', 'trade value', 'trade away',
  'make a trade', 'evaluate trade', 'trade target', 'trade targets',
]

/** Draft subjects */
const DRAFT_TOKENS = ['draft', 'drafting', 'drafted']
const DRAFT_PHRASES = [
  'draft advice', 'mock draft', 'who should i draft',
  'who to draft', 'who do i draft', 'draft strategy',
  'draft picks', 'draft board', 'draft rankings', 'draft order',
  'draft round', 'draft prep', 'draft preparation',
]

/** Teams / standings subjects */
const TEAMS_TOKENS = ['teams', 'standings', 'leaderboard']
const TEAMS_PHRASES = [
  'league standings', 'show all teams', 'view all teams',
  'list teams', 'all teams', 'teams in league', 'teams in my league',
  'who is in my league', "who's in my league", 'whos in my league',
  'who are the teams', 'what teams', 'show teams', 'view teams',
  'show standings', 'view standings', 'see standings',
  'league teams', 'every team', 'all the teams',
]

/** Batters / hitters subjects */
const BATTER_TOKENS = ['batters', 'batter', 'hitters', 'hitter']
const BATTER_PHRASES = ['position players', 'position player']

/** Pitcher subjects */
const PITCHER_TOKENS = ['pitchers', 'pitcher', 'arms']
const PITCHER_PHRASES = ['pitching staff']

/** League settings / stats categories subjects */
const SETTINGS_TOKENS = ['settings', 'categories', 'scoring']
const SETTINGS_PHRASES = [
  'what stats', 'which stats', 'what categories', 'which categories',
  'stat categories', 'scoring categories', 'league settings', 'league rules',
  'league scoring', 'league categories', 'league stats',
  'what does this league', 'what does my league',
  'how is scoring', 'how does scoring', 'how is this league scored',
  'what counts', 'stats count', 'stats matter', 'stats are tracked',
  'stats are scored', 'what are the categories', 'what are the stats',
  'roster positions', 'roster slots', 'what positions',
  'league format', 'league setup', 'league config', 'league configuration',
  'how many roster', 'how many bench', 'how many il',
  'trade deadline', 'waiver rules', 'playoff format',
]

/** Comparison subjects */
const COMPARE_TOKENS = ['compare', 'comparison']
const COMPARE_PHRASES = [
  'compare', 'head to head', 'h2h between', 'stack up against',
  'stacks up against', 'stack up to', 'stacks up to',
  "who's better", 'whos better', 'who is better',
  'better between', 'better of',
  'side by side', 'side-by-side',
]

/**
 * Separators between two player names in a comparison query.
 * Tried in order — first match wins.
 */
const COMPARE_SEPARATORS = [
  ' compared to ', ' compared with ',
  ' versus ', ' vs. ', ' vs ',
  ' head to head with ', ' h2h with ', ' h2h ',
  ' stack up against ', ' stacks up against ',
  ' stack up to ', ' stacks up to ',
  ' side by side with ', ' side-by-side with ',
  ' against ', ' with ', ' and ', ' or ', ' to ',
]

/**
 * Extract two player names from a comparison query.
 * Returns [playerA, playerB] or undefined if the message doesn't look like a comparison.
 */
function extractCompareNames(input: string): [string, string] | undefined {
  const s = input.trim()
  if (!s) return undefined

  // Strip leading compare-related verbs/phrases to get to the names
  let stripped = s
    .replace(/^(?:compare|comparison of|can you compare|could you compare|please compare)\s+/i, '')
    .replace(/^(?:who's better|whos better|who is better)\s*[,:]?\s*/i, '')
    .replace(/^(?:better between|better of)\s*/i, '')
    .replace(/^(?:head to head|h2h|side by side|side-by-side)\s*(?:between|of|for|with|:)?\s*/i, '')

  // Strip trailing comparison-related phrases that aren't part of names
  stripped = stripped
    .replace(/\s+(?:side by side|side-by-side|head to head|h2h|comparison|compared)$/i, '')

  // Try each separator
  for (const sep of COMPARE_SEPARATORS) {
    const idx = stripped.toLowerCase().indexOf(sep)
    if (idx > 0) {
      const rawA = stripped.slice(0, idx).trim()
      const rawB = stripped.slice(idx + sep.length).trim()
      const nameA = cleanupName(rawA)
      const nameB = cleanupName(rawB)
      if (nameA && nameB && isLikelyName(nameA) && isLikelyName(nameB)) {
        return [nameA, nameB]
      }
    }
  }

  return undefined
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMatcher(s: string, wordSet: Set<string>) {
  return {
    /** True if ANY single-word token is present (exact word boundary). */
    word: (...tokens: string[]) => tokens.some(t => wordSet.has(t)),
    /** True if ANY phrase (possibly multi-word) appears as substring. */
    phrase: (...phrases: string[]) => phrases.some(p => s.includes(p)),
    /** Unified: single-word → wordSet, multi-word → includes. */
    has: (...targets: string[]) =>
      targets.some(t => (t.includes(' ') || t.includes('-') || t.includes("'"))
        ? s.includes(t)
        : wordSet.has(t)),
    /** True if ANY item from a token array OR a phrase array matches. */
    any: (tokens: string[], phrases: string[] = []) =>
      tokens.some(t => wordSet.has(t)) || phrases.some(p => s.includes(p)),
  }
}

// ── Main parser ─────────────────────────────────────────────────────────────

export function parseIntent(input: string): ParsedIntent {
  const s = input.trim().toLowerCase()
  if (!s) return emptyIntent()

  const words = s.split(/\s+/).filter(Boolean)
  const wordSet = new Set(words)
  const m = buildMatcher(s, wordSet)

  // ── Concept detectors ──
  const wantsToView = m.any(VIEW_TOKENS, VIEW_PHRASES)
  const wantsToSet  = m.any(SET_TOKENS, SET_PHRASES)
  const mentionsBest = m.any(BEST_TOKENS)

  const mentionsLineup   = m.any(LINEUP_TOKENS, LINEUP_PHRASES)
  const mentionsMatchup  = m.any(MATCHUP_TOKENS, MATCHUP_PHRASES)
  const mentionsWaivers  = m.any(WAIVER_TOKENS, WAIVER_PHRASES)
  const mentionsTrade    = m.any(TRADE_TOKENS, TRADE_PHRASES)
  const mentionsDraft    = m.any(DRAFT_TOKENS, DRAFT_PHRASES)
  const mentionsTeams    = m.any(TEAMS_TOKENS, TEAMS_PHRASES)
  const mentionsBatters  = m.any(BATTER_TOKENS, BATTER_PHRASES)
  const mentionsPitchers = m.any(PITCHER_TOKENS, PITCHER_PHRASES)

  // ── Intent detection (ordered by specificity) ──

  const isHelp =
    s === 'help' || s === '/help' ||
    m.phrase('what can you do', 'how do you work', 'what do you do') ||
    (m.word('capabilities', 'commands', 'features') && words.length <= 4)

  // Set lineup — actionable change
  const isSetLineup =
    (wantsToSet && mentionsLineup) ||
    (mentionsBest && mentionsLineup) ||
    m.phrase(
      'who should i start', 'who should i play', 'who should i sit',
      'who do i start', 'who do i play', 'who do i sit',
      'who to start', 'who to play', 'who to sit',
      'who am i starting', 'who goes in',
    ) ||
    (m.word('start', 'sit', 'bench') && m.word('should') && !mentionsTrade) ||
    s.startsWith('/lineup')

  // Show lineup — view only
  const isShowLineup = !isSetLineup && (
    (wantsToView && mentionsLineup) ||
    m.phrase('my lineup', 'current lineup', 'my starters', 'current roster', 'my roster') ||
    s === 'lineup' || s === 'roster' || s === 'my roster' || s === 'my lineup'
  )

  // Matchup
  const isMatchup = mentionsMatchup ||
    m.phrase(
      'who am i playing', 'who am i facing', 'who am i up against',
      'who do i face', 'playing against', 'my opponent',
      'matchup analysis', 'matchup preview', 'weekly matchup',
      'head to head', 'h2h',
    )

  // Waivers
  const isWaivers = mentionsWaivers ||
    s.startsWith('/waivers')

  // Add / Drop
  const isAddDrop =
    s.startsWith('add ') || s.startsWith('drop ') ||
    m.phrase('drop for', 'swap for', 'replace with', 'swap out') ||
    (m.word('drop') && m.word('for'))

  // Trade
  const isTrade = mentionsTrade ||
    s.startsWith('/trade')

  // Draft
  const isDraft = mentionsDraft ||
    s.startsWith('/draft')

  // View teams / standings
  const isViewTeams =
    mentionsTeams ||
    (m.word('teams') && (wantsToView || m.word('all', 'every', 'list'))) ||
    s === 'teams' || s === 'standings'

  // Show batters
  const isShowBatters =
    (mentionsBatters && (wantsToView || m.word('all', 'every', 'list', 'my'))) ||
    s === 'batters' || s === 'hitters'

  // Show pitchers
  const isShowPitchers =
    (mentionsPitchers && (wantsToView || m.word('all', 'every', 'list', 'my'))) ||
    s === 'pitchers'

  // League settings / stat categories
  const isLeagueSettings =
    m.any(SETTINGS_TOKENS, SETTINGS_PHRASES) ||
    (m.word('stats') && (m.word('count', 'matter', 'tracked', 'scored') || m.phrase('this league', 'my league')))

  // ── Compare (must be checked BEFORE player lookup to avoid false-positive) ──
  const compareNames = extractCompareNames(input)
  const isCompare = Boolean(compareNames) && (
    m.any(COMPARE_TOKENS, COMPARE_PHRASES) ||
    m.phrase(' vs ', ' vs. ', ' versus ') ||
    m.phrase("who's better", 'whos better', 'who is better') ||
    // Even "Player A vs Player B" without "compare" should work
    Boolean(compareNames)
  )

  // ── Archetype query ("I want power", "need speed", "give me a closer") ──
  const hasStructuralIntent =
    isHelp || isSetLineup || isShowLineup || isMatchup || isWaivers ||
    isAddDrop || isTrade || isDraft || isViewTeams || isShowBatters ||
    isShowPitchers || isLeagueSettings || isCompare

  const archetypeResult = !hasStructuralIntent ? detectArchetype(input) : undefined
  const isArchetypeQuery = Boolean(archetypeResult)

  // ── Player lookup (most permissive — fallback intent) ──
  const playerName = isCompare || isArchetypeQuery ? undefined : extractPlayerName(input)
  const isPlayerLookup = !isCompare && !isLeagueSettings && !isArchetypeQuery && shouldHandlePlayerLookup(s, words, {
    isHelp, isSetLineup, isShowLineup, isMatchup, isWaivers,
    isAddDrop, isTrade, isDraft, isViewTeams, isShowBatters, isShowPitchers,
  }, playerName)

  return {
    isHelp,
    isSetLineup,
    isShowLineup,
    isMatchup,
    isWaivers,
    isAddDrop,
    isTrade,
    isDraft,
    isViewTeams,
    isShowBatters,
    isShowPitchers,
    isLeagueSettings,
    isCompare,
    isArchetypeQuery,
    archetypeKey: archetypeResult?.key,
    isPlayerLookup,
    playerName,
    comparePlayerA: compareNames?.[0],
    comparePlayerB: compareNames?.[1],
    dropPlayer: extractDropPlayer(s),
    addPlayer: extractAddPlayer(s),
    tradePlayer: extractTradePlayer(s),
  }
}

function emptyIntent(): ParsedIntent {
  return {
    isHelp: false, isSetLineup: false, isShowLineup: false,
    isMatchup: false, isWaivers: false, isAddDrop: false,
    isTrade: false, isDraft: false, isPlayerLookup: false,
    isCompare: false, isLeagueSettings: false,
    isViewTeams: false, isShowBatters: false, isShowPitchers: false,
    isArchetypeQuery: false,
  }
}

// ── Player lookup detection ─────────────────────────────────────────────────

/**
 * Natural phrases that signal a player lookup (prefix patterns).
 * These are checked as substrings, so "tell me about Mike Trout" matches.
 */
const LOOKUP_PHRASES = [
  // Direct inquiries
  'tell me about', 'tell me', 'who is', "who's", 'whos',
  'what about', 'how is', "how's", 'hows', 'how has', 'how does',
  // Info requests
  'info on', 'information on', 'player info', 'player information',
  'details on', 'details for', 'details about',
  'report on', 'breakdown of', 'breakdown for', 'breakdown on',
  'rundown on', 'rundown for',
  'analysis of', 'analysis on', 'analysis for',
  'scouting report', 'scouting on',
  // Stats requests
  'stats for', 'stats on', 'stat line for', 'stat line on',
  'statistics for', 'statistics on', 'numbers for', 'numbers on',
  // View + player
  'show me', 'bring up', 'pull up', 'look up', 'look at',
  'check on', 'check out',
  // Desire / request phrases
  'i want to see', 'want to see', 'wanna see',
  'can you show', 'can you show me', 'could you show', 'could you show me',
  'let me see', 'give me', 'get me',
  'i want to know about', 'want to know about',
  // Opinion
  'what do you think about', 'what do you think of',
  'how about', 'thoughts on',
]

/**
 * Words that, when they make up the ENTIRE message, are NOT player names.
 * If the message also contains non-excluded words, it can still be a player lookup.
 */
const PLAYER_LOOKUP_EXCLUDE = new Set([
  // Greetings / filler
  'help', 'hi', 'hello', 'hey', 'yo', 'sup', 'thanks', 'thank', 'please', 'ok', 'okay', 'sure',
  // Structural intent keywords
  'lineup', 'lineups', 'matchup', 'matchups', 'waiver', 'waivers',
  'trade', 'trades', 'trading', 'draft', 'drafting', 'drafted',
  'team', 'teams', 'league', 'leagues', 'roster', 'rosters',
  // Actions
  'start', 'sit', 'bench', 'add', 'drop', 'create', 'set', 'optimize',
  'view', 'list', 'all', 'every', 'my', 'the',
  // Generic sport terms (not names)
  'score', 'scores', 'standings', 'rules', 'settings', 'schedule',
  'position', 'positions',
  'pitcher', 'pitchers', 'hitter', 'hitters', 'batter', 'batters',
  'catcher', 'catchers', 'outfielder', 'outfielders', 'infielder', 'infielders',
])

function shouldHandlePlayerLookup(
  s: string,
  words: string[],
  intents: Pick<ParsedIntent,
    'isHelp' | 'isSetLineup' | 'isShowLineup' | 'isMatchup' |
    'isWaivers' | 'isAddDrop' | 'isTrade' | 'isDraft' |
    'isViewTeams' | 'isShowBatters' | 'isShowPitchers'
  >,
  playerName?: string,
): boolean {
  if (!s) return false

  // If any structural intent matched, defer to that intent
  const hasStructural =
    intents.isHelp || intents.isSetLineup || intents.isShowLineup ||
    intents.isMatchup || intents.isWaivers || intents.isAddDrop ||
    intents.isTrade || intents.isDraft || intents.isViewTeams ||
    intents.isShowBatters || intents.isShowPitchers

  if (hasStructural) return false

  // Check if a lookup phrase is present
  if (LOOKUP_PHRASES.some((phrase) => s.includes(phrase))) return true

  // Short message ending with stat-related words (e.g. "Aaron Judge stats")
  if (words.length <= 6) {
    const lastWord = words[words.length - 1]
    const statSuffixes = ['stats', 'statistics', 'numbers', 'performance', 'statline', 'outlook', 'projection']
    if (statSuffixes.includes(lastWord)) return true
  }

  // Short message (1-5 words) where at least some words look like a name
  if (words.length >= 1 && words.length <= 5) {
    const allExcluded = words.every((w) => PLAYER_LOOKUP_EXCLUDE.has(w))
    if (!allExcluded) return true
  }

  // If extractPlayerName found something, trust it
  return Boolean(playerName && playerName.trim().length > 0)
}

// ── Player name extraction ──────────────────────────────────────────────────

/**
 * Words that precede a player name and should be stripped.
 * E.g. "show me Aaron Judge" → strip "show", "me" → "Aaron Judge"
 */
const NAME_FILLER_WORDS = new Set([
  // Original
  'tell', 'me', 'about', 'the', 'a', 'an', 'please',
  'info', 'information', 'stats', 'stat', 'statistics',
  'news', 'player', 'profile', 'snapshot', 'status', 'injury',
  'on', 'for', 'of', 'is', 'who', 'what', 'how',
  // View / action verbs
  'show', 'see', 'view', 'display', 'check', 'get', 'give',
  'find', 'bring', 'pull', 'up', 'look', 'at', 'out',
  'lookup', 'open', 'reveal',
  // Request / desire words
  'want', 'to', 'wanna', 'need', 'can', 'you', 'could', 'would',
  'help', 'let', 'i', "i'd", 'id', 'like',
  // Inquiry words
  "how's", 'hows', "what's", 'whats', "who's", 'whos',
  'has', 'does', 'did', 'do', 'think',
  // Articles & connectors
  'some', 'any', 'details', 'report', 'breakdown', 'rundown',
  'analysis', 'scouting',
  // Misc
  'know', 'thoughts',
])

/**
 * Words that follow a player name and should be stripped.
 * E.g. "Aaron Judge stats this week" → strip "stats", "this", "week" → "Aaron Judge"
 */
const TRAILING_NOISE_WORDS = new Set([
  // Time references
  'today', 'tonight', 'tomorrow', 'this', 'next', 'last',
  'week', 'season', 'year', 'month', 'lately', 'recently',
  'recent', 'now', 'currently', 'right',
  // Stat / performance suffixes
  'stats', 'stat', 'statistics', 'numbers', 'performance',
  'doing', 'outlook', 'projection', 'projections', 'forecast',
  'analysis', 'breakdown', 'update', 'news', 'status',
  // Comparative (not 'vs', 'versus', 'against', 'compared' — those are comparison separators)
  'matchup',
  // Filler
  'so', 'far', 'been', 'looking', 'playing', 'performing',
  'like', 'please',
])

/**
 * Regex patterns that capture the player name after a known prefix.
 * Tried in order; first match wins.
 */
const NAME_PREFIX_PATTERNS = [
  // Long-form inquiries — "what do you think about Player"
  /(?:what do you think (?:about|of)|thoughts on|want to know about|i want to know about)\s+(.+)/i,

  // Desire + view — "i want to see Player", "can you show me Player"
  /(?:i (?:want|need|wanna|'d like|d like) to (?:see|check|view|know about)|(?:can|could|would) you (?:show|bring up|pull up|get|check)(?: me)?|let me (?:see|check|look at)|give me|get me)\s+(.+)/i,

  // Standard lookup — "tell me about Player", "stats for Player", "bring up Player"
  /(?:tell me about|tell me|who is|who's|whos|what about|how is|how's|hows|how has|how does|how did|how about|info(?:rmation)? on|player info(?:rmation)?|stats? (?:for|on|of)|stat(?:istic)?s? (?:for|on|of)|stat line (?:for|on)|numbers (?:for|on)|news (?:on|about)|injury status(?:\s+(?:for|of))?|status of|profile(?:\s+(?:for|of))?|details? (?:on|for|about)|report on|breakdown (?:of|for|on)|rundown (?:on|for)|analysis (?:of|on|for)|scouting (?:report on|on)|check (?:on|out)|look (?:up|at)|show me|show|bring up|pull up)\s+(.+)/i,

  // Suffix patterns — "Player stats", "Player numbers"
  /^(.+?)\s+(?:stats?|statistics|numbers|performance|outlook|projection|projections|analysis|breakdown|update|news|status|stat\s?line|statline)$/i,

  // Label format — "player: Name"
  /(?:player|profile|snapshot)[:\s]+(.+)/i,
]

function extractPlayerName(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  const cleanedInput = trimmed.replace(/[?.!,]/g, '')

  // Try regex patterns first
  for (const pattern of NAME_PREFIX_PATTERNS) {
    const match = cleanedInput.match(pattern)
    if (match?.[1]) {
      const candidate = cleanupName(match[1])
      if (candidate && isLikelyName(candidate)) return candidate
    }
  }

  // Fallback: strip all leading filler and trailing noise, see what remains
  const words = cleanedInput.split(/\s+/).filter(Boolean)
  if (words.length === 0) return undefined

  const strippedLeading = stripLeadingFiller(words)
  const trimmedWords = stripTrailingNoise(strippedLeading.length > 0 ? strippedLeading : words)
  const candidate = trimmedWords.join(' ').trim()

  if (!candidate) return undefined
  if (!isLikelyName(candidate)) return undefined

  // If still too long, grab the last 2–3 words (likely "First Last" or "First Middle Last")
  if (trimmedWords.length > 4) {
    return trimmedWords.slice(-2).join(' ')
  }

  return candidate
}

function stripLeadingFiller(words: string[]): string[] {
  let startIndex = 0
  while (startIndex < words.length && NAME_FILLER_WORDS.has(words[startIndex].toLowerCase())) {
    startIndex += 1
  }
  return words.slice(startIndex)
}

function stripTrailingNoise(words: string[]): string[] {
  let endIndex = words.length
  while (endIndex > 0 && TRAILING_NOISE_WORDS.has(words[endIndex - 1].toLowerCase())) {
    endIndex -= 1
  }
  return words.slice(0, endIndex)
}

function cleanupName(name: string): string {
  const cleaned = name.replace(/[?.!,]/g, '').trim()
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const strippedLeading = stripLeadingFiller(tokens)
  // If ALL words were filler, there's no name here — return empty
  if (strippedLeading.length === 0) return ''
  const trimmedTokens = stripTrailingNoise(strippedLeading)
  return trimmedTokens.join(' ').trim()
}

function isLikelyName(candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase()
  if (!normalized) return false
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  // A name must contain at least one token that isn't an excluded keyword
  return !tokens.every((token) => PLAYER_LOOKUP_EXCLUDE.has(token))
}

// ── Add / Drop / Trade player extraction ────────────────────────────────────

function extractDropPlayer(input: string): string | undefined {
  const match = input.match(/drop\s+(.+?)(?:\s+for|\s*$)/i)
  return match?.[1]?.trim()
}

function extractAddPlayer(input: string): string | undefined {
  if (input.includes('drop') && input.includes('for')) {
    const match = input.match(/for\s+(.+?)(?:\s*$)/i)
    return match?.[1]?.trim()
  }
  const match = input.match(/add\s+(.+?)(?:\s*$)/i)
  return match?.[1]?.trim()
}

function extractTradePlayer(input: string): string | undefined {
  const match = input.match(/(?:involving|with|for)\s+(.+?)(?:\s*$)/i)
  return match?.[1]?.trim()
}

// ── Fuzzy name matching (unchanged) ─────────────────────────────────────────

export function findPlayerByNameApprox(name: string, players: any[]): any | null {
  if (!name || !players) return null

  const query = normalizeName(name)
  if (!query) return null

  let bestMatch: any | null = null
  let bestScore = 0

  for (const player of players) {
    if (!player?.name) continue
    const candidate = normalizeName(player.name)
    if (!candidate) continue

    const score = scoreNameMatch(query, candidate)
    if (score > bestScore) {
      bestScore = score
      bestMatch = player
    } else if (score === bestScore && score > 0) {
      const currentPoints = bestMatch?.projectedPoints || 0
      const nextPoints = player?.projectedPoints || 0
      if (nextPoints > currentPoints) {
        bestMatch = player
      }
    }
  }

  if (bestScore < 12) return null
  return bestMatch
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreNameMatch(query: string, candidate: string): number {
  if (!query || !candidate) return 0
  if (query === candidate) return 100
  if (candidate.includes(query)) return 85
  if (query.includes(candidate)) return 70

  const queryTokens = query.split(' ')
  const candidateTokens = candidate.split(' ')
  const candidateSet = new Set(candidateTokens)

  let score = 0
  let matchedTokens = 0

  for (const token of queryTokens) {
    if (candidateSet.has(token)) {
      score += 15
      matchedTokens += 1
      continue
    }

    const partial = candidateTokens.find((ct) => ct.startsWith(token) || token.startsWith(ct))
    if (partial) {
      score += 8
      matchedTokens += 1
    }
  }

  if (queryTokens.length === 1) {
    const lastName = candidateTokens[candidateTokens.length - 1] || ''
    const firstName = candidateTokens[0] || ''
    if (lastName.startsWith(queryTokens[0]) || queryTokens[0].startsWith(lastName)) {
      score += 8
    } else if (firstName.startsWith(queryTokens[0]) || queryTokens[0].startsWith(firstName)) {
      score += 4
    }
  } else {
    const lastQueryToken = queryTokens[queryTokens.length - 1]
    const lastCandidateToken = candidateTokens[candidateTokens.length - 1]
    if (lastQueryToken === lastCandidateToken) {
      score += 6
    }
  }

  if (matchedTokens === queryTokens.length) {
    score += 10
  }

  return score
}
