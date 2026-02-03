'use client'

import { Player, Roster, Matchup } from '@/types'

interface LineupCardProps {
  roster: Roster
  players: Player[]
}

export function LineupCard({ roster, players }: LineupCardProps) {
  const starters = roster.players.filter((p) => p.isStarter)
  const bench = roster.players.filter((p) => !p.isStarter)

  const getPlayer = (playerId: string) => {
    return players.find((p) => p.id === playerId)
  }

  const totalProjected = starters.reduce((sum, sp) => {
    const player = getPlayer(sp.playerId)
    return sum + (player?.projectedPoints || 0)
  }, 0)

  return (
    <div className="bg-slate-800 rounded-lg p-6 text-white">
      <h3 className="text-xl font-semibold mb-4">Your Lineup</h3>
      <div className="mb-4">
        <div className="text-2xl font-bold text-primary-400">
          {totalProjected.toFixed(1)}
        </div>
        <div className="text-sm text-slate-400">Projected Points</div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="font-medium mb-2 text-slate-300">Starters</h4>
          <div className="space-y-2">
            {starters.map((starter) => {
              const player = getPlayer(starter.playerId)
              if (!player) return null
              return (
                <div
                  key={starter.playerId}
                  className="flex justify-between items-center p-2 bg-slate-700 rounded"
                >
                  <div>
                    <span className="font-medium">{player.name}</span>
                    <span className="text-sm text-slate-400 ml-2">
                      {player.position} - {player.team}
                    </span>
                  </div>
                  <div className="text-primary-400 font-medium">
                    {player.projectedPoints?.toFixed(1) || '0.0'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {bench.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-slate-300">Bench</h4>
            <div className="space-y-2">
              {bench.map((benchPlayer) => {
                const player = getPlayer(benchPlayer.playerId)
                if (!player) return null
                return (
                  <div
                    key={benchPlayer.playerId}
                    className="flex justify-between items-center p-2 bg-slate-700 rounded opacity-60"
                  >
                    <div>
                      <span className="font-medium">{player.name}</span>
                      <span className="text-sm text-slate-400 ml-2">
                        {player.position} - {player.team}
                      </span>
                    </div>
                    <div className="text-slate-400 text-sm">
                      {player.projectedPoints?.toFixed(1) || '0.0'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface PlayerCardProps {
  player: Player
  onAction?: (action: string) => void
}

export function PlayerCard({ player, onAction }: PlayerCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 text-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold">{player.name}</h3>
          <p className="text-slate-400">
            {player.position} - {player.team}
          </p>
        </div>
        {player.injuryStatus && player.injuryStatus !== 'healthy' && (
          <span
            className={`px-2 py-1 rounded text-xs ${
              player.injuryStatus === 'out'
                ? 'bg-red-600'
                : player.injuryStatus === 'doubtful'
                ? 'bg-orange-600'
                : 'bg-yellow-600'
            }`}
          >
            {player.injuryStatus.toUpperCase()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold text-primary-400">
            {player.projectedPoints?.toFixed(1) || 'N/A'}
          </div>
          <div className="text-sm text-slate-400">Projected Points</div>
        </div>
        {player.adp && (
          <div>
            <div className="text-2xl font-bold text-slate-300">{player.adp}</div>
            <div className="text-sm text-slate-400">Average Draft Position</div>
          </div>
        )}
      </div>

      {onAction && (
        <div className="flex gap-2">
          <button
            onClick={() => onAction('add')}
            className="flex-1 bg-primary-600 hover:bg-primary-700 rounded-lg px-4 py-2"
          >
            Add to Team
          </button>
          <button
            onClick={() => onAction('drop')}
            className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-2"
          >
            Drop
          </button>
        </div>
      )}
    </div>
  )
}

interface MatchupCardProps {
  matchup: Matchup
  team1Name: string
  team2Name: string
}

export function MatchupCard({ matchup, team1Name, team2Name }: MatchupCardProps) {
  const isLive = matchup.status === 'live'
  const isCompleted = matchup.status === 'completed'

  return (
    <div className="bg-slate-800 rounded-lg p-6 text-white">
      <h3 className="text-xl font-semibold mb-4">Week {matchup.week} Matchup</h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="font-medium">{team1Name}</div>
            <div className="text-2xl font-bold text-primary-400 mt-1">
              {isCompleted || isLive ? matchup.team1Score.toFixed(1) : '--'}
            </div>
          </div>
          <div className="text-slate-400 mx-4">vs</div>
          <div className="flex-1 text-right">
            <div className="font-medium">{team2Name}</div>
            <div className="text-2xl font-bold text-primary-400 mt-1">
              {isCompleted || isLive ? matchup.team2Score.toFixed(1) : '--'}
            </div>
          </div>
        </div>

        {isLive && (
          <div className="text-center text-sm text-green-400 font-medium">
            LIVE
          </div>
        )}

        {isCompleted && (
          <div className="text-center text-sm text-slate-400">
            {matchup.team1Score > matchup.team2Score ? team1Name : team2Name} wins
          </div>
        )}
      </div>
    </div>
  )
}
