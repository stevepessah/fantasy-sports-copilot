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
  playerName?: string
  dropPlayer?: string
  addPlayer?: string
  tradePlayer?: string
}

export function parseIntent(input: string): ParsedIntent {
  const s = input.trim().toLowerCase()
  
  return {
    isHelp: s === 'help' || s === '/help' || s.includes('what can you do'),
    isSetLineup: s.startsWith('set lineup') || s.includes('optimal lineup') || s.startsWith('/lineup') || s.includes('optimize lineup'),
    isShowLineup: s === 'show lineup' || s === 'lineup' || s.startsWith('show my lineup') || s === 'my lineup',
    isMatchup: s.includes('matchup') || s.includes('projected') || s.includes('win probability') || s.startsWith('/matchup') || s.includes('vs ') || s.includes('versus'),
    isWaivers: s.includes('waiver') || s.includes('free agent') || s.startsWith('/waivers') || s.includes('pick up') || s.includes('available'),
    isAddDrop: s.startsWith('add ') || s.startsWith('drop ') || (s.includes('drop') && s.includes('for')),
    isTrade: s.includes('trade') || s.startsWith('/trade') || s.includes('propose trade') || s.includes('suggest trade'),
    isDraft: s.includes('draft') || s.startsWith('/draft') || s.includes('draft advice'),
    isPlayerLookup: !s.includes('set') && !s.includes('show') && !s.includes('matchup') && !s.includes('waiver') && !s.includes('trade') && !s.includes('draft') && s.length > 0,
    playerName: extractPlayerName(s),
    dropPlayer: extractDropPlayer(s),
    addPlayer: extractAddPlayer(s),
    tradePlayer: extractTradePlayer(s),
  }
}

function extractPlayerName(input: string): string | undefined {
  // Try to find a player name in the input
  // This is simplified - in production, use NLP or fuzzy matching
  const words = input.split(/\s+/)
  if (words.length >= 2 && words[0] !== 'set' && words[0] !== 'show' && words[0] !== 'add' && words[0] !== 'drop') {
    // Likely a player name (first last)
    return words.slice(0, 2).join(' ')
  }
  return undefined
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
  
  const s = name.trim().toLowerCase()
  if (!s) return null

  // Exact match
  const exact = players.find((p) => p.name.toLowerCase() === s)
  if (exact) return exact

  // Partial match
  const matches = players.filter((p) => 
    p.name.toLowerCase().includes(s) || 
    s.includes(p.name.toLowerCase().split(' ')[0]) ||
    s.includes(p.name.toLowerCase().split(' ').pop() || '')
  )

  if (matches.length === 0) return null

  // Return highest projected if multiple matches
  return matches.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))[0]
}
