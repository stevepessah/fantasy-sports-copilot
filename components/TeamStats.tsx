'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLeague } from '@/contexts/LeagueContext'
import AuthRequiredMessage, { isAuthError } from '@/components/AuthRequiredMessage'
import { formatStatValue } from '@/lib/statFormatters'
import type { TeamStatsResponse } from '@/app/api/yahoo/team-stats/route'

interface TeamStatsProps {
  leagueKey: string | null
}

type Side = 'batters' | 'pitchers'
type Mode = 'wl' | 'totals'

function Sparkline({
  values,
  width,
  height,
  color,
}: {
  values: number[]
  width: number
  height: number
  color: string
}) {
  if (values.length === 0) return <span className="text-slate-600">—</span>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = 2
  const w = width - pad * 2
  const h = height - pad * 2
  const pts = values.map((v, i) => {
    const x = pad + (values.length <= 1 ? w / 2 : (i / (values.length - 1)) * w)
    const y = pad + h - (max === min ? h / 2 : ((v - min) / (max - min)) * h)
    return `${x},${y}`
  })
  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')} />
    </svg>
  )
}

function WeeklyWinSparkline({
  weeks,
  categories,
}: {
  weeks: TeamStatsResponse['weekly']
  categories: TeamStatsResponse['categories']
}) {
  const counts = weeks.map((w) => {
    let n = 0
    for (const c of categories) {
      if (w.results[c.displayName] === 'W') n++
    }
    return n
  })
  const maxCat = Math.max(1, categories.length)
  const norm = counts.map((c) => c / maxCat)
  return <Sparkline values={norm} width={200} height={36} color="rgb(96 165 250)" />
}

function ModeChart({
  mode,
  weeks,
  displayName,
  wlSeries,
  totalsSeries,
  chartWidth,
}: {
  mode: Mode
  weeks: TeamStatsResponse['weekly']
  displayName: string
  wlSeries: number[]
  totalsSeries: number[]
  chartWidth: number
}) {
  const values = mode === 'wl' ? wlSeries : totalsSeries
  const color = mode === 'wl' ? 'rgb(52 211 153)' : 'rgb(96 165 250)'
  if (values.length === 0 || values.every((v) => v == null || Number.isNaN(v))) {
    return <div className="text-center text-xs text-slate-500 py-6">No data for this category yet.</div>
  }
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{displayName}</div>
      <div className="flex justify-center overflow-hidden">
        <Sparkline values={values} width={chartWidth} height={80} color={color} />
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 mt-1 px-1">
        <span>W{weeks[0]?.week}</span>
        <span>W{weeks[weeks.length - 1]?.week}</span>
      </div>
    </div>
  )
}

export default function TeamStats({ leagueKey }: TeamStatsProps) {
  const { selectedLeagueKey } = useLeague()
  const effectiveKey = leagueKey ?? selectedLeagueKey

  const [data, setData] = useState<TeamStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [side, setSide] = useState<Side>('batters')
  const [mode, setMode] = useState<Mode>('wl')
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [chartCategory, setChartCategory] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [chartWidth, setChartWidth] = useState(300)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const ro = () => setChartWidth(Math.min(340, Math.max(240, window.innerWidth - 48)))
    ro()
    window.addEventListener('resize', ro)
    return () => window.removeEventListener('resize', ro)
  }, [])

  const load = useCallback(() => {
    if (!effectiveKey) return
    setLoading(true)
    setError(null)
    fetch(`/api/yahoo/team-stats?leagueKey=${encodeURIComponent(effectiveKey)}`)
      .then((res) => {
        if (res.status === 401) throw new Error('401 Not authenticated')
        if (!res.ok) throw new Error(`Failed to load team stats (${res.status})`)
        return res.json() as Promise<TeamStatsResponse>
      })
      .then((json) => {
        setData(json)
        setSelectedWeek(json.currentWeek)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [effectiveKey])

  useEffect(() => {
    load()
  }, [load])

  const filteredCategories = useMemo(() => {
    if (!data) return []
    const want = side === 'batters' ? 'B' : 'P'
    return data.categories.filter((c) => c.positionType === want)
  }, [data, side])

  useEffect(() => {
    if (!filteredCategories.length) return
    setChartCategory((prev) => {
      if (prev && filteredCategories.some((c) => c.displayName === prev)) return prev
      return filteredCategories[0].displayName
    })
  }, [filteredCategories])

  const weekRow = useMemo(() => {
    if (!data || selectedWeek == null) return null
    return data.weekly.find((w) => w.week === selectedWeek) ?? null
  }, [data, selectedWeek])

  const chartSeries = useMemo(() => {
    if (!data || !chartCategory) return { wl: [] as number[], totals: [] as number[] }
    const wl = data.weekly.map((w) => {
      const r = w.results[chartCategory]
      if (r === 'W') return 1
      if (r === 'T') return 0.5
      if (r === 'L') return 0
      return 0
    })
    const totals = data.weekly.map((w) => {
      const v = w.stats[chartCategory]
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      return isNaN(n) ? 0 : n
    })
    return { wl, totals }
  }, [data, chartCategory])

  if (!effectiveKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Select a league to view team stats</div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading team stats…
        </div>
      </div>
    )
  }

  if (error && !data) {
    if (isAuthError(error)) return <AuthRequiredMessage />
    return <div className="flex items-center justify-center py-16 text-red-400 text-sm">{error}</div>
  }

  if (!data) return null

  const weekRange = []
  for (let w = data.startWeek; w <= data.currentWeek; w++) weekRange.push(w)

  return (
    <div className="flex-1 overflow-auto flex flex-col min-h-0">
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Team Stats</h2>
            <p className="text-xs text-slate-400">{data.teamName}</p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="self-start text-[11px] px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* Side + mode tabs */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-lg border border-slate-700/80 p-0.5 bg-slate-900/50">
            {(['batters', 'pitchers'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  side === s ? 'bg-primary-600/30 text-primary-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s === 'batters' ? 'Batters' : 'Pitchers'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-slate-700/80 p-0.5 bg-slate-900/50">
            {([
              { id: 'wl' as Mode, label: 'Win–Loss' },
              { id: 'totals' as Mode, label: 'Totals' },
            ]).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === m.id ? 'bg-primary-600/30 text-primary-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: week scrubber + win-density sparkline */}
        {isDesktop && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Weeks · category wins</div>
            <div className="flex items-end gap-3">
              <WeeklyWinSparkline weeks={data.weekly} categories={filteredCategories} />
              <span className="text-[10px] text-slate-500 pb-1">Higher = more categories won that week</span>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
              {weekRange.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setSelectedWeek(w)}
                  className={`shrink-0 min-w-[2.5rem] px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    selectedWeek === w
                      ? 'border-primary-500 bg-primary-600/20 text-primary-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  W{w}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile: week select */}
        {!isDesktop && (
          <div className="sticky top-0 z-10 -mx-3 px-3 py-2 bg-slate-900/95 backdrop-blur border-b border-slate-800 sm:static sm:bg-transparent sm:border-0 sm:p-0">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Week</label>
            <select
              value={selectedWeek ?? ''}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 text-sm text-white px-3 py-2"
            >
              {weekRange.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-1">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Main table */}
        <div className="overflow-x-auto rounded-xl border border-slate-700/60">
          <table className="w-full text-[10px] sm:text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 text-left">
                <th className="py-2 px-2 font-semibold sticky left-0 bg-slate-800 z-[1]">Category</th>
                <th className="py-2 px-2 font-semibold whitespace-nowrap">{mode === 'wl' ? 'Season W–L–T' : 'Season'}</th>
                <th className="py-2 px-2 font-semibold">Trend</th>
                <th className="py-2 px-2 font-semibold whitespace-nowrap">
                  W{selectedWeek ?? data.currentWeek}
                  {weekRow?.opponentName ? (
                    <span className="block font-normal text-slate-500 truncate max-w-[100px] sm:max-w-[120px]">
                      vs {weekRow.opponentName}
                    </span>
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat, idx) => {
                const wl = data.seasonWL[cat.displayName]
                const wlStr = wl ? `${wl.w}-${wl.l}-${wl.t}` : '—'
                const tot = data.seasonTotals[cat.displayName]
                const totStr =
                  tot === '-' || tot === undefined
                    ? '—'
                    : formatStatValue(tot as number | string, cat.displayName.replace(/\([^)]+\)$/, ''))

                const trendWl = data.weekly.map((w) => {
                  const r = w.results[cat.displayName]
                  if (r === 'W') return 1
                  if (r === 'T') return 0.5
                  return 0
                })
                const trendTot = data.weekly.map((w) => {
                  const v = w.stats[cat.displayName]
                  const n = typeof v === 'number' ? v : parseFloat(String(v))
                  return isNaN(n) ? 0 : n
                })

                const cellWeek =
                  weekRow == null
                    ? '—'
                    : mode === 'wl'
                      ? weekRow.results[cat.displayName] ?? '—'
                      : weekRow.stats[cat.displayName] !== undefined
                        ? formatStatValue(weekRow.stats[cat.displayName], cat.displayName.replace(/\([^)]+\)$/, ''))
                        : '—'

                const shortLabel = cat.displayName.replace(/\((B|P)\)$/, '')

                return (
                  <tr
                    key={cat.statId}
                    className={idx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/20'}
                  >
                    <td className="py-1.5 px-2 text-slate-200 font-medium sticky left-0 bg-inherit z-[1] border-r border-slate-800/80">
                      {shortLabel}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-slate-100 whitespace-nowrap">{mode === 'wl' ? wlStr : totStr}</td>
                    <td className="py-1.5 px-2">
                      <Sparkline
                        values={mode === 'wl' ? trendWl : trendTot}
                        width={isDesktop ? 120 : 72}
                        height={22}
                        color={mode === 'wl' ? 'rgb(52 211 153)' : 'rgb(96 165 250)'}
                      />
                    </td>
                    <td
                      className={`py-1.5 px-2 font-mono whitespace-nowrap text-[10px] sm:text-xs ${
                        mode === 'wl'
                          ? cellWeek === 'W'
                            ? 'text-emerald-400 font-semibold'
                            : cellWeek === 'L'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          : 'text-slate-200'
                      }`}
                    >
                      {cellWeek}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!isDesktop && (
          <div className="space-y-2 pb-8">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trend chart · category</label>
            <select
              value={chartCategory ?? ''}
              onChange={(e) => setChartCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 text-sm text-white px-3 py-2 mb-2"
            >
              {filteredCategories.map((c) => (
                <option key={c.statId} value={c.displayName}>
                  {c.displayName.replace(/\((B|P)\)$/, '')}
                </option>
              ))}
            </select>
            <ModeChart
              mode={mode}
              weeks={data.weekly}
              displayName={chartCategory ?? ''}
              wlSeries={chartSeries.wl}
              totalsSeries={chartSeries.totals}
              chartWidth={chartWidth}
            />
          </div>
        )}
      </div>
    </div>
  )
}
