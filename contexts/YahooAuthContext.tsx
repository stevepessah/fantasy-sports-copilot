'use client'

import { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/yahoo/fetcher'

interface YahooAuthState {
  isAuthenticated: boolean
  isLoading: boolean
  /** Call to refetch auth status (e.g. after connect / disconnect). */
  mutate: () => void
}

const YahooAuthContext = createContext<YahooAuthState>({
  isAuthenticated: false,
  isLoading: true,
  mutate: () => {},
})

export function YahooAuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, mutate } = useSWR<{ authenticated: boolean }>(
    '/api/yahoo/status',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000, // avoid duplicate fetches within 30 s
    },
  )

  return (
    <YahooAuthContext.Provider
      value={{
        isAuthenticated: data?.authenticated ?? false,
        isLoading,
        mutate,
      }}
    >
      {children}
    </YahooAuthContext.Provider>
  )
}

export function useYahooAuth() {
  return useContext(YahooAuthContext)
}
