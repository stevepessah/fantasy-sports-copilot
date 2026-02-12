'use client'

import { useState, useCallback } from 'react'
import Sparkline from './Sparkline'

export interface PlayerCompare {
  name: string
  team: string
  position: string
  positionType?: string // 'B' | 'P'
  stats: Record<string, number | string>
  sparkData?: number[]
}

interface CompareCardProps {
  playerA: PlayerCompare
  playerB: PlayerCompare
  statKeys: string[]
  title?: string
  isMixed?: boolean
  onAction?: (command: string) => void
}

/** Stats where lower is better */
const LOWER_IS_BETTER = new Set(['ERA', 'WHIP', 'BB', 'L', 'ER', 'H (Pitching)', 'BB (Pitching)'])

function formatStatValue(key: string, value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '–'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return String(value)

  const rateStats = ['AVG', 'OBP', 'SLG', 'OPS', 'WHIP']
  const rate3Stats = ['AVG', 'OBP', 'SLG', 'OPS']

  if (rate3Stats.includes(key)) {
    return n >= 0 && n < 10 ? n.toFixed(3).replace(/^0/, '') : n.toFixed(3)
  }
  if (rateStats.includes(key)) return n.toFixed(2)
  if (key === 'ERA') return n.toFixed(2)
  if (key === 'IP') return n.toFixed(1)
  return Number.isInteger(n) ? n.toString() : n.toFixed(1)
}

export default function CompareCard({
  playerA,
  playerB,
  statKeys,
  title,
  isMixed,
  onAction,
}: CompareCardProps) {
  const [highlight, setHighlight] = useState<string | null>(null)

  const getWinner = useCallback((key: string): 'a' | 'b' | 'tie' => {
    const rawA = playerA.stats[key]
    const rawB = playerB.stats[key]
    if (rawA === undefined && rawB === undefined) return 'tie'
    if (rawA === undefined) return 'b'
    if (rawB === undefined) return 'a'

    const a = typeof rawA === 'string' ? parseFloat(rawA) : rawA
    const b = typeof rawB === 'string' ? parseFloat(rawB) : rawB
    if (isNaN(a) || isNaN(b)) return 'tie'
    if (a === b) return 'tie'

    const lowerBetter = LOWER_IS_BETTER.has(key)
    if (lowerBetter) return a < b ? 'a' : 'b'
    return a > b ? 'a' : 'b'
  }, [playerA, playerB])

  const winsA = statKeys.filter(k => getWinner(k) === 'a').length
  const winsB = statKeys.filter(k => getWinner(k) === 'b').length

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
            <span className={winsA > winsB ? 'text-green-400 font-bold' : 'text-slate-400 font-bold'}>{winsA}</span>
            {' – '}
            <span className={winsB > winsA ? 'text-green-400 font-bold' : 'text-slate-400 font-bold'}>{winsB}</span>
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

      {/* Mixed position type notice */}
      {isMixed && (
        <div className="px-4 py-2 bg-yellow-600/10 border-b border-yellow-600/20">
          <p className="text-[10px] text-yellow-400/80 text-center">
            ⚠ Different position types — showing all available stats
          </p>
        </div>
      )}

      {/* Stat rows */}
      <div className="divide-y divide-slate-700/20">
        {statKeys.map((key) => {
          const winner = getWinner(key)
          const isHighlighted = highlight === key
          const valA = playerA.stats[key]
          const valB = playerB.stats[key]

          return (
            <button
              key={key}
              onClick={() => setHighlight(isHighlighted ? null : key)}
              className={`w-full grid grid-cols-3 gap-2 px-4 py-2 text-xs transition-colors ${
                isHighlighted ? 'bg-slate-700/30' : 'hover:bg-slate-700/10'
              }`}
            >
              <div className={`text-left font-mono tabular-nums ${
                winner === 'a' ? 'text-green-400 font-bold' : valA === undefined ? 'text-slate-600' : 'text-slate-300'
              }`}>
                {formatStatValue(key, valA)}
              </div>
              <div className="text-center text-slate-500 uppercase text-[10px] font-bold self-center">
                {key}
                {LOWER_IS_BETTER.has(key) && (
                  <span className="text-slate-600 ml-0.5" title="Lower is better">↓</span>
                )}
              </div>
              <div className={`text-right font-mono tabular-nums ${
                winner === 'b' ? 'text-green-400 font-bold' : valB === undefined ? 'text-slate-600' : 'text-slate-300'
              }`}>
                {formatStatValue(key, valB)}
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

      {/* Action buttons */}
      {onAction && (
        <div className="px-4 py-2.5 border-t border-slate-700/30 flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => onAction(`tell me about ${playerA.name}`)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-medium transition-colors"
          >
            {playerA.name} details
          </button>
          <button
            onClick={() => onAction(`tell me about ${playerB.name}`)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-medium transition-colors"
          >
            {playerB.name} details
          </button>
          <button
            onClick={() => onAction(`suggest a trade involving ${playerA.name} and ${playerB.name}`)}
            className="px-3 py-1.5 text-xs rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-medium transition-colors"
          >
            Trade idea
          </button>
        </div>
      )}
    </div>
  )
}
