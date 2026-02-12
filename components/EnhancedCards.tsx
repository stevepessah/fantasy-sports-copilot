'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Player, Sport } from '@/types'
import { PlayerStats } from './PlayerStats'
import { CardSkeleton } from './Skeleton'

const CompareCard = dynamic(() => import('./CompareCard'), { ssr: false })
const Sparkline = dynamic(() => import('./Sparkline'), { ssr: false })

interface Card {
  type: 'lineup' | 'matchup' | 'player' | 'waivers' | 'trade' | 'draft' | 'teams' | 'roster_list' | 'compare'
  title: string
  payload: any
}

interface EnhancedCardsProps {
  card: Card
  onAction?: (command: string) => void
  sport: Sport
}

export function EnhancedCards({ card, onAction, sport }: EnhancedCardsProps) {
  const runCommand = (cmd: string) => {
    if (onAction) onAction(cmd)
  }

  switch (card.type) {
    case 'lineup': {
      const p = card.payload
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">
            {p.teamName} • Week {p.week} • Projected: <span className="font-bold text-white">{p.projectedTotal?.toFixed(1) || '0.0'}</span>
          </div>
          <div className="space-y-2">
            {p.slots?.map((slot: any) => (
              <div key={slot.slot} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                <div className="w-16 text-xs font-bold text-slate-400">{slot.slot}</div>
                <div className="flex-1 min-w-0">
                  {slot.player ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{slot.player.name}</span>
                      <span className="text-xs text-slate-400">
                        ({slot.player.position}-{slot.player.team})
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                        {slot.player.projectedPoints?.toFixed(1) || '0.0'} pts
                      </span>
                      {slot.note && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">
                          {slot.note}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-sm">Empty</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <button
              onClick={() => runCommand('set my optimal lineup')}
              className="px-3 py-2.5 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold transition-colors"
            >
              Optimize again
            </button>
            <button
              onClick={() => runCommand('show matchup')}
              className="px-3 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
            >
              View matchup
            </button>
          </div>
        </CardShell>
      )
    }

    case 'matchup': {
      const p = card.payload
      return (
        <CardShell title={card.title}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="text-xs text-slate-400">Home</div>
              <div className="text-lg font-bold">{p.home?.team || 'Your Team'}</div>
              <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300 mt-1 inline-block">
                {p.home?.projected?.toFixed(1) || '0.0'} pts
              </span>
            </div>
            <div className="text-slate-400 font-bold">vs</div>
            <div className="flex-1 text-right">
              <div className="text-xs text-slate-400">Away</div>
              <div className="text-lg font-bold">{p.away?.team || 'Opponent'}</div>
              <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300 mt-1 inline-block">
                {p.away?.projected?.toFixed(1) || '0.0'} pts
              </span>
            </div>
          </div>

          {p.winProbHome !== undefined && (
            <div className="mb-4">
              <div className="text-xs text-slate-400 mb-2">Win Probability:</div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${Math.max(5, Math.min(95, p.winProbHome))}%` }}
                />
              </div>
              <div className="mt-2 text-sm font-bold">
                {p.winProbHome.toFixed(0)}% chance to win
              </div>
            </div>
          )}

          {p.notes && p.notes.length > 0 && (
            <ul className="space-y-1 mb-4">
              {p.notes.map((note: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {note}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => runCommand('set my optimal lineup')}
              className="px-3 py-2.5 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold transition-colors"
            >
              Improve my lineup
            </button>
            <button
              onClick={() => runCommand('who should I pick up on waivers?')}
              className="px-3 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
            >
              Waiver targets
            </button>
          </div>
        </CardShell>
      )
    }

    case 'player': {
      const p = card.payload
      const player = p.player
      return (
        <CardShell title={card.title}>
          {/* Compact player header: name + meta inline */}
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-base sm:text-lg font-bold leading-tight">{player.name}</span>
            <span className="text-xs text-slate-400">
              {player.team} &middot; {p.eligiblePositions && p.eligiblePositions.length > 0 
                ? p.eligiblePositions.join(', ')
                : player.position}
            </span>
            {p.ownershipStatus === 'free_agent' && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-600/20 text-green-400 border border-green-600/30 font-semibold leading-none">
                FA
              </span>
            )}
            {p.ownershipStatus === 'taken' && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-600/20 text-red-400 border border-red-600/30 font-semibold leading-none">
                {p.owningTeamName ? p.owningTeamName : 'Taken'}
              </span>
            )}
          </div>

          {/* Projected / ADP inline row — only show when available */}
          {(player.projectedPoints || player.adp) && (
            <div className="flex items-baseline gap-4 mb-2 text-xs text-slate-400">
              {player.projectedPoints != null && (
                <span>Proj <span className="text-primary-400 font-bold text-sm">{player.projectedPoints.toFixed(1)}</span></span>
              )}
              {player.adp != null && (
                <span>ADP <span className="text-slate-200 font-bold text-sm">{player.adp}</span></span>
              )}
            </div>
          )}

          {/* Player Statistics */}
          {(player.yahooPlayerKey || p.leagueKey) && (
            <PlayerStats 
              playerKey={player.yahooPlayerKey || null} 
              leagueKey={p.leagueKey}
              playerName={player.name}
              positions={p.eligiblePositions || (player.position ? [player.position] : [])}
            />
          )}

          {p.insights && p.insights.length > 0 && (
            <ul className="space-y-0.5 mb-2">
              {p.insights.map((insight: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {insight}
                </li>
              ))}
            </ul>
          )}

          {p.actions && p.actions.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {p.actions.map((action: any) => (
                <button
                  key={action.label}
                  onClick={() => runCommand(action.command)}
                  className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </CardShell>
      )
    }

    case 'waivers': {
      const p = card.payload
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">Top targets:</div>
          <div className="space-y-2 mb-4">
            {p.targets?.map((target: Player) => (
              <div key={target.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-700/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{target.name}</div>
                  <div className="text-xs text-slate-400">
                    {target.position} - {target.team}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">
                    {target.projectedPoints?.toFixed(1) || '0.0'} pts
                  </span>
                  <button
                    onClick={() => runCommand(`add ${target.name}`)}
                    className="px-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-semibold"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
          {p.reasoning && p.reasoning.length > 0 && (
            <ul className="space-y-1">
              {p.reasoning.map((reason: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </CardShell>
      )
    }

    case 'trade': {
      const p = card.payload
      return (
        <CardShell title={card.title}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs text-slate-400">From</div>
              <div className="font-bold">{p.fromTeam}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">To</div>
              <div className="font-bold">{p.toTeam}</div>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Offer</div>
              <div className="font-medium">
                {p.offer?.name} ({p.offer?.position}) - {p.offer?.projectedPoints?.toFixed(1) || '0.0'} pts
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Request</div>
              <div className="font-medium">
                {p.request?.name} ({p.request?.position}) - {p.request?.projectedPoints?.toFixed(1) || '0.0'} pts
              </div>
            </div>
          </div>

          <div className="mb-4">
            <span className={`px-3 py-1 text-xs rounded-full font-semibold ${
              p.verdict === 'Fair' ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
              p.verdict === 'Slightly Unfair' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
              'bg-red-600/20 text-red-400 border border-red-600/30'
            }`}>
              Verdict: {p.verdict}
            </span>
          </div>

          {p.reasons && p.reasons.length > 0 && (
            <ul className="space-y-1 mb-4">
              {p.reasons.map((reason: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {reason}
                </li>
              ))}
            </ul>
          )}

          {p.suggestedMessage && (
            <div className="mb-4 p-3 rounded-lg border border-slate-700 bg-slate-800/50">
              <div className="text-xs text-slate-400 mb-1">Suggested message:</div>
              <div className="text-sm">{p.suggestedMessage}</div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => runCommand(`propose trade: give ${p.offer?.name} for ${p.request?.name}`)}
              className="px-3 py-2.5 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold transition-colors"
            >
              Propose trade
            </button>
          </div>
        </CardShell>
      )
    }

    case 'draft': {
      const p = card.payload
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">
            Round {p.round} • Pick {p.pick}
          </div>
          <div className="space-y-2 mb-4">
            {p.recommended?.map((rec: Player) => (
              <div key={rec.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-700/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{rec.name}</div>
                  <div className="text-xs text-slate-400">
                    {rec.position} - {rec.team} • {rec.projectedPoints?.toFixed(1) || '0.0'} pts
                  </div>
                </div>
                <button
                  onClick={() => runCommand(`draft ${rec.name}`)}
                  className="px-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-semibold"
                >
                  Draft
                </button>
              </div>
            ))}
          </div>
          {p.why && p.why.length > 0 && (
            <ul className="space-y-1">
              {p.why.map((reason: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </CardShell>
      )
    }

    case 'teams': {
      const p = card.payload
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-4">
            {p.leagueName} • {p.teams?.length || 0} teams
          </div>
          <div className="space-y-2">
            {p.teams?.map((team: any) => (
              <div key={team.rank} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                <div className="w-8 text-sm font-bold text-slate-400">
                  #{team.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{team.name}</div>
                  <div className="text-xs text-slate-400 mt-1 break-words">
                    {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''} · 
                    Win%: {team.winPercentage} · 
                    PF: {team.pointsFor?.toFixed(1) || '0.0'} · 
                    PA: {team.pointsAgainst?.toFixed(1) || '0.0'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {team.rank <= 3 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">
                      Top 3
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardShell>
      )
    }

    case 'roster_list': {
      return <RosterListCard card={card} onAction={onAction} />
    }

    case 'compare': {
      const p = card.payload
      return (
        <CompareCard
          playerA={p.playerA}
          playerB={p.playerB}
          statKeys={p.statKeys || ['AVG', 'HR', 'RBI', 'R', 'SB', 'OPS']}
          title={card.title}
        />
      )
    }

    default:
      return null
  }
}

// ── Stat column definitions (same curated lists as PlayerStats) ──

interface ColDef {
  key: string        // stat display name to look up in player.stats
  label: string      // column header
  composite?: 'h_ab'
  fmt?: 'rate3' | 'rate2' | 'ip' | 'int'
}

const BATTER_COLS: ColDef[] = [
  { key: 'GP', label: 'GP', fmt: 'int' },
  { key: 'H/AB', label: 'H/AB', composite: 'h_ab' },
  { key: 'AVG', label: 'AVG', fmt: 'rate3' },
  { key: 'OBP', label: 'OBP', fmt: 'rate3' },
  { key: 'OPS', label: 'OPS', fmt: 'rate3' },
  { key: 'R', label: 'R', fmt: 'int' },
  { key: 'HR', label: 'HR', fmt: 'int' },
  { key: 'RBI', label: 'RBI', fmt: 'int' },
  { key: 'SB', label: 'SB', fmt: 'int' },
  { key: 'BB', label: 'BB', fmt: 'int' },
  { key: 'K', label: 'K', fmt: 'int' },
]

const PITCHER_COLS: ColDef[] = [
  { key: 'GP', label: 'GP', fmt: 'int' },
  { key: 'IP', label: 'IP', fmt: 'ip' },
  { key: 'W', label: 'W', fmt: 'int' },
  { key: 'L', label: 'L', fmt: 'int' },
  { key: 'SV', label: 'SV', fmt: 'int' },
  { key: 'HLD', label: 'HLD', fmt: 'int' },
  { key: 'K', label: 'K', fmt: 'int' },
  { key: 'ERA', label: 'ERA', fmt: 'rate2' },
  { key: 'WHIP', label: 'WHIP', fmt: 'rate2' },
  { key: 'QS', label: 'QS', fmt: 'int' },
]

function fmtStat(value: number | string | undefined, col: ColDef): string {
  if (value === undefined || value === '' || value === null) return '-'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return String(value)
  switch (col.fmt) {
    case 'rate3': return n >= 0 && n < 1 ? n.toFixed(3).replace(/^0/, '') : n.toFixed(3)
    case 'rate2': return n.toFixed(2)
    case 'ip': return n.toFixed(1)
    case 'int': return Math.round(n).toString()
    default: return Number.isInteger(n) ? n.toString() : n.toFixed(1)
  }
}

function buildHABList(stats: Record<string, number | string>): string {
  const h = stats['H']
  const ab = stats['AB']
  if (h !== undefined && ab !== undefined) {
    const hv = typeof h === 'number' ? Math.round(h) : h
    const abv = typeof ab === 'number' ? Math.round(ab) : ab
    return `${hv}/${abv}`
  }
  return '-'
}

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

// Season options for the dropdown
const CURRENT_YEAR = new Date().getFullYear()
const SEASON_OPTIONS = [
  { value: 0, label: `${CURRENT_YEAR} (Current)` },
  { value: CURRENT_YEAR - 1, label: `${CURRENT_YEAR - 1}` },
  { value: CURRENT_YEAR - 2, label: `${CURRENT_YEAR - 2}` },
  { value: CURRENT_YEAR - 3, label: `${CURRENT_YEAR - 3}` },
]

function RosterListCard({ card, onAction }: { card: Card; onAction?: (cmd: string) => void }) {
  const p = card.payload
  const isPitcher = p.positionType === 'P'
  const cols = isPitcher ? PITCHER_COLS : BATTER_COLS

  const PAGE_SIZE = 25
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)

  // Season toggle state
  const [selectedSeason, setSelectedSeason] = useState(0) // 0 = current
  const [seasonPlayers, setSeasonPlayers] = useState<Record<number, any[]>>({ 0: p.players || [] })
  const [seasonTotals, setSeasonTotals] = useState<Record<number, number>>({ 0: p.total || 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch players for a given season
  const fetchSeasonPlayers = useCallback(async (season: number) => {
    if (seasonPlayers[season]) return // already cached
    if (!p.leagueKey) return

    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/yahoo/league-players', window.location.origin)
      url.searchParams.set('leagueKey', p.leagueKey)
      if (p.positionType) url.searchParams.set('positionType', p.positionType)
      if (season > 0) url.searchParams.set('season', season.toString())

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setSeasonPlayers(prev => ({ ...prev, [season]: data.players || [] }))
      setSeasonTotals(prev => ({ ...prev, [season]: data.total || 0 }))
    } catch (err: any) {
      console.error(`Failed to fetch season ${season} players:`, err)
      setError(`Failed to load ${season} data`)
    } finally {
      setLoading(false)
    }
  }, [p.leagueKey, p.positionType, seasonPlayers])

  // Fetch when season changes
  useEffect(() => {
    if (selectedSeason !== 0 && !seasonPlayers[selectedSeason]) {
      fetchSeasonPlayers(selectedSeason)
    }
  }, [selectedSeason, fetchSeasonPlayers, seasonPlayers])

  const allPlayers: any[] = seasonPlayers[selectedSeason] || []
  const totalCount = seasonTotals[selectedSeason] || 0

  // Sort players
  const sorted = [...allPlayers]
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

  return (
    <CardShell title={card.title}>
      {/* Season selector + player count + pagination info */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={selectedSeason}
            onChange={(e) => handleSeasonChange(parseInt(e.target.value, 10))}
            className="text-[11px] bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {SEASON_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-[11px] text-slate-400">{totalCount} players</span>
        </div>
        {totalPages > 1 && (
          <span className="text-[11px] text-slate-400">
            Page {page + 1}/{totalPages}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-500 mr-2" />
          <span className="text-xs text-slate-400">Loading {selectedSeason} stats…</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-4">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={() => { setError(null); fetchSeasonPlayers(selectedSeason) }}
            className="mt-2 text-xs text-primary-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <div className="overflow-x-auto -mx-2.5 sm:-mx-3">
            <table className="w-full text-[11px] min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="w-8 px-1 py-1.5 sticky left-0 bg-slate-800/90 z-10" />
                  <th
                    className="text-left px-1.5 py-1.5 text-slate-500 uppercase tracking-wide font-semibold cursor-pointer hover:text-slate-300 sticky left-8 bg-slate-800/90 z-10 min-w-[130px]"
                    onClick={() => handleSort('__name')}
                  >
                    Player{sortIndicator('__name')}
                  </th>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      className="text-right px-1.5 py-1.5 text-slate-500 uppercase tracking-wide font-semibold cursor-pointer hover:text-slate-300 whitespace-nowrap"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}{sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={cols.length + 2} className="text-center py-6 text-xs text-slate-500">
                      No players found for this season
                    </td>
                  </tr>
                )}
                {pageItems.map((pl: any, idx: number) => (
                  <tr
                    key={pl.playerKey || idx}
                    className="hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-1 py-1 sticky left-0 bg-slate-800/90 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAction && onAction(`add ${pl.name}`) }}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/40 active:bg-green-600/60 border border-green-600/30 text-sm font-bold leading-none transition-colors"
                        title={`Add ${pl.name}`}
                      >
                        +
                      </button>
                    </td>
                    <td
                      className="px-1.5 py-1 sticky left-8 bg-slate-800/90 z-10 min-w-[130px] cursor-pointer"
                      onClick={() => onAction && onAction(`tell me about ${pl.name}`)}
                    >
                      <div className="font-medium text-white truncate max-w-[160px] sm:max-w-[200px]">{pl.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {pl.team} · {pl.positions?.filter((pos: string) => pos !== 'Util' && pos !== 'BN' && pos !== 'IL' && pos !== 'IL+' && pos !== 'NA').join(', ') || pl.displayPosition || '-'}
                      </div>
                    </td>
                    {cols.map((col) => (
                      <td key={col.key} className="text-right px-1.5 py-1 text-slate-300 whitespace-nowrap tabular-nums">
                        {col.composite === 'h_ab'
                          ? buildHABList(pl.stats || {})
                          : fmtStat(pl.stats?.[col.key], col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
              <button
                disabled={page === 0}
                onClick={() => setPage((pg) => Math.max(0, pg - 1))}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                ← Prev
              </button>
              <span className="text-[11px] text-slate-400">
                {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((pg) => Math.min(totalPages - 1, pg + 1))}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </CardShell>
  )
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 border-b border-slate-700 bg-slate-800/50">
        <div className="text-xs sm:text-sm font-bold">{title}</div>
      </div>
      <div className="p-2.5 sm:p-3">{children}</div>
    </div>
  )
}
