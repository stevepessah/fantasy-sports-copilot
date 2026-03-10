'use client'

import { useState, useEffect } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import type { ParsedLeagueSettings, ParsedStatCategory, ParsedRosterPosition } from '@/lib/yahoo/xmlParser'

interface LeagueInfo {
  league_key: string
  league_id: string
  name: string
  url: string
  logo_url?: string
  num_teams: number
  scoring_type: string
  league_type: string
  draft_status: string
  current_week?: string
  start_week?: string
  end_week?: string
  start_date?: string
  end_date?: string
  is_finished?: string
  game_code?: string
}

interface SettingsResponse {
  settings: ParsedLeagueSettings
  league: LeagueInfo | null
}

interface LeagueSettingsProps {
  leagueKey: string | null
}

function SettingRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex justify-between items-start gap-4 py-2.5 px-3 ${className ?? ''}`}>
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-slate-200 text-sm text-right font-medium">{value}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-400 px-3 pt-5 pb-2">
      {children}
    </h3>
  )
}

function formatScoringType(raw?: string): string {
  if (!raw) return '—'
  const map: Record<string, string> = {
    head: 'Head-to-Head - Categories',
    headpoint: 'Head-to-Head - Points',
    headone: 'Head-to-Head - One Win',
    roto: 'Rotisserie',
  }
  return map[raw.toLowerCase()] ?? raw
}

function formatDraftType(raw?: string): string {
  if (!raw) return '—'
  const map: Record<string, string> = {
    live: 'Live Standard Draft',
    offline: 'Offline Draft',
    autopick: 'Autopick Draft',
    auction: 'Auction Draft',
  }
  return map[raw.toLowerCase()] ?? raw
}

function formatWaiverType(raw?: string): string {
  if (!raw) return '—'
  const map: Record<string, string> = {
    R: 'Continual rolling list',
    FR: 'First-come, first-served',
    AB: 'FAAB - Continuous',
    ABW: 'FAAB - Weekly',
  }
  return map[raw] ?? raw
}

function formatTradeReview(raw?: string): string {
  if (!raw) return '—'
  const map: Record<string, string> = {
    vote: 'League Votes',
    commish: 'Commissioner Review',
    none: 'No Review',
  }
  return map[raw.toLowerCase()] ?? raw
}

function formatDays(hours?: number): string {
  if (hours == null) return '—'
  if (hours < 24) return `${hours} hours`
  const days = Math.round(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''}`
}

function StatBadge({ cat, type }: { cat: ParsedStatCategory; type: 'batter' | 'pitcher' }) {
  const color = type === 'batter'
    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${color}`}>
      {cat.displayName || cat.name}
      {cat.sortOrder === '0' && (
        <span className="ml-1 text-[10px] opacity-60" title="Lower is better">↓</span>
      )}
    </span>
  )
}

function PositionBadge({ pos }: { pos: ParsedRosterPosition }) {
  const isActive = !['BN', 'IL', 'IL+', 'DL', 'NA'].includes(pos.position)
  const color = isActive
    ? 'bg-slate-600/40 text-slate-200 border-slate-500/30'
    : 'bg-slate-700/40 text-slate-400 border-slate-600/30'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${color}`}>
      <span>{pos.position}</span>
      <span className="opacity-50">×{pos.count}</span>
    </span>
  )
}

export default function LeagueSettings({ leagueKey }: LeagueSettingsProps) {
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { leagues } = useYahooLeagues('mlb')
  const effectiveLeagueKey = leagueKey ?? leagues[0]?.league_key

  useEffect(() => {
    if (!effectiveLeagueKey) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/api/yahoo/league-settings?leagueKey=${encodeURIComponent(effectiveLeagueKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch settings (${res.status})`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
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

  if (!effectiveLeagueKey) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Select a league to view settings
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
          Loading league settings…
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

  if (!data) return null

  const { settings, league } = data
  const batterCats = settings.statCategories.filter(c => c.positionType === 'B' && !c.isOnlyDisplayStat)
  const pitcherCats = settings.statCategories.filter(c => c.positionType === 'P' && !c.isOnlyDisplayStat)
  const activePositions = settings.rosterPositions.filter(p => !['BN', 'IL', 'IL+', 'DL', 'NA'].includes(p.position))
  const benchPositions = settings.rosterPositions.filter(p => ['BN', 'IL', 'IL+', 'DL', 'NA'].includes(p.position))
  const rosterSummary = settings.rosterPositions.map(p => `${p.position}`).join(', ')

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 space-y-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 px-3">
          {league?.logo_url && (
            <img src={league.logo_url} alt="" className="w-10 h-10 rounded-lg" />
          )}
          <div>
            <h2 className="text-lg font-bold text-white">{league?.name ?? 'League Settings'}</h2>
            {league?.league_id && (
              <p className="text-xs text-slate-500">League ID: {league.league_id}</p>
            )}
          </div>
        </div>

        {/* League Info */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden divide-y divide-slate-700/30">
          <SectionHeading>League Info</SectionHeading>
          <SettingRow label="League Name" value={league?.name ?? '—'} />
          <SettingRow label="Max Teams" value={league?.num_teams ?? settings.maxTeams ?? '—'} />
          <SettingRow label="Scoring Type" value={formatScoringType(settings.scoringType ?? league?.scoring_type)} />
          <SettingRow label="League Type" value={league?.league_type ?? '—'} />
          {league?.url && (
            <SettingRow
              label="League URL"
              value={
                <a href={league.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline truncate max-w-[200px] inline-block">
                  View on Yahoo →
                </a>
              }
            />
          )}
        </div>

        {/* Draft */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden divide-y divide-slate-700/30">
          <SectionHeading>Draft</SectionHeading>
          <SettingRow label="Draft Type" value={formatDraftType(settings.draftType)} />
          <SettingRow label="Draft Status" value={league?.draft_status ?? '—'} />
        </div>

        {/* Scoring Categories */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
          <SectionHeading>Batting Categories</SectionHeading>
          <div className="px-3 pb-3 flex flex-wrap gap-2">
            {batterCats.length > 0
              ? batterCats.map(c => <StatBadge key={c.statId} cat={c} type="batter" />)
              : <span className="text-slate-500 text-sm">None</span>
            }
          </div>

          <SectionHeading>Pitching Categories</SectionHeading>
          <div className="px-3 pb-3 flex flex-wrap gap-2">
            {pitcherCats.length > 0
              ? pitcherCats.map(c => <StatBadge key={c.statId} cat={c} type="pitcher" />)
              : <span className="text-slate-500 text-sm">None</span>
            }
          </div>
        </div>

        {/* Roster Positions */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
          <SectionHeading>Active Roster Positions</SectionHeading>
          <div className="px-3 pb-3 flex flex-wrap gap-2">
            {activePositions.map(p => <PositionBadge key={p.position} pos={p} />)}
          </div>

          {benchPositions.length > 0 && (
            <>
              <SectionHeading>Bench &amp; IL</SectionHeading>
              <div className="px-3 pb-3 flex flex-wrap gap-2">
                {benchPositions.map(p => <PositionBadge key={p.position} pos={p} />)}
              </div>
            </>
          )}

          <div className="border-t border-slate-700/30">
            <SettingRow
              label="All Positions"
              value={<span className="text-xs text-slate-400">{rosterSummary}</span>}
            />
          </div>
        </div>

        {/* Transactions */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden divide-y divide-slate-700/30">
          <SectionHeading>Transactions</SectionHeading>
          <SettingRow label="Waiver Type" value={formatWaiverType(settings.waiverType)} />
          {settings.waiverTime != null && (
            <SettingRow label="Waiver Time" value={formatDays(settings.waiverTime)} />
          )}
          <SettingRow
            label="Max Acquisitions"
            value={settings.maxAcquisitions != null ? String(settings.maxAcquisitions) : 'No maximum'}
          />
          {settings.maxAcquisitionsPerWeek != null && (
            <SettingRow label="Max Acquisitions / Week" value={String(settings.maxAcquisitionsPerWeek)} />
          )}
          <SettingRow
            label="Max Trades"
            value={settings.maxTrades != null ? String(settings.maxTrades) : 'No maximum'}
          />
          <SettingRow label="Trade Review" value={formatTradeReview(settings.tradeReview)} />
          {settings.tradeRejectTime != null && (
            <SettingRow label="Trade Reject Time" value={formatDays(settings.tradeRejectTime)} />
          )}
          {settings.tradeEndDate && (
            <SettingRow label="Trade Deadline" value={settings.tradeEndDate} />
          )}
          {settings.canTradeDraftPicks && (
            <SettingRow label="Trade Draft Picks" value={settings.canTradeDraftPicks === '1' ? 'Yes' : 'No'} />
          )}
        </div>

        {/* Schedule & Playoffs */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden divide-y divide-slate-700/30">
          <SectionHeading>Schedule &amp; Playoffs</SectionHeading>
          {league?.current_week && (
            <SettingRow label="Current Week" value={`Week ${league.current_week}`} />
          )}
          {settings.weeklyDeadline && (
            <SettingRow label="Weekly Deadline" value={settings.weeklyDeadline} />
          )}
          {league?.start_date && (
            <SettingRow label="Season Start" value={league.start_date} />
          )}
          {league?.end_date && (
            <SettingRow label="Season End" value={league.end_date} />
          )}
          {settings.playoffStartWeek && (
            <SettingRow
              label="Playoffs"
              value={`${settings.numPlayoffTeams ?? '?'} teams — Week ${settings.playoffStartWeek}${league?.end_week ? `–${league.end_week}` : ''}`}
            />
          )}
          {settings.usesPlayoffReseeding != null && (
            <SettingRow label="Playoff Reseeding" value={settings.usesPlayoffReseeding ? 'Yes' : 'No'} />
          )}
          {settings.usesLockEliminatedTeams != null && (
            <SettingRow label="Lock Eliminated Teams" value={settings.usesLockEliminatedTeams ? 'Yes' : 'No'} />
          )}
        </div>

        {/* Miscellaneous */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden divide-y divide-slate-700/30">
          <SectionHeading>Other Settings</SectionHeading>
          {settings.playerUniverse && (
            <SettingRow label="Player Universe" value={settings.playerUniverse} />
          )}
          {settings.postDraftPlayers && (
            <SettingRow label="Post Draft Players" value={settings.postDraftPlayers} />
          )}
          {settings.minInningsPerWeek != null && (
            <SettingRow label="Min Innings / Week" value={String(settings.minInningsPerWeek)} />
          )}
          {league?.is_finished && (
            <SettingRow label="Season Finished" value={league.is_finished === '1' ? 'Yes' : 'No'} />
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  )
}
