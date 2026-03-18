'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/yahoo/fetcher'

export interface YahooTeam {
  team_key: string
  team_id: string
  name: string
  url: string
  logo_url?: string
  managers?: Array<{
    manager_id: string
    nickname?: string
    guid: string
    is_commissioner?: string
    is_current_login?: string
  }>
}

interface TeamsResponse {
  teams: YahooTeam[]
}

export function useYahooTeams(leagueKey: string | null) {
  const { data, error, isLoading } = useSWR<TeamsResponse>(
    leagueKey
      ? `/api/yahoo/teams?leagueKey=${encodeURIComponent(leagueKey)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  )

  return {
    teams: data?.teams ?? [],
    isLoading,
    error: error?.message ?? null,
  }
}
