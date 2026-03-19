'use client'

import dynamic from 'next/dynamic'
import { Player, Sport } from '@/types'
import { PlayerStats } from './PlayerStats'
import { CardShell } from './cards/CardShell'
import { RosterListCard } from './cards/RosterListCard'
import { MatchupCardInner } from './cards/MatchupCardInner'

const CompareCard = dynamic(() => import('./CompareCard'), { ssr: false })

interface Card {
  type: 'lineup' | 'matchup' | 'player' | 'waivers' | 'trade' | 'draft' | 'teams' | 'roster_list' | 'compare'
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
      const hasProjections = p.projectedTotal != null
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">
            {p.teamName}
            {p.week != null && <> • Week {p.week}</>}
            {hasProjections && <> • Projected: <span className="font-bold text-white">{p.projectedTotal.toFixed(1)}</span></>}
          </div>
          <div className="space-y-2">
            {p.slots?.map((slot: any, idx: number) => (
              <div key={`${slot.slot}-${idx}`} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                <div className="w-16 text-xs font-bold text-slate-400">{slot.slot}</div>
                <div className="flex-1 min-w-0">
                  {slot.player ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{slot.player.name}</span>
                      <span className="text-xs text-slate-400">
                        ({slot.player.position}{slot.player.team ? `-${slot.player.team}` : ''})
                      </span>
                      {slot.player.projectedPoints != null && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                          {slot.player.projectedPoints.toFixed(1)} pts
                        </span>
                      )}
                      {slot.player.injuryStatus && (
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                          slot.player.injuryStatus === 'O' || slot.player.injuryStatus === 'OUT'
                            ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                            : slot.player.injuryStatus === 'DTD'
                            ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                            : 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
                        }`}>
                          {slot.player.injuryStatus}
                        </span>
                      )}
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
              Optimize lineup
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
      return <MatchupCardInner card={card} runCommand={runCommand} />
    }

    case 'player': {
      const p = card.payload
      const player = p.player
      return (
        <CardShell title={card.title}>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-base sm:text-lg font-bold leading-tight">{player.name}</span>
            <span className="text-xs text-slate-400">
              {player.team} &middot; {p.eligiblePositions && p.eligiblePositions.length > 0 
                ? p.eligiblePositions.join(', ')
                : player.position}
            </span>
            {p.ownershipStatus === 'free_agent' && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-green-600/20 text-green-400 border border-green-600/30 font-semibold leading-none">
                FA
              </span>
            )}
            {p.ownershipStatus === 'taken' && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-600/20 text-red-400 border border-red-600/30 font-semibold leading-none">
                {p.owningTeamName ? p.owningTeamName : 'Taken'}
              </span>
            )}
          </div>

          {(player.projectedPoints || player.adp) && (
            <div className="flex items-baseline gap-4 mb-2 text-xs text-slate-400">
              {player.projectedPoints != null && (
                <span>Proj <span className="text-primary-400 font-bold text-sm">{player.projectedPoints.toFixed(1)}</span></span>
              )}
              {player.adp != null && (
                <span>ADP <span className="text-slate-200 font-bold text-sm">{player.adp}</span></span>
              )}
            </div>
          )}

          {(player.yahooPlayerKey || p.leagueKey) && (
            <PlayerStats 
              playerKey={player.yahooPlayerKey || null} 
              leagueKey={p.leagueKey}
              playerName={player.name}
              positions={p.eligiblePositions?.length > 0 ? p.eligiblePositions : (player.position ? [player.position] : [])}
            />
          )}

          {p.insights && p.insights.length > 0 && (
            <ul className="space-y-0.5 mb-2">
              {p.insights.map((insight: string, i: number) => (
                <li key={i} className="text-xs text-slate-400 list-disc list-inside">
                  {insight}
                </li>
              ))}
            </ul>
          )}

          {p.actions && p.actions.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {p.actions.map((action: any) => (
                <button
                  key={action.label}
                  onClick={() => runCommand(action.command)}
                  className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
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
                    className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
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
                  className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold transition-colors"
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
      const teams: any[] = p.teams || []
      return (
        <CardShell title={card.title}>
          <div className="text-xs text-slate-400 mb-3">
            {p.leagueName} • {teams.length} teams
          </div>
          <div className="table-scroll-hint">
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="py-2 pr-2 font-semibold w-8 text-center">#</th>
                  <th className="py-2 pr-3 font-semibold">Team</th>
                  <th className="py-2 px-2 font-semibold text-center whitespace-nowrap">W-L-T</th>
                  <th className="py-2 px-2 font-semibold text-center">Pct</th>
                  <th className="py-2 px-2 font-semibold text-center">GB</th>
                  <th className="py-2 px-2 font-semibold text-center">Waiver</th>
                  <th className="py-2 pl-2 font-semibold text-center">Moves</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team: any) => (
                  <tr
                    key={team.rank}
                    className="border-b border-slate-700/40 last:border-0 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-2 pr-2 text-center text-slate-400 font-bold">{team.rank}</td>
                    <td className="py-2 pr-3 font-medium truncate max-w-[140px] sm:max-w-[200px]">{team.name}</td>
                    <td className="py-2 px-2 text-center text-slate-300 whitespace-nowrap tabular-nums">
                      {team.wins}-{team.losses}-{team.ties ?? 0}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300 tabular-nums">{team.winPercentage}</td>
                    <td className="py-2 px-2 text-center text-slate-400 tabular-nums">{team.gamesBack ?? '-'}</td>
                    <td className="py-2 px-2 text-center text-slate-400 tabular-nums">{team.waiverPriority ?? '-'}</td>
                    <td className="py-2 pl-2 text-center text-slate-400 tabular-nums">{team.moves ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </CardShell>
      )
    }

    case 'roster_list': {
      return <RosterListCard card={card} onAction={onAction} />
    }

    case 'compare': {
      const p = card.payload
      return (
        <CompareCard
          playerA={p.playerA}
          playerB={p.playerB}
          statKeys={p.statKeys || ['AVG', 'HR', 'RBI', 'R', 'SB', 'OPS']}
          title={card.title}
          isMixed={p.isMixed}
          onAction={onAction}
        />
      )
    }

    default:
      return null
  }
}
