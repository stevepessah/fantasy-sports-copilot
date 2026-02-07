'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage, Sport } from '@/types'
import SportToggle from './SportToggle'

interface ChatInterfaceProps {
  leagueId?: string
  userId?: string
  initialMessages?: ChatMessage[]
}

export default function ChatInterface({ leagueId, userId, initialMessages = [] }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSport, setCurrentSport] = useState<Sport>('football')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
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
          message: input,
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
        metadata: data.action ? { action: data.action.type, ...data.action.data } : undefined,
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
    // Handle different action types
    switch (action.type) {
      case 'create_league':
        // Navigate to league creation or show confirmation
        console.log('Creating league:', action.data)
        break
      case 'set_lineup':
        // Update lineup
        console.log('Setting lineup:', action.data)
        break
      default:
        console.log('Action:', action)
    }
  }

  return (
    <div className="chat-container bg-slate-900 text-white">
      <div className="chat-messages p-6 space-y-4">
        <div className="max-w-4xl mx-auto">
          <SportToggle currentSport={currentSport} onSportChange={setCurrentSport} />
        </div>
        
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-12">
            <h2 className="text-2xl font-bold mb-4 text-white">Fantasy Sports Copilot</h2>
            <p className="mb-2">Your AI-powered fantasy sports assistant</p>
            <p className="text-sm mb-4">Currently viewing: {currentSport === 'football' ? '🏈 Football' : '⚾ Baseball'}</p>
            <p className="text-sm">Try asking:</p>
            <ul className="mt-4 space-y-2 text-left max-w-md mx-auto">
              {currentSport === 'football' ? (
                <>
                  <li className="text-slate-300">• &ldquo;Create a 12-team PPR league&rdquo;</li>
                  <li className="text-slate-300">• &ldquo;Set my best lineup&rdquo;</li>
                  <li className="text-slate-300">• &ldquo;Who should I draft?&rdquo;</li>
                  <li className="text-slate-300">• &ldquo;Drop Player X for Player Y&rdquo;</li>
                </>
              ) : (
                <>
                  <li className="text-slate-300">• &ldquo;Create a 12-team roto league&rdquo;</li>
                  <li className="text-slate-300">• &ldquo;Set my best lineup&rdquo;</li>
                  <li className="text-slate-300">• &ldquo;Who should I draft?&rdquo;</li>
                  <li className="text-slate-300">• &ldquo;Drop Player X for Player Y&rdquo;</li>
                </>
              )}
            </ul>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-800 text-slate-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.metadata?.action && (
                <div className="mt-2 text-xs text-slate-400">
                  Action: {message.metadata.action}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-lg px-4 py-2">
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

      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your fantasy team..."
              className="flex-1 bg-slate-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
