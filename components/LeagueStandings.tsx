'use client'

import { useState, useEffect } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import { useYahooRoster, YahooRosterPlayer } from '@/hooks/useYahooRoster'
import type { ParsedStandingsTeam } from '@/lib/yahoo/xmlParser'

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

function TeamRosterView({
  teamKey,
  teamName,
  onBack,
}: {
  teamKey: string
  teamName: string | null
  onBack: () => void
}) {
  const { players, isLoading, error } = useYahooRoster(teamKey)

  const batters = players.filter((p) => p.position_type === 'B')
  const pitchers = players.filter((p) => p.position_type === 'P')

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
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
          <div className="space-y-4">
            {batters.length > 0 && (
              <RosterSection title="Batters" players={batters} />
            )}
            {pitchers.length > 0 && (
              <RosterSection title="Pitchers" players={pitchers} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RosterSection({ title, players }: { title: string; players: YahooRosterPlayer[] }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-800/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-400">
          {title} ({players.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-left">
              <th className="py-2 pl-3 pr-2 font-semibold w-12">Pos</th>
              <th className="py-2 pr-3 font-semibold">Player</th>
              <th className="py-2 px-2 font-semibold hidden sm:table-cell">Team</th>
              <th className="py-2 px-2 font-semibold">Eligible</th>
              <th className="py-2 pr-3 font-semibold text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const isBench = player.selected_position.position === 'BN'
              const isIL = ['IL', 'IL+', 'DL'].includes(player.selected_position.position)
              return (
                <tr
                  key={player.player_key}
                  className={`border-b border-slate-700/30 last:border-0 transition-colors ${
                    isBench || isIL ? 'opacity-60' : ''
                  }`}
                >
                  <td className="py-2 pl-3 pr-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isIL
                        ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                        : isBench
                        ? 'bg-slate-600/30 text-slate-400 border border-slate-600/40'
                        : 'bg-slate-600/40 text-slate-200 border border-slate-500/30'
                    }`}>
                      {player.selected_position.position}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      {player.image_url && (
                        <img
                          src={player.image_url}
                          alt=""
                          className="w-7 h-7 rounded-full shrink-0 bg-slate-700"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate max-w-[140px] sm:max-w-[200px]">
                          {player.name.full}
                        </div>
                        <div className="text-[10px] text-slate-500 sm:hidden">
                          {player.editorial_team_abbr ?? ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-slate-400 hidden sm:table-cell">
                    {player.editorial_team_abbr ?? '-'}
                  </td>
                  <td className="py-2 px-2 text-slate-400 text-[10px] sm:text-xs">
                    {player.eligible_positions
                      ?.filter((p) => !['BN', 'IL', 'IL+', 'DL', 'NA', 'Util'].includes(p))
                      .join(', ') || player.display_position || '-'}
                  </td>
                  <td className="py-2 pr-3 text-center">
                    {player.injury_status ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        player.injury_status === 'O' || player.injury_status === 'OUT'
                          ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                          : player.injury_status === 'DTD'
                          ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                          : 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
                      }`}>
                        {player.injury_status}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
