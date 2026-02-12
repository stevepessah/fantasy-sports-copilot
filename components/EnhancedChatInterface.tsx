'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { ChatMessage, Sport } from '@/types'
import YahooAuth from './YahooAuth'
import { useYahooAuth } from '@/contexts/YahooAuthContext'

// Lazy-load the heavy cards component — only needed after first message
const EnhancedCards = dynamic(
  () => import('./EnhancedCards').then((mod) => mod.EnhancedCards),
  { ssr: false },
)

// ── Static constants (no re-creation on render) ──

const QUICK_ACTIONS = [
  { label: '📋 Set optimal lineup', command: 'set my optimal lineup' },
  { label: '⚔️ Show matchup', command: 'show matchup' },
  { label: '🏆 View all teams', command: 'show all teams' },
  { label: '🏏 Show all batters', command: 'show all batters' },
  { label: '⚾ Show all pitchers', command: 'show all pitchers' },
  { label: '🔍 Waiver targets', command: 'who should I pick up on waivers?' },
  { label: '🔄 Trade idea', command: 'suggest a trade' },
  { label: '📝 Draft advice', command: 'draft advice' },
] as const

const SUGGESTION_PILLS = [
  { label: 'Set my best lineup', cmd: 'set my best lineup' },
  { label: 'Who should I draft?', cmd: 'Who should I draft?' },
  { label: 'Waiver targets', cmd: 'who should I pick up on waivers?' },
  { label: 'Suggest a trade', cmd: 'suggest a trade' },
] as const

const BOUNCE_DELAY_200 = { animationDelay: '0.2s' } as const
const BOUNCE_DELAY_400 = { animationDelay: '0.4s' } as const

interface ChatInterfaceProps {
  leagueId?: string
  userId?: string
  initialMessages?: ChatMessage[]
}

export default function EnhancedChatInterface({ leagueId, userId, initialMessages = [] }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSport] = useState<Sport>('baseball')
  const [mounted, setMounted] = useState(false)
  const [isNarrow, setIsNarrow] = useState(true)   // mobile-first default
  const [isTiny, setIsTiny] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { isAuthenticated: isYahooConnected } = useYahooAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced resize handler — only fires after 150ms of no resize events
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const checkSize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setIsNarrow(window.innerWidth <= 900)
        setIsTiny(window.innerWidth <= 520)
      }, 150)
    }
    // Set initial values synchronously (no debounce on mount)
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
  }, [messages, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isNarrow) {
      setShowQuickActions(false)
      setDrawerOpen(false)
    }
  }, [isNarrow])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])


  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          leagueId,
          userId,
          sport: currentSport,
          conversationHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        metadata: {
          ...(data.action ? { action: data.action.type, ...data.action.data } : {}),
          ...(data.cards ? { cards: data.cards } : {}),
        },
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (data.action) {
        handleAction(data.action)
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const handleAction = async (action: { type: string; data?: unknown }) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('Action:', action.type, action.data)
    }
  }

  const runCommand = useCallback((command: string) => {
    setInput(command)
    setTimeout(() => handleSubmit(), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleQuickAction = useCallback((command: string) => {
    runCommand(command)
    setShowQuickActions(false)
    setDrawerOpen(false)
  }, [runCommand])

  return (
    <div className="h-[100dvh] bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header — top padding = safe-area (for notch/dynamic island) + 10px breathing room */}
      <header className="landscape-compact-header px-3 sm:px-4 pt-[calc(env(safe-area-inset-top,0px)+0.625rem)] pb-2.5 sm:pb-3 bg-gradient-to-b from-slate-800 to-slate-800/80 backdrop-blur-md border-b border-slate-700/50 shadow-lg shadow-black/10 flex justify-between items-center shrink-0">
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
        {/* Mobile: small Yahoo status indicator */}
        {mounted && isNarrow && (
          <YahooStatusBadge isAuthenticated={isYahooConnected} />
        )}
      </header>

      {/* Mobile drawer overlay */}
      {mounted && isNarrow && drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <nav className="relative w-[85vw] max-w-[340px] h-full bg-slate-800 border-r border-slate-700 overflow-auto animate-slide-in flex flex-col" aria-label="Main menu">
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
              {/* Yahoo Auth */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Yahoo Fantasy</h3>
                <YahooAuth />
              </section>

              {/* Quick Actions */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.command)}
                      className="w-full text-left px-3 py-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 transition-colors text-sm"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </nav>
        </div>
      )}


      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar — hidden until mounted to prevent flash */}
        {!isNarrow && mounted && (
          <aside className="w-72 lg:w-80 border-r border-slate-700 bg-slate-800/30 overflow-auto flex flex-col">
            <div className="p-4">
              <section className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Yahoo Fantasy</h2>
                <YahooAuth />
              </section>

              <section className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.command)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 transition-colors text-sm"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        )}

        {/* Chat Panel */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3 sm:space-y-4 chat-scroll-fade">
            {/* Welcome screen */}
            {messages.length === 0 && (
              <div className="text-center text-slate-400 mt-8 sm:mt-12 max-w-2xl mx-auto px-2">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">Fantasy Baseball Copilot</h2>
                <p className="mb-2 text-sm sm:text-base">Your AI-powered fantasy baseball assistant</p>
                <p className="text-xs sm:text-sm mb-4">⚾ Baseball</p>

                {/* Mobile: connect CTA — only show if not connected */}
                {mounted && isNarrow && !isYahooConnected && (
                  <div className="mb-6 p-4 rounded-xl border border-purple-600/30 bg-purple-600/10">
                    <p className="text-sm text-slate-300 mb-3">Connect your Yahoo account to get started</p>
                    <button
                      onClick={() => setDrawerOpen(true)}
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg font-semibold transition-colors text-sm"
                    >
                      Connect Yahoo Fantasy
                    </button>
                  </div>
                )}

                <p className="text-xs sm:text-sm">Try asking:</p>
                {/* Mobile: tappable suggestion pills */}
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
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} max-w-4xl mx-auto`}
              >
                <div
                  className={`${
                    message.metadata?.cards && message.metadata.cards.length > 0
                      ? 'max-w-[98%] sm:max-w-[95%] md:max-w-[90%] lg:max-w-full'
                      : 'max-w-[95%] sm:max-w-[85%] md:max-w-[80%]'
                  } rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-100'
                  }`}
                >
                  {/* Hide the text blurb only when there are actual cards to show */}
                  {!(message.metadata?.cards && message.metadata.cards.length > 0) && (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                  )}
                  
                  {message.metadata?.cards && message.metadata.cards.length > 0 && (
                    <div className="space-y-3">
                      {message.metadata.cards.map((card: any, idx: number) => (
                        <EnhancedCards
                          key={idx}
                          card={card}
                          onAction={runCommand}
                          sport={currentSport}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
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

          {/* Input Bar — bottom padding = safe-area (for home indicator in PWA) + base padding */}
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
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleQuickAction(action.command)}
                        className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 transition-colors text-xs text-slate-200"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isTiny ? 'Ask anything...' : 'Try: "set my optimal lineup"'}
                className="flex-1 min-w-0 bg-slate-800 border border-slate-700/60 text-white rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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
        </main>
      </div>
    </div>
  )
}

/** Small status badge for the header on mobile — shows green/gray dot.
 *  Receives auth state from parent (no independent fetch). */
function YahooStatusBadge({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] shrink-0">
      <div className={`w-1.5 h-1.5 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-slate-500'}`} />
      <span className="text-slate-400">{isAuthenticated ? 'Yahoo' : 'Not connected'}</span>
    </div>
  )
}
