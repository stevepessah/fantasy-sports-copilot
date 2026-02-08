'use client'

import { useState, useEffect } from 'react'

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

export function useYahooLeagues(gameKey?: string) {
  const [leagues, setLeagues] = useState<YahooLeague[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const url = gameKey 
          ? `/api/yahoo/leagues?game=${gameKey}`
          : '/api/yahoo/leagues?game=mlb' // Default to MLB
        
        const response = await fetch(url)
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please connect your Yahoo account.')
            return
          }
          throw new Error(`Failed to fetch leagues: ${response.statusText}`)
        }
        
        const data = await response.json()
        setLeagues(data.leagues || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch leagues')
        console.error('Error fetching Yahoo leagues:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeagues()
  }, [gameKey])

  return { leagues, isLoading, error }
}
