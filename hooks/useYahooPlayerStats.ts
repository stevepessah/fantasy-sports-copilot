'use client'

import { useState, useEffect } from 'react'
import { ParsedPlayerStats } from '@/lib/yahoo/xmlParser'

export function useYahooPlayerStats(playerKey: string | null, leagueKey?: string | null, season?: number | null) {
  const [stats, setStats] = useState<ParsedPlayerStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!playerKey) {
      setStats(null)
      return
    }

    const fetchStats = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const params = new URLSearchParams({ playerKey })
        if (leagueKey) {
          params.append('leagueKey', leagueKey)
        }
        if (season) {
          params.append('season', season.toString())
        }
        
        const response = await fetch(`/api/yahoo/player-stats?${params.toString()}`)
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please connect your Yahoo account.')
            return
          }
          throw new Error(`Failed to fetch player stats: ${response.statusText}`)
        }
        
        const data = await response.json()
        setStats(data.stats || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch player stats')
        console.error('Error fetching Yahoo player stats:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [playerKey, leagueKey, season])

  return { stats, isLoading, error }
}
