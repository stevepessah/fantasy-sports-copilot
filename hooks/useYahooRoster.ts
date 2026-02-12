'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/yahoo/fetcher'

export interface YahooRosterPlayer {
  player_key: string
  player_id: string
  name: {
    full: string
    first: string
    last: string
    ascii_first?: string
    ascii_last?: string
  }
  position_type: string
  eligible_positions: string[]
  selected_position: {
    position: string
    is_flex?: string
  }
  status?: string
  injury_status?: string
  editorial_team_full_name?: string
  editorial_team_abbr?: string
  uniform_number?: string
  display_position?: string
  image_url?: string
  is_undroppable?: string
  position?: string
}

interface RosterResponse {
  players: YahooRosterPlayer[]
}

export function useYahooRoster(teamKey: string | null) {
  const { data, error, isLoading } = useSWR<RosterResponse>(
    teamKey
      ? `/api/yahoo/roster?teamKey=${encodeURIComponent(teamKey)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  )

  return {
    players: data?.players ?? [],
    isLoading,
    error: error?.message ?? null,
  }
}
