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
      const hasProjections = p.projectedTotal != null
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">
            {p.teamName}
            {p.week != null && <> • Week {p.week}</>}
            {hasProjections && <> • Projected: <span className="font-bold text-white">{p.projectedTotal.toFixed(1)}</span></>}
          </div>
          <div className="space-y-2">
            {p.slots?.map((slot: any, idx: number) => (
              <div key={`${slot.slot}-${idx}`} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                <div className="w-16 text-xs font-bold text-slate-400">{slot.slot}</div>
                <div className="flex-1 min-w-0">
                  {slot.player ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{slot.player.name}</span>
                      <span className="text-xs text-slate-400">
                        ({slot.player.position}{slot.player.team ? `-${slot.player.team}` : ''})
                      </span>
                      {slot.player.projectedPoints != null && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                          {slot.player.projectedPoints.toFixed(1)} pts
                        </span>
                      )}
                      {slot.player.injuryStatus && (
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                          slot.player.injuryStatus === 'O' || slot.player.injuryStatus === 'OUT'
                            ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                            : slot.player.injuryStatus === 'DTD'
                            ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                            : 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
                        }`}>
                          {slot.player.injuryStatus}
                        </span>
                      )}
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
              Optimize lineup
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
      return <MatchupCardInner card={card} runCommand={runCommand} />
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
              positions={p.eligiblePositions?.length > 0 ? p.eligiblePositions : (player.position ? [player.position] : [])}
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
                    className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
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
                  className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
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
      const teams: any[] = p.teams || []
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">
            {p.leagueName} • {teams.length} teams
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="py-2 pr-2 font-semibold w-8 text-center">#</th>
                  <th className="py-2 pr-3 font-semibold">Team</th>
                  <th className="py-2 px-2 font-semibold text-center whitespace-nowrap">W-L-T</th>
                  <th className="py-2 px-2 font-semibold text-center">Pct</th>
                  <th className="py-2 px-2 font-semibold text-center">GB</th>
                  <th className="py-2 px-2 font-semibold text-center">Waiver</th>
                  <th className="py-2 pl-2 font-semibold text-center">Moves</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team: any) => (
                  <tr
                    key={team.rank}
                    className="border-b border-slate-700/40 last:border-0 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-2 pr-2 text-center text-slate-400 font-bold">{team.rank}</td>
                    <td className="py-2 pr-3 font-medium truncate max-w-[140px] sm:max-w-[200px]">{team.name}</td>
                    <td className="py-2 px-2 text-center text-slate-300 whitespace-nowrap tabular-nums">
                      {team.wins}-{team.losses}-{team.ties ?? 0}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300 tabular-nums">{team.winPercentage}</td>
                    <td className="py-2 px-2 text-center text-slate-400 tabular-nums">{team.gamesBack ?? '-'}</td>
                    <td className="py-2 px-2 text-center text-slate-400 tabular-nums">{team.waiverPriority ?? '-'}</td>
                    <td className="py-2 pl-2 text-center text-slate-400 tabular-nums">{team.moves ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          isMixed={p.isMixed}
          onAction={onAction}
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

/** Abbreviate "Jonathan Aranda" → "J. Aranda" for compact mobile display */
function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

/** Compact position string: filter noise, abbreviate */
function compactPositions(pl: any): string {
  const HIDE = new Set(['Util', 'BN', 'IL', 'IL+', 'NA'])
  const pos = (pl.positions || []).filter((p: string) => !HIDE.has(p))
  if (pos.length > 0) return pos.join(',')
  return pl.displayPosition || '-'
}

function RosterListCard({ card, onAction }: { card: Card; onAction?: (cmd: string) => void }) {
  const p = card.payload
  const isPitcher = p.positionType === 'P'
  const cols = isPitcher ? PITCHER_COLS : BATTER_COLS

  const PAGE_SIZE = 25
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [filterText, setFilterText] = useState('')

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

  // Filter players
  const filtered = filterText.trim()
    ? allPlayers.filter((pl: any) => {
        const q = filterText.toLowerCase()
        const name = (pl.name || '').toLowerCase()
        const team = (pl.team || '').toLowerCase()
        const positions = (pl.positions || []).join(' ').toLowerCase()
        const displayPos = (pl.displayPosition || '').toLowerCase()
        return name.includes(q) || team.includes(q) || positions.includes(q) || displayPos.includes(q)
      })
    : allPlayers

  // Sort players
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

  // The "+" button column width in px — used for sticky left offsets
  const ADD_COL_W = 32 // w-8

  return (
    <CardShell title={card.title}>
      {/* ── Controls: season, count, filter, page — compact single row on mobile ── */}
      <div className="flex items-center justify-between mb-1.5 gap-1 sm:gap-2 flex-wrap">
        <div className="flex items-center gap-1 sm:gap-2">
          <select
            value={selectedSeason}
            onChange={(e) => handleSeasonChange(parseInt(e.target.value, 10))}
            className="text-[10px] sm:text-[11px] bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {SEASON_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-[10px] sm:text-[11px] text-slate-400">
            {filterText ? `${filtered.length}/` : ''}{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="relative">
            <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filterText}
              onChange={(e) => { setFilterText(e.target.value); setPage(0) }}
              placeholder="Filter…"
              className="w-24 sm:w-44 text-[10px] sm:text-[11px] bg-slate-700 border border-slate-600 rounded pl-5 sm:pl-6 pr-1.5 sm:pr-2 py-0.5 sm:py-1 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
          {totalPages > 1 && (
            <span className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap">
              {page + 1}/{totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-500 mr-2" />
          <span className="text-[10px] text-slate-400">Loading {selectedSeason} stats…</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-3">
          <p className="text-[10px] text-red-400">{error}</p>
          <button
            onClick={() => { setError(null); fetchSeasonPlayers(selectedSeason) }}
            className="mt-1 text-[10px] text-primary-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && (
        <>
          <div className="overflow-x-auto -mx-2.5 sm:-mx-3">
            {/* Mobile: text-[9px], Desktop: text-[11px]. No min-width — let it scroll naturally */}
            <table className="w-full text-[9px] sm:text-[11px]">
              <thead>
                <tr className="border-b border-slate-700/60">
                  {/* "+" column header */}
                  <th className="w-8 px-0.5 sm:px-1 py-1 sticky left-0 bg-slate-800/90 z-10" />
                  <th
                    className="text-left px-0.5 sm:px-1.5 py-1 text-slate-500 uppercase tracking-wide font-semibold cursor-pointer hover:text-slate-300 sticky bg-slate-800/90 z-10 min-w-[90px] sm:min-w-[130px]"
                    style={{ left: ADD_COL_W }}
                    onClick={() => handleSort('__name')}
                  >
                    Player{sortIndicator('__name')}
                  </th>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      className="text-right px-[3px] sm:px-1.5 py-1 text-slate-500 uppercase tracking-wide font-semibold cursor-pointer hover:text-slate-300 whitespace-nowrap"
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
                    <td colSpan={cols.length + 2} className="text-center py-6 text-[10px] text-slate-500">
                      No players found
                    </td>
                  </tr>
                )}
                {pageItems.map((pl: any, idx: number) => (
                  <tr
                    key={pl.playerKey || idx}
                    className="hover:bg-slate-700/20 transition-colors"
                  >
                    {/* "+" button */}
                    <td className="px-0.5 sm:px-1 py-0.5 sm:py-1 sticky left-0 bg-slate-800/90 z-10 w-8">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAction && onAction(`add ${pl.name}`) }}
                        className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 active:bg-green-600/60 border border-green-600/30 text-sm font-bold leading-none transition-colors"
                        title={`Add ${pl.name}`}
                      >
                        +
                      </button>
                    </td>
                    {/* Player name — abbreviated on mobile, full on desktop */}
                    <td
                      className="px-0.5 sm:px-1.5 py-0.5 sm:py-1 sticky bg-slate-800/90 z-10 min-w-[90px] sm:min-w-[130px] cursor-pointer"
                      style={{ left: ADD_COL_W }}
                      onClick={() => onAction && onAction(`tell me about ${pl.name}${pl.playerKey ? ` [pk:${pl.playerKey}]` : ''}`)}
                    >
                      {/* Mobile: single line — "J. Aranda  TB·1B,2B" */}
                      <div className="sm:hidden">
                        <span className="font-medium text-white truncate text-[14px]">{abbreviateName(pl.name)}</span>
                        <span className="text-slate-500 ml-1">{pl.team}·{compactPositions(pl)}</span>
                      </div>
                      {/* Desktop: two-line */}
                      <div className="hidden sm:block">
                        <div className="font-medium text-white truncate max-w-[200px] text-[14px]">{pl.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {pl.team} · {compactPositions(pl)}
                        </div>
                      </div>
                    </td>
                    {cols.map((col) => (
                      <td key={col.key} className="text-right px-[3px] sm:px-1.5 py-0.5 sm:py-1 text-slate-300 whitespace-nowrap tabular-nums">
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

          {/* Pagination — compact on mobile */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-700/50">
              <button
                disabled={page === 0}
                onClick={() => setPage((pg) => Math.max(0, pg - 1))}
                className="px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                ←
              </button>
              <span className="text-[10px] sm:text-[11px] text-slate-400">
                {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((pg) => Math.min(totalPages - 1, pg + 1))}
                className="px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </CardShell>
  )
}

// ─── Matchup Card (stateful) ────────────────────────────────────────────────

function MatchupCardInner({ card, runCommand }: { card: { title: string; payload: any }; runCommand: (cmd: string) => void }) {
  const p = card.payload
  const [showOthers, setShowOthers] = useState(false)

  // Determine the scoring style: if stats are present → category-based, else points-based
  const userMatch = p.userMatchup
  const userTeam = userMatch?.teams?.find((t: any) => t.isUser) ?? userMatch?.teams?.[0]
  const oppTeam = userMatch?.teams?.find((t: any) => !t.isUser) ?? userMatch?.teams?.[1]
  const hasStats = userTeam?.stats && Object.keys(userTeam.stats).length > 0

  // Category scoring: count wins/losses/ties per stat
  const catResults = (() => {
    if (!hasStats || !userTeam?.stats || !oppTeam?.stats) return null
    let userWins = 0, oppWins = 0, ties = 0
    const rows: { stat: string; userVal: number | string; oppVal: number | string; winner: 'user' | 'opp' | 'tie' }[] = []
    for (const [stat, uVal] of Object.entries(userTeam.stats as Record<string, number | string>)) {
      const oVal = oppTeam.stats[stat]
      if (oVal == null) continue
      const uNum = typeof uVal === 'number' ? uVal : parseFloat(uVal as string)
      const oNum = typeof oVal === 'number' ? oVal : parseFloat(oVal as string)
      // Lower-is-better stats (ERA, WHIP, BB(P))
      const lowerBetter = /^(ERA|WHIP|BB\(P\)|L)$/i.test(stat)
      let winner: 'user' | 'opp' | 'tie' = 'tie'
      if (!isNaN(uNum) && !isNaN(oNum)) {
        if (lowerBetter) {
          if (uNum < oNum) { winner = 'user'; userWins++ }
          else if (uNum > oNum) { winner = 'opp'; oppWins++ }
          else ties++
        } else {
          if (uNum > oNum) { winner = 'user'; userWins++ }
          else if (uNum < oNum) { winner = 'opp'; oppWins++ }
          else ties++
        }
      }
      rows.push({ stat, userVal: uVal, oppVal: oVal, winner })
    }
    return { userWins, oppWins, ties, rows }
  })()

  // Status label
  const statusLabel = userMatch?.status === 'midevent' ? '🔴 Live' :
    userMatch?.status === 'postevent' ? '✅ Final' : '🕐 Upcoming'

  // Week navigation
  const displayed = p.displayedWeek ?? p.currentWeek ?? 1
  const canPrev = displayed > 1
  const canNext = p.totalWeeks ? displayed < p.totalWeeks : true

  return (
    <CardShell title={card.title}>
      {/* Week navigator */}
      <div className="flex items-center justify-between mb-3">
        <button
          disabled={!canPrev}
          onClick={() => runCommand(`show matchup week ${displayed - 1}`)}
          className="px-2 py-1 text-xs rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          ◀ Wk {displayed - 1}
        </button>
        <div className="text-center">
          <span className="text-sm font-bold">Week {displayed}</span>
          {userMatch?.weekStart && userMatch?.weekEnd && (
            <div className="text-[10px] text-slate-400">{userMatch.weekStart} – {userMatch.weekEnd}</div>
          )}
        </div>
        <button
          disabled={!canNext}
          onClick={() => runCommand(`show matchup week ${displayed + 1}`)}
          className="px-2 py-1 text-xs rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          Wk {displayed + 1} ▶
        </button>
      </div>

      {/* Status badge */}
      <div className="flex justify-center mb-3">
        <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
          userMatch?.status === 'midevent' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
          userMatch?.status === 'postevent' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
          'bg-slate-600/30 text-slate-400 border border-slate-600'
        }`}>
          {statusLabel}
        </span>
      </div>

      {/* Main matchup: teams head-to-head */}
      {userTeam && oppTeam && (
        <div className="flex items-stretch gap-2 mb-3">
          {/* User team */}
          <div className={`flex-1 rounded-lg p-2.5 text-center ${userMatch?.winnerTeamKey === userTeam.teamKey ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-700/30 border border-slate-700'}`}>
            {userTeam.logoUrl && (
              <img src={userTeam.logoUrl} alt="" className="w-8 h-8 mx-auto mb-1 rounded" />
            )}
            <div className="text-xs font-bold truncate">{userTeam.name}</div>
            {userTeam.isUser && <div className="text-[9px] text-primary-400 font-semibold">YOUR TEAM</div>}
            {userTeam.points != null && (
              <div className="text-lg font-bold mt-1">{typeof userTeam.points === 'number' ? userTeam.points.toFixed(1) : userTeam.points}</div>
            )}
            {userTeam.winProbability != null && (
              <div className="text-[10px] text-slate-400 mt-0.5">{userTeam.winProbability}% win</div>
            )}
          </div>

          {/* VS */}
          <div className="flex items-center">
            <span className="text-slate-500 font-bold text-sm">vs</span>
          </div>

          {/* Opponent team */}
          <div className={`flex-1 rounded-lg p-2.5 text-center ${userMatch?.winnerTeamKey === oppTeam.teamKey ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-700/30 border border-slate-700'}`}>
            {oppTeam.logoUrl && (
              <img src={oppTeam.logoUrl} alt="" className="w-8 h-8 mx-auto mb-1 rounded" />
            )}
            <div className="text-xs font-bold truncate">{oppTeam.name}</div>
            {oppTeam.points != null && (
              <div className="text-lg font-bold mt-1">{typeof oppTeam.points === 'number' ? oppTeam.points.toFixed(1) : oppTeam.points}</div>
            )}
            {oppTeam.winProbability != null && (
              <div className="text-[10px] text-slate-400 mt-0.5">{oppTeam.winProbability}% win</div>
            )}
          </div>
        </div>
      )}

      {/* Category stats table */}
      {catResults && catResults.rows.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-center gap-3 mb-2 text-xs font-bold">
            <span className="text-green-400">{catResults.userWins}W</span>
            <span className="text-slate-400">–</span>
            <span className="text-red-400">{catResults.oppWins}L</span>
            {catResults.ties > 0 && <>
              <span className="text-slate-400">–</span>
              <span className="text-yellow-400">{catResults.ties}T</span>
            </>}
          </div>
          <div className="overflow-x-auto -mx-1.5 sm:-mx-3">
            <table className="w-full text-[10px] sm:text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-1 px-1 font-medium">You</th>
                  <th className="text-center py-1 px-1 font-medium">Stat</th>
                  <th className="text-right py-1 px-1 font-medium">Opp</th>
                </tr>
              </thead>
              <tbody>
                {catResults.rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className={`py-1 px-1 font-mono text-left ${row.winner === 'user' ? 'text-green-400 font-bold' : 'text-slate-300'}`}>
                      {typeof row.userVal === 'number' ? (Number.isInteger(row.userVal) ? row.userVal : row.userVal.toFixed(3).replace(/^0\./, '.')) : row.userVal}
                    </td>
                    <td className="py-1 px-1 text-center text-slate-400 font-medium">{row.stat}</td>
                    <td className={`py-1 px-1 font-mono text-right ${row.winner === 'opp' ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                      {typeof row.oppVal === 'number' ? (Number.isInteger(row.oppVal) ? row.oppVal : row.oppVal.toFixed(3).replace(/^0\./, '.')) : row.oppVal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Other matchups toggle */}
      {p.otherMatchups && p.otherMatchups.length > 0 && (
        <div className="border-t border-slate-700 pt-2 mt-2">
          <button
            onClick={() => setShowOthers(v => !v)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-300 transition-colors py-1"
          >
            <span>Other matchups this week ({p.otherMatchups.length})</span>
            <span className="text-[10px]">{showOthers ? '▲' : '▼'}</span>
          </button>
          {showOthers && (
            <div className="mt-2 space-y-1.5">
              {p.otherMatchups.map((m: any, i: number) => {
                const t1 = m.teams?.[0]
                const t2 = m.teams?.[1]
                if (!t1 || !t2) return null
                const isDone = m.status === 'postevent'
                return (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-slate-700/30 px-2 py-1.5 text-[10px] sm:text-xs">
                    <div className="flex-1 truncate font-medium">{t1.name}</div>
                    <div className="text-slate-400 font-mono whitespace-nowrap">
                      {t1.points != null ? (typeof t1.points === 'number' ? t1.points.toFixed(1) : t1.points) : '-'}
                    </div>
                    <div className="text-slate-500 text-[9px]">{isDone ? 'F' : 'vs'}</div>
                    <div className="text-slate-400 font-mono whitespace-nowrap">
                      {t2.points != null ? (typeof t2.points === 'number' ? t2.points.toFixed(1) : t2.points) : '-'}
                    </div>
                    <div className="flex-1 truncate font-medium text-right">{t2.name}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap mt-3">
        <button
          onClick={() => runCommand('set my optimal lineup')}
          className="px-3 py-2 text-xs rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold transition-colors"
        >
          Optimize lineup
        </button>
        <button
          onClick={() => runCommand('who should I pick up on waivers?')}
          className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
        >
          Waiver targets
        </button>
      </div>
    </CardShell>
  )
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="px-2 sm:px-3 py-1 sm:py-2 border-b border-slate-700 bg-slate-800/50">
        <div className="text-[11px] sm:text-sm font-bold">{title}</div>
      </div>
      <div className="p-1.5 sm:p-3">{children}</div>
    </div>
  )
}
