'use client'

import { useMemo } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import { useYahooTeams } from '@/hooks/useYahooTeams'
import { useYahooRoster, YahooRosterPlayer } from '@/hooks/useYahooRoster'

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

  const { players, isLoading: rosterLoading, error } = useYahooRoster(userTeam?.team_key ?? null)

  const batters = useMemo(() => players.filter((p) => p.position_type === 'B'), [players])
  const pitchers = useMemo(() => players.filter((p) => p.position_type === 'P'), [players])

  if (!effectiveLeagueKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Select a league to view your roster
      </div>
    )
  }

  const isLoading = teamsLoading || rosterLoading

  if (isLoading) {
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

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (!userTeam) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Could not find your team in this league
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
        <div className="flex items-center gap-3 mb-4 px-1">
          {userTeam.logo_url && (
            <img src={userTeam.logo_url} alt="" className="w-9 h-9 rounded-lg" />
          )}
          <div>
            <h2 className="text-lg font-bold text-white">{userTeam.name}</h2>
            <p className="text-xs text-slate-400">
              {players.length} players
            </p>
          </div>
        </div>

        {players.length > 0 && (
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
