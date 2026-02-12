'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/yahoo/fetcher'

export function useYahooPlayerStats(
  playerKey: string | null,
  leagueKey?: string | null,
  season?: number | null,
) {
  // Build the cache key (URL) — null disables the request
  const url = playerKey
    ? (() => {
        const params = new URLSearchParams({ playerKey })
        if (leagueKey) params.append('leagueKey', leagueKey)
        if (season) params.append('season', season.toString())
        return `/api/yahoo/player-stats?${params.toString()}`
      })()
    : null

  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // 1 min dedup
  })

  return {
    stats: (data as any)?.stats ?? null,
    isLoading,
    error: error?.message ?? null,
  }
}
