import { describe, it, expect } from 'vitest'
import { buildMatchupPrompt } from '@/app/api/matchup-recap/route'
import type { MatchupRecapRequest } from '@/app/api/matchup-recap/route'

describe('buildMatchupPrompt', () => {
  const baseCategoryRequest: MatchupRecapRequest = {
    userTeamName: 'Sluggers',
    opponentName: 'Aces',
    week: 8,
    status: 'midevent',
    categoryResults: {
      userWins: 5,
      oppWins: 3,
      ties: 2,
      rows: [
        { stat: 'HR', userVal: 12, oppVal: 8, winner: 'user' },
        { stat: 'ERA', userVal: 3.45, oppVal: 3.12, winner: 'opp' },
        { stat: 'SB', userVal: 4, oppVal: 4, winner: 'tie' },
      ],
    },
  }

  it('includes team names, week, and status', () => {
    const prompt = buildMatchupPrompt(baseCategoryRequest)
    expect(prompt).toContain('Week 8')
    expect(prompt).toContain('Sluggers')
    expect(prompt).toContain('Aces')
    expect(prompt).toContain('In progress')
  })

  it('includes category tally', () => {
    const prompt = buildMatchupPrompt(baseCategoryRequest)
    expect(prompt).toContain('Sluggers 5')
    expect(prompt).toContain('Aces 3')
    expect(prompt).toContain('Tied 2')
  })

  it('includes stat-by-stat breakdown with winner markers', () => {
    const prompt = buildMatchupPrompt(baseCategoryRequest)
    expect(prompt).toContain('HR: Sluggers 12 vs Aces 8')
    expect(prompt).toContain('← winning')
    expect(prompt).toContain('ERA: Sluggers 3.45 vs Aces 3.12')
    expect(prompt).toContain('← losing')
    expect(prompt).toContain('SB: Sluggers 4 vs Aces 4')
    expect(prompt).toContain('(tied)')
  })

  it('renders postevent status as Final', () => {
    const prompt = buildMatchupPrompt({ ...baseCategoryRequest, status: 'postevent' })
    expect(prompt).toContain('Final')
  })

  it('renders preevent status as Upcoming', () => {
    const prompt = buildMatchupPrompt({ ...baseCategoryRequest, status: 'preevent' })
    expect(prompt).toContain('Upcoming')
  })

  it('handles points-league matchups without categories', () => {
    const pointsRequest: MatchupRecapRequest = {
      userTeamName: 'Sluggers',
      opponentName: 'Aces',
      week: 8,
      status: 'midevent',
      userPoints: 125.5,
      opponentPoints: 118.3,
    }
    const prompt = buildMatchupPrompt(pointsRequest)
    expect(prompt).toContain('125.5')
    expect(prompt).toContain('118.3')
    expect(prompt).not.toContain('CATEGORY BREAKDOWN')
  })

  it('includes win probability when provided', () => {
    const req: MatchupRecapRequest = {
      ...baseCategoryRequest,
      userWinProbability: 72,
      opponentWinProbability: 28,
    }
    const prompt = buildMatchupPrompt(req)
    expect(prompt).toContain('Sluggers 72%')
    expect(prompt).toContain('Aces 28%')
  })

  it('handles null stat values with dashes', () => {
    const req: MatchupRecapRequest = {
      userTeamName: 'Sluggers',
      opponentName: 'Aces',
      week: 1,
      status: 'preevent',
      categoryResults: {
        userWins: 0,
        oppWins: 0,
        ties: 0,
        rows: [
          { stat: 'HR', userVal: null, oppVal: null, winner: 'tie' },
        ],
      },
    }
    const prompt = buildMatchupPrompt(req)
    expect(prompt).toContain('Sluggers - vs Aces -')
  })

  it('omits ties line from tally when there are none', () => {
    const req: MatchupRecapRequest = {
      ...baseCategoryRequest,
      categoryResults: {
        userWins: 6,
        oppWins: 4,
        ties: 0,
        rows: baseCategoryRequest.categoryResults!.rows,
      },
    }
    const prompt = buildMatchupPrompt(req)
    expect(prompt).not.toContain('Tied')
  })
})
