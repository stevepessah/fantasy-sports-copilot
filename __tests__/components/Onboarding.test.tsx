import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the YahooAuthContext before importing the component
vi.mock('@/contexts/YahooAuthContext', () => ({
  useYahooAuth: vi.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
    userGuid: null,
    userNickname: null,
    mutate: vi.fn(),
  })),
}))

import Onboarding from '@/components/Onboarding'
import { useYahooAuth } from '@/contexts/YahooAuthContext'

const mockUseYahooAuth = vi.mocked(useYahooAuth)

describe('Onboarding', () => {
  const onComplete = vi.fn()
  const onRunCommand = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseYahooAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      userGuid: null,
      userNickname: null,
      mutate: vi.fn(),
    })
  })

  it('renders the first step (Connect Yahoo) when not authenticated', () => {
    render(<Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />)
    expect(screen.getByText('Connect Your Yahoo Account')).toBeInTheDocument()
    expect(screen.getByText('Connect Yahoo Fantasy')).toBeInTheDocument()
  })

  it('auto-advances to step 2 (capabilities) when already authenticated', () => {
    mockUseYahooAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      userGuid: 'abc',
      userNickname: 'Steve',
      mutate: vi.fn(),
    })
    render(<Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />)
    expect(screen.getByText('What I Can Do')).toBeInTheDocument()
  })

  it('advances to step 2 with "Skip for now" when not authenticated', () => {
    render(<Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />)
    fireEvent.click(screen.getByText('Skip for now →'))
    expect(screen.getByText('What I Can Do')).toBeInTheDocument()
  })

  it('step 2 shows capabilities', () => {
    render(<Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />)
    fireEvent.click(screen.getByText('Skip for now →'))
    expect(screen.getByText('Optimize Lineup')).toBeInTheDocument()
    expect(screen.getByText('Trade Analysis')).toBeInTheDocument()
    expect(screen.getByText('Waiver Targets')).toBeInTheDocument()
    expect(screen.getByText('Draft Advice')).toBeInTheDocument()
    expect(screen.getByText('Player Stats')).toBeInTheDocument()
    expect(screen.getByText('Matchup Insights')).toBeInTheDocument()
  })

  it('advances to step 3 from step 2', () => {
    render(<Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />)
    fireEvent.click(screen.getByText('Skip for now →'))
    fireEvent.click(screen.getByText('Continue →'))
    expect(screen.getByText("Let's Get Started!")).toBeInTheDocument()
  })

  it('calls onComplete when a quick action is clicked in step 3', () => {
    vi.useFakeTimers()
    render(<Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />)
    fireEvent.click(screen.getByText('Skip for now →'))
    fireEvent.click(screen.getByText('Continue →'))
    fireEvent.click(screen.getByText(/Set my optimal lineup/))
    expect(onComplete).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(onRunCommand).toHaveBeenCalledWith('set my optimal lineup')
    vi.useRealTimers()
  })

  it('"Skip onboarding" calls onComplete from any early step', () => {
    render(<Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />)
    fireEvent.click(screen.getByText('Skip onboarding'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('renders 3 progress dots', () => {
    const { container } = render(
      <Onboarding onComplete={onComplete} onRunCommand={onRunCommand} />,
    )
    const dots = container.querySelectorAll('.rounded-full')
    expect(dots.length).toBe(3)
  })
})
