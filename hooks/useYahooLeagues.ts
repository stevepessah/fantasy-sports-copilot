'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/yahoo/fetcher'

export interface YahooLeague {
  league_key: string
  league_id: string
  name: string
  url: string
  logo_url?: string
  num_teams: number
  scoring_type: string
  league_type: string
  season: string
  game_code: string
  draft_status: string
  is_finished?: string
  current_week?: string
  start_date?: string
  end_date?: string
}

interface LeaguesResponse {
  leagues: YahooLeague[]
}

export function useYahooLeagues(gameKey?: string) {
  const url = gameKey
    ? `/api/yahoo/leagues?game=${gameKey}`
    : '/api/yahoo/leagues?game=mlb'

  const { data, error, isLoading } = useSWR<LeaguesResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // 1 min dedup
  })

  // The fetcher attaches the parsed JSON body as `error.info`, which carries
  // the structured `code`/`message` from the API so the UI can show accurate,
  // actionable guidance (e.g. a 403 app-approval gate vs an expired session).
  const info = error?.info as { code?: string; message?: string } | undefined

  return {
    leagues: data?.leagues ?? [],
    isLoading,
    error: error ? info?.message ?? error.message ?? 'Failed to load leagues' : null,
    errorCode: error ? info?.code ?? 'yahoo_error' : null,
  }
}
