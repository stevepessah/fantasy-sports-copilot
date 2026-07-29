import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/contexts/YahooAuthContext', () => ({
  useYahooAuth: vi.fn(),
}))

vi.mock('@/contexts/LeagueContext', () => ({
  useLeague: vi.fn(),
}))

// YahooTeams renders only when a league is selected; stub it out.
vi.mock('@/components/YahooTeams', () => ({
  default: () => null,
}))

import YahooAuth from '@/components/YahooAuth'
import { useYahooAuth } from '@/contexts/YahooAuthContext'
import { useLeague } from '@/contexts/LeagueContext'

const mockAuth = vi.mocked(useYahooAuth)
const mockLeague = vi.mocked(useLeague)

function leagueState(overrides: Partial<ReturnType<typeof useLeague>> = {}) {
  return {
    selectedLeagueKey: null,
    setSelectedLeagueKey: vi.fn(),
    leagues: [],
    isLoading: false,
    error: null,
    errorCode: null,
    selectedLeague: undefined,
    ...overrides,
  } as ReturnType<typeof useLeague>
}

describe('YahooAuth leagues error states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      userGuid: 'g',
      userNickname: 'Steve',
      mutate: vi.fn(),
    } as ReturnType<typeof useYahooAuth>)
  })

  it('shows the Yahoo app-approval guidance (no Reconnect) for a 403 gate', () => {
    mockLeague.mockReturnValue(
      leagueState({
        error: 'Yahoo hasn’t authorized this app…',
        errorCode: 'yahoo_not_authorized',
      }),
    )
    render(<YahooAuth />)

    expect(screen.getByText(/hasn't approved this app for Fantasy API access/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Request Fantasy API access/i })
    expect(link).toHaveAttribute('href', 'https://sports.yahoo.com/developer/')
    // A 403 is not fixable by reconnecting, so no Reconnect control is shown.
    expect(screen.queryByText(/Reconnect Yahoo/i)).not.toBeInTheDocument()
  })

  it('shows a Reconnect control for an expired session (401)', () => {
    mockLeague.mockReturnValue(
      leagueState({
        error: 'Your Yahoo session has expired. Please reconnect your Yahoo account.',
        errorCode: 'yahoo_auth_expired',
      }),
    )
    render(<YahooAuth />)

    expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    expect(screen.getByText(/Reconnect Yahoo/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Request Fantasy API access/i })).not.toBeInTheDocument()
  })

  it('shows the league selector when leagues load successfully', () => {
    mockLeague.mockReturnValue(
      leagueState({
        leagues: [
          {
            league_key: '469.l.1',
            league_id: '1',
            name: 'My League',
            url: '',
            num_teams: 12,
            scoring_type: 'head',
            league_type: 'private',
            season: '2026',
            game_code: 'mlb',
            draft_status: 'postdraft',
          },
        ],
        selectedLeagueKey: '469.l.1',
      }),
    )
    render(<YahooAuth />)

    expect(screen.getByText(/Select League:/i)).toBeInTheDocument()
    expect(screen.queryByText(/Reconnect Yahoo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No leagues found/i)).not.toBeInTheDocument()
  })
})
