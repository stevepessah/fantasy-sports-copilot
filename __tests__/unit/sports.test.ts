import { describe, it, expect } from 'vitest'
import {
  SPORT_CONFIGS,
  getLineupSlots,
  getTotalRosterSize,
  isValidPosition,
  getPositionGroup,
  getScoringTypes,
  formatSportName,
  getDefaultScoringType,
} from '@/lib/sports'

describe('SPORT_CONFIGS', () => {
  it('has configs for football and baseball', () => {
    expect(SPORT_CONFIGS).toHaveProperty('football')
    expect(SPORT_CONFIGS).toHaveProperty('baseball')
  })

  it('football has correct roster size', () => {
    expect(SPORT_CONFIGS.football.totalRosterSize).toBe(15)
  })

  it('baseball has correct roster size', () => {
    expect(SPORT_CONFIGS.baseball.totalRosterSize).toBe(27)
  })
})

describe('getLineupSlots', () => {
  it('returns football positions', () => {
    const slots = getLineupSlots('football')
    expect(slots).toContain('QB')
    expect(slots).toContain('FLEX')
    expect(slots).toContain('DEF')
  })

  it('returns baseball positions', () => {
    const slots = getLineupSlots('baseball')
    expect(slots).toContain('C')
    expect(slots).toContain('SS')
    expect(slots).toContain('SP1')
    expect(slots).toContain('RP1')
  })
})

describe('getTotalRosterSize', () => {
  it('returns 15 for football', () => {
    expect(getTotalRosterSize('football')).toBe(15)
  })
  it('returns 27 for baseball', () => {
    expect(getTotalRosterSize('baseball')).toBe(27)
  })
})

describe('isValidPosition', () => {
  it('validates football positions', () => {
    expect(isValidPosition('football', 'QB')).toBe(true)
    expect(isValidPosition('football', 'RB')).toBe(true)
    expect(isValidPosition('football', 'WR')).toBe(true)
    expect(isValidPosition('football', 'TE')).toBe(true)
    expect(isValidPosition('football', 'K')).toBe(true)
    expect(isValidPosition('football', 'DEF')).toBe(true)
    expect(isValidPosition('football', 'SP' as any)).toBe(false)
  })

  it('validates baseball positions', () => {
    expect(isValidPosition('baseball', 'C')).toBe(true)
    expect(isValidPosition('baseball', '1B')).toBe(true)
    expect(isValidPosition('baseball', 'SS')).toBe(true)
    expect(isValidPosition('baseball', 'OF')).toBe(true)
    expect(isValidPosition('baseball', 'SP')).toBe(true)
    expect(isValidPosition('baseball', 'RP')).toBe(true)
    expect(isValidPosition('baseball', 'UTIL')).toBe(true)
    expect(isValidPosition('baseball', 'QB' as any)).toBe(false)
  })
})

describe('getPositionGroup', () => {
  it('football FLEX accepts RB, WR, TE', () => {
    const groups = getPositionGroup('football')
    expect(groups.FLEX).toEqual(['RB', 'WR', 'TE'])
  })

  it('baseball P accepts SP and RP', () => {
    const groups = getPositionGroup('baseball')
    expect(groups.P).toEqual(['SP', 'RP'])
  })

  it('baseball UTIL accepts position players only', () => {
    const groups = getPositionGroup('baseball')
    expect(groups.UTIL).toContain('C')
    expect(groups.UTIL).toContain('SS')
    expect(groups.UTIL).not.toContain('SP')
    expect(groups.UTIL).not.toContain('RP')
  })
})

describe('getScoringTypes', () => {
  it('returns football scoring types', () => {
    expect(getScoringTypes('football')).toEqual(['standard', 'ppr', 'half-ppr'])
  })
  it('returns baseball scoring types', () => {
    expect(getScoringTypes('baseball')).toEqual(['roto', 'points', 'head-to-head'])
  })
})

describe('formatSportName', () => {
  it('capitalizes sport names', () => {
    expect(formatSportName('football')).toBe('Football')
    expect(formatSportName('baseball')).toBe('Baseball')
  })
})

describe('getDefaultScoringType', () => {
  it('defaults to ppr for football', () => {
    expect(getDefaultScoringType('football')).toBe('ppr')
  })
  it('defaults to roto for baseball', () => {
    expect(getDefaultScoringType('baseball')).toBe('roto')
  })
})
