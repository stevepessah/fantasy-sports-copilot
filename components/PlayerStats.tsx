'use client'

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
  'H': 'Hits Allowed',
  'ER': 'Earned Runs',
  'BB': 'Walks',
  'K': 'Strikeouts',
  'ERA': 'ERA',
  'WHIP': 'WHIP',
  'K/9': 'K/9',
}

export function PlayerStats({ playerKey, leagueKey, playerName }: PlayerStatsProps) {
  const { stats, isLoading, error } = useYahooPlayerStats(playerKey, leagueKey)

  if (!playerKey) {
    return null
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

  if (!stats || !stats.season_stats) {
    return (
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-sm text-slate-400">No statistics available</div>
      </div>
    )
  }

  const seasonStats = stats.season_stats
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

  // Get stat label
  const getStatLabel = (key: string): string => {
    return BASEBALL_STAT_LABELS[key] || key
  }

  // Organize stats by category
  const hittingStats: Array<{ key: string; value: number | string }> = []
  const pitchingStats: Array<{ key: string; value: number | string }> = []

  Object.entries(seasonStats).forEach(([key, value]) => {
    const upperKey = key.toUpperCase()
    if (['AB', 'H', 'R', 'HR', 'RBI', 'SB', 'AVG', 'OBP', 'SLG', 'OPS'].includes(upperKey)) {
      hittingStats.push({ key: upperKey, value })
    } else if (['W', 'L', 'SV', 'IP', 'ER', 'BB', 'K', 'ERA', 'WHIP', 'K/9'].includes(upperKey)) {
      pitchingStats.push({ key: upperKey, value })
    }
  })

  return (
    <div className="mt-4 space-y-4">
      {/* Season Stats */}
      {hittingStats.length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Season Hitting Stats</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {hittingStats.map(({ key, value }) => (
              <div key={key}>
                <div className="text-slate-400">{getStatLabel(key)}</div>
                <div className="text-white font-semibold">{formatStat(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pitchingStats.length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Season Pitching Stats</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {pitchingStats.map(({ key, value }) => (
              <div key={key}>
                <div className="text-slate-400">{getStatLabel(key)}</div>
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
