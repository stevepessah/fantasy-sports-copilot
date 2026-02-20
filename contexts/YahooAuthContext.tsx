'use client'

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/yahoo/fetcher'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

interface YahooAuthState {
  isAuthenticated: boolean
  isLoading: boolean
  userGuid: string | null
  /** Call to refetch auth status (e.g. after connect / disconnect). */
  mutate: () => void
}

const YahooAuthContext = createContext<YahooAuthState>({
  isAuthenticated: false,
  isLoading: true,
  userGuid: null,
  mutate: () => {},
})

export function YahooAuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, mutate } = useSWR<{ authenticated: boolean; userGuid: string | null }>(
    '/api/yahoo/status',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  )

  const hasFiredRef = useRef(false)

  // Fire GA4 event when a fresh Yahoo login is detected
  useEffect(() => {
    if (hasFiredRef.current || !data?.authenticated) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('yahoo_connected') !== 'true') return

    hasFiredRef.current = true

    // Send login event to GA4
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'yahoo_login', {
        yahoo_guid: data.userGuid ?? 'unknown',
      })
    }

    // Clean the query param from the URL
    params.delete('yahoo_connected')
    const cleanUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.replaceState({}, '', cleanUrl)
  }, [data])

  return (
    <YahooAuthContext.Provider
      value={{
        isAuthenticated: data?.authenticated ?? false,
        isLoading,
        userGuid: data?.userGuid ?? null,
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
