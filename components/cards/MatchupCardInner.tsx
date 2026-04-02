'use client'

import { useState } from 'react'
import { CardShell } from './CardShell'

interface MatchupCardProps {
  card: { title: string; payload: any }
  runCommand: (cmd: string) => void
}

export function MatchupCardInner({ card, runCommand }: MatchupCardProps) {
  const p = card.payload
  const [showOthers, setShowOthers] = useState(false)

  const userMatch = p.userMatchup
  const userTeam = userMatch?.teams?.find((t: any) => t.isUser) ?? userMatch?.teams?.[0]
  const oppTeam = userMatch?.teams?.find((t: any) => !t.isUser) ?? userMatch?.teams?.[1]
  const hasStats = userTeam?.stats && Object.keys(userTeam.stats).length > 0

  const catResults = (() => {
    if (!hasStats || !userTeam?.stats || !oppTeam?.stats) return null
    let userWins = 0, oppWins = 0, ties = 0
    const rows: { stat: string; userVal: number | string; oppVal: number | string; winner: 'user' | 'opp' | 'tie' }[] = []
    for (const [stat, uVal] of Object.entries(userTeam.stats as Record<string, number | string>)) {
      const oVal = oppTeam.stats[stat]
      if (oVal == null) continue
      const uNum = typeof uVal === 'number' ? uVal : parseFloat(uVal as string)
      const oNum = typeof oVal === 'number' ? oVal : parseFloat(oVal as string)
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

  const statusLabel = userMatch?.status === 'midevent' ? '🔴 Live' :
    userMatch?.status === 'postevent' ? '✅ Final' : '🕐 Upcoming'

  const displayed = p.displayedWeek ?? p.currentWeek ?? 1
  const canPrev = displayed > 1
  const canNext = p.totalWeeks ? displayed < p.totalWeeks : true

  return (
    <CardShell title={card.title}>
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

      <div className="flex justify-center mb-3">
        <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
          userMatch?.status === 'midevent' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
          userMatch?.status === 'postevent' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
          'bg-slate-600/30 text-slate-400 border border-slate-600'
        }`}>
          {statusLabel}
        </span>
      </div>

      {userTeam && oppTeam && (
        <div className="flex items-stretch gap-2 mb-3">
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

          <div className="flex items-center">
            <span className="text-slate-500 font-bold text-sm">vs</span>
          </div>

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

      {catResults && catResults.rows.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-center gap-3 mb-2 text-xs font-bold">
            <span className="text-green-400">{catResults.userWins}W</span>
            <span className="text-slate-400">–</span>
            <span className="text-red-400">{catResults.oppWins}L</span>
          </div>
          <div className="table-scroll-hint">
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
        </div>
      )}

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
