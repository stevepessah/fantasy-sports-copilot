'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChatMessage, Sport, Player, Roster } from '@/types'
import SportToggle from './SportToggle'
import { EnhancedCards } from './EnhancedCards'

interface ChatInterfaceProps {
  leagueId?: string
  userId?: string
  initialMessages?: ChatMessage[]
}

export default function EnhancedChatInterface({ leagueId, userId, initialMessages = [] }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSport, setCurrentSport] = useState<Sport>('baseball')
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'roster'>('chat')
  const [roster, setRoster] = useState<Player[]>([])
  const [isNarrow, setIsNarrow] = useState(false)
  const [isTiny, setIsTiny] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkSize = () => {
      setIsNarrow(window.innerWidth <= 900)
      setIsTiny(window.innerWidth <= 520)
    }
    checkSize()
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Load roster when league/team is available
    loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSport])

  useEffect(() => {
    if (!isNarrow) {
      setMobilePanel('chat')
    }
  }, [isNarrow])

  const loadRoster = async () => {
    try {
      const response = await fetch(`/api/players?sport=${currentSport}`)
      if (response.ok) {
        const players = await response.json()
        // In a real app, filter by team roster
        setRoster(players.slice(0, 15)) // Mock roster
      }
    } catch (error) {
      console.error('Error loading roster:', error)
    }
  }

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

      // Handle actions
      if (data.action) {
        handleAction(data.action)
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async (action: any) => {
    switch (action.type) {
      case 'create_league':
        console.log('Creating league:', action.data)
        break
      case 'set_lineup':
        console.log('Setting lineup:', action.data)
        break
      default:
        console.log('Action:', action)
    }
  }

  const runCommand = (command: string) => {
    setInput(command)
    setTimeout(() => handleSubmit(), 0)
  }

  const quickActions = [
    { label: 'Set optimal lineup', command: 'set my optimal lineup' },
    { label: 'Show matchup', command: 'show matchup' },
    { label: 'View all teams', command: 'show all teams' },
    { label: 'Waiver targets', command: 'who should I pick up on waivers?' },
    { label: 'Trade idea', command: 'suggest a trade' },
    { label: 'Draft advice', command: 'draft advice' },
  ]

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">Fantasy Sports Copilot</h1>
          <p className="text-xs text-slate-400">
            {currentSport === 'football' ? '🏈 Football' : '⚾ Baseball'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Projected</div>
          <div className="text-lg font-bold">--</div>
        </div>
      </header>

      {/* Mobile Tabs */}
      {isNarrow && (
        <div className="flex gap-2 p-2 border-b border-slate-700 bg-slate-800/30">
          <button
            onClick={() => setMobilePanel('chat')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
              mobilePanel === 'chat'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobilePanel('roster')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
              mobilePanel === 'roster'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            Roster
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Roster Sidebar */}
        {(!isNarrow || mobilePanel === 'roster') && (
          <aside className={`${isNarrow ? 'w-full' : 'w-80'} border-r border-slate-700 bg-slate-800/30 overflow-auto flex flex-col`}>
            <div className="p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Roster</h2>
              <div className="space-y-2">
                {roster.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => runCommand(player.name)}
                    className="w-full text-left p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{player.name}</div>
                        <div className="text-xs text-slate-400">
                          {player.position} - {player.team}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line react/no-unescaped-entities */}
                        {player.injuryStatus && player.injuryStatus !== 'healthy' && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-600/20 text-red-400 border border-red-600/30">
                            {player.injuryStatus}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                          {player.projectedPoints?.toFixed(1) || '0.0'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => runCommand(action.command)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-colors text-sm"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Chat Panel */}
        {(!isNarrow || mobilePanel === 'chat') && (
          <main className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="max-w-4xl mx-auto">
                <SportToggle currentSport={currentSport} onSportChange={setCurrentSport} />
              </div>

              {messages.length === 0 && (
                <div className="text-center text-slate-400 mt-12 max-w-2xl mx-auto">
                  <h2 className="text-2xl font-bold mb-4 text-white">Fantasy Sports Copilot</h2>
                  <p className="mb-2">Your AI-powered fantasy sports assistant</p>
                  <p className="text-sm mb-4">
                    Currently viewing: {currentSport === 'football' ? '🏈 Football' : '⚾ Baseball'}
                  </p>
                  <p className="text-sm">Try asking:</p>
                  <ul className="mt-4 space-y-2 text-left max-w-md mx-auto">
                    {currentSport === 'football' ? (
                      <>
                        <li className="text-slate-300">• &quot;Create a 12-team PPR league&quot;</li>
                        <li className="text-slate-300">• &quot;Set my best lineup&quot;</li>
                        <li className="text-slate-300">• &quot;Who should I draft?&quot;</li>
                        <li className="text-slate-300">• &quot;Drop Player X for Player Y&quot;</li>
                      </>
                    ) : (
                      <>
                        <li className="text-slate-300">• &quot;Create a 12-team roto league&quot;</li>
                        <li className="text-slate-300">• &quot;Set my best lineup&quot;</li>
                        <li className="text-slate-300">• &quot;Who should I draft?&quot;</li>
                        <li className="text-slate-300">• &quot;Drop Player X for Player Y&quot;</li>
                      </>
                    )}
                  </ul>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} max-w-4xl mx-auto`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-800 border border-slate-700 text-slate-100'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                    
                    {/* Render cards if present */}
                    {message.metadata?.cards && (
                      <div className="mt-4 space-y-3">
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
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="border-t border-slate-700 bg-slate-800/50 p-4">
              <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={'Try: "set my optimal lineup"'}
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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
                  className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
