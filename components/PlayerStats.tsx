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
  positionType: string
  statId: string
}

type StatsSection = Record<string, StatEntry>

// Stat definitions: label to show, and display name patterns to match from Yahoo API
interface StatDef {
  label: string
  matchNames: string[] // Yahoo display_name values to match (case-insensitive)
  composite?: 'h_ab'  // Special composite stats
}

const BATTER_STATS: StatDef[] = [
  { label: 'GP', matchNames: ['GP', 'G'] },
  { label: 'H/AB', matchNames: [], composite: 'h_ab' },
  { label: 'AVG', matchNames: ['AVG'] },
  { label: 'OBP', matchNames: ['OBP'] },
  { label: 'OPS', matchNames: ['OPS'] },
  { label: 'R', matchNames: ['R'] },
  { label: 'HR', matchNames: ['HR'] },
  { label: 'RBI', matchNames: ['RBI'] },
  { label: 'SB', matchNames: ['SB'] },
  { label: 'BB', matchNames: ['BB'] },
  { label: 'K', matchNames: ['K', 'SO'] },
]

const PITCHER_STATS: StatDef[] = [
  { label: 'GP', matchNames: ['GP', 'G'] },
  { label: 'IP', matchNames: ['IP'] },
  { label: 'W', matchNames: ['W'] },
  { label: 'L', matchNames: ['L'] },
  { label: 'SV', matchNames: ['SV'] },
  { label: 'HLD', matchNames: ['HLD'] },
  { label: 'K', matchNames: ['K', 'SO'] },
  { label: 'ERA', matchNames: ['ERA'] },
  { label: 'WHIP', matchNames: ['WHIP'] },
  { label: 'QS', matchNames: ['QS'] },
]

// Determine if player is a pitcher based on positions
function isPitcher(positions: string[]): boolean {
  const pitcherPositions = ['SP', 'RP', 'P']
  return positions.some(pos => pitcherPositions.includes(pos.toUpperCase()))
}

// Format stat value for display
function formatStatValue(value: number | string, label: string): string {
  if (typeof value === 'string') {
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return formatNumber(num, label)
  }
  return formatNumber(value, label)
}

function formatNumber(value: number, label: string): string {
  const upper = label.toUpperCase()

  // Rate stats: AVG/OBP/SLG/OPS/BAA → .XXX
  if (['AVG', 'OBP', 'SLG', 'OPS', 'BAA'].includes(upper)) {
    if (value >= 0 && value < 1) {
      return value.toFixed(3).replace(/^0/, '')
    }
    return value.toFixed(3)
  }

  // ERA, WHIP → 2 decimal places
  if (['ERA', 'WHIP'].includes(upper)) {
    return value.toFixed(2)
  }

  // IP → 1 decimal place
  if (upper === 'IP') {
    return value.toFixed(1)
  }

  // All counting stats → whole numbers
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return Math.round(value).toString()
}

// Find a stat entry matching any of the given display names
function findStat(stats: StatsSection, matchNames: string[]): StatEntry | undefined {
  for (const name of matchNames) {
    const upper = name.toUpperCase()
    // Try exact match on key
    if (stats[name]) return stats[name]
    if (stats[upper]) return stats[upper]
    // Search all entries
    const found = Object.values(stats).find(
      s => s.displayName.toUpperCase() === upper
    )
    if (found) return found
  }
  return undefined
}

// Build the H/AB composite string
function buildHAB(stats: StatsSection): string {
  const hStat = findStat(stats, ['H'])
  const abStat = findStat(stats, ['AB'])
  if (hStat && abStat) {
    const h = typeof hStat.value === 'number' ? Math.round(hStat.value) : hStat.value
    const ab = typeof abStat.value === 'number' ? Math.round(abStat.value) : abStat.value
    return `${h}/${ab}`
  }
  if (hStat) return String(typeof hStat.value === 'number' ? Math.round(hStat.value) : hStat.value)
  return '-'
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
  const statDefs = playerIsPitcher ? PITCHER_STATS : BATTER_STATS

  // Fetch current season stats
  useEffect(() => {
    if (!playerKey) { setCurrentStats(null); return }

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
    if (!playerKey || !selectedHistoricalYear) { setHistoricalStats(null); return }

    const fetchHistoricalStats = async () => {
      try {
        setIsLoadingHistorical(true)
        const params = new URLSearchParams({ playerKey, season: selectedHistoricalYear.toString() })
        if (leagueKey) params.append('leagueKey', leagueKey)
        
        const response = await fetch(`/api/yahoo/player-stats?${params.toString()}`)
        if (!response.ok) throw new Error(`Failed to fetch historical stats: ${response.statusText}`)
        
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

  // Render the curated stats grid for a stats section
  function renderCuratedStats(statsSection: StatsSection | undefined) {
    if (!statsSection || Object.keys(statsSection).length === 0) return null

    const items: { label: string; value: string }[] = []

    for (const def of statDefs) {
      if (def.composite === 'h_ab') {
        items.push({ label: def.label, value: buildHAB(statsSection) })
      } else {
        const entry = findStat(statsSection, def.matchNames)
        if (entry) {
          items.push({ label: def.label, value: formatStatValue(entry.value, def.label) })
        }
      }
    }

    if (items.length === 0) return null

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-slate-400">{item.label}</div>
            <div className="text-white font-semibold">{item.value}</div>
          </div>
        ))}
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

          {currentStats.season_stats && Object.keys(currentStats.season_stats).length > 0 && (
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <h6 className="text-sm font-semibold text-slate-300 mb-2">Season Stats</h6>
              {renderCuratedStats(currentStats.season_stats)}
            </div>
          )}

          {currentStats.week_stats && Object.keys(currentStats.week_stats).length > 0 && (
            <div className="p-3 bg-slate-800/30 rounded-lg">
              <h6 className="text-xs font-semibold text-slate-300 mb-2">This Week</h6>
              {renderCuratedStats(currentStats.week_stats)}
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
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {isLoadingHistorical && (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <div className="text-xs text-slate-400">Loading {selectedHistoricalYear} stats...</div>
          </div>
        )}

        {!isLoadingHistorical && historicalStats?.season_stats && Object.keys(historicalStats.season_stats).length > 0 ? (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <h6 className="text-sm font-semibold text-slate-300 mb-2">{selectedHistoricalYear} Season</h6>
            {renderCuratedStats(historicalStats.season_stats)}
          </div>
        ) : (
          !isLoadingHistorical && (
            <div className="p-3 bg-slate-800/30 rounded-lg">
              <div className="text-xs text-slate-400">No stats available for {selectedHistoricalYear}</div>
            </div>
          )
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
