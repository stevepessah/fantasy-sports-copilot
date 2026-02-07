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
    positions: [
      'C',           // Catcher
      '1B',          // First Base
      '2B',          // Second Base
      '3B',          // Third Base
      'SS',          // Shortstop
      'OF1',         // Outfield
      'OF2',         // Outfield
      'OF3',         // Outfield
      'UTIL1',       // Utility
      'UTIL2',       // Utility
      'SP1',         // Starting Pitcher
      'SP2',         // Starting Pitcher
      'RP1',         // Reliever
      'RP2',         // Reliever
      'P1',          // All Pitcher (SP or RP)
      'P2',          // All Pitcher (SP or RP)
      'P3',          // All Pitcher (SP or RP)
      'P4',          // All Pitcher (SP or RP)
      'IL1',         // Injured List
      'IL2',         // Injured List
      'IL3',         // Injured List
      'NA',          // Not Active
      'BN1',         // Bench
      'BN2',         // Bench
      'BN3',         // Bench
      'BN4',         // Bench
      'BN5',         // Bench
    ],
    benchSlots: 5,
    totalRosterSize: 27, // 9 position + 2 SP + 2 RP + 4 P + 3 IL + 1 NA + 5 BN
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
      P: ['SP', 'RP'], // All Pitcher slots can be SP or RP
      UTIL: ['C', '1B', '2B', '3B', 'SS', 'OF'],
      IL: ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP'], // IL can hold any position
      NA: ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP'], // NA can hold any position
      BN: ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP'], // Bench can hold any position
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
