// Shared stat formatting, column definitions, and stat ID mappings.
// Centralises logic previously duplicated across MyRoster, LeagueStandings,
// PlayerStats, CompareCard, rosterContext, and the chat API route.

// ── Types ────────────────────────────────────────────────────────────────────

export type StatFormat = 'rate3' | 'rate2' | 'ip' | 'int'

export interface ColDef {
  key: string
  label: string
  composite?: 'h_ab'
  fmt?: StatFormat
}

export interface LeagueStatCategory {
  displayName: string
  positionType: string
  sortOrder: string
  isOnlyDisplayStat?: boolean
}

// ── Stat ID → Display Name ──────────────────────────────────────────────────

export const BATTER_STAT_IDS: Record<string, string> = {
  '60': 'H/AB', '7': 'R', '8': 'H', '9': '2B', '10': '3B',
  '12': 'HR', '13': 'RBI', '16': 'SB', '18': 'BB', '21': 'K',
  '3': 'AVG', '4': 'OBP', '5': 'SLG', '55': 'OPS', '6': 'AB', '1': 'GP',
}

export const PITCHER_STAT_IDS: Record<string, string> = {
  '28': 'W', '29': 'L', '32': 'SV', '42': 'HLD', '26': 'ERA',
  '27': 'WHIP', '39': 'IP', '34': 'K', '37': 'BB', '48': 'QS', '25': 'GS',
}

/** Combined batter + pitcher stat IDs for fallback resolution. */
export const STAT_ID_MAP: Record<string, string> = {
  ...BATTER_STAT_IDS,
  ...PITCHER_STAT_IDS,
  // Pitching variants that differ from batting IDs
  '34': 'K(P)', '37': 'BB(P)',
}

export const BATTER_DISPLAY_STATS = ['GP', 'AVG', 'OBP', 'OPS', 'HR', 'R', 'RBI', 'SB', 'H', 'AB', 'BB', 'K']
export const PITCHER_DISPLAY_STATS = ['GP', 'IP', 'ERA', 'WHIP', 'W', 'L', 'SV', 'HLD', 'K', 'BB', 'QS']

// ── Format classification ───────────────────────────────────────────────────

const RATE3_STATS = new Set(['AVG', 'OBP', 'SLG', 'OPS', 'BABIP', 'ISO', 'BAA'])
const RATE2_STATS = new Set(['ERA', 'WHIP', 'K/9', 'BB/9', 'K/BB', 'HR/9', 'FIP'])
const IP_STATS = new Set(['IP'])

export function inferFormat(displayName: string): StatFormat {
  if (RATE3_STATS.has(displayName)) return 'rate3'
  if (RATE2_STATS.has(displayName)) return 'rate2'
  if (IP_STATS.has(displayName)) return 'ip'
  return 'int'
}

// ── Formatting functions ────────────────────────────────────────────────────

/**
 * Format a stat value using an explicit ColDef format.
 * Preferred for table-based views (MyRoster, LeagueStandings).
 */
export function fmtStat(value: number | string | undefined, col: ColDef): string {
  if (value === undefined || value === '' || value === null) return '-'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return String(value)
  switch (col.fmt) {
    case 'rate3': return n >= 0 && n < 2 ? n.toFixed(3).replace(/^0/, '') : n.toFixed(3)
    case 'rate2': return n.toFixed(2)
    case 'ip':    return n.toFixed(1)
    case 'int':   return Math.round(n).toString()
    default:      return Number.isInteger(n) ? n.toString() : n.toFixed(1)
  }
}

/**
 * Format a stat value using just the stat name for format inference.
 * Preferred for simpler displays (PlayerStats, CompareCard, context strings).
 */
export function formatStatValue(
  value: number | string | undefined,
  statName: string,
): string {
  if (value === undefined || value === null || value === '') return '-'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return String(value)

  const upper = statName.toUpperCase()

  if (RATE3_STATS.has(upper)) {
    return n >= 0 && n < 1 ? n.toFixed(3).replace(/^0/, '') : n.toFixed(3)
  }
  if (RATE2_STATS.has(upper)) return n.toFixed(2)
  if (IP_STATS.has(upper)) return n.toFixed(1)
  return Number.isInteger(n) ? n.toString() : Math.round(n).toString()
}

// ── Column builders ─────────────────────────────────────────────────────────

const PINNED_FIRST_COLS: Record<'B' | 'P', ColDef[]> = {
  B: [
    { key: 'GP', label: 'GP', fmt: 'int' },
    { key: 'H/AB', label: 'H/AB', composite: 'h_ab' },
  ],
  P: [
    { key: 'GP', label: 'GP', fmt: 'int' },
  ],
}

const PINNED_KEYS: Record<'B' | 'P', Set<string>> = {
  B: new Set(['GP', 'G', 'H', 'AB']),
  P: new Set(['GP', 'G']),
}

export function buildColsFromCategories(
  categories: LeagueStatCategory[],
  positionType: 'B' | 'P',
): ColDef[] {
  const filtered = categories.filter((c) => c.positionType === positionType)
  const pinned = PINNED_KEYS[positionType]
  const cols: ColDef[] = [...PINNED_FIRST_COLS[positionType]]

  for (const cat of filtered) {
    if (pinned.has(cat.displayName)) continue
    cols.push({
      key: cat.displayName,
      label: cat.displayName,
      fmt: inferFormat(cat.displayName),
    })
  }

  return cols
}

export const FALLBACK_BATTER_COLS: ColDef[] = [
  { key: 'GP', label: 'GP', fmt: 'int' },
  { key: 'H/AB', label: 'H/AB', composite: 'h_ab' },
  { key: 'R', label: 'R', fmt: 'int' },
  { key: 'HR', label: 'HR', fmt: 'int' },
  { key: 'RBI', label: 'RBI', fmt: 'int' },
  { key: 'SB', label: 'SB', fmt: 'int' },
  { key: 'K', label: 'K', fmt: 'int' },
  { key: 'AVG', label: 'AVG', fmt: 'rate3' },
  { key: 'OPS', label: 'OPS', fmt: 'rate3' },
]

export const FALLBACK_PITCHER_COLS: ColDef[] = [
  { key: 'GP', label: 'GP', fmt: 'int' },
  { key: 'IP', label: 'IP', fmt: 'ip' },
  { key: 'L', label: 'L', fmt: 'int' },
  { key: 'SV', label: 'SV', fmt: 'int' },
  { key: 'K', label: 'K', fmt: 'int' },
  { key: 'HLD', label: 'HLD', fmt: 'int' },
  { key: 'ERA', label: 'ERA', fmt: 'rate2' },
  { key: 'WHIP', label: 'WHIP', fmt: 'rate2' },
  { key: 'QS', label: 'QS', fmt: 'int' },
]

// ── Composite stats ─────────────────────────────────────────────────────────

export function buildHAB(stats: Record<string, number | string>): string {
  const h = stats['H']
  const ab = stats['AB']
  if (h !== undefined && ab !== undefined) {
    const hv = typeof h === 'number' ? Math.round(h) : h
    const abv = typeof ab === 'number' ? Math.round(ab) : ab
    return `${hv}/${abv}`
  }
  return '-'
}

// ── Visual helpers ──────────────────────────────────────────────────────────

export const LOWER_IS_BETTER = new Set([
  'ERA', 'WHIP', 'BB', 'L', 'ER', 'H (Pitching)', 'BB (Pitching)',
])

export function getPositionColor(pos: string): string {
  switch (pos) {
    case 'C': case '1B': case '2B': case '3B': case 'SS': case 'OF': case 'Util':
      return 'bg-blue-600/80 text-white'
    case 'SP': return 'bg-green-600/80 text-white'
    case 'RP': return 'bg-emerald-600/80 text-white'
    case 'P':  return 'bg-teal-600/80 text-white'
    case 'BN': return 'bg-slate-600/60 text-slate-300'
    case 'IL': case 'IL+': case 'DL': return 'bg-red-600/60 text-red-200'
    default:   return 'bg-slate-600/40 text-slate-300'
  }
}
