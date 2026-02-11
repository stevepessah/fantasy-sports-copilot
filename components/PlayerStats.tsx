'use client'

import { useState, useEffect } from 'react'
import { ParsedPlayerStats } from '@/lib/yahoo/xmlParser'

interface PlayerStatsProps {
  playerKey: string | null
  leagueKey?: string | null
  playerName?: string
}

// Baseball stat labels mapping
const BASEBALL_STAT_LABELS: Record<string, string> = {
  // Hitting stats
  'AB': 'At Bats',
  'H': 'Hits',
  'R': 'Runs',
  'HR': 'Home Runs',
  'RBI': 'RBI',
  'SB': 'Stolen Bases',
  'AVG': 'Average',
  'OBP': 'On-Base %',
  'SLG': 'Slugging %',
  'OPS': 'OPS',
  // Pitching stats
  'W': 'Wins',
  'L': 'Losses',
  'SV': 'Saves',
  'IP': 'Innings Pitched',
  'HA': 'Hits Allowed',
  'ER': 'Earned Runs',
  'BB': 'Walks',
  'K': 'Strikeouts',
  'ERA': 'ERA',
  'WHIP': 'WHIP',
  'K/9': 'K/9',
}

// Context-aware stat labels
const getContextualStatLabel = (key: string, isPitching: boolean): string => {
  if (key === 'H') {
    return isPitching ? 'Hits Allowed' : 'Hits'
  }
  return BASEBALL_STAT_LABELS[key] || key
}

export function PlayerStats({ playerKey, leagueKey, playerName }: PlayerStatsProps) {
  const currentYear = new Date().getFullYear()
  const [selectedHistoricalYear, setSelectedHistoricalYear] = useState<number>(currentYear - 1)
  const [statsRanges, setStatsRanges] = useState<any>(null)
  const [historicalStats, setHistoricalStats] = useState<any>(null)
  const [isLoadingRanges, setIsLoadingRanges] = useState(false)
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current season stats (simpler approach - just use the regular player-stats endpoint)
  useEffect(() => {
    if (!playerKey) {
      setStatsRanges(null)
      return
    }

    const fetchRangeStats = async () => {
      try {
        setIsLoadingRanges(true)
        setError(null)
        
        const params = new URLSearchParams({ playerKey })
        if (leagueKey) {
          params.append('leagueKey', leagueKey)
        }
        params.append('season', currentYear.toString())
        
        // Use the regular player-stats endpoint instead of ranges
        const response = await fetch(`/api/yahoo/player-stats?${params.toString()}`)
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please connect your Yahoo account.')
            return
          }
          throw new Error(`Failed to fetch player stats: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('🔍 Current Season Stats Response:', data)
        
        // The response has stats directly, not wrapped in a ranges object
        setStatsRanges(data.stats ? { season: data.stats } : null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch player stats')
        console.error('Error fetching Yahoo player stats:', err)
      } finally {
        setIsLoadingRanges(false)
      }
    }

    fetchRangeStats()
  }, [playerKey, leagueKey, currentYear])

  // Fetch historical stats for selected year
  useEffect(() => {
    if (!playerKey || !selectedHistoricalYear) {
      setHistoricalStats(null)
      return
    }

    const fetchHistoricalStats = async () => {
      try {
        setIsLoadingHistorical(true)
        
        const params = new URLSearchParams({ 
          playerKey,
          season: selectedHistoricalYear.toString()
        })
        if (leagueKey) {
          params.append('leagueKey', leagueKey)
        }
        
        const response = await fetch(`/api/yahoo/player-stats?${params.toString()}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch historical stats: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('🔍 Historical Stats API Response:', JSON.stringify(data, null, 2))
        setHistoricalStats(data.stats || null)
      } catch (err) {
        console.error('Error fetching historical stats:', err)
        setHistoricalStats(null)
      } finally {
        setIsLoadingHistorical(false)
      }
    }

    fetchHistoricalStats()
  }, [playerKey, leagueKey, selectedHistoricalYear])

  // Show message if no player key
  if (!playerKey) {
    return (
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-sm text-slate-400">
          {leagueKey 
            ? 'Player not found in your Yahoo league. Stats are only available for players in your league.'
            : 'Connect to Yahoo Fantasy to view player statistics.'}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    )
  }

  if (isLoadingRanges) {
    return (
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-sm text-slate-400">Loading statistics...</div>
      </div>
    )
  }

  // Format stat value
  const formatStat = (value: number | string): string => {
    if (typeof value === 'number') {
      if (value < 1 && value > 0) {
        return value.toFixed(3)
      }
      return value.toFixed(2)
    }
    return String(value)
  }

  // Get stat label
  const getStatLabel = (key: string, isPitching: boolean = false): string => {
    return getContextualStatLabel(key, isPitching)
  }

  // Extract and organize stats by category
  const organizeStats = (stats: any) => {
    const hittingStats: Array<{ key: string; value: number | string }> = []
    const pitchingStats: Array<{ key: string; value: number | string }> = []
    
    if (!stats) return { hittingStats, pitchingStats }
    
    Object.entries(stats).forEach(([key, value]) => {
      const upperKey = key.toUpperCase()
      if (['AB', 'H', 'R', 'HR', 'RBI', 'SB', 'AVG', 'OBP', 'SLG', 'OPS'].includes(upperKey)) {
        hittingStats.push({ key: upperKey, value: value as number | string })
      } else if (['W', 'L', 'SV', 'IP', 'ER', 'BB', 'K', 'ERA', 'WHIP', 'K/9', 'HA'].includes(upperKey)) {
        pitchingStats.push({ key: upperKey, value: value as number | string })
      }
    })
    
    return { hittingStats, pitchingStats }
  }

  const renderStatsSection = (title: string, stats: any, isPitching: boolean = false) => {
    if (!stats || Object.keys(stats).length === 0) {
      return null
    }

    return (
      <div className="grid grid-cols-3 gap-2 text-xs">
        {Object.entries(stats).slice(0, 9).map(([key, value]) => (
          <div key={key}>
            <div className="text-slate-400">{getStatLabel(key.toUpperCase(), isPitching)}</div>
            <div className="text-white font-semibold">{formatStat(value as number | string)}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <h4 className="text-sm font-semibold text-slate-300">Player Statistics</h4>

      {/* Current Season Stats */}
      <div className="space-y-3">
        <h5 className="text-xs font-semibold text-slate-400 uppercase">{currentYear} Season</h5>
        
        {/* Full Season Stats */}
        {statsRanges?.season && (
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <h6 className="text-sm font-semibold text-slate-300 mb-2">Season Stats</h6>
            {(() => {
              const seasonData = statsRanges.season.season_stats || statsRanges.season.ytd_stats || {}
              const { hittingStats, pitchingStats } = organizeStats(seasonData)
              
              console.log('📊 Organizing stats:', {
                seasonData,
                hittingStatsCount: hittingStats.length,
                pitchingStatsCount: pitchingStats.length
              })
              
              if (hittingStats.length === 0 && pitchingStats.length === 0) {
                return (
                  <div className="text-xs text-slate-400">
                    No stats available. Raw data: {JSON.stringify(Object.keys(seasonData)).substring(0, 100)}
                  </div>
                )
              }
              
              return (
                <>
                  {hittingStats.length > 0 && renderStatsSection('Hitting', Object.fromEntries(hittingStats.map(s => [s.key, s.value])), false)}
                  {pitchingStats.length > 0 && (
                    <div className="mt-3">
                      {renderStatsSection('Pitching', Object.fromEntries(pitchingStats.map(s => [s.key, s.value])), true)}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* This Week */}
        {statsRanges?.season?.week_stats && Object.keys(statsRanges.season.week_stats).length > 0 && (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <h6 className="text-xs font-semibold text-slate-300 mb-2">This Week</h6>
            {(() => {
              const { hittingStats, pitchingStats } = organizeStats(statsRanges.season.week_stats)
              return (
                <>
                  {hittingStats.length > 0 && renderStatsSection('Hitting', Object.fromEntries(hittingStats.map(s => [s.key, s.value])), false)}
                  {pitchingStats.length > 0 && (
                    <div className="mt-3">
                      {renderStatsSection('Pitching', Object.fromEntries(pitchingStats.map(s => [s.key, s.value])), true)}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* Historical Seasons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-semibold text-slate-400 uppercase">Historical Seasons</h5>
          <select
            value={selectedHistoricalYear}
            onChange={(e) => setSelectedHistoricalYear(parseInt(e.target.value, 10))}
            className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {[currentYear - 1, currentYear - 2, currentYear - 3].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        
        {isLoadingHistorical && (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <div className="text-xs text-slate-400">Loading {selectedHistoricalYear} stats...</div>
          </div>
        )}
        
        {!isLoadingHistorical && historicalStats && (() => {
          const historicalData = historicalStats.season_stats || historicalStats.ytd_stats || {}
          const { hittingStats, pitchingStats } = organizeStats(historicalData)
          
          console.log('📊 Historical stats organization:', {
            year: selectedHistoricalYear,
            historicalData,
            hittingStatsCount: hittingStats.length,
            pitchingStatsCount: pitchingStats.length
          })
          
          if (hittingStats.length === 0 && pitchingStats.length === 0) {
            return (
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <div className="text-xs text-slate-400">
                  No stats available for {selectedHistoricalYear}. 
                  Raw keys: {JSON.stringify(Object.keys(historicalData)).substring(0, 100)}
                </div>
              </div>
            )
          }
          
          return (
            <div className="p-3 bg-slate-800/30 rounded-lg">
              <h6 className="text-sm font-semibold text-slate-300 mb-2">{selectedHistoricalYear} Season</h6>
              {hittingStats.length > 0 && renderStatsSection('Hitting', Object.fromEntries(hittingStats.map(s => [s.key, s.value])), false)}
              {pitchingStats.length > 0 && (
                <div className="mt-3">
                  {renderStatsSection('Pitching', Object.fromEntries(pitchingStats.map(s => [s.key, s.value])), true)}
                </div>
              )}
            </div>
          )
        })()}
        
        {!isLoadingHistorical && !historicalStats && (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <div className="text-xs text-slate-400">No stats available for {selectedHistoricalYear}</div>
          </div>
        )}
      </div>

      {/* No stats message */}
      {!isLoadingRanges && !statsRanges && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <div className="text-sm text-slate-400">
            No statistics available. The player may not have played this season or stats may not be available yet.
          </div>
        </div>
      )}
    </div>
  )
}
