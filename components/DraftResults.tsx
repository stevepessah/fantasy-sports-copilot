'use client'

import { useState, useEffect, useMemo } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'

interface DraftPick {
  pick: number
  round: number
  team_key: string
  player_key: string
  is_keeper?: boolean
  player?: {
    player_key: string
    player_id: string
    name: { full: string; first: string; last: string }
    editorial_team_abbr?: string
    display_position?: string
    headshot_url?: string
  }
  team_name: string
  team_logo?: string
  team_id: string
}

interface TeamInfo {
  team_key: string
  team_id: string
  name: string
  logo_url?: string
}

interface DraftResultsProps {
  leagueKey: string | null
}

type ViewMode = 'by-round' | 'by-team'

export default function DraftResults({ leagueKey }: DraftResultsProps) {
  const [picks, setPicks] = useState<DraftPick[]>([])
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('by-round')

  const { leagues } = useYahooLeagues('mlb')
  const effectiveLeagueKey = leagueKey ?? leagues[0]?.league_key

  useEffect(() => {
    if (!effectiveLeagueKey) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/api/yahoo/draft-results?leagueKey=${encodeURIComponent(effectiveLeagueKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch draft results (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setPicks(data.picks ?? [])
        setTeams(data.teams ?? [])
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

  const maxRound = useMemo(() => Math.max(0, ...picks.map((p) => p.round)), [picks])

  const picksByTeam = useMemo(() => {
    const map = new Map<string, DraftPick[]>()
    for (const p of picks) {
      const arr = map.get(p.team_key) ?? []
      arr.push(p)
      map.set(p.team_key, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.round - b.round)
    return map
  }, [picks])

  const pickGrid = useMemo(() => {
    const grid: Map<string, Map<number, DraftPick>> = new Map()
    for (const t of teams) grid.set(t.team_key, new Map())
    for (const p of picks) {
      const teamMap = grid.get(p.team_key)
      if (teamMap) teamMap.set(p.round, p)
    }
    return grid
  }, [picks, teams])

  if (!effectiveLeagueKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Select a league to view draft results
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
          Loading draft results…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">Failed to load draft results</p>
          <p className="text-slate-500 text-xs">{error}</p>
        </div>
      </div>
    )
  }

  if (picks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        No draft results available yet
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white">Draft Results</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">{picks.length} picks · {teams.length} teams</p>
        </div>
        <div className="flex bg-slate-800 rounded-lg border border-slate-700/60 p-0.5">
          <button
            onClick={() => setViewMode('by-round')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'by-round'
                ? 'bg-primary-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            By Round
          </button>
          <button
            onClick={() => setViewMode('by-team')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'by-team'
                ? 'bg-primary-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            By Team
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        {viewMode === 'by-round' ? (
          <ByRoundView
            teams={teams}
            pickGrid={pickGrid}
            maxRound={maxRound}
          />
        ) : (
          <ByTeamView
            teams={teams}
            picksByTeam={picksByTeam}
          />
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────── */
/*  By Round View                             */
/* ────────────────────────────────────────── */

function ByRoundView({
  teams,
  pickGrid,
  maxRound,
}: {
  teams: TeamInfo[]
  pickGrid: Map<string, Map<number, DraftPick>>
  maxRound: number
}) {
  const TEAMS_PER_GROUP = 3

  const teamGroups: TeamInfo[][] = []
  for (let i = 0; i < teams.length; i += TEAMS_PER_GROUP) {
    teamGroups.push(teams.slice(i, i + TEAMS_PER_GROUP))
  }

  return (
    <div className="space-y-6">
      {teamGroups.map((group, gIdx) => (
        <div key={gIdx} className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {group.map((team) => (
                  <th
                    key={team.team_key}
                    className="text-left py-2 px-3 bg-slate-800/80 border-b border-slate-700/50 font-bold text-white"
                    style={{ width: `${100 / group.length}%` }}
                  >
                    <div className="flex items-center gap-2">
                      {team.logo_url && (
                        <img src={team.logo_url} alt="" className="w-5 h-5 rounded-sm" />
                      )}
                      <span className="truncate">{team.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRound }, (_, rIdx) => {
                const round = rIdx + 1
                return (
                  <tr key={round} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    {group.map((team) => {
                      const pick = pickGrid.get(team.team_key)?.get(round)
                      return (
                        <td key={team.team_key} className="py-1.5 px-3 align-top">
                          {pick ? (
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-500 tabular-nums w-4 text-right shrink-0">{round}.</span>
                                  <span className={`font-medium truncate ${pick.is_keeper ? 'text-primary-400' : 'text-slate-200'}`}>
                                    {pick.player?.name.full || pick.player_key}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 ml-5">
                                  <span className="text-slate-500">
                                    {pick.player?.display_position || ''}
                                    {pick.player?.editorial_team_abbr ? ` - ${pick.player.editorial_team_abbr}` : ''}
                                  </span>
                                </div>
                              </div>
                              {pick.is_keeper && (
                                <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-bold bg-primary-600/20 text-primary-400 border border-primary-500/30">
                                  K
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────── */
/*  By Team View                              */
/* ────────────────────────────────────────── */

function ByTeamView({
  teams,
  picksByTeam,
}: {
  teams: TeamInfo[]
  picksByTeam: Map<string, DraftPick[]>
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map((team) => {
        const teamPicks = picksByTeam.get(team.team_key) ?? []
        const keeperCount = teamPicks.filter((p) => p.is_keeper).length

        return (
          <div
            key={team.team_key}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden"
          >
            {/* Team header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800 border-b border-slate-700/50">
              <div className="flex items-center gap-2 min-w-0">
                {team.logo_url && (
                  <img src={team.logo_url} alt="" className="w-6 h-6 rounded-sm shrink-0" />
                )}
                <span className="font-bold text-sm text-white truncate">{team.name}</span>
              </div>
              {keeperCount > 0 && (
                <span className="text-[10px] text-primary-400 shrink-0">
                  {keeperCount} keeper{keeperCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Picks table */}
            <div className="divide-y divide-slate-700/20">
              {teamPicks.map((pick) => (
                <div
                  key={pick.pick}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                    pick.is_keeper ? 'bg-primary-600/5' : ''
                  }`}
                >
                  <span className="text-slate-500 tabular-nums w-5 text-right shrink-0">
                    {pick.round}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium truncate block ${pick.is_keeper ? 'text-primary-400' : 'text-slate-200'}`}>
                      {pick.player?.name.full || pick.player_key}
                    </span>
                  </div>
                  <span className="text-slate-500 shrink-0">
                    {pick.player?.display_position || ''}
                  </span>
                  {pick.is_keeper && (
                    <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-bold bg-primary-600/20 text-primary-400 border border-primary-500/30">
                      K
                    </span>
                  )}
                </div>
              ))}
              {teamPicks.length === 0 && (
                <div className="px-3 py-3 text-xs text-slate-500 italic">No picks</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
