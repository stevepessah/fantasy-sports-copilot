'use client'

import { Player, Sport } from '@/types'
import { PlayerStats } from './PlayerStats'

interface Card {
  type: 'lineup' | 'matchup' | 'player' | 'waivers' | 'trade' | 'draft' | 'teams'
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
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">
            {p.teamName} • Week {p.week} • Projected: <span className="font-bold text-white">{p.projectedTotal?.toFixed(1) || '0.0'}</span>
          </div>
          <div className="space-y-2">
            {p.slots?.map((slot: any) => (
              <div key={slot.slot} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                <div className="w-16 text-xs font-bold text-slate-400">{slot.slot}</div>
                <div className="flex-1 min-w-0">
                  {slot.player ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{slot.player.name}</span>
                      <span className="text-xs text-slate-400">
                        ({slot.player.position}-{slot.player.team})
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                        {slot.player.projectedPoints?.toFixed(1) || '0.0'} pts
                      </span>
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
              Optimize again
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
      const p = card.payload
      return (
        <CardShell title={card.title}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="text-xs text-slate-400">Home</div>
              <div className="text-lg font-bold">{p.home?.team || 'Your Team'}</div>
              <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300 mt-1 inline-block">
                {p.home?.projected?.toFixed(1) || '0.0'} pts
              </span>
            </div>
            <div className="text-slate-400 font-bold">vs</div>
            <div className="flex-1 text-right">
              <div className="text-xs text-slate-400">Away</div>
              <div className="text-lg font-bold">{p.away?.team || 'Opponent'}</div>
              <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300 mt-1 inline-block">
                {p.away?.projected?.toFixed(1) || '0.0'} pts
              </span>
            </div>
          </div>

          {p.winProbHome !== undefined && (
            <div className="mb-4">
              <div className="text-xs text-slate-400 mb-2">Win Probability:</div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${Math.max(5, Math.min(95, p.winProbHome))}%` }}
                />
              </div>
              <div className="mt-2 text-sm font-bold">
                {p.winProbHome.toFixed(0)}% chance to win
              </div>
            </div>
          )}

          {p.notes && p.notes.length > 0 && (
            <ul className="space-y-1 mb-4">
              {p.notes.map((note: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {note}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => runCommand('set my optimal lineup')}
              className="px-3 py-2.5 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold transition-colors"
            >
              Improve my lineup
            </button>
            <button
              onClick={() => runCommand('who should I pick up on waivers?')}
              className="px-3 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
            >
              Waiver targets
            </button>
          </div>
        </CardShell>
      )
    }

    case 'player': {
      const p = card.payload
      const player = p.player
      return (
        <CardShell title={card.title}>
          {/* Player Information Section */}
          <div className="mb-4 p-3 bg-slate-700/30 rounded-lg">
            <div className="text-lg font-bold mb-2">{player.name}</div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">MLB Team:</span>
                <span className="text-white font-semibold">{player.team}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Position(s):</span>
                <span className="text-white font-semibold">
                  {p.eligiblePositions && p.eligiblePositions.length > 0 
                    ? p.eligiblePositions.join(', ')
                    : player.position}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Fantasy Status:</span>
                {p.ownershipStatus === 'free_agent' && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-600/20 text-green-400 border border-green-600/30 font-semibold">
                    Free Agent
                  </span>
                )}
                {p.ownershipStatus === 'taken' && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-600/20 text-red-400 border border-red-600/30 font-semibold">
                    Taken {p.owningTeamName ? `by ${p.owningTeamName}` : ''}
                  </span>
                )}
                {p.ownershipStatus === 'unknown' && (
                  <span className="text-slate-400 text-xs">Unknown</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold text-primary-400">
                {player.projectedPoints?.toFixed(1) || 'N/A'}
              </div>
              <div className="text-xs text-slate-400">Projected Points</div>
            </div>
            {player.adp && (
              <div>
                <div className="text-2xl font-bold text-slate-300">{player.adp}</div>
                <div className="text-xs text-slate-400">ADP</div>
              </div>
            )}
          </div>

          {/* Player Statistics - Always show if we have a player key or league key */}
          {(player.yahooPlayerKey || p.leagueKey) && (
            <PlayerStats 
              playerKey={player.yahooPlayerKey || null} 
              leagueKey={p.leagueKey}
              playerName={player.name}
              positions={p.eligiblePositions || (player.position ? [player.position] : [])}
            />
          )}

          {p.insights && p.insights.length > 0 && (
            <ul className="space-y-1 mb-4">
              {p.insights.map((insight: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {insight}
                </li>
              ))}
            </ul>
          )}

          {p.actions && p.actions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {p.actions.map((action: any) => (
                <button
                  key={action.label}
                  onClick={() => runCommand(action.command)}
                  className="px-3 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
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
                    className="px-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-semibold"
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
                  className="px-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-semibold"
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
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-4">
            {p.leagueName} • {p.teams?.length || 0} teams
          </div>
          <div className="space-y-2">
            {p.teams?.map((team: any) => (
              <div key={team.rank} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                <div className="w-8 text-sm font-bold text-slate-400">
                  #{team.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{team.name}</div>
                  <div className="text-xs text-slate-400 mt-1 break-words">
                    {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''} · 
                    Win%: {team.winPercentage} · 
                    PF: {team.pointsFor?.toFixed(1) || '0.0'} · 
                    PA: {team.pointsAgainst?.toFixed(1) || '0.0'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {team.rank <= 3 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">
                      Top 3
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardShell>
      )
    }

    default:
      return null
  }
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="text-sm font-bold">{title}</div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  )
}
