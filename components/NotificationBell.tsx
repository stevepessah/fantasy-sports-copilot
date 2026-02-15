'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useYahooAuth } from '@/contexts/YahooAuthContext'

export interface AlertItem {
  id: string
  type: 'injury' | 'hot_streak' | 'cold_streak' | 'lineup' | 'waiver' | 'schedule'
  title: string
  body: string
  timestamp: string
  read: boolean
  actionCommand?: string
}

interface NotificationBellProps {
  onAction?: (command: string) => void
}

export default function NotificationBell({ onAction }: NotificationBellProps) {
  const { isAuthenticated } = useYahooAuth()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [hasFetched, setHasFetched] = useState(false)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Generate alerts based on available context
  const generateAlerts = useCallback(() => {
    if (!isAuthenticated) return

    const now = new Date()
    const hour = now.getHours()
    const newAlerts: AlertItem[] = []

    // Lineup reminder — games typically start around 7pm ET
    if (hour >= 10 && hour <= 18) {
      newAlerts.push({
        id: 'lineup_reminder',
        type: 'lineup',
        title: '⏰ Set your lineup',
        body: "Make sure your lineup is set for today's games. Don't leave empty slots!",
        timestamp: now.toISOString(),
        read: false,
        actionCommand: 'set my optimal lineup',
      })
    }

    // Waiver wire tip
    newAlerts.push({
      id: 'waiver_tip',
      type: 'waiver',
      title: '🔍 Check the waiver wire',
      body: 'There may be hot free agents available. Ask me for waiver targets!',
      timestamp: now.toISOString(),
      read: false,
      actionCommand: 'who should I pick up on waivers?',
    })

    // Weekly schedule note
    const dayOfWeek = now.getDay()
    if (dayOfWeek === 1) {
      // Monday
      newAlerts.push({
        id: 'weekly_matchup',
        type: 'schedule',
        title: '📅 New matchup week',
        body: 'A new fantasy week has started. Review your matchup and streaming options.',
        timestamp: now.toISOString(),
        read: false,
        actionCommand: 'show matchup',
      })
    }

    // Two-start pitcher reminder (midweek)
    if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      newAlerts.push({
        id: 'two_start_pitchers',
        type: 'schedule',
        title: '⚾ 2-start pitcher alert',
        body: 'Check which pitchers have two starts this week for extra value.',
        timestamp: now.toISOString(),
        read: false,
        actionCommand: 'which pitchers have two starts this week?',
      })
    }

    setAlerts(newAlerts)
    setHasFetched(true)
  }, [isAuthenticated])

  // Fetch alerts when bell is opened for the first time or auth changes
  useEffect(() => {
    if (isAuthenticated && !hasFetched) {
      generateAlerts()
    }
  }, [isAuthenticated, hasFetched, generateAlerts])

  const unreadCount = alerts.filter((a) => !a.read).length

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
  }

  const handleAlertClick = (alert: AlertItem) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, read: true } : a))
    )
    if (alert.actionCommand && onAction) {
      onAction(alert.actionCommand)
    }
    setOpen(false)
  }

  if (!isAuthenticated) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open)
          if (!hasFetched) generateAlerts()
        }}
        className="relative p-2 rounded-lg hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
            <h3 className="text-sm font-bold text-white">Alerts</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-primary-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                No alerts right now
              </div>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-700/50 last:border-0 transition-colors ${
                    alert.read
                      ? 'opacity-60 hover:opacity-80'
                      : 'hover:bg-slate-700/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!alert.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                    )}
                    <div className={!alert.read ? '' : 'ml-3.5'}>
                      <div className="text-sm font-medium text-white">{alert.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{alert.body}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
