'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import { useYahooTeams } from '@/hooks/useYahooTeams'
import AuthRequiredMessage, { isAuthError } from '@/components/AuthRequiredMessage'
import type { RosterPlayerEntry } from '@/app/api/yahoo/roster-stats/route'
import {
  type ColDef,
  type LeagueStatCategory,
  buildColsFromCategories,
  fmtStat,
  buildHAB,
  FALLBACK_BATTER_COLS,
  FALLBACK_PITCHER_COLS,
} from '@/lib/statFormatters'

// ── Date range options ──

interface DateRangeOption {
  id: string
  label: string
  dateRange?: string
  season?: number
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { id: 'today', label: 'Today', dateRange: `date=${today()}` },
  { id: 'last7', label: 'Last 7', dateRange: 'lastweek' },
  { id: 'last14', label: 'Last 14', dateRange: 'last2weeks' },
  { id: 'last30', label: 'Last 30', dateRange: 'lastmonth' },
  { id: '2026', label: '2026' },
  { id: '2025', label: '2025', season: 2025 },
  { id: '2024', label: '2024', season: 2024 },
]

const DATE_RANGE_DISPLAY: Record<string, string> = {
  today: "today's games",
  last7: 'the last 7 days',
  last14: 'the last 14 days',
  last30: 'the last 30 days',
  '2026': 'the 2026 season',
  '2025': 'the 2025 season',
  '2024': 'the 2024 season',
}

// ── Component ──

interface MyRosterProps {
  leagueKey: string | null
}

export default function MyRoster({ leagueKey }: MyRosterProps) {
  const { leagues } = useYahooLeagues('mlb')
  const effectiveLeagueKey = leagueKey ?? leagues[0]?.league_key ?? null
  const { teams, isLoading: teamsLoading } = useYahooTeams(effectiveLeagueKey)

  const userTeam = useMemo(
    () => teams.find((t) => t.managers?.some((m) => m.is_current_login === '1')),
    [teams],
  )

  const [selectedRange, setSelectedRange] = useState<string>('today')
  const [players, setPlayers] = useState<RosterPlayerEntry[]>([])
  const [leagueCategories, setLeagueCategories] = useState<LeagueStatCategory[] | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [recapSummary, setRecapSummary] = useState<string | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)

  const activeRange = useMemo(
    () => DATE_RANGE_OPTIONS.find((o) => o.id === selectedRange) ?? DATE_RANGE_OPTIONS[0],
    [selectedRange],
  )

  // Fetch roster stats whenever team, league, or date range changes
  useEffect(() => {
    if (!userTeam?.team_key) return

    let cancelled = false
    setRosterLoading(true)
    setError(null)

    const params = new URLSearchParams({ teamKey: userTeam.team_key })
    if (effectiveLeagueKey) params.set('leagueKey', effectiveLeagueKey)
    if (activeRange.dateRange) params.set('dateRange', activeRange.dateRange)
    if (activeRange.season) params.set('season', String(activeRange.season))

    fetch(`/api/yahoo/roster-stats?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch roster (${res.status})`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setPlayers(json.players ?? [])
        setLeagueCategories(json.leagueCategories ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false)
      })

    return () => { cancelled = true }
  }, [userTeam?.team_key, effectiveLeagueKey, activeRange])

  // Fetch LLM recap after players load
  const fetchRecap = useCallback(
    (rosterPlayers: RosterPlayerEntry[], teamName: string, rangeId: string) => {
      if (rosterPlayers.length === 0) {
        setRecapSummary(null)
        return
      }

      setRecapLoading(true)
      setRecapSummary(null)

      const payload = {
        players: rosterPlayers.map((p) => ({
          name: p.name,
          positionType: p.positionType,
          selectedPosition: p.selectedPosition,
          stats: p.stats,
          injuryStatus: p.injuryStatus,
        })),
        teamName,
        dateRangeLabel: DATE_RANGE_DISPLAY[rangeId] ?? rangeId,
      }

      fetch('/api/roster-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((json) => {
          setRecapSummary(json.summary ?? null)
        })
        .catch(() => {
          setRecapSummary(null)
        })
        .finally(() => setRecapLoading(false))
    },
    [],
  )

  useEffect(() => {
    if (players.length > 0 && userTeam?.name) {
      fetchRecap(players, userTeam.name, selectedRange)
    }
  }, [players, userTeam?.name, selectedRange, fetchRecap])

  const batterCols = useMemo(
    () => leagueCategories ? buildColsFromCategories(leagueCategories, 'B') : FALLBACK_BATTER_COLS,
    [leagueCategories],
  )
  const pitcherCols = useMemo(
    () => leagueCategories ? buildColsFromCategories(leagueCategories, 'P') : FALLBACK_PITCHER_COLS,
    [leagueCategories],
  )

  const batters = useMemo(() => players.filter((p) => p.positionType === 'B'), [players])
  const pitchers = useMemo(() => players.filter((p) => p.positionType === 'P'), [players])

  if (!effectiveLeagueKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Select a league to view your roster
      </div>
    )
  }

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading roster…
        </div>
      </div>
    )
  }

  if (isAuthError(error ?? '')) return <AuthRequiredMessage />

  if (!userTeam && !teamsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Could not find your team in this league
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
        {/* Team header */}
        <div className="flex items-center gap-3 mb-4 px-1">
          {userTeam?.logo_url && (
            <img src={userTeam.logo_url} alt="" className="w-9 h-9 rounded-lg" />
          )}
          <div>
            <h2 className="text-lg font-bold text-white">{userTeam?.name ?? 'My Team'}</h2>
            <p className="text-xs text-slate-400">
              {players.length} players
            </p>
          </div>
        </div>

        {/* Date range picker */}
        <DateRangePicker
          selected={selectedRange}
          onChange={setSelectedRange}
          disabled={rosterLoading}
        />

        {/* LLM recap banner */}
        <RecapBanner loading={recapLoading} summary={recapSummary} />

        {/* Inline error for date-range fetch failures */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Stats tables */}
        {rosterLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading stats…
            </div>
          </div>
        ) : players.length > 0 ? (
          <div className="space-y-5">
            {batters.length > 0 && (
              <RosterStatsTable
                title="Batters"
                players={batters}
                cols={batterCols}
              />
            )}
            {pitchers.length > 0 && (
              <RosterStatsTable
                title="Pitchers"
                players={pitchers}
                cols={pitcherCols}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Date Range Picker ──

function DateRangePicker({
  selected,
  onChange,
  disabled,
}: {
  selected: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4 px-1">
      {DATE_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          disabled={disabled}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            selected === opt.id
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── LLM Recap Banner ──

const COLLAPSED_MAX_HEIGHT = 108 // ~6 lines at text-sm leading-relaxed (18px line-height)

function RecapBanner({
  loading,
  summary,
}: {
  loading: boolean
  summary: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [needsClamp, setNeedsClamp] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    setExpanded(false)
  }, [summary])

  useEffect(() => {
    if (!textRef.current) return
    setNeedsClamp(textRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT)
  }, [summary])

  if (!loading && !summary) return null

  return (
    <div className="mb-5 rounded-xl border border-slate-700/50 bg-gradient-to-r from-slate-800/60 to-slate-800/40 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-sm shrink-0" aria-hidden>
          ✦
        </span>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded bg-slate-700/60 animate-pulse" />
              <div className="h-3.5 w-11/12 rounded bg-slate-700/60 animate-pulse" />
              <div className="h-3.5 w-4/5 rounded bg-slate-700/60 animate-pulse" />
            </div>
          ) : (
            <>
              <div
                className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                style={{
                  maxHeight: expanded || !needsClamp ? '600px' : `${COLLAPSED_MAX_HEIGHT}px`,
                }}
              >
                <p
                  ref={textRef}
                  className="text-sm leading-relaxed text-slate-200"
                >
                  {summary}
                </p>
              </div>
              {needsClamp && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {expanded ? 'Read less' : 'Read more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RosterStatsTable({
  title,
  players,
  cols,
}: {
  title: string
  players: RosterPlayerEntry[]
  cols: ColDef[]
}) {
  const activePlayers = players.filter(
    (p) => !['BN', 'IL', 'IL+', 'DL', 'NA'].includes(p.selectedPosition),
  )
  const benchPlayers = players.filter((p) => p.selectedPosition === 'BN')
  const ilPlayers = players.filter((p) =>
    ['IL', 'IL+', 'DL', 'NA'].includes(p.selectedPosition),
  )

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <div className="table-scroll-hint">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] sm:text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60">
                <th className="py-2 pl-3 pr-1 text-left font-semibold text-slate-400 w-10 sticky left-0 bg-slate-800/95 z-10">
                  Pos
                </th>
                <th className="py-2 px-1 text-left font-semibold text-slate-400 sticky left-10 bg-slate-800/95 z-10 min-w-[120px] sm:min-w-[170px]">
                  {title}
                </th>
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className="py-2 px-1.5 sm:px-2 text-right font-semibold text-slate-400 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activePlayers.map((player) => (
                <PlayerRow key={player.playerKey} player={player} cols={cols} />
              ))}
              {benchPlayers.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={cols.length + 2}
                      className="py-1.5 px-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/30 border-t border-slate-700/50"
                    >
                      Bench
                    </td>
                  </tr>
                  {benchPlayers.map((player) => (
                    <PlayerRow key={player.playerKey} player={player} cols={cols} dimmed />
                  ))}
                </>
              )}
              {ilPlayers.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={cols.length + 2}
                      className="py-1.5 px-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/30 border-t border-slate-700/50"
                    >
                      Injured List
                    </td>
                  </tr>
                  {ilPlayers.map((player) => (
                    <PlayerRow key={player.playerKey} player={player} cols={cols} dimmed />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PlayerRow({
  player,
  cols,
  dimmed,
}: {
  player: RosterPlayerEntry
  cols: ColDef[]
  dimmed?: boolean
}) {
  const posColor = getPositionColor(player.selectedPosition)

  return (
    <tr
      className={`border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20 transition-colors ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      <td className="py-1.5 pl-3 pr-1 sticky left-0 bg-slate-800/95 z-10">
        <span
          className={`inline-flex items-center justify-center w-7 h-5 rounded text-[9px] sm:text-[10px] font-bold ${posColor}`}
        >
          {player.selectedPosition}
        </span>
      </td>
      <td className="py-1.5 px-1 sticky left-10 bg-slate-800/95 z-10 min-w-[120px] sm:min-w-[170px]">
        <div className="flex items-center gap-1.5">
          {player.imageUrl && (
            <img
              src={player.imageUrl}
              alt=""
              className="w-9 h-9 rounded-full shrink-0 bg-slate-700 object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="font-medium text-white truncate max-w-[100px] sm:max-w-[160px] text-[11px] sm:text-xs">
              {player.name}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
              {player.team} - {player.displayPosition}
              {player.injuryStatus && (
                <span className={`ml-1 font-semibold ${
                  player.injuryStatus === 'O' || player.injuryStatus === 'OUT'
                    ? 'text-red-400'
                    : player.injuryStatus === 'DTD'
                    ? 'text-yellow-400'
                    : 'text-orange-400'
                }`}>
                  {player.injuryStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      {cols.map((col) => (
        <td
          key={col.key}
          className="py-1.5 px-1.5 sm:px-2 text-right text-slate-300 whitespace-nowrap tabular-nums"
        >
          {col.composite === 'h_ab'
            ? buildHAB(player.stats)
            : fmtStat(player.stats[col.key], col)}
        </td>
      ))}
    </tr>
  )
}

function getPositionColor(pos: string): string {
  switch (pos) {
    case 'C':
    case '1B':
    case '2B':
    case '3B':
    case 'SS':
    case 'OF':
    case 'Util':
      return 'bg-blue-600/80 text-white'
    case 'SP':
      return 'bg-green-600/80 text-white'
    case 'RP':
      return 'bg-emerald-600/80 text-white'
    case 'P':
      return 'bg-teal-600/80 text-white'
    case 'BN':
      return 'bg-slate-600/60 text-slate-300'
    case 'IL':
    case 'IL+':
    case 'DL':
      return 'bg-red-600/60 text-red-200'
    default:
      return 'bg-slate-600/40 text-slate-300'
  }
}
