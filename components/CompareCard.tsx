'use client'

import { useState, useCallback } from 'react'
import Sparkline from './Sparkline'

interface PlayerCompare {
  name: string
  team: string
  position: string
  stats: Record<string, number | string>
  sparkData?: number[] // Historical points or key stat trend
}

interface CompareCardProps {
  playerA: PlayerCompare
  playerB: PlayerCompare
  statKeys: string[]
  title?: string
}

export default function CompareCard({ playerA, playerB, statKeys, title }: CompareCardProps) {
  const [highlight, setHighlight] = useState<string | null>(null)

  const getWinner = useCallback((key: string): 'a' | 'b' | 'tie' => {
    const a = Number(playerA.stats[key]) || 0
    const b = Number(playerB.stats[key]) || 0
    // For ERA, WHIP — lower is better
    const lowerIsBetter = ['ERA', 'WHIP', 'BB', 'L'].includes(key.toUpperCase())
    if (a === b) return 'tie'
    if (lowerIsBetter) return a < b ? 'a' : 'b'
    return a > b ? 'a' : 'b'
  }, [playerA, playerB])

  const winsA = statKeys.filter((k) => getWinner(k) === 'a').length
  const winsB = statKeys.filter((k) => getWinner(k) === 'b').length

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <h3 className="text-sm font-bold text-white">{title || '⚖️ Player Comparison'}</h3>
      </div>

      {/* Player names + sparklines */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-slate-700/30">
        <div className="text-left">
          <div className="font-bold text-sm text-white">{playerA.name}</div>
          <div className="text-[10px] text-slate-400">
            {playerA.team} · {playerA.position}
          </div>
          {playerA.sparkData && (
            <Sparkline data={playerA.sparkData} className="mt-1" />
          )}
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className="text-xs font-bold text-slate-500">VS</div>
          <div className="text-[10px] text-slate-500 mt-1">
            <span className="text-green-400 font-bold">{winsA}</span>
            {' – '}
            <span className="text-green-400 font-bold">{winsB}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-sm text-white">{playerB.name}</div>
          <div className="text-[10px] text-slate-400">
            {playerB.team} · {playerB.position}
          </div>
          {playerB.sparkData && (
            <Sparkline data={playerB.sparkData} className="mt-1 ml-auto" />
          )}
        </div>
      </div>

      {/* Stat rows */}
      <div className="divide-y divide-slate-700/20">
        {statKeys.map((key) => {
          const winner = getWinner(key)
          const isHighlighted = highlight === key
          return (
            <button
              key={key}
              onClick={() => setHighlight(isHighlighted ? null : key)}
              className={`w-full grid grid-cols-3 gap-2 px-4 py-2 text-xs transition-colors ${
                isHighlighted ? 'bg-slate-700/30' : 'hover:bg-slate-700/10'
              }`}
            >
              <div className={`text-left font-mono tabular-nums ${
                winner === 'a' ? 'text-green-400 font-bold' : 'text-slate-300'
              }`}>
                {playerA.stats[key] ?? '–'}
              </div>
              <div className="text-center text-slate-500 uppercase text-[10px] font-bold self-center">
                {key}
              </div>
              <div className={`text-right font-mono tabular-nums ${
                winner === 'b' ? 'text-green-400 font-bold' : 'text-slate-300'
              }`}>
                {playerB.stats[key] ?? '–'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Summary */}
      <div className="px-4 py-2.5 border-t border-slate-700/30 bg-slate-800/30 text-center text-xs">
        {winsA > winsB ? (
          <span className="text-green-400 font-semibold">{playerA.name} wins {winsA}–{winsB} across categories</span>
        ) : winsB > winsA ? (
          <span className="text-green-400 font-semibold">{playerB.name} wins {winsB}–{winsA} across categories</span>
        ) : (
          <span className="text-yellow-400 font-semibold">Dead even at {winsA}–{winsB}</span>
        )}
      </div>
    </div>
  )
}
