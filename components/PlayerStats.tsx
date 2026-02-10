'use client'

import { useState, useEffect } from 'react'
import { useYahooPlayerStats } from '@/hooks/useYahooPlayerStats'

interface PlayerStatsProps {
  playerKey: string | null
  leagueKey?: string | null
  playerName?: string
}

// Baseball stat labels mapping
const BASEBALL_STAT_LABELS: Record<string, string> = {
  // Hitting stats
  'AB': 'At Bats',
  'H': 'Hits', // Note: 'H' can mean "Hits" (hitting) or "Hits Allowed" (pitching) - handled contextually
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
  'HA': 'Hits Allowed', // Alternative stat ID for hits allowed
  'ER': 'Earned Runs',
  'BB': 'Walks',
  'K': 'Strikeouts',
  'ERA': 'ERA',
  'WHIP': 'WHIP',
  'K/9': 'K/9',
}

// Context-aware stat labels (for stats that appear in both hitting and pitching)
const getContextualStatLabel = (key: string, isPitching: boolean): string => {
  if (key === 'H') {
    return isPitching ? 'Hits Allowed' : 'Hits'
  }
  return BASEBALL_STAT_LABELS[key] || key
}

export function PlayerStats({ playerKey, leagueKey, playerName }: PlayerStatsProps) {
  const currentYear = new Date().getFullYear()
  const [selectedSeason, setSelectedSeason] = useState<number>(currentYear)
  const { stats, isLoading, error } = useYahooPlayerStats(playerKey, leagueKey, selectedSeason)
  
  // Available seasons (last 5 years)
  const availableSeasons = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Debug logging
  useEffect(() => {
    if (stats) {
      console.log('PlayerStats - Stats received:', {
        playerKey,
        leagueKey,
        season: selectedSeason,
        hasSeasonStats: !!stats.season_stats,
        hasWeekStats: !!stats.week_stats,
        statsKeys: stats.season_stats ? Object.keys(stats.season_stats) : [],
        fullStats: stats
      })
    }
  }, [stats, playerKey, leagueKey, selectedSeason])

  // Show message if no player key but we have a league (means player wasn't found in Yahoo)
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

  if (isLoading) {
    return (
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-sm text-slate-400">Loading statistics...</div>
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

  // Check if we have any stats at all
  const hasAnyStats = stats && (
    (stats.season_stats && Object.keys(stats.season_stats).length > 0) ||
    (stats.week_stats && Object.keys(stats.week_stats).length > 0) ||
    (stats.ytd_stats && Object.keys(stats.ytd_stats).length > 0)
  )

  if (!stats || !hasAnyStats) {
    return (
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-sm text-slate-400">
          {!playerKey 
            ? 'Player key not available. Make sure you\'re connected to Yahoo and the player is in your league.'
            : `No statistics available for ${selectedSeason}. The player may not have played this season or stats may not be available yet.`}
        </div>
        {stats && (
          <div className="mt-2 text-xs text-slate-500">
            Debug: Stats object exists but is empty. Player key: {playerKey?.substring(0, 20)}...
          </div>
        )}
      </div>
    )
  }

  const seasonStats = stats.season_stats || stats.ytd_stats || {}
  const weekStats = stats.week_stats

  // Format stat value
  const formatStat = (value: number | string): string => {
    if (typeof value === 'number') {
      // Format decimals to 3 places for averages, 2 for others
      if (value < 1 && value > 0) {
        return value.toFixed(3)
      }
      return value.toFixed(2)
    }
    return String(value)
  }

  // Get stat label (with context for ambiguous stats)
  const getStatLabel = (key: string, isPitching: boolean = false): string => {
    return getContextualStatLabel(key, isPitching)
  }

  // Organize stats by category
  const hittingStats: Array<{ key: string; value: number | string }> = []
  const pitchingStats: Array<{ key: string; value: number | string }> = []
  const otherStats: Array<{ key: string; value: number | string }> = []

  Object.entries(seasonStats).forEach(([key, value]) => {
    const upperKey = key.toUpperCase()
    if (['AB', 'H', 'R', 'HR', 'RBI', 'SB', 'AVG', 'OBP', 'SLG', 'OPS'].includes(upperKey)) {
      hittingStats.push({ key: upperKey, value })
    } else if (['W', 'L', 'SV', 'IP', 'ER', 'BB', 'K', 'ERA', 'WHIP', 'K/9', 'HA'].includes(upperKey)) {
      pitchingStats.push({ key: upperKey, value })
    } else {
      // Include other stats too
      otherStats.push({ key: upperKey, value })
    }
  })

  return (
    <div className="mt-4 space-y-4">
      {/* Season Selector */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-300">Statistics</h4>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(parseInt(e.target.value, 10))}
          className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {availableSeasons.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Season Stats */}
      {hittingStats.length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">{selectedSeason} Season Hitting Stats</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {hittingStats.map(({ key, value }) => (
              <div key={key}>
                <div className="text-slate-400">{getStatLabel(key, false)}</div>
                <div className="text-white font-semibold">{formatStat(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pitchingStats.length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">{selectedSeason} Season Pitching Stats</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {pitchingStats.map(({ key, value }) => (
              <div key={key}>
                <div className="text-slate-400">{getStatLabel(key, true)}</div>
                <div className="text-white font-semibold">{formatStat(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Stats (if any) */}
      {otherStats.length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Other Stats</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {otherStats.slice(0, 9).map(({ key, value }) => (
              <div key={key}>
                <div className="text-slate-400">{getStatLabel(key, false)}</div>
                <div className="text-white font-semibold">{formatStat(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week Stats */}
      {weekStats && Object.keys(weekStats).length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">This Week</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {Object.entries(weekStats).slice(0, 6).map(([key, value]) => (
              <div key={key}>
                <div className="text-slate-400">{getStatLabel(key.toUpperCase())}</div>
                <div className="text-white font-semibold">{formatStat(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
