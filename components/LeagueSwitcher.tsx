'use client'

import { useLeague } from '@/contexts/LeagueContext'
import { useYahooAuth } from '@/contexts/YahooAuthContext'
import { useState, useRef, useEffect } from 'react'

export default function LeagueSwitcher() {
  const { isAuthenticated } = useYahooAuth()
  const { leagues, isLoading, selectedLeagueKey, setSelectedLeagueKey } = useLeague()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!isAuthenticated || isLoading || leagues.length === 0) return null

  const current = leagues.find((l) => l.league_key === selectedLeagueKey) ?? leagues[0]
  const hasMultiple = leagues.length >= 2

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => hasMultiple && setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-600/50 text-xs text-slate-300 transition-colors ${
          hasMultiple ? 'bg-slate-700/60 hover:bg-slate-700 cursor-pointer' : 'bg-slate-700/40 cursor-default'
        }`}
      >
        <span className="truncate max-w-[140px]">{current?.name ?? 'League'}</span>
        {hasMultiple && (
          <svg
            className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && hasMultiple && (
        <div className="absolute top-full right-0 mt-1 w-56 max-w-[calc(100vw-2rem)] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
          {leagues.map((league) => (
            <button
              key={league.league_key}
              onClick={() => {
                setSelectedLeagueKey(league.league_key)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                league.league_key === selectedLeagueKey
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'hover:bg-slate-700/50 text-slate-300'
              }`}
            >
              <div className="font-medium truncate">{league.name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {league.season} · {league.num_teams} teams
                {league.is_finished === '1' ? ' · Finished' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
