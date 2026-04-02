'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import AuthRequiredMessage, { isAuthError } from '@/components/AuthRequiredMessage'
import type { MatchupResponse, MatchupPayload, MatchupTeamPayload } from '@/app/api/yahoo/matchup/route'

interface MyMatchupProps {
  leagueKey: string | null
}

export default function MyMatchup({ leagueKey }: MyMatchupProps) {
  const { leagues } = useYahooLeagues('mlb')
  const effectiveLeagueKey = leagueKey ?? leagues[0]?.league_key ?? null

  const [data, setData] = useState<MatchupResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestedWeek, setRequestedWeek] = useState<number | undefined>(undefined)

  const fetchMatchup = useCallback(
    (week?: number) => {
      if (!effectiveLeagueKey) return

      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({ leagueKey: effectiveLeagueKey })
      if (week) params.set('week', week.toString())

      fetch(`/api/yahoo/matchup?${params}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch matchup (${res.status})`)
          return res.json()
        })
        .then((json: MatchupResponse) => {
          setData(json)
        })
        .catch((err) => {
          setError(err.message)
        })
        .finally(() => {
          setIsLoading(false)
        })
    },
    [effectiveLeagueKey],
  )

  useEffect(() => {
    fetchMatchup(requestedWeek)
  }, [fetchMatchup, requestedWeek])

  // All hooks must be called before any conditional returns
  const lowerBetterStats = useMemo(() => {
    const set = new Set(['ERA', 'WHIP', 'BB(P)', 'L'])
    if (data?.leagueCategories) {
      for (const cat of data.leagueCategories) {
        if (cat.sortOrder === '0') set.add(cat.displayName)
      }
    }
    return set
  }, [data?.leagueCategories])

  if (!effectiveLeagueKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Select a league to view matchups
      </div>
    )
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading matchups…
        </div>
      </div>
    )
  }

  if (error && !data) {
    if (isAuthError(error)) return <AuthRequiredMessage />
    return (
      <div className="flex items-center justify-center py-16 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (!data) return null

  const displayed = data.displayedWeek
  const canPrev = displayed > 1
  const canNext = data.totalWeeks ? displayed < data.totalWeeks : true

  const navigateWeek = (week: number) => {
    setRequestedWeek(week)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <button
            disabled={!canPrev || isLoading}
            onClick={() => navigateWeek(displayed - 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            Week {displayed - 1}
          </button>
          <div className="text-center">
            <span className="text-base font-bold text-white">Week {displayed}</span>
            {data.userMatchup?.weekStart && data.userMatchup?.weekEnd && (
              <div className="text-[10px] text-slate-400">
                {data.userMatchup.weekStart} – {data.userMatchup.weekEnd}
              </div>
            )}
          </div>
          <button
            disabled={!canNext || isLoading}
            onClick={() => navigateWeek(displayed + 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            Week {displayed + 1}
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-2">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* User's matchup */}
        {data.userMatchup && (
          <MatchupCard
            matchup={data.userMatchup}
            isUserMatchup
            lowerBetterStats={lowerBetterStats}
            leagueCategories={data.leagueCategories}
          />
        )}

        {/* Other matchups */}
        {data.otherMatchups.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 px-1">
              Other Matchups
            </h3>
            <div className="space-y-3">
              {data.otherMatchups.map((m, i) => (
                <MatchupCard
                  key={i}
                  matchup={m}
                  lowerBetterStats={lowerBetterStats}
                  leagueCategories={data.leagueCategories}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MatchupCard({
  matchup,
  isUserMatchup,
  lowerBetterStats,
  leagueCategories,
}: {
  matchup: MatchupPayload
  isUserMatchup?: boolean
  lowerBetterStats: Set<string>
  leagueCategories: MatchupResponse['leagueCategories']
}) {
  const [expanded, setExpanded] = useState(isUserMatchup ?? false)

  const t1 = matchup.teams[0]
  const t2 = matchup.teams[1]

  const hasStats = t1.stats && Object.keys(t1.stats).length > 0
  const canShowCategories = (leagueCategories && leagueCategories.length > 0) || hasStats

  const statusLabel =
    matchup.status === 'midevent' ? '🔴 Live' :
    matchup.status === 'postevent' ? '✅ Final' : '🕐 Upcoming'

  const statusColor =
    matchup.status === 'midevent' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    matchup.status === 'postevent' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    'bg-slate-600/30 text-slate-400 border-slate-600'

  const catResults = useMemo(() => {
    if (!canShowCategories) return null
    const stats1 = t1.stats || {}
    const stats2 = t2.stats || {}

    const statEntries = leagueCategories
      ? leagueCategories.map((c) => ({ key: c.displayName, positionType: c.positionType }))
      : Object.keys(stats1).map((k) => ({ key: k, positionType: undefined as string | undefined }))

    let t1Wins = 0, t2Wins = 0, ties = 0
    const rows: { stat: string; displayStat: string; t1Val: number | string | null; t2Val: number | string | null; winner: 1 | 2 | 0; positionType?: string }[] = []
    for (const { key: stat, positionType } of statEntries) {
      const v1 = stat in stats1 ? stats1[stat] : null
      const v2 = stat in stats2 ? stats2[stat] : null
      const displayStat = stat.replace(/\(B\)$/, '').replace(/\(P\)$/, '')

      if (v1 == null && v2 == null) {
        rows.push({ stat, displayStat, t1Val: null, t2Val: null, winner: 0, positionType })
        continue
      }

      const n1 = v1 != null ? (typeof v1 === 'number' ? v1 : parseFloat(String(v1))) : NaN
      const n2 = v2 != null ? (typeof v2 === 'number' ? v2 : parseFloat(String(v2))) : NaN
      const lowerBetter = lowerBetterStats.has(stat)
      let winner: 1 | 2 | 0 = 0
      if (!isNaN(n1) && !isNaN(n2)) {
        if (lowerBetter) {
          if (n1 < n2) { winner = 1; t1Wins++ }
          else if (n1 > n2) { winner = 2; t2Wins++ }
          else ties++
        } else {
          if (n1 > n2) { winner = 1; t1Wins++ }
          else if (n1 < n2) { winner = 2; t2Wins++ }
          else ties++
        }
      }
      rows.push({ stat, displayStat, t1Val: v1, t2Val: v2, winner, positionType })
    }
    return { t1Wins, t2Wins, ties, rows }
  }, [t1.stats, t2.stats, canShowCategories, lowerBetterStats, leagueCategories])

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isUserMatchup
        ? 'border-primary-500/30 bg-slate-800/60'
        : 'border-slate-700/50 bg-slate-800/40'
    }`}>
      {/* Matchup header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 sm:px-4 py-3 flex items-center gap-2 hover:bg-slate-700/20 transition-colors"
      >
        {/* Invisible spacer to balance the chevron on the right */}
        <div className="w-4 shrink-0" />

        <TeamBadge team={t1} winnerKey={matchup.winnerTeamKey} side="left" />

        <div className="flex flex-col items-center shrink-0 px-2">
          {/* Points or category tally */}
          {catResults ? (
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className={catResults.t1Wins > catResults.t2Wins ? 'text-green-400' : 'text-slate-300'}>
                {catResults.t1Wins}
              </span>
              <span className="text-slate-500">-</span>
              <span className={catResults.t2Wins > catResults.t1Wins ? 'text-green-400' : 'text-slate-300'}>
                {catResults.t2Wins}
              </span>
            </div>
          ) : t1.points != null && t2.points != null ? (
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className={t1.points > t2.points ? 'text-green-400' : 'text-slate-300'}>
                {typeof t1.points === 'number' ? t1.points.toFixed(1) : t1.points}
              </span>
              <span className="text-slate-500">-</span>
              <span className={t2.points > t1.points ? 'text-green-400' : 'text-slate-300'}>
                {typeof t2.points === 'number' ? t2.points.toFixed(1) : t2.points}
              </span>
            </div>
          ) : (
            <span className="text-slate-500 text-xs font-medium">vs</span>
          )}
          <span className={`mt-0.5 px-1.5 py-0.5 text-[8px] sm:text-[9px] rounded-full font-semibold border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <TeamBadge team={t2} winnerKey={matchup.winnerTeamKey} side="right" />

        <svg
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded: category stats table */}
      {expanded && catResults && catResults.rows.length > 0 && (
        <div className="border-t border-slate-700/50 px-3 sm:px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] sm:text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700/50">
                  <th className="text-left py-1 px-1 font-medium truncate max-w-[80px]">{t1.name}</th>
                  <th className="text-center py-1 px-1 font-medium">Stat</th>
                  <th className="text-right py-1 px-1 font-medium truncate max-w-[80px]">{t2.name}</th>
                </tr>
              </thead>
              <tbody>
                {catResults.rows.map((row, i) => {
                  const prev = i > 0 ? catResults.rows[i - 1] : null
                  const showSection = row.positionType && row.positionType !== prev?.positionType
                  return (
                    <Fragment key={row.stat}>
                      {showSection && (
                        <tr>
                          <td colSpan={3} className="pt-2.5 pb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-0 text-center">
                            {row.positionType === 'B' ? 'Batting' : row.positionType === 'P' ? 'Pitching' : ''}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-700/30 last:border-0">
                        <td className={`py-1 px-1 font-mono text-left ${row.t1Val == null ? 'text-slate-600' : row.winner === 1 ? 'text-green-400 font-bold' : 'text-slate-300'}`}>
                          {fmtStatVal(row.t1Val, row.stat)}
                        </td>
                        <td className="py-1 px-1 text-center text-slate-400 font-medium">{row.displayStat}</td>
                        <td className={`py-1 px-1 font-mono text-right ${row.t2Val == null ? 'text-slate-600' : row.winner === 2 ? 'text-green-400 font-bold' : 'text-slate-300'}`}>
                          {fmtStatVal(row.t2Val, row.stat)}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expanded: points breakdown if no category stats */}
      {expanded && !catResults && (t1.points != null || t2.points != null) && (
        <div className="border-t border-slate-700/50 px-3 sm:px-4 py-3">
          <div className="flex items-stretch gap-3">
            <PointsPanel team={t1} isWinner={matchup.winnerTeamKey === t1.teamKey} />
            <div className="flex items-center">
              <span className="text-slate-600 text-xs font-bold">vs</span>
            </div>
            <PointsPanel team={t2} isWinner={matchup.winnerTeamKey === t2.teamKey} />
          </div>
        </div>
      )}
    </div>
  )
}

function TeamBadge({
  team,
  winnerKey,
  side,
}: {
  team: MatchupTeamPayload
  winnerKey?: string
  side: 'left' | 'right'
}) {
  const isWinner = winnerKey === team.teamKey
  return (
    <div className={`flex-1 min-w-0 flex items-center gap-2 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {team.logoUrl && (
        <img src={team.logoUrl} alt="" className="w-7 h-7 rounded shrink-0" />
      )}
      <div className="min-w-0">
        <div className={`text-xs font-medium truncate ${isWinner ? 'text-green-400' : team.isUser ? 'text-primary-400' : 'text-white'}`}>
          {team.name}
        </div>
        {team.isUser && (
          <div className="text-[8px] text-primary-400/70 font-semibold uppercase">Your Team</div>
        )}
      </div>
    </div>
  )
}

function PointsPanel({ team, isWinner }: { team: MatchupTeamPayload; isWinner: boolean }) {
  return (
    <div className={`flex-1 rounded-lg p-3 text-center ${
      isWinner ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-700/30 border border-slate-700'
    }`}>
      {team.logoUrl && (
        <img src={team.logoUrl} alt="" className="w-8 h-8 mx-auto mb-1 rounded" />
      )}
      <div className="text-xs font-bold truncate">{team.name}</div>
      {team.isUser && <div className="text-[9px] text-primary-400 font-semibold">YOUR TEAM</div>}
      {team.points != null && (
        <div className="text-lg font-bold mt-1">
          {typeof team.points === 'number' ? team.points.toFixed(1) : team.points}
        </div>
      )}
      {team.winProbability != null && (
        <div className="text-[10px] text-slate-400 mt-0.5">{team.winProbability}% win</div>
      )}
    </div>
  )
}

function fmtStatVal(val: number | string | null, stat?: string): string {
  if (val == null) return '-'
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toString()
    const base = stat?.replace(/\([BP]\)$/, '')
    if (base === 'ERA' || base === 'WHIP') return val.toFixed(2)
    return val.toFixed(3).replace(/^0\./, '.')
  }
  return String(val)
}
