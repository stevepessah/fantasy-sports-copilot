'use client'

import { useYahooTeams, YahooTeam } from '@/hooks/useYahooTeams'
import { useYahooRoster } from '@/hooks/useYahooRoster'
import { PlayerStats } from './PlayerStats'
import { useState } from 'react'

interface YahooTeamsProps {
  leagueKey: string | null
}

export default function YahooTeams({ leagueKey }: YahooTeamsProps) {
  const { teams, isLoading, error } = useYahooTeams(leagueKey)
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null)
  const { players: rosterPlayers, isLoading: rosterLoading } = useYahooRoster(selectedTeamKey)
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null)

  if (!leagueKey) {
    return (
      <div className="py-2 text-sm text-slate-400">
        Select a league to view teams
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="py-2 text-sm text-slate-400">
        Loading teams...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-2 text-sm text-red-400">
        {error}
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="py-2 text-sm text-slate-400">
        No teams found
      </div>
    )
  }

  return (
    <div className="py-2 space-y-3">
      <div>
        <label className="text-xs text-slate-400 block mb-2">Teams ({teams.length}):</label>
        <select
          value={selectedTeamKey || ''}
          onChange={(e) => setSelectedTeamKey(e.target.value || null)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Select a team...</option>
          {teams.map((team) => (
            <option key={team.team_key} value={team.team_key}>
              {team.name}
              {team.managers && team.managers.length > 0 && team.managers[0].nickname && (
                ` (${team.managers[0].nickname})`
              )}
            </option>
          ))}
        </select>
      </div>

      {selectedTeamKey && (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Roster
          </h3>
          {rosterLoading ? (
            <div className="text-xs text-slate-400">Loading roster...</div>
          ) : rosterPlayers.length > 0 ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {rosterPlayers.map((player) => (
                <div key={player.player_key}>
                  <button
                    onClick={() => setSelectedPlayerKey(
                      selectedPlayerKey === player.player_key ? null : player.player_key
                    )}
                    className="w-full p-2 rounded-lg border border-slate-700 bg-slate-800/50 text-xs hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">
                          {player.name.full}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          {player.selected_position.position || player.display_position || player.position || 'BN'}
                          {player.editorial_team_abbr && ` • ${player.editorial_team_abbr}`}
                          {player.status && player.status !== 'A' && (
                            <span className="text-yellow-400 ml-1">({player.status})</span>
                          )}
                        </div>
                      </div>
                      {player.selected_position.position && player.selected_position.position !== 'BN' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-600/20 text-green-400 border border-green-600/30">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                  {selectedPlayerKey === player.player_key && (
                    <div className="mt-2 ml-2">
                      <PlayerStats 
                        playerKey={player.player_key} 
                        leagueKey={leagueKey}
                        playerName={player.name.full}
                        positions={player.eligible_positions || (player.display_position ? player.display_position.split(',') : [])}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400">No players found</div>
          )}
        </div>
      )}
    </div>
  )
}
