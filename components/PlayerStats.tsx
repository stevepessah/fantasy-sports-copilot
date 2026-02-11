'use client'

import { useState, useEffect } from 'react'

interface PlayerStatsProps {
  playerKey: string | null
  leagueKey?: string | null
  playerName?: string
  positions?: string[]
}

interface StatEntry {
  value: number | string
  displayName: string
  positionType: string // 'B' for batter, 'P' for pitcher
  statId: string
}

type StatsSection = Record<string, StatEntry>

// Determine if player is a pitcher based on positions
function isPitcher(positions: string[]): boolean {
  const pitcherPositions = ['SP', 'RP', 'P']
  return positions.some(pos => pitcherPositions.includes(pos.toUpperCase()))
}

// Format stat value for display
function formatStatValue(value: number | string, displayName: string): string {
  if (typeof value === 'string') {
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return formatNumber(num, displayName)
  }
  return formatNumber(value, displayName)
}

function formatNumber(value: number, displayName: string): string {
  // Rate stats that should show as decimal (e.g., .232 not 0.232)
  const rateStats = ['AVG', 'OBP', 'SLG', 'OPS', 'WHIP', 'ERA', 'BAA', 'K/BB', 'K/9', 'BB/9']
  const isRate = rateStats.some(s => displayName.toUpperCase().includes(s))
  
  if (isRate) {
    // AVG/OBP/SLG/OPS/BAA: show as .XXX (3 decimal places, no leading zero for < 1)
    if (['AVG', 'OBP', 'SLG', 'OPS', 'BAA'].some(s => displayName.toUpperCase().includes(s))) {
      if (value >= 0 && value < 1) {
        return value.toFixed(3).replace(/^0/, '')
      }
      return value.toFixed(3)
    }
    // ERA, WHIP, K/9, BB/9, OPS: show with 2 decimal places
    return value.toFixed(2)
  }
  
  // Innings Pitched: show with 1 decimal (e.g., 156.2)
  if (displayName.toUpperCase().includes('IP') || displayName.toUpperCase().includes('INNINGS')) {
    return value.toFixed(1)
  }
  
  // Counting stats: show as whole numbers
  if (Number.isInteger(value)) {
    return value.toString()
  }
  
  // Default: round to nearest integer for counting stats
  return Math.round(value).toString()
}

export function PlayerStats({ playerKey, leagueKey, playerName, positions = [] }: PlayerStatsProps) {
  const currentYear = new Date().getFullYear()
  const [selectedHistoricalYear, setSelectedHistoricalYear] = useState<number>(currentYear - 1)
  const [currentStats, setCurrentStats] = useState<any>(null)
  const [historicalStats, setHistoricalStats] = useState<any>(null)
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false)
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const playerIsPitcher = isPitcher(positions)

  // Fetch current season stats
  useEffect(() => {
    if (!playerKey) {
      setCurrentStats(null)
      return
    }

    const fetchCurrentStats = async () => {
      try {
        setIsLoadingCurrent(true)
        setError(null)
        
        const params = new URLSearchParams({ playerKey })
        if (leagueKey) params.append('leagueKey', leagueKey)
        params.append('season', currentYear.toString())
        
        const response = await fetch(`/api/yahoo/player-stats?${params.toString()}`)
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Not authenticated. Please connect your Yahoo account.')
            return
          }
          throw new Error(`Failed to fetch player stats: ${response.statusText}`)
        }
        
        const data = await response.json()
        setCurrentStats(data.stats || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch player stats')
        console.error('Error fetching current stats:', err)
      } finally {
        setIsLoadingCurrent(false)
      }
    }

    fetchCurrentStats()
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
        if (leagueKey) params.append('leagueKey', leagueKey)
        
        const response = await fetch(`/api/yahoo/player-stats?${params.toString()}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch historical stats: ${response.statusText}`)
        }
        
        const data = await response.json()
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

  if (isLoadingCurrent) {
    return (
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-sm text-slate-400">Loading statistics...</div>
      </div>
    )
  }

  // Filter stats by position type
  function filterStatsByPosition(stats: StatsSection | undefined): StatEntry[] {
    if (!stats) return []
    
    const allStats = Object.values(stats)
    
    // Filter by position type
    const filtered = allStats.filter(stat => {
      if (playerIsPitcher) {
        return stat.positionType === 'P'
      } else {
        return stat.positionType === 'B'
      }
    })
    
    // If no stats matched the filter (e.g. stat categories failed to load),
    // show all stats as a fallback
    if (filtered.length === 0 && allStats.length > 0) {
      return allStats.filter(stat => stat.positionType !== 'unknown' || allStats.every(s => s.positionType === 'unknown'))
    }
    
    return filtered
  }

  // Render a grid of stats
  function renderStatsGrid(stats: StatEntry[]) {
    if (stats.length === 0) return null

    return (
      <div className="grid grid-cols-3 gap-2 text-xs">
        {stats.map((stat) => (
          <div key={stat.statId}>
            <div className="text-slate-400">{stat.displayName}</div>
            <div className="text-white font-semibold">
              {formatStatValue(stat.value, stat.displayName)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Render a stats section (season or week)
  function renderSection(title: string, statsSection: StatsSection | undefined) {
    const filtered = filterStatsByPosition(statsSection)
    if (filtered.length === 0) return null

    return (
      <div className="p-3 bg-slate-800/50 rounded-lg">
        <h6 className="text-sm font-semibold text-slate-300 mb-2">{title}</h6>
        {renderStatsGrid(filtered)}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <h4 className="text-sm font-semibold text-slate-300">
        Player Statistics {playerIsPitcher ? '(Pitching)' : '(Batting)'}
      </h4>

      {/* Current Season Stats */}
      {currentStats && (
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-slate-400 uppercase">{currentYear} Season</h5>
          
          {renderSection('Season Stats', currentStats.season_stats)}
          
          {currentStats.week_stats && Object.keys(currentStats.week_stats).length > 0 && (
            <div className="p-3 bg-slate-800/30 rounded-lg">
              <h6 className="text-xs font-semibold text-slate-300 mb-2">This Week</h6>
              {renderStatsGrid(filterStatsByPosition(currentStats.week_stats))}
            </div>
          )}
        </div>
      )}

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
          const seasonData = historicalStats.season_stats
          const filtered = filterStatsByPosition(seasonData)
          
          if (filtered.length === 0) {
            return (
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <div className="text-xs text-slate-400">No stats available for {selectedHistoricalYear}</div>
              </div>
            )
          }
          
          return (
            <div className="p-3 bg-slate-800/30 rounded-lg">
              <h6 className="text-sm font-semibold text-slate-300 mb-2">{selectedHistoricalYear} Season</h6>
              {renderStatsGrid(filtered)}
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
      {!isLoadingCurrent && !currentStats && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <div className="text-sm text-slate-400">
            No statistics available. The player may not have played this season or stats may not be available yet.
          </div>
        </div>
      )}
    </div>
  )
}
