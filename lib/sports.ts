// Sport-specific configurations and utilities

import { Sport, FootballPosition, BaseballPosition, PlayerPosition, League } from '@/types'

export interface LineupConfig {
  positions: string[]
  benchSlots: number
  totalRosterSize: number
}

export const SPORT_CONFIGS: Record<Sport, LineupConfig> = {
  football: {
    positions: ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'WR3', 'TE', 'FLEX', 'K', 'DEF'],
    benchSlots: 5,
    totalRosterSize: 15,
  },
  baseball: {
    positions: ['C', '1B', '2B', '3B', 'SS', 'OF1', 'OF2', 'OF3', 'UTIL', 'SP1', 'SP2', 'RP1', 'RP2'],
    benchSlots: 5,
    totalRosterSize: 18,
  },
}

export function getLineupSlots(sport: Sport): string[] {
  return SPORT_CONFIGS[sport].positions
}

export function getTotalRosterSize(sport: Sport): number {
  return SPORT_CONFIGS[sport].totalRosterSize
}

export function isValidPosition(sport: Sport, position: PlayerPosition): boolean {
  if (sport === 'football') {
    return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position as FootballPosition)
  } else {
    return ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP', 'UTIL'].includes(position as BaseballPosition)
  }
}

export function getPositionGroup(sport: Sport): Record<string, string[]> {
  if (sport === 'football') {
    return {
      QB: ['QB'],
      RB: ['RB'],
      WR: ['WR'],
      TE: ['TE'],
      K: ['K'],
      DEF: ['DEF'],
      FLEX: ['RB', 'WR', 'TE'],
    }
  } else {
    return {
      C: ['C'],
      '1B': ['1B'],
      '2B': ['2B'],
      '3B': ['3B'],
      SS: ['SS'],
      OF: ['OF'],
      SP: ['SP'],
      RP: ['RP'],
      UTIL: ['C', '1B', '2B', '3B', 'SS', 'OF'],
    }
  }
}

export function getScoringTypes(sport: Sport): string[] {
  if (sport === 'football') {
    return ['standard', 'ppr', 'half-ppr']
  } else {
    return ['roto', 'points', 'head-to-head']
  }
}

export function formatSportName(sport: Sport): string {
  return sport === 'football' ? 'Football' : 'Baseball'
}

export function getDefaultScoringType(sport: Sport): string {
  return sport === 'football' ? 'ppr' : 'roto'
}
