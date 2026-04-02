/**
 * Shared utilities for MLB Stats API integrations.
 * Used by both mlbStats.ts (hitting supplement) and mlbProbableStarters.ts.
 */

export const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1'

export const TEAM_ABBR_TO_MLB_ID: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112,
  CWS: 145, CIN: 113, CLE: 114, COL: 115, DET: 116,
  HOU: 117, KC: 118, LAA: 108, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYM: 121, NYY: 147, OAK: 133,
  PHI: 143, PIT: 134, SD: 135, SF: 137, SEA: 136,
  STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
  AZ: 109, CHW: 145, WAS: 120,
}

const mlbIdToAbbrMap = new Map<number, string>()
for (const [abbr, id] of Object.entries(TEAM_ABBR_TO_MLB_ID)) {
  if (abbr.length <= 3 && !mlbIdToAbbrMap.has(id)) {
    mlbIdToAbbrMap.set(id, abbr)
  }
}
export const MLB_ID_TO_TEAM_ABBR: ReadonlyMap<number, string> = mlbIdToAbbrMap

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.''-]/g, '')
    .toLowerCase()
    .trim()
}
