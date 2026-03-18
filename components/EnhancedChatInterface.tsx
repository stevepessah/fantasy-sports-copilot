'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { ChatMessage, Sport } from '@/types'
import YahooAuth from './YahooAuth'
import { useYahooAuth } from '@/contexts/YahooAuthContext'
import { useLeague } from '@/contexts/LeagueContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from './Toast'
import { hapticTap, hapticSuccess } from '@/lib/haptics'
import {
  getConversations,
  getActiveConversationId,
  setActiveConversationId,
  getConversation,
  saveConversation,
  deleteConversation,
  generateTitle,
  createNewConversation,
  Conversation,
} from '@/lib/chatStorage'
import ChatMarkdown from './ChatMarkdown'
import Onboarding, { useOnboarding } from './Onboarding'
import NotificationBell from './NotificationBell'
import LeagueSwitcher from './LeagueSwitcher'

// Lazy-load heavy components — only needed after first message
const EnhancedCards = dynamic(
  () => import('./EnhancedCards').then((mod) => mod.EnhancedCards),
  { ssr: false },
)

// Lazy-load Season History (only when sidebar is visible & user is authenticated)
const SeasonHistory = dynamic(() => import('./SeasonHistory'), {
  loading: () => <div className="text-xs text-slate-400 py-2">Loading…</div>,
  ssr: false,
})

// Lazy-load Draft Results (only when Draft tab is active)
const DraftResults = dynamic(() => import('./DraftResults'), {
  loading: () => <div className="text-xs text-slate-400 py-2">Loading…</div>,
})

// Lazy-load League Settings (only when Settings tab is active)
const LeagueSettings = dynamic(() => import('./LeagueSettings'), {
  loading: () => <div className="text-xs text-slate-400 py-2">Loading…</div>,
  ssr: false,
})

// Lazy-load League Standings (only when League tab is active)
const LeagueStandings = dynamic(() => import('./LeagueStandings'), {
  loading: () => <div className="text-xs text-slate-400 py-2">Loading…</div>,
  ssr: false,
})

// Lazy-load My Roster (only when Roster tab is active)
const MyRoster = dynamic(() => import('./MyRoster'), {
  loading: () => <div className="text-xs text-slate-400 py-2">Loading…</div>,
  ssr: false,
})
// ── Static constants ──

const BOUNCE_DELAY_200 = { animationDelay: '0.2s' } as const
const BOUNCE_DELAY_400 = { animationDelay: '0.4s' } as const

interface QuickAction {
  label: string
  command: string
  /** When true, clicking this action prefills the input instead of sending the message */
  prefill?: boolean
  context?: 'authenticated' | 'unauthenticated' | 'always'
}

const BASE_QUICK_ACTIONS: QuickAction[] = [
  { label: '📋 Set optimal lineup', command: 'set my optimal lineup', context: 'authenticated' },
  // "Show matchup" and "View all teams" moved to top tab nav
  // "Show all batters" and "Show all pitchers" moved to Players tab
  { label: '🔍 Waiver targets', command: 'who should I pick up on waivers?' },
  { label: '🔄 Trade idea', command: 'suggest a trade' },
  { label: '📝 Draft advice', command: 'draft advice' },
]

// ── Top tab navigation ──
type TopTab = 'league' | 'roster' | 'matchups' | 'players' | 'draft' | 'settings'

interface TabDef {
  id: TopTab
  label: string
  icon: string
}

const SUGGESTION_PILLS = [
  { label: 'Set my best lineup', cmd: 'set my best lineup' },
  { label: 'Who should I draft?', cmd: 'Who should I draft?' },
  { label: 'Waiver targets', cmd: 'who should I pick up on waivers?' },
  { label: 'Suggest a trade', cmd: 'suggest a trade' },
] as const

interface ChatInterfaceProps {
  leagueId?: string
  userId?: string
  initialMessages?: ChatMessage[]
}

export default function EnhancedChatInterface({ leagueId, userId, initialMessages = [] }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [currentSport] = useState<Sport>('baseball')
  const [mounted, setMounted] = useState(false)
  const [isNarrow, setIsNarrow] = useState(true)
  const [isTiny, setIsTiny] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<TopTab | null>(null)

  const { isAuthenticated: isYahooConnected } = useYahooAuth()
  const { selectedLeagueKey } = useLeague()
  const { theme, toggleTheme } = useTheme()
  const { addToast } = useToast()
  const { isOnboardingComplete, markComplete: markOnboardingComplete } = useOnboarding()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const touchRef = useRef<{ startX: number; currentX: number; swiping: boolean }>({ startX: 0, currentX: 0, swiping: false })

  // ── Auto-resize textarea ──
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  // ── Swipe-to-close drawer ──
  const SWIPE_THRESHOLD = 80 // px – minimum swipe distance to trigger close

  const handleDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = { startX: e.touches[0].clientX, currentX: e.touches[0].clientX, swiping: true }
  }, [])

  const handleDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current.swiping) return
    const x = e.touches[0].clientX
    touchRef.current.currentX = x
    const dx = x - touchRef.current.startX
    // Only allow swiping left (negative direction) to close
    if (dx < 0 && drawerRef.current) {
      drawerRef.current.style.transform = `translateX(${dx}px)`
      drawerRef.current.style.transition = 'none'
    }
  }, [])

  const handleDrawerTouchEnd = useCallback(() => {
    if (!touchRef.current.swiping) return
    const dx = touchRef.current.currentX - touchRef.current.startX
    touchRef.current.swiping = false
    if (drawerRef.current) {
      if (dx < -SWIPE_THRESHOLD) {
        // Animate off-screen then close
        drawerRef.current.style.transition = 'transform 0.2s ease-out'
        drawerRef.current.style.transform = 'translateX(-100%)'
        setTimeout(() => setDrawerOpen(false), 200)
      } else {
        // Snap back
        drawerRef.current.style.transition = 'transform 0.2s ease-out'
        drawerRef.current.style.transform = 'translateX(0)'
      }
    }
  }, [])

  // ── Contextual quick actions ──
  const quickActions = useMemo(() => {
    const lastMessage = messages[messages.length - 1]
    const cards = lastMessage?.metadata?.cards
    const hasCards = cards && cards.length > 0
    const lastCardType = hasCards ? cards[0]?.type : null

    const contextual: QuickAction[] = []

    // Add context-specific actions based on last card
    if (lastCardType === 'player') {
      const playerName = cards?.[0]?.payload?.player?.name
      if (playerName) {
        contextual.push({ label: `📊 Compare ${playerName}`, command: `compare ${playerName} with `, prefill: true })
        contextual.push({ label: `🔄 Trade ${playerName}`, command: `suggest a trade involving ${playerName}` })
      }
    }
    if (lastCardType === 'matchup') {
      contextual.push({ label: '⚾ Stream a pitcher', command: 'which pitchers should I stream this week?' })
    }
    if (lastCardType === 'lineup') {
      contextual.push({ label: '🔍 Find upgrades', command: 'who should I pick up on waivers to upgrade my lineup?' })
    }

    // Filter base actions by auth state
    const filtered = BASE_QUICK_ACTIONS.filter((a) => {
      if (a.context === 'authenticated') return isYahooConnected
      if (a.context === 'unauthenticated') return !isYahooConnected
      return true
    })

    return [...contextual, ...filtered]
  }, [messages, isYahooConnected])

  // ── Persistence: Load conversations on mount ──
  // Always start a fresh chat on return; old conversations are still in the sidebar.
  useEffect(() => {
    const convs = getConversations()
    setConversations(convs)
    const newConv = createNewConversation()
    setConversationId(newConv.id)
    setActiveConversationId(newConv.id)
  }, [])

  // ── Persistence: Save messages whenever they change ──
  useEffect(() => {
    if (!conversationId || messages.length === 0) return
    const conv: Conversation = {
      id: conversationId,
      title: generateTitle(messages),
      messages,
      createdAt: getConversation(conversationId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveConversation(conv)
    setConversations(getConversations())
  }, [messages, conversationId])

  // ── Resize handler ──
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const checkSize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setIsNarrow(window.innerWidth <= 900)
        setIsTiny(window.innerWidth <= 520)
      }, 150)
    }
    setIsNarrow(window.innerWidth <= 900)
    setIsTiny(window.innerWidth <= 520)
    setMounted(true)
    window.addEventListener('resize', checkSize)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', checkSize)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isNarrow) {
      setShowQuickActions(false)
      setDrawerOpen(false)
    }
  }, [isNarrow])

  // Lock body scroll when drawer is open & reset transform
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
      // Reset transform so drawer slides in fresh
      if (drawerRef.current) {
        drawerRef.current.style.transform = ''
        drawerRef.current.style.transition = ''
      }
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to focus input (when not already focused)
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      // Escape to close drawer or blur input
      if (e.key === 'Escape') {
        if (drawerOpen) setDrawerOpen(false)
        else if (showQuickActions) setShowQuickActions(false)
        else inputRef.current?.blur()
      }
      // Cmd/Ctrl+K — command palette (focus input with clear)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setInput('')
        inputRef.current?.focus()
      }
      // Arrow Up — edit last message
      if (e.key === 'ArrowUp' && document.activeElement === inputRef.current && !input) {
        const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
        if (lastUserMsg) {
          setInput(lastUserMsg.content)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen, showQuickActions, input, messages])

  // ── Typewriter reveal — progressively shows the AI text after response ──
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const revealText = useCallback((fullText: string, onDone: () => void) => {
    let idx = 0
    const chunkSize = 3 // characters per tick
    const tick = () => {
      idx = Math.min(idx + chunkSize, fullText.length)
      setStreamingText(fullText.slice(0, idx))
      if (idx < fullText.length) {
        typewriterRef.current = setTimeout(tick, 12)
      } else {
        setStreamingText('')
        onDone()
      }
    }
    tick()
  }, [])

  // Cleanup typewriter on unmount
  useEffect(() => {
    return () => { if (typewriterRef.current) clearTimeout(typewriterRef.current) }
  }, [])

  // ── Ref to always hold the latest handleSubmit (avoids stale closure in runCommand) ──
  const handleSubmitRef = useRef<(e?: React.FormEvent, directMessage?: string) => Promise<void>>(async () => {})

  // ── Chat submission (JSON path — preserves function calling) ──
  const handleSubmit = async (e?: React.FormEvent, directMessage?: string) => {
    e?.preventDefault()
    const rawText = (directMessage || input).trim()
    if (!rawText || isLoading) return

    hapticTap()

    // Strip embedded metadata tags (e.g. [pk:...]) for display, keep for API
    const displayText = rawText.replace(/\s*\[pk:[^\]]*\]/g, '').trim()

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: displayText,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreamingText('')
    // Reset textarea height after clearing
    if (inputRef.current) inputRef.current.style.height = 'auto'

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: rawText,
          leagueId,
          userId,
          sport: currentSport,
          yahooLeagueKey: selectedLeagueKey || undefined,
          conversationHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await response.json()

      const hasCards = data.cards && data.cards.length > 0
      const msgText: string = data.message || 'Sorry, I could not generate a response.'

      const buildAssistantMessage = (): ChatMessage => ({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: msgText,
        timestamp: new Date().toISOString(),
        metadata: {
          ...(data.action ? { action: data.action.type, ...data.action.data } : {}),
          ...(hasCards ? { cards: data.cards } : {}),
        },
      })

      if (hasCards) {
        // Cards present — show immediately (no typewriter, avoids flicker)
        setMessages((prev) => [...prev, buildAssistantMessage()])
      } else {
        // Text-only — reveal with typewriter effect
        setIsLoading(false) // hide bounce dots so streaming text shows
        revealText(msgText, () => {
          setMessages((prev) => [...prev, buildAssistantMessage()])
        })
      }

      if (data.action) handleAction(data.action)
      hapticSuccess()
    } catch {
      setStreamingText('')
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleAction = async (action: { type: string; data?: unknown }) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('Action:', action.type, action.data)
    }
  }

  // Keep ref pointing to the latest handleSubmit every render
  handleSubmitRef.current = handleSubmit

  const runCommand = useCallback((command: string) => {
    setInput(command)
    // Use ref so we always call the latest handleSubmit (avoids stale closure)
    handleSubmitRef.current(undefined, command)
  }, [])

  const handleQuickAction = useCallback((action: QuickAction) => {
    hapticTap()
    if (action.prefill) {
      // Just populate the input and focus — let the user finish typing
      setInput(action.command)
      setShowQuickActions(false)
      setDrawerOpen(false)
      setTimeout(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          // Move cursor to end of the prefilled text
          const len = action.command.length
          if ('setSelectionRange' in el) {
            el.setSelectionRange(len, len)
          }
        }
      }, 0)
    } else {
      runCommand(action.command)
      setShowQuickActions(false)
      setDrawerOpen(false)
    }
  }, [runCommand])

  // ── Action confirmation with undo ──
  const handleCardAction = useCallback((command: string) => {
    hapticTap()
    // For add/drop actions, show confirmation toast
    if (command.startsWith('add ') || command.startsWith('drop ')) {
      const verb = command.startsWith('add ') ? 'Adding' : 'Dropping'
      const playerName = command.replace(/^(add|drop)\s+/i, '')
      addToast({
        message: `${verb} ${playerName}…`,
        type: 'info',
        duration: 3000,
        undoAction: () => {
          addToast({ message: `Cancelled ${verb.toLowerCase()} ${playerName}`, type: 'info', duration: 2000 })
        },
      })
      // Delay the actual command to allow undo
      setTimeout(() => runCommand(command), 3000)
    } else {
      runCommand(command)
    }
  }, [runCommand, addToast])

  // ── Conversation management ──
  const startNewChat = useCallback(() => {
    const newConv = createNewConversation()
    setConversationId(newConv.id)
    setActiveConversationId(newConv.id)
    setMessages([])
    setShowHistory(false)
    setDrawerOpen(false)
  }, [])

  const loadConversation = useCallback((id: string) => {
    const conv = getConversation(id)
    if (conv) {
      setConversationId(conv.id)
      setActiveConversationId(conv.id)
      setMessages(conv.messages)
    }
    setShowHistory(false)
    setDrawerOpen(false)
  }, [])

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id)
    setConversations(getConversations())
    if (conversationId === id) {
      startNewChat()
    }
  }, [conversationId, startNewChat])


  // ── Show onboarding for first-time users ──
  const showOnboarding = mounted && !isOnboardingComplete && messages.length === 0

  return (
    <div className="h-[100dvh] bg-slate-900 dark:bg-slate-900 light:bg-slate-50 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="landscape-compact-header px-3 sm:px-4 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] pb-2.5 sm:pb-3 bg-gradient-to-b from-slate-800 to-slate-800/80 backdrop-blur-md border-b border-slate-700/50 shadow-lg shadow-black/10 flex justify-between items-center shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile menu button */}
          {mounted && isNarrow && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 -ml-1 rounded-lg hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">Fantasy Baseball Copilot</h1>
            <p className="text-[10px] sm:text-xs text-slate-400">⚾ Baseball</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* League switcher (desktop) */}
          {mounted && !isNarrow && <LeagueSwitcher />}

          {/* Notification bell */}
          {mounted && <NotificationBell onAction={runCommand} />}

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          )}

          {/* Mobile Yahoo status */}
          {mounted && isNarrow && (
            <YahooStatusBadge isAuthenticated={isYahooConnected} />
          )}
        </div>
      </header>

      {/* ── Top Tab Navigation ── */}
      {mounted && (
        <nav className="bg-slate-800/60 backdrop-blur-md border-b border-slate-700/50 shrink-0 z-30">
          <div className="flex items-center">
            {([
              { id: 'league' as TopTab, label: 'League', icon: '🏆' },
              { id: 'roster' as TopTab, label: 'Roster', icon: '📋' },
              { id: 'matchups' as TopTab, label: 'Matchups', icon: '⚔️' },
              { id: 'players' as TopTab, label: 'Players', icon: '👥' },
              { id: 'draft' as TopTab, label: 'Draft', icon: '📝' },
              { id: 'settings' as TopTab, label: 'Settings', icon: '⚙️' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === activeTab) {
                    setActiveTab(null)
                    return
                  }
                  setActiveTab(tab.id)
                  // Dedicated view tabs — no chat command needed
                  if (tab.id === 'league' || tab.id === 'roster' || tab.id === 'draft' || tab.id === 'settings') return
                  // Fire the appropriate command
                  if (tab.id === 'matchups') runCommand('show matchup')
                  if (tab.id === 'players') runCommand('show all batters')
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-primary-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                }`}
              >
                <span>{tab.icon}</span>
                <span className={isTiny ? 'sr-only' : ''}>{tab.label}</span>
                {/* Active indicator line */}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Mobile drawer overlay */}
      {mounted && isNarrow && drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <nav
            ref={drawerRef}
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
            className="relative w-[85vw] max-w-[340px] h-full bg-slate-800 border-r border-slate-700 overflow-auto animate-slide-in flex flex-col"
            aria-label="Main menu"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="text-sm font-bold text-white">Menu</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-700/50 active:bg-slate-700"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* New Chat button */}
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-slate-600 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>

              {/* Chat History */}
              {conversations.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recent Chats</h3>
                  <div className="space-y-1 max-h-48 overflow-auto">
                    {conversations.slice(0, 10).map((conv) => (
                      <div key={conv.id} className="flex items-center gap-1">
                        <button
                          onClick={() => loadConversation(conv.id)}
                          className={`flex-1 text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                            conv.id === conversationId
                              ? 'bg-primary-600/20 text-primary-400'
                              : 'hover:bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {conv.title}
                        </button>
                        <button
                          onClick={() => handleDeleteConversation(conv.id)}
                          className="p-2.5 -mr-1 rounded-lg hover:bg-slate-700/50 text-slate-600 hover:text-slate-400"
                          aria-label="Delete conversation"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* League switcher (mobile) */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">League</h3>
                <LeagueSwitcher />
              </section>

              {/* Yahoo Auth */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Yahoo Fantasy</h3>
                <YahooAuth />
              </section>

              {/* Quick Actions */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      className="w-full text-left px-3 py-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 transition-colors text-sm"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Season History */}
              {isYahooConnected && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Past Seasons</h3>
                  <SeasonHistory />
                </section>
              )}
            </div>
          </nav>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        {!isNarrow && mounted && (
          <aside className="w-72 lg:w-80 border-r border-slate-700 bg-slate-800/30 overflow-auto flex flex-col">
            <div className="p-4">
              {/* New Chat */}
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4 rounded-lg border border-dashed border-slate-600 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>

              {/* Chat History */}
              {conversations.length > 0 && (
                <section className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Chats</h2>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-[10px] text-primary-400 hover:underline"
                    >
                      {showHistory ? 'Collapse' : `Show all (${conversations.length})`}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {conversations.slice(0, showHistory ? 20 : 5).map((conv) => (
                      <div key={conv.id} className="flex items-center gap-1 group">
                        <button
                          onClick={() => loadConversation(conv.id)}
                          className={`flex-1 text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                            conv.id === conversationId
                              ? 'bg-primary-600/20 text-primary-400'
                              : 'hover:bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {conv.title}
                        </button>
                        <button
                          onClick={() => handleDeleteConversation(conv.id)}
                          className="p-2 -mr-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-700/50 text-slate-600 hover:text-slate-400 transition-opacity"
                          aria-label="Delete conversation"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Yahoo Fantasy</h2>
                <YahooAuth />
              </section>

              <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 transition-colors text-sm"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Season History */}
              {isYahooConnected && (
                <section className="mt-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Past Seasons</h2>
                  <SeasonHistory />
                </section>
              )}
            </div>
          </aside>
        )}

        {/* Chat Panel / Draft Results */}
        <main className="flex-1 flex flex-col min-w-0">
          {activeTab === 'league' ? (
            <LeagueStandings leagueKey={selectedLeagueKey} />
          ) : activeTab === 'roster' ? (
            <MyRoster leagueKey={selectedLeagueKey} />
          ) : activeTab === 'draft' ? (
            <DraftResults leagueKey={selectedLeagueKey} />
          ) : activeTab === 'settings' ? (
            <LeagueSettings leagueKey={selectedLeagueKey} />
          ) : (
          <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3 sm:space-y-4 chat-scroll-fade">
            {/* Onboarding or Welcome screen */}
            {showOnboarding ? (
              <Onboarding
                onComplete={markOnboardingComplete}
                onRunCommand={runCommand}
              />
            ) : messages.length === 0 && !isLoading ? (
              <div className="text-center text-slate-400 mt-8 sm:mt-12 max-w-2xl mx-auto px-2">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">Fantasy Baseball Copilot</h2>
                <p className="mb-2 text-sm sm:text-base">Your AI-powered fantasy baseball assistant</p>
                <p className="text-xs sm:text-sm mb-4">⚾ Baseball</p>

                {/* Mobile: connect CTA */}
                {mounted && isNarrow && !isYahooConnected && (
                  <div className="mb-6 p-4 rounded-xl border border-purple-600/30 bg-purple-600/10">
                    <p className="text-sm text-slate-300 mb-3">Connect your Yahoo account to get started</p>
                    <button
                      onClick={() => { window.location.href = '/api/yahoo/auth' }}
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg font-semibold transition-colors text-sm"
                    >
                      Connect Yahoo Fantasy
                    </button>
                  </div>
                )}

                <p className="text-xs sm:text-sm">Try asking:</p>
                {mounted && isNarrow ? (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {SUGGESTION_PILLS.map(s => (
                      <button
                        key={s.cmd}
                        onClick={() => runCommand(s.cmd)}
                        className="px-3 py-2 rounded-full border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 text-xs sm:text-sm text-slate-300 transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <ul className="mt-4 space-y-2 text-left max-w-md mx-auto">
                    <li className="text-slate-300">• &quot;Create a 12-team roto league&quot;</li>
                    <li className="text-slate-300">• &quot;Set my best lineup&quot;</li>
                    <li className="text-slate-300">• &quot;Who should I draft?&quot;</li>
                    <li className="text-slate-300">• &quot;Drop Player X for Player Y&quot;</li>
                  </ul>
                )}

                {/* Keyboard shortcut hint (desktop) */}
                {mounted && !isNarrow && (
                  <p className="mt-6 text-[10px] text-slate-600">
                    Tip: Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">/</kbd> to focus chat · <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">⌘K</kbd> to clear
                  </p>
                )}
              </div>
            ) : null}

            {messages.map((message, msgIdx) => {
              const hasCards = message.metadata?.cards && message.metadata.cards.length > 0
              const prevMessage = msgIdx > 0 ? messages[msgIdx - 1] : null
              const showDateSep = message.timestamp && (
                !prevMessage?.timestamp || isDifferentDay(prevMessage.timestamp, message.timestamp)
              )
              return (
              <div key={message.id}>
              {/* Date separator */}
              {showDateSep && (
                <div className="flex items-center gap-3 max-w-4xl mx-auto my-2">
                  <div className="flex-1 h-px bg-slate-700/50" />
                  <span className="text-[10px] sm:text-xs text-slate-500 font-medium shrink-0">
                    {formatDateSeparator(message.timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-slate-700/50" />
                </div>
              )}
              <div
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} max-w-4xl mx-auto ${
                  hasCards ? 'w-full' : ''
                }`}
              >
                <div
                  className={`${
                    hasCards
                      ? 'w-full'
                      : 'max-w-[95%] sm:max-w-[85%] md:max-w-[80%]'
                  } rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-100'
                  }`}
                >
                  {/* Render with markdown for assistant, plain for user */}
                  {!(message.metadata?.cards && message.metadata.cards.length > 0) && (
                    message.role === 'assistant' ? (
                      <ChatMarkdown content={message.content} />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                    )
                  )}

                  {message.metadata?.cards && message.metadata.cards.length > 0 && (
                    <div className="space-y-3">
                      {message.metadata.cards.map((card: any, idx: number) => (
                        <EnhancedCards
                          key={idx}
                          card={card}
                          onAction={handleCardAction}
                          sport={currentSport}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </div>
              )
            })}

            {/* Typewriter text reveal */}
            {streamingText && (
              <div className="flex justify-start max-w-4xl mx-auto">
                <div className="max-w-[95%] sm:max-w-[85%] md:max-w-[80%] bg-slate-800 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
                  <ChatMarkdown content={streamingText} />
                  <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse rounded-sm ml-0.5" />
                </div>
              </div>
            )}

            {/* Typing indicator (waiting for server) */}
            {isLoading && !streamingText && (
              <div className="flex justify-start max-w-4xl mx-auto">
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={BOUNCE_DELAY_200} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={BOUNCE_DELAY_400} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
          )}

          {/* Input Bar — hidden when dedicated view tabs are active */}
          {activeTab !== 'league' && activeTab !== 'roster' && activeTab !== 'draft' && activeTab !== 'settings' && (
          <div className="landscape-compact-footer bg-gradient-to-t from-slate-900 via-slate-800/95 to-slate-800/80 backdrop-blur-md border-t border-slate-700/40 px-2.5 sm:px-4 pt-2.5 sm:pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.625rem)] shrink-0">
            {/* Mobile quick actions toggle */}
            {mounted && isNarrow && (
              <div className="mb-2.5">
                <button
                  type="button"
                  onClick={() => setShowQuickActions((prev) => !prev)}
                  aria-expanded={showQuickActions}
                  aria-controls="quick-actions-panel"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-700/60 bg-slate-800/70 text-sm font-semibold text-slate-200 active:bg-slate-700"
                >
                  <span>⚡ Quick actions</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${showQuickActions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showQuickActions && (
                  <div id="quick-actions-panel" className="mt-2 flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleQuickAction(action)}
                        className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 transition-colors text-xs text-slate-200"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2 items-end">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  resizeTextarea()
                }}
                placeholder={isTiny ? 'Ask anything...' : 'Try: "set my optimal lineup" · Press / to focus'}
                className="flex-1 min-w-0 bg-slate-800 border border-slate-700/60 text-white rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm placeholder:text-slate-500 resize-none overflow-y-auto leading-relaxed"
                style={{ maxHeight: 120 }}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-colors shrink-0"
                aria-label="Send message"
              >
                {isTiny ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                ) : (
                  'Send'
                )}
              </button>
            </form>
          </div>
          )}
        </main>
      </div>
    </div>
  )
}

/** Format a date for the chat separator */
function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffMs = today.getTime() - msgDay.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Check if two timestamps fall on different calendar days */
function isDifferentDay(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
}

/** Small status badge for the header on mobile */
function YahooStatusBadge({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] shrink-0">
      <div className={`w-1.5 h-1.5 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-slate-500'}`} />
      <span className="text-slate-400">{isAuthenticated ? 'Yahoo' : 'Not connected'}</span>
    </div>
  )
}
