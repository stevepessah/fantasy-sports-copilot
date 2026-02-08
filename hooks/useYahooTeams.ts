'use client'

import { useState, useEffect } from 'react'

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
  }>
}

export function useYahooTeams(leagueKey: string | null) {
  const [teams, setTeams] = useState<YahooTeam[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!leagueKey) {
      setTeams([])
      return
    }

    const fetchTeams = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch(`/api/yahoo/teams?leagueKey=${encodeURIComponent(leagueKey)}`)
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please connect your Yahoo account.')
            return
          }
          throw new Error(`Failed to fetch teams: ${response.statusText}`)
        }
        
        const data = await response.json()
        setTeams(data.teams || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch teams')
        console.error('Error fetching Yahoo teams:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTeams()
  }, [leagueKey])

  return { teams, isLoading, error }
}
