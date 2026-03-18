'use client'

import { useState, useEffect, useMemo } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import type { ParsedStandingsTeam } from '@/lib/yahoo/xmlParser'
import type { RosterPlayerEntry, LeagueStatCategory } from '@/app/api/yahoo/roster-stats/route'

interface LeagueStandingsProps {
  leagueKey: string | null
}

export default function LeagueStandings({ leagueKey }: LeagueStandingsProps) {
  const [standings, setStandings] = useState<ParsedStandingsTeam[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null)
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(null)

  const { leagues } = useYahooLeagues('mlb')
  const effectiveLeagueKey = leagueKey ?? leagues[0]?.league_key

  useEffect(() => {
    if (!effectiveLeagueKey) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/api/yahoo/standings?leagueKey=${encodeURIComponent(effectiveLeagueKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch standings (${res.status})`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setStandings(json.standings ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [effectiveLeagueKey])

  if (!effectiveLeagueKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Select a league to view standings
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading standings…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (selectedTeamKey) {
    return (
      <TeamRosterView
        teamKey={selectedTeamKey}
        teamName={selectedTeamName}
        leagueKey={effectiveLeagueKey}
        onBack={() => { setSelectedTeamKey(null); setSelectedTeamName(null) }}
      />
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
        <h2 className="text-lg font-bold text-white mb-1 px-1">League Standings</h2>
        <p className="text-xs text-slate-400 mb-4 px-1">{standings.length} teams</p>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="py-2.5 pl-3 pr-2 font-semibold w-8 text-center">#</th>
                  <th className="py-2.5 pr-3 font-semibold">Team</th>
                  <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap">W-L-T</th>
                  <th className="py-2.5 px-2 font-semibold text-center">Pct</th>
                  <th className="py-2.5 px-2 font-semibold text-center">GB</th>
                  <th className="py-2.5 px-2 font-semibold text-center hidden sm:table-cell">Streak</th>
                  <th className="py-2.5 px-2 font-semibold text-center hidden sm:table-cell">Waiver</th>
                  <th className="py-2.5 pr-3 font-semibold text-center hidden sm:table-cell">Moves</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team) => (
                  <tr
                    key={team.team_key}
                    className="border-b border-slate-700/40 last:border-0 hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTeamKey(team.team_key)
                      setSelectedTeamName(team.name)
                    }}
                  >
                    <td className="py-2.5 pl-3 pr-2 text-center text-slate-400 font-bold tabular-nums">
                      {team.rank}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        {team.logo_url && (
                          <img
                            src={team.logo_url}
                            alt=""
                            className="w-6 h-6 rounded shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate max-w-[140px] sm:max-w-[220px] hover:text-primary-400 transition-colors">
                            {team.name}
                          </div>
                          {team.managers?.[0]?.nickname && (
                            <div className="text-[10px] text-slate-500 truncate">
                              {team.managers[0].nickname}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300 whitespace-nowrap tabular-nums">
                      {team.wins}-{team.losses}-{team.ties}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300 tabular-nums">
                      {team.percentage}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400 tabular-nums">
                      {team.games_back ?? '-'}
                    </td>
                    <td className="py-2.5 px-2 text-center hidden sm:table-cell">
                      {team.streak ? (
                        <span className={`text-xs font-medium ${
                          team.streak.type === 'win' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {team.streak.type === 'win' ? 'W' : 'L'}{team.streak.value}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400 tabular-nums hidden sm:table-cell">
                      {team.waiver_priority ?? '-'}
                    </td>
                    <td className="py-2.5 pr-3 text-center text-slate-400 tabular-nums hidden sm:table-cell">
                      {team.number_of_moves ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stat column definitions ──

interface ColDef {
  key: string
  label: string
  composite?: 'h_ab'
  fmt?: 'rate3' | 'rate2' | 'ip' | 'int'
}

const RATE_STATS = new Set(['AVG', 'OBP', 'SLG', 'OPS', 'BABIP', 'ISO'])
const RATE2_STATS = new Set(['ERA', 'WHIP', 'K/9', 'BB/9', 'K/BB', 'HR/9', 'FIP'])
const IP_STATS = new Set(['IP'])

function inferFormat(displayName: string): ColDef['fmt'] {
  if (RATE_STATS.has(displayName)) return 'rate3'
  if (RATE2_STATS.has(displayName)) return 'rate2'
  if (IP_STATS.has(displayName)) return 'ip'
  return 'int'
}

function buildColsFromCategories(
  categories: LeagueStatCategory[],
  positionType: 'B' | 'P',
): ColDef[] {
  const filtered = categories.filter((c) => c.positionType === positionType)
  const cols: ColDef[] = []

  if (positionType === 'B') {
    cols.push({ key: 'H/AB', label: 'H/AB', composite: 'h_ab' })
  }

  for (const cat of filtered) {
    if (cat.displayName === 'H' || cat.displayName === 'AB') continue
    cols.push({
      key: cat.displayName,
      label: cat.displayName,
      fmt: inferFormat(cat.displayName),
    })
  }

  return cols
}

const FALLBACK_BATTER_COLS: ColDef[] = [
  { key: 'H/AB', label: 'H/AB', composite: 'h_ab' },
  { key: 'R', label: 'R', fmt: 'int' },
  { key: 'HR', label: 'HR', fmt: 'int' },
  { key: 'RBI', label: 'RBI', fmt: 'int' },
  { key: 'SB', label: 'SB', fmt: 'int' },
  { key: 'K', label: 'K', fmt: 'int' },
  { key: 'AVG', label: 'AVG', fmt: 'rate3' },
  { key: 'OPS', label: 'OPS', fmt: 'rate3' },
]

const FALLBACK_PITCHER_COLS: ColDef[] = [
  { key: 'IP', label: 'IP', fmt: 'ip' },
  { key: 'L', label: 'L', fmt: 'int' },
  { key: 'SV', label: 'SV', fmt: 'int' },
  { key: 'K', label: 'K', fmt: 'int' },
  { key: 'HLD', label: 'HLD', fmt: 'int' },
  { key: 'ERA', label: 'ERA', fmt: 'rate2' },
  { key: 'WHIP', label: 'WHIP', fmt: 'rate2' },
  { key: 'QS', label: 'QS', fmt: 'int' },
]

function fmtStat(value: number | string | undefined, col: ColDef): string {
  if (value === undefined || value === '' || value === null) return '-'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return String(value)
  switch (col.fmt) {
    case 'rate3': return n >= 0 && n < 2 ? n.toFixed(3).replace(/^0/, '') : n.toFixed(3)
    case 'rate2': return n.toFixed(2)
    case 'ip': return n.toFixed(1)
    case 'int': return Math.round(n).toString()
    default: return Number.isInteger(n) ? n.toString() : n.toFixed(1)
  }
}

function buildHAB(stats: Record<string, number | string>): string {
  const h = stats['H']
  const ab = stats['AB']
  if (h !== undefined && ab !== undefined) {
    const hv = typeof h === 'number' ? Math.round(h) : h
    const abv = typeof ab === 'number' ? Math.round(ab) : ab
    return `${hv}/${abv}`
  }
  return '-'
}

function getPositionColor(pos: string): string {
  switch (pos) {
    case 'C': case '1B': case '2B': case '3B': case 'SS': case 'OF': case 'Util':
      return 'bg-blue-600/80 text-white'
    case 'SP': return 'bg-green-600/80 text-white'
    case 'RP': return 'bg-emerald-600/80 text-white'
    case 'P': return 'bg-teal-600/80 text-white'
    case 'BN': return 'bg-slate-600/60 text-slate-300'
    case 'IL': case 'IL+': case 'DL': return 'bg-red-600/60 text-red-200'
    default: return 'bg-slate-600/40 text-slate-300'
  }
}

function TeamRosterView({
  teamKey,
  teamName,
  leagueKey,
  onBack,
}: {
  teamKey: string
  teamName: string | null
  leagueKey: string
  onBack: () => void
}) {
  const [players, setPlayers] = useState<RosterPlayerEntry[]>([])
  const [leagueCategories, setLeagueCategories] = useState<LeagueStatCategory[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({ teamKey })
    if (leagueKey) params.set('leagueKey', leagueKey)

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
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [teamKey, leagueKey])

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

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to standings
        </button>

        <h2 className="text-lg font-bold text-white mb-1 px-1">
          {teamName ?? 'Team Roster'}
        </h2>
        <p className="text-xs text-slate-400 mb-4 px-1">
          {players.length > 0 ? `${players.length} players` : ''}
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading roster…
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-12 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && players.length > 0 && (
          <div className="space-y-5">
            {batters.length > 0 && (
              <RosterStatsTable title="Batters" players={batters} cols={batterCols} />
            )}
            {pitchers.length > 0 && (
              <RosterStatsTable title="Pitchers" players={pitchers} cols={pitcherCols} />
            )}
          </div>
        )}
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
                  <th key={col.key} className="py-2 px-1.5 sm:px-2 text-right font-semibold text-slate-400 whitespace-nowrap">
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
                    <td colSpan={cols.length + 2} className="py-1.5 px-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/30 border-t border-slate-700/50">
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
                    <td colSpan={cols.length + 2} className="py-1.5 px-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/30 border-t border-slate-700/50">
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
    <tr className={`border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20 transition-colors ${dimmed ? 'opacity-50' : ''}`}>
      <td className="py-1.5 pl-3 pr-1 sticky left-0 bg-slate-800/95 z-10">
        <span className={`inline-flex items-center justify-center w-7 h-5 rounded text-[9px] sm:text-[10px] font-bold ${posColor}`}>
          {player.selectedPosition}
        </span>
      </td>
      <td className="py-1.5 px-1 sticky left-10 bg-slate-800/95 z-10 min-w-[120px] sm:min-w-[170px]">
        <div className="flex items-center gap-1.5">
          {player.imageUrl && (
            <img src={player.imageUrl} alt="" className="w-12 h-12 rounded-full shrink-0 bg-slate-700" />
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
        <td key={col.key} className="py-1.5 px-1.5 sm:px-2 text-right text-slate-300 whitespace-nowrap tabular-nums">
          {col.composite === 'h_ab' ? buildHAB(player.stats) : fmtStat(player.stats[col.key], col)}
        </td>
      ))}
    </tr>
  )
}
