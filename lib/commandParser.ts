// Enhanced command parsing inspired by the prototype

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
  isViewTeams: boolean
  isShowBatters: boolean
  isShowPitchers: boolean
  playerName?: string
  dropPlayer?: string
  addPlayer?: string
  tradePlayer?: string
}

export function parseIntent(input: string): ParsedIntent {
  const s = input.trim().toLowerCase()

  const isHelp = s === 'help' || s === '/help' || s.includes('what can you do')
  // More flexible lineup detection
  const isSetLineup = 
    s.startsWith('set lineup') || 
    s.includes('optimal lineup') || 
    s.startsWith('/lineup') || 
    s.includes('optimize lineup') ||
    s.includes('set my lineup') ||
    s.includes('set best lineup') ||
    s.includes('set optimal') ||
    s.includes('optimize my lineup') ||
    s.includes('who should i start') ||
    s.includes('who should i play') ||
    s.includes('best lineup') ||
    (s.includes('lineup') && (s.includes('set') || s.includes('optimize') || s.includes('best')))
  
  const isShowLineup = 
    s === 'show lineup' || 
    s === 'lineup' || 
    s.startsWith('show my lineup') || 
    s === 'my lineup' ||
    s.includes('show my lineup') ||
    s.includes('view my lineup') ||
    s.includes('current lineup') ||
    s.includes('my current lineup') ||
    (s.includes('lineup') && (s.includes('show') || s.includes('view') || s.includes('see')))
  const isMatchup = 
    s.includes('matchup') || 
    s.includes('win probability') || 
    s.startsWith('/matchup') || 
    s.includes(' vs ') || 
    s.includes(' versus ') ||
    s.includes('this week') ||
    s.includes('my matchup') ||
    s.includes('who am i playing') ||
    s.includes('who am i facing') ||
    s.includes('opponent')
  const isWaivers = 
    s.includes('waiver') || 
    s.includes('free agent') || 
    s.startsWith('/waivers') || 
    s.includes('pick up') || 
    s.includes('available') ||
    s.includes('who should i pick up') ||
    s.includes('who should i add') ||
    s.includes('waiver wire') ||
    s.includes('free agents') ||
    s.includes('available players')
  const isAddDrop = s.startsWith('add ') || s.startsWith('drop ') || (s.includes('drop') && s.includes('for'))
  const isTrade = s.includes('trade') || s.startsWith('/trade') || s.includes('propose trade') || s.includes('suggest trade')
  const isDraft = s.includes('draft') || s.startsWith('/draft') || s.includes('draft advice')
  // More flexible team viewing - handle many conversational variations
  const isViewTeams = 
    s.includes('show all teams') || 
    s.includes('view all teams') || 
    s.includes('list teams') || 
    s.includes('all teams') || 
    s.includes('teams in league') || 
    s.includes('teams in my league') ||
    s.includes('who is in my league') ||
    s.includes('who\'s in my league') ||
    s.includes('who are the teams') ||
    s.includes('what teams') ||
    s.includes('show teams') ||
    s.includes('view teams') ||
    s.includes('list teams') ||
    s.includes('standings') ||
    s.includes('league standings') ||
    s.includes('show standings') ||
    s.includes('view standings') ||
    (s.includes('teams') && (s.includes('show') || s.includes('view') || s.includes('list') || s.includes('see') || s.includes('display'))) ||
    s === 'teams' ||
    s === 'standings'
  const isShowBatters =
    s.includes('show all batters') ||
    s.includes('show all hitters') ||
    s.includes('list all batters') ||
    s.includes('list all hitters') ||
    s.includes('all batters') ||
    s.includes('all hitters') ||
    s.includes('show batters') ||
    s.includes('show hitters') ||
    s === 'batters' ||
    s === 'hitters'
  const isShowPitchers =
    s.includes('show all pitchers') ||
    s.includes('list all pitchers') ||
    s.includes('all pitchers') ||
    s.includes('show pitchers') ||
    s === 'pitchers'
  const playerName = extractPlayerName(input)
  const isPlayerLookup = shouldHandlePlayerLookup(s, {
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
    isPlayerLookup,
    playerName,
    dropPlayer: extractDropPlayer(s),
    addPlayer: extractAddPlayer(s),
    tradePlayer: extractTradePlayer(s),
  }
}

const LOOKUP_PHRASES = [
  'tell me about',
  'tell me',
  'who is',
  'what about',
  'how is',
  'info on',
  'information on',
  'player info',
  'player information',
  'stats for',
  'stat line for',
  'news on',
  'injury status',
  'status of',
  'profile for',
  'profile of',
  'show me',
]

const PLAYER_LOOKUP_EXCLUDE = new Set([
  'help',
  'hi',
  'hello',
  'thanks',
  'thank',
  'please',
  'lineup',
  'matchup',
  'waiver',
  'waivers',
  'trade',
  'trades',
  'draft',
  'drafting',
  'team',
  'teams',
  'league',
  'leagues',
  'roster',
  'start',
  'bench',
  'add',
  'drop',
  'create',
  'set',
  'view',
  'list',
  'all',
  'score',
  'scores',
  'standings',
  'rules',
  'settings',
  'schedule',
  'position',
  'positions',
  'pitcher',
  'pitchers',
  'hitter',
  'hitters',
  'batter',
  'batters',
])

const NAME_FILLER_WORDS = new Set([
  'tell',
  'me',
  'about',
  'the',
  'a',
  'an',
  'please',
  'info',
  'information',
  'stats',
  'stat',
  'news',
  'player',
  'profile',
  'snapshot',
  'status',
  'injury',
  'on',
  'for',
  'of',
  'is',
  'who',
  'what',
  'how',
  'show',
])

const TRAILING_NOISE_WORDS = new Set([
  'vs',
  'versus',
  'against',
  'today',
  'tonight',
  'tomorrow',
  'this',
  'next',
  'week',
  'season',
  'year',
  'lately',
  'recently',
  'recent',
  'now',
  'matchup',
])

function shouldHandlePlayerLookup(
  s: string,
  intents: Pick<ParsedIntent, 'isHelp' | 'isSetLineup' | 'isShowLineup' | 'isMatchup' | 'isWaivers' | 'isAddDrop' | 'isTrade' | 'isDraft' | 'isViewTeams' | 'isShowBatters' | 'isShowPitchers'>,
  playerName?: string
): boolean {
  if (!s) return false
  if (intents.isHelp || intents.isSetLineup || intents.isShowLineup || intents.isMatchup || intents.isWaivers || intents.isAddDrop || intents.isTrade || intents.isDraft || intents.isViewTeams || intents.isShowBatters || intents.isShowPitchers) {
    return false
  }
  if (looksLikePlayerQuery(s)) return true
  return Boolean(playerName && playerName.trim().length > 0)
}

function looksLikePlayerQuery(s: string): boolean {
  if (LOOKUP_PHRASES.some((phrase) => s.includes(phrase))) return true
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  if (words.length <= 4) {
    const hasExcludedToken = words.some((word) => PLAYER_LOOKUP_EXCLUDE.has(word))
    return !hasExcludedToken
  }
  return false
}

function extractPlayerName(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  const cleanedInput = trimmed.replace(/[?.!,]/g, '')

  const patterns = [
    /(?:tell me about|tell me|who is|what about|how is|info(?:rmation)? on|player info(?:rmation)?|stats for|stat line for|news on|injury status(?:\s+(?:for|of))?|status of|profile(?:\s+(?:for|of))?|show me|show)\s+(.+)/i,
    /(?:player|profile|snapshot)[:\s]+(.+)/i,
  ]

  for (const pattern of patterns) {
    const match = cleanedInput.match(pattern)
    if (match?.[1]) {
      const candidate = cleanupName(match[1])
      if (candidate) return candidate
    }
  }

  const words = cleanedInput.split(/\s+/).filter(Boolean)
  if (words.length === 0) return undefined

  const strippedLeading = stripLeadingFiller(words)
  const trimmedWords = stripTrailingNoise(strippedLeading.length > 0 ? strippedLeading : words)
  const candidate = trimmedWords.join(' ').trim()

  if (!candidate) return undefined
  if (!isLikelyName(candidate)) return undefined

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
  const noiseIndex = words.findIndex((word) => TRAILING_NOISE_WORDS.has(word.toLowerCase()))
  if (noiseIndex === -1) {
    return words
  }
  return words.slice(0, noiseIndex)
}

function cleanupName(name: string): string {
  const cleaned = name.replace(/[?.!,]/g, '').trim()
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const strippedLeading = stripLeadingFiller(tokens)
  const trimmedTokens = stripTrailingNoise(strippedLeading.length > 0 ? strippedLeading : tokens)
  return trimmedTokens.join(' ').trim()
}

function isLikelyName(candidate: string): boolean {
  const normalized = candidate.trim().toLowerCase()
  if (!normalized) return false
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  return !tokens.every((token) => PLAYER_LOOKUP_EXCLUDE.has(token))
}

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

// Find player by approximate name match
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
