'use client'

import { useState, useMemo } from 'react'
import { useYahooSeasons, useYahooSeasonHistory, HistoryLeagueWithStandings } from '@/hooks/useYahooHistory'
import type { ParsedStandingsTeam } from '@/lib/yahoo/xmlParser'

// ── Standings Table ──

function StandingsTable({ standings }: { standings: ParsedStandingsTeam[] }) {
  if (standings.length === 0) {
    return <p className="text-xs text-slate-500 italic">No standings data available.</p>
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700/50">
            <th className="text-left py-1.5 pl-1 pr-2 font-semibold">#</th>
            <th className="text-left py-1.5 pr-2 font-semibold">Team</th>
            <th className="text-center py-1.5 px-1.5 font-semibold">W</th>
            <th className="text-center py-1.5 px-1.5 font-semibold">L</th>
            <th className="text-center py-1.5 px-1.5 font-semibold">T</th>
            <th className="text-center py-1.5 px-1.5 font-semibold">Pct</th>
            {standings.some(t => t.points_for) && (
              <th className="text-right py-1.5 px-1.5 font-semibold">Pts</th>
            )}
            {standings.some(t => t.streak) && (
              <th className="text-center py-1.5 px-1.5 font-semibold">Streak</th>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => {
            const isCurrentUser = team.managers?.some(m => m.is_current_login === '1')
            return (
              <tr
                key={team.team_key}
                className={`border-b border-slate-700/20 ${
                  isCurrentUser
                    ? 'bg-primary-600/10 text-white'
                    : 'text-slate-300'
                }`}
              >
                <td className="py-1.5 pl-1 pr-2 text-slate-500">{team.rank}</td>
                <td className="py-1.5 pr-2 font-medium truncate max-w-[130px]">
                  <div className="flex items-center gap-1.5">
                    {isCurrentUser && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                    )}
                    <span className="truncate">{team.name}</span>
                  </div>
                  {team.managers?.[0]?.nickname && (
                    <div className="text-[10px] text-slate-500 truncate">{team.managers[0].nickname}</div>
                  )}
                </td>
                <td className="text-center py-1.5 px-1.5 text-green-400">{team.wins}</td>
                <td className="text-center py-1.5 px-1.5 text-red-400">{team.losses}</td>
                <td className="text-center py-1.5 px-1.5 text-slate-500">{team.ties}</td>
                <td className="text-center py-1.5 px-1.5">{team.percentage}</td>
                {standings.some(t => t.points_for) && (
                  <td className="text-right py-1.5 px-1.5 tabular-nums">
                    {team.points_for?.toFixed(1) ?? '–'}
                  </td>
                )}
                {standings.some(t => t.streak) && (
                  <td className="text-center py-1.5 px-1.5">
                    {team.streak ? (
                      <span className={team.streak.type === 'win' ? 'text-green-400' : 'text-red-400'}>
                        {team.streak.type === 'win' ? 'W' : 'L'}{team.streak.value}
                      </span>
                    ) : '–'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── League Card ──

function LeagueCard({ league }: { league: HistoryLeagueWithStandings }) {
  const [expanded, setExpanded] = useState(false)

  // Find the current user's team for a quick summary
  const userTeam = league.standings?.find(t =>
    t.managers?.some(m => m.is_current_login === '1')
  )

  return (
    <div className="border border-slate-700/60 rounded-lg bg-slate-800/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5 hover:bg-slate-700/30 transition-colors rounded-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{league.name}</div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
              <span>{league.num_teams} teams</span>
              <span>•</span>
              <span className="capitalize">{league.scoring_type}</span>
              {league.is_finished === '1' && (
                <>
                  <span>•</span>
                  <span className="text-slate-500">Finished</span>
                </>
              )}
            </div>
            {userTeam && (
              <div className="mt-1 text-[11px]">
                <span className="text-slate-400">Your finish: </span>
                <span className="text-white font-medium">
                  #{userTeam.rank}
                </span>
                <span className="text-slate-500 ml-1">
                  ({userTeam.wins}-{userTeam.losses}{userTeam.ties > 0 ? `-${userTeam.ties}` : ''})
                </span>
                {userTeam.clinched_playoffs && (
                  <span className="ml-1 text-green-400">🏆</span>
                )}
              </div>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && league.standings && league.standings.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/30">
          <StandingsTable standings={league.standings} />
        </div>
      )}
      {expanded && (!league.standings || league.standings.length === 0) && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/30">
          <p className="text-xs text-slate-500 italic">No standings data available for this league.</p>
        </div>
      )}
    </div>
  )
}

// ── Main Component ──

export default function SeasonHistory() {
  const { seasons, isLoading: seasonsLoading, error: seasonsError } = useYahooSeasons()
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)

  const { leagues, isLoading: historyLoading, error: historyError } = useYahooSeasonHistory(selectedSeason)

  // Derive available season years from user's leagues
  const availableSeasons = useMemo(() => {
    return seasons.map(s => parseInt(s.season)).filter(y => !isNaN(y)).sort((a, b) => b - a)
  }, [seasons])

  if (seasonsLoading) {
    return (
      <div className="text-xs text-slate-400 py-2">Loading seasons…</div>
    )
  }

  if (seasonsError) {
    return (
      <div className="text-xs text-red-400 py-2">{seasonsError}</div>
    )
  }

  if (availableSeasons.length === 0) {
    return (
      <div className="text-xs text-slate-500 py-2">No past seasons found.</div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Season Selector */}
      <div>
        <label className="text-xs text-slate-400 block mb-1.5">Season:</label>
        <select
          value={selectedSeason ?? ''}
          onChange={(e) => setSelectedSeason(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Choose a season…</option>
          {availableSeasons.map((year) => (
            <option key={year} value={year}>
              {year} Season
            </option>
          ))}
        </select>
      </div>

      {/* Season Data */}
      {selectedSeason && (
        <div className="space-y-2">
          {historyLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Loading {selectedSeason} season…</span>
            </div>
          ) : historyError ? (
            <div className="text-xs text-red-400 py-2">{historyError}</div>
          ) : leagues.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">
              No leagues found for the {selectedSeason} season.
            </div>
          ) : (
            <div className="space-y-2">
              {leagues.map((league) => (
                <LeagueCard key={league.league_key} league={league} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
