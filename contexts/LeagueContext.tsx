'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useYahooAuth } from './YahooAuthContext'
import { useYahooLeagues, YahooLeague } from '@/hooks/useYahooLeagues'

const STORAGE_KEY = 'fantasy_selected_league'

interface LeagueState {
  selectedLeagueKey: string | null
  setSelectedLeagueKey: (key: string) => void
  leagues: YahooLeague[]
  isLoading: boolean
  /** The full league object for the currently selected key */
  selectedLeague: YahooLeague | undefined
}

const LeagueContext = createContext<LeagueState>({
  selectedLeagueKey: null,
  setSelectedLeagueKey: () => {},
  leagues: [],
  isLoading: true,
  selectedLeague: undefined,
})

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useYahooAuth()
  const { leagues, isLoading } = useYahooLeagues('mlb')
  const [selectedLeagueKey, setKeyRaw] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setKeyRaw(stored)
    } catch { /* SSR / private-browsing guard */ }
    setHydrated(true)
  }, [])

  // Auto-select a league once data is available
  useEffect(() => {
    if (!hydrated || !isAuthenticated || leagues.length === 0) return

    const currentValid = selectedLeagueKey && leagues.some(l => l.league_key === selectedLeagueKey)
    if (currentValid) return

    const active = leagues.find(l => l.is_finished !== '1')
    setKeyRaw(active?.league_key ?? leagues[0].league_key)
  }, [hydrated, isAuthenticated, leagues, selectedLeagueKey])

  const setSelectedLeagueKey = useCallback((key: string) => {
    setKeyRaw(key)
    try { localStorage.setItem(STORAGE_KEY, key) } catch { /* noop */ }
  }, [])

  const selectedLeague = leagues.find(l => l.league_key === selectedLeagueKey)

  return (
    <LeagueContext.Provider
      value={{ selectedLeagueKey, setSelectedLeagueKey, leagues, isLoading, selectedLeague }}
    >
      {children}
    </LeagueContext.Provider>
  )
}

export function useLeague() {
  return useContext(LeagueContext)
}
