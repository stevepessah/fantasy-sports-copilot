import { ChatMessage } from '@/types'

const STORAGE_KEY = 'fbc_conversations'
const ACTIVE_KEY = 'fbc_active_conversation'

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

function getAll(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAll(conversations: Conversation[]) {
  try {
    // Keep only the most recent 50 conversations
    const trimmed = conversations.slice(0, 50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function getConversations(): Conversation[] {
  return getAll()
}

export function getActiveConversationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveConversationId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id)
    } else {
      localStorage.removeItem(ACTIVE_KEY)
    }
  } catch {
    // silent
  }
}

export function getConversation(id: string): Conversation | null {
  return getAll().find((c) => c.id === id) ?? null
}

export function saveConversation(conv: Conversation) {
  const all = getAll()
  const idx = all.findIndex((c) => c.id === conv.id)
  if (idx >= 0) {
    all[idx] = conv
  } else {
    all.unshift(conv)
  }
  saveAll(all)
}

export function deleteConversation(id: string) {
  const all = getAll().filter((c) => c.id !== id)
  saveAll(all)
  // If we deleted the active conversation, clear it
  if (getActiveConversationId() === id) {
    setActiveConversationId(null)
  }
}

/** Generate a short title from the first user message */
export function generateTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return 'New Chat'
  const text = first.content.trim()
  return text.length > 50 ? text.slice(0, 47) + '…' : text
}

export function createNewConversation(): Conversation {
  return {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
