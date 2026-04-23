/**
 * Maps natural-language player archetypes ("power", "speed", "contact", etc.)
 * to concrete stat categories so the chat pipeline can:
 *   1. Detect when a user asks for a type of player rather than a specific name
 *   2. Tell the LLM exactly which stats matter for that archetype
 *   3. Sort/filter waiver-wire or league-player results by the right stat
 */

export interface StatArchetype {
  label: string
  stats: string[]
  sortBy: string
  positionType: 'B' | 'P' | 'both'
  description: string
}

export const STAT_ARCHETYPES: Record<string, StatArchetype> = {
  power: {
    label: 'Power Hitter',
    stats: ['HR', 'SLG', 'OPS', 'RBI'],
    sortBy: 'HR',
    positionType: 'B',
    description: 'home runs, slugging, OPS, and extra-base power',
  },
  speed: {
    label: 'Speed / Stolen Bases',
    stats: ['SB', 'R'],
    sortBy: 'SB',
    positionType: 'B',
    description: 'stolen bases, runs scored, and sprint speed',
  },
  contact: {
    label: 'Contact / Average Hitter',
    stats: ['AVG', 'OBP', 'K'],
    sortBy: 'AVG',
    positionType: 'B',
    description: 'batting average, on-base percentage, and low strikeouts',
  },
  average: {
    label: 'High Average Hitter',
    stats: ['AVG', 'OBP'],
    sortBy: 'AVG',
    positionType: 'B',
    description: 'batting average and on-base percentage',
  },
  obp: {
    label: 'On-Base Machine',
    stats: ['OBP', 'BB', 'AVG'],
    sortBy: 'OBP',
    positionType: 'B',
    description: 'on-base percentage, walks, and plate discipline',
  },
  runs: {
    label: 'Runs Scored',
    stats: ['R', 'OBP', 'SB'],
    sortBy: 'R',
    positionType: 'B',
    description: 'runs scored, often from leadoff-type hitters',
  },
  rbi: {
    label: 'RBI Producer',
    stats: ['RBI', 'HR', 'OPS'],
    sortBy: 'RBI',
    positionType: 'B',
    description: 'RBI, home runs, and middle-of-the-order production',
  },
  strikeouts: {
    label: 'Strikeout Pitcher',
    stats: ['K', 'IP', 'ERA'],
    sortBy: 'K',
    positionType: 'P',
    description: 'strikeouts, high K rate, and swing-and-miss stuff',
  },
  ace: {
    label: 'Ace / Elite Starter',
    stats: ['K', 'ERA', 'WHIP', 'QS', 'W'],
    sortBy: 'K',
    positionType: 'P',
    description: 'elite starting pitching — strikeouts, low ERA, quality starts',
  },
  ratios: {
    label: 'Ratio Pitcher',
    stats: ['ERA', 'WHIP', 'K'],
    sortBy: 'ERA',
    positionType: 'P',
    description: 'low ERA and WHIP — ratio-friendly arms',
  },
  saves: {
    label: 'Closer / Saves',
    stats: ['SV', 'HLD', 'ERA'],
    sortBy: 'SV',
    positionType: 'P',
    description: 'saves, holds, and late-inning relief',
  },
  holds: {
    label: 'Setup Man / Holds',
    stats: ['HLD', 'SV', 'ERA'],
    sortBy: 'HLD',
    positionType: 'P',
    description: 'holds, middle-relief, and high-leverage innings',
  },
  wins: {
    label: 'Win-Producing Pitcher',
    stats: ['W', 'QS', 'K', 'IP'],
    sortBy: 'W',
    positionType: 'P',
    description: 'wins and quality starts from durable starters',
  },
  allround: {
    label: 'All-Around Hitter',
    stats: ['OPS', 'HR', 'SB', 'R', 'RBI'],
    sortBy: 'OPS',
    positionType: 'B',
    description: 'five-category contributor — power, speed, and production',
  },
}

/**
 * Tokens / phrases that trigger each archetype.
 * Order matters — first match wins, so more specific patterns come first.
 */
const ARCHETYPE_PATTERNS: Array<{ key: string; tokens: string[]; phrases: string[] }> = [
  {
    key: 'allround',
    tokens: [],
    phrases: ['all around', 'all-around', 'five category', 'five-category', '5-cat', '5 cat', 'five tool', 'five-tool', '5-tool', '5 tool'],
  },
  {
    key: 'saves',
    tokens: ['closer', 'closers', 'saves'],
    phrases: ['save opportunities', 'who saves', 'need saves', 'closer available'],
  },
  {
    key: 'holds',
    tokens: ['holds'],
    phrases: ['setup man', 'setup men', 'set-up man', 'set-up men', 'need holds'],
  },
  {
    key: 'strikeouts',
    tokens: [],
    phrases: [
      'strikeout pitcher', 'strikeout pitchers', 'strikeout arm', 'strikeout arms',
      'high k', 'high strikeout', 'swing and miss', 'swing-and-miss',
      'lots of strikeouts', 'lots of ks', 'need strikeouts', 'need ks',
      'pitcher with strikeouts', 'pitchers with strikeouts',
    ],
  },
  {
    key: 'ace',
    tokens: ['ace', 'aces'],
    phrases: [
      'top arm', 'top arms', 'elite starter', 'elite starters', 'elite pitcher', 'elite pitchers',
      'sp1', 'number one starter', '#1 starter', 'frontline starter',
    ],
  },
  {
    key: 'ratios',
    tokens: [],
    phrases: [
      'low era', 'low whip', 'good ratios', 'good era', 'ratio help',
      'ratio pitcher', 'ratio pitchers', 'help my ratios', 'fix my era', 'fix my whip',
    ],
  },
  {
    key: 'wins',
    tokens: [],
    phrases: ['need wins', 'pitcher wins', 'quality starts', 'lots of wins', 'qs'],
  },
  {
    key: 'power',
    tokens: ['power', 'slugger', 'sluggers', 'masher', 'mashers', 'dingers'],
    phrases: [
      'power hitter', 'power hitters', 'power bat', 'power bats',
      'home run', 'home runs', 'high ops', 'high slugging',
      'need power', 'want power', 'more homers',
      'big bat', 'big bats', 'big fly', 'can mash', 'who mashes',
    ],
  },
  {
    key: 'speed',
    tokens: ['speed', 'steals', 'sb'],
    phrases: [
      'stolen base', 'stolen bases', 'fast guy', 'fast guys',
      'need speed', 'want speed', 'need steals', 'want steals',
      'base stealer', 'base stealers', 'fast runner', 'fast runners',
      'speed guy', 'speed guys',
    ],
  },
  {
    key: 'contact',
    tokens: [],
    phrases: [
      'contact hitter', 'contact hitters', 'contact bat', 'contact bats',
      'high contact', 'good contact', 'low strikeout', 'low k',
    ],
  },
  {
    key: 'average',
    tokens: [],
    phrases: [
      'high average', 'batting average', 'need average', 'want average',
      'avg help', 'raise my average', 'help my average',
    ],
  },
  {
    key: 'obp',
    tokens: [],
    phrases: [
      'on base', 'on-base', 'obp', 'walks a lot', 'lots of walks',
      'high obp', 'good obp', 'patient hitter', 'plate discipline',
    ],
  },
  {
    key: 'runs',
    tokens: [],
    phrases: [
      'need runs', 'runs scored', 'want runs', 'run producer', 'run producers',
      'leadoff hitter', 'leadoff hitters', 'scores runs',
    ],
  },
  {
    key: 'rbi',
    tokens: [],
    phrases: [
      'need rbi', 'need rbis', 'want rbi', 'want rbis', 'rbi producer', 'rbi producers',
      'run batted in', 'runs batted in', 'middle of the order', 'cleanup hitter',
    ],
  },
]

/**
 * Detect whether the user message matches a stat archetype.
 * Returns the archetype key + object, or undefined if no match.
 */
export function detectArchetype(input: string): { key: string; archetype: StatArchetype } | undefined {
  const s = input.trim().toLowerCase()
  if (!s) return undefined

  const words = s.split(/\s+/).filter(Boolean)
  const wordSet = new Set(words)

  for (const pattern of ARCHETYPE_PATTERNS) {
    const tokenMatch = pattern.tokens.length > 0 && pattern.tokens.some(t => wordSet.has(t))
    const phraseMatch = pattern.phrases.length > 0 && pattern.phrases.some(p => s.includes(p))
    if (tokenMatch || phraseMatch) {
      return { key: pattern.key, archetype: STAT_ARCHETYPES[pattern.key] }
    }
  }

  return undefined
}
