'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import AuthRequiredMessage, { isAuthError } from '@/components/AuthRequiredMessage'
import {
  type ColDef,
  type LeagueStatCategory,
  fmtStat,
  buildHAB,
  buildColsFromCategories,
  FALLBACK_BATTER_COLS,
  FALLBACK_PITCHER_COLS,
} from '@/lib/statFormatters'

interface PlayersViewProps {
  leagueKey: string | null
  onAction?: (cmd: string) => void
}

const CURRENT_YEAR = new Date().getFullYear()
const SEASON_OPTIONS = [
  { value: 0, label: `${CURRENT_YEAR} (Current)` },
  { value: CURRENT_YEAR - 1, label: `${CURRENT_YEAR - 1}` },
  { value: CURRENT_YEAR - 2, label: `${CURRENT_YEAR - 2}` },
  { value: CURRENT_YEAR - 3, label: `${CURRENT_YEAR - 3}` },
]

const MLB_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BOS', 'CHC', 'CWS', 'CIN', 'CLE', 'COL', 'DET',
  'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'OAK',
  'PHI', 'PIT', 'SD', 'SF', 'SEA', 'STL', 'TB', 'TEX', 'TOR', 'WSH',
]

const PLAYER_STATUS_OPTIONS = [
  { value: '', label: 'All Players' },
  { value: 'A', label: 'Available' },
  { value: 'FA', label: 'Free Agents' },
  { value: 'W', label: 'Waivers' },
  { value: 'T', label: 'Taken' },
] as const

const BATTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'Util'] as const
const PITCHER_POSITIONS = ['SP', 'RP'] as const

function statSortValue(pl: any, colKey: string, composite?: string): number {
  if (composite === 'h_ab') {
    const h = pl.stats?.['H']
    return h !== undefined ? (typeof h === 'number' ? h : parseFloat(h) || 0) : -Infinity
  }
  const v = pl.stats?.[colKey]
  if (v === undefined || v === '') return -Infinity
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? -Infinity : n
}

function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

function compactPositions(pl: any): string {
  const HIDE = new Set(['Util', 'BN', 'IL', 'IL+', 'NA'])
  const pos = (pl.positions || []).filter((p: string) => !HIDE.has(p))
  if (pos.length > 0) return pos.join(',')
  return pl.displayPosition || '-'
}

const PAGE_SIZE = 25
const ADD_COL_W = 32

export default function PlayersView({ leagueKey, onAction }: PlayersViewProps) {
  const { leagues } = useYahooLeagues('mlb')
  const effectiveLeagueKey = leagueKey ?? leagues[0]?.league_key ?? null

  const [positionType, setPositionType] = useState<'B' | 'P'>('B')
  const [leagueCategories, setLeagueCategories] = useState<LeagueStatCategory[] | null>(null)

  const batterCols = useMemo(
    () => leagueCategories ? buildColsFromCategories(leagueCategories, 'B') : FALLBACK_BATTER_COLS,
    [leagueCategories],
  )
  const pitcherCols = useMemo(
    () => leagueCategories ? buildColsFromCategories(leagueCategories, 'P') : FALLBACK_PITCHER_COLS,
    [leagueCategories],
  )
  const cols = positionType === 'P' ? pitcherCols : batterCols

  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('All')
  const [teamFilter, setTeamFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedSeason, setSelectedSeason] = useState(0)

  const cacheKey = (pt: string, status: string, season: number) =>
    `${effectiveLeagueKey || ''}_${pt}_${status}_${season}`

  const [playerCache, setPlayerCache] = useState<Record<string, any[]>>({})
  const [totalCache, setTotalCache] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentCacheKey = cacheKey(positionType, statusFilter, selectedSeason)

  const fetchPlayers = useCallback(async (pt: string, status: string, season: number) => {
    const key = cacheKey(pt, status, season)
    if (playerCache[key]) return
    if (!effectiveLeagueKey) return

    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/yahoo/league-players', window.location.origin)
      url.searchParams.set('leagueKey', effectiveLeagueKey)
      url.searchParams.set('positionType', pt)
      url.searchParams.set('status', status)
      if (season > 0) url.searchParams.set('season', season.toString())

      const res = await fetch(url.toString())
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        if (res.status === 401 || text.includes('auth')) {
          throw new Error('AUTH_REQUIRED')
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()

      setPlayerCache(prev => ({ ...prev, [key]: data.players || [] }))
      setTotalCache(prev => ({ ...prev, [key]: data.total || 0 }))
      if (data.leagueCategories) setLeagueCategories(data.leagueCategories)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLeagueKey, playerCache])

  useEffect(() => {
    if (!playerCache[currentCacheKey]) {
      fetchPlayers(positionType, statusFilter, selectedSeason)
    }
  }, [positionType, statusFilter, selectedSeason, currentCacheKey, fetchPlayers, playerCache])

  const allPlayers: any[] = playerCache[currentCacheKey] || []
  const totalCount = totalCache[currentCacheKey] || 0

  const filtered = allPlayers.filter((pl: any) => {
    if (positionFilter !== 'All') {
      const positions: string[] = pl.positions || []
      const dp: string = pl.displayPosition || ''
      if (!positions.some(pos => pos.toUpperCase() === positionFilter.toUpperCase()) &&
          dp.toUpperCase() !== positionFilter.toUpperCase()) {
        return false
      }
    }
    if (teamFilter !== 'All') {
      if ((pl.team || '').toUpperCase() !== teamFilter.toUpperCase()) {
        return false
      }
    }
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      const name = (pl.name || '').toLowerCase()
      const team = (pl.team || '').toLowerCase()
      const positions = (pl.positions || []).join(' ').toLowerCase()
      const displayPos = (pl.displayPosition || '').toLowerCase()
      if (!name.includes(q) && !team.includes(q) && !positions.includes(q) && !displayPos.includes(q)) {
        return false
      }
    }
    return true
  })

  const sorted = [...filtered]
  if (sortCol !== null) {
    const colDef = cols.find(c => c.key === sortCol)
    sorted.sort((a, b) => {
      if (sortCol === '__name') {
        const cmp = (a.name || '').localeCompare(b.name || '')
        return sortAsc ? cmp : -cmp
      }
      const av = statSortValue(a, sortCol, colDef?.composite)
      const bv = statSortValue(b, sortCol, colDef?.composite)
      return sortAsc ? av - bv : bv - av
    })
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const startIdx = page * PAGE_SIZE
  const pageItems = sorted.slice(startIdx, startIdx + PAGE_SIZE)

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(key)
      setSortAsc(false)
    }
    setPage(0)
  }

  const sortIndicator = (key: string) => {
    if (sortCol !== key) return ''
    return sortAsc ? ' ▲' : ' ▼'
  }

  const handleSeasonChange = (season: number) => {
    setSelectedSeason(season)
    setPage(0)
    setSortCol(null)
    setSortAsc(false)
  }

  const handlePositionTypeChange = (pt: 'B' | 'P') => {
    setPositionType(pt)
    setPositionFilter('All')
    setPage(0)
    setSortCol(null)
    setSortAsc(false)
  }

  const handleStatusChange = (status: string) => {
    setStatusFilter(status)
    setPage(0)
    setSortCol(null)
    setSortAsc(false)
  }

  const availableTeams = Array.from(
    new Set(allPlayers.map((pl: any) => (pl.team || '').toUpperCase()).filter(Boolean))
  ).sort()

  const positionOptions = positionType === 'P' ? PITCHER_POSITIONS : BATTER_POSITIONS

  if (!effectiveLeagueKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Select a league to view players
      </div>
    )
  }

  if (error && isAuthError(error)) {
    return <AuthRequiredMessage />
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4">
        {/* Batters/Pitchers toggle */}
        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={() => handlePositionTypeChange('B')}
            className={`flex-1 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
              positionType === 'B'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
            }`}
          >
            Batters
          </button>
          <button
            onClick={() => handlePositionTypeChange('P')}
            className={`flex-1 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
              positionType === 'P'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
            }`}
          >
            Pitchers
          </button>
        </div>

        {/* Position pills */}
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => { setPositionFilter('All'); setPage(0) }}
            className={`shrink-0 px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-full transition-colors ${
              positionFilter === 'All'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
            }`}
          >
            All
          </button>
          {positionOptions.map((pos) => (
            <button
              key={pos}
              onClick={() => { setPositionFilter(pos); setPage(0) }}
              className={`shrink-0 px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-full transition-colors ${
                positionFilter === pos
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Filters: team, status, season, search, count */}
        <div className="flex items-center gap-1 sm:gap-1.5 mb-3 flex-wrap">
          <select
            value={teamFilter}
            onChange={(e) => { setTeamFilter(e.target.value); setPage(0) }}
            className="text-[10px] sm:text-[11px] bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="All">All Teams</option>
            {(availableTeams.length > 0 ? availableTeams : MLB_TEAMS).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-[10px] sm:text-[11px] bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {PLAYER_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={selectedSeason}
            onChange={(e) => handleSeasonChange(parseInt(e.target.value, 10))}
            className="text-[10px] sm:text-[11px] bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {SEASON_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex-1" />
          <div className="relative">
            <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filterText}
              onChange={(e) => { setFilterText(e.target.value); setPage(0) }}
              placeholder="Search…"
              className="w-24 sm:w-36 text-[10px] sm:text-[11px] bg-slate-700 border border-slate-600 rounded pl-5 sm:pl-6 pr-1.5 sm:pr-2 py-0.5 sm:py-1 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            {filterText && (
              <button
                onClick={() => { setFilterText(''); setPage(0) }}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label="Clear filter"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap">
            {(filterText || positionFilter !== 'All' || teamFilter !== 'All') ? `${filtered.length}/` : ''}{totalCount}
            {totalPages > 1 && <> · {page + 1}/{totalPages}</>}
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading players…
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-6">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => { setError(null); fetchPlayers(positionType, statusFilter, selectedSeason) }}
              className="mt-2 text-xs text-primary-400 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
              <div className="table-scroll-hint">
              <div className="overflow-x-auto">
                <table className="w-full text-[9px] sm:text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="w-8 px-0.5 sm:px-1 py-1.5 sticky left-0 bg-slate-800/90 z-10" />
                      <th
                        className="text-left px-0.5 sm:px-1.5 py-1.5 text-slate-500 uppercase tracking-wide font-semibold cursor-pointer hover:text-slate-300 sticky bg-slate-800/90 z-10 min-w-[90px] sm:min-w-[130px]"
                        style={{ left: ADD_COL_W }}
                        onClick={() => handleSort('__name')}
                      >
                        Player{sortIndicator('__name')}
                      </th>
                      {cols.map((col) => (
                        <th
                          key={col.key}
                          className="text-right px-[3px] sm:px-1.5 py-1.5 text-slate-500 uppercase tracking-wide font-semibold cursor-pointer hover:text-slate-300 whitespace-nowrap"
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}{sortIndicator(col.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/20">
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={cols.length + 2} className="text-center py-8 text-xs text-slate-500">
                          No players found
                        </td>
                      </tr>
                    )}
                    {pageItems.map((pl: any, idx: number) => {
                      const isTaken = pl.ownershipType === 'team'
                      return (
                      <tr
                        key={pl.playerKey || idx}
                        className="hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-0.5 sm:px-1 py-0.5 sm:py-1 sticky left-0 bg-slate-800/90 z-10 w-8">
                          {isTaken ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); onAction?.(`propose trade for ${pl.name}`) }}
                              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 active:bg-blue-600/60 border border-blue-600/30 text-sm font-bold leading-none transition-colors"
                              title={`Propose trade for ${pl.name}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); onAction?.(`add ${pl.name}`) }}
                              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 active:bg-green-600/60 border border-green-600/30 text-sm font-bold leading-none transition-colors"
                              title={`Add ${pl.name}`}
                            >
                              +
                            </button>
                          )}
                        </td>
                        <td
                          className="px-0.5 sm:px-1.5 py-0.5 sm:py-1 sticky bg-slate-800/90 z-10 min-w-[90px] sm:min-w-[130px] cursor-pointer"
                          style={{ left: ADD_COL_W }}
                          onClick={() => onAction?.(`tell me about ${pl.name}${pl.playerKey ? ` [pk:${pl.playerKey}]` : ''}`)}
                        >
                          <div className="sm:hidden">
                            <span className="font-medium text-white truncate text-[14px]">{abbreviateName(pl.name)}</span>
                            <span className="text-slate-500 ml-1">{pl.team}·{compactPositions(pl)}</span>
                            {isTaken && pl.ownerTeamName && (
                              <div className="text-[9px] text-blue-400/70 truncate">{pl.ownerTeamName}</div>
                            )}
                          </div>
                          <div className="hidden sm:block">
                            <div className="font-medium text-white truncate max-w-[200px] text-[14px]">{pl.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {pl.team} · {compactPositions(pl)}
                              {isTaken && pl.ownerTeamName && (
                                <span className="text-blue-400/70 ml-1">· {pl.ownerTeamName}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {cols.map((col) => (
                          <td key={col.key} className="text-right px-[3px] sm:px-1.5 py-0.5 sm:py-1 text-slate-300 whitespace-nowrap tabular-nums">
                            {col.composite === 'h_ab'
                              ? buildHAB(pl.stats || {})
                              : fmtStat(pl.stats?.[col.key], col)}
                          </td>
                        ))}
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((pg) => Math.max(0, pg - 1))}
                  className="px-2.5 py-1.5 text-[10px] sm:text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
                >
                  ←
                </button>
                <span className="text-[10px] sm:text-[11px] text-slate-400">
                  {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((pg) => Math.min(totalPages - 1, pg + 1))}
                  className="px-2.5 py-1.5 text-[10px] sm:text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
