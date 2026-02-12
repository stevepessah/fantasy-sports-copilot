'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/yahoo/fetcher'
import { ParsedLeague } from '@/lib/yahoo/xmlParser'
import type { ParsedStandingsTeam } from '@/lib/yahoo/xmlParser'

export interface HistorySeason {
  season: string
  leagues: ParsedLeague[]
}

export interface HistoryLeagueWithStandings extends ParsedLeague {
  standings: ParsedStandingsTeam[]
}

/**
 * Fetch all seasons the user has participated in
 */
export function useYahooSeasons() {
  const { data, error, isLoading } = useSWR<{ seasons: HistorySeason[] }>(
    '/api/yahoo/history',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 min dedup
    }
  )

  return {
    seasons: data?.seasons || [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch seasons') : null,
  }
}

/**
 * Fetch leagues + standings for a specific season
 */
export function useYahooSeasonHistory(season: number | null) {
  const { data, error, isLoading } = useSWR<{ season: number; gameKey: string; leagues: HistoryLeagueWithStandings[] }>(
    season ? `/api/yahoo/history?season=${season}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 min dedup — historical data doesn't change
    }
  )

  return {
    leagues: data?.leagues || [],
    gameKey: data?.gameKey || null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch season history') : null,
  }
}
