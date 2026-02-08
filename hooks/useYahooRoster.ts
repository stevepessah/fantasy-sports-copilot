'use client'

import { useState, useEffect } from 'react'

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

export function useYahooRoster(teamKey: string | null) {
  const [players, setPlayers] = useState<YahooRosterPlayer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!teamKey) {
      setPlayers([])
      return
    }

    const fetchRoster = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch(`/api/yahoo/roster?teamKey=${encodeURIComponent(teamKey)}`)
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please connect your Yahoo account.')
            return
          }
          throw new Error(`Failed to fetch roster: ${response.statusText}`)
        }
        
        const data = await response.json()
        setPlayers(data.players || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch roster')
        console.error('Error fetching Yahoo roster:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoster()
  }, [teamKey])

  return { players, isLoading, error }
}
