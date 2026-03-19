import { describe, it, expect, beforeEach, vi } from 'vitest'
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

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key] }),
  })
})

function makeConversation(id: string, title = 'Test'): Conversation {
  return {
    id,
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('getConversations', () => {
  it('returns empty array when nothing is stored', () => {
    expect(getConversations()).toEqual([])
  })

  it('returns parsed conversations', () => {
    const convos = [makeConversation('1'), makeConversation('2')]
    mockStorage['fbc_conversations'] = JSON.stringify(convos)
    expect(getConversations()).toHaveLength(2)
  })

  it('returns empty array for corrupt JSON', () => {
    mockStorage['fbc_conversations'] = 'not-json'
    expect(getConversations()).toEqual([])
  })
})

describe('getActiveConversationId / setActiveConversationId', () => {
  it('returns null when no active conversation', () => {
    expect(getActiveConversationId()).toBeNull()
  })

  it('stores and retrieves active conversation id', () => {
    setActiveConversationId('conv_123')
    expect(mockStorage['fbc_active_conversation']).toBe('conv_123')
    expect(getActiveConversationId()).toBe('conv_123')
  })

  it('clears active conversation when passed null', () => {
    setActiveConversationId('conv_123')
    setActiveConversationId(null)
    expect(mockStorage['fbc_active_conversation']).toBeUndefined()
  })
})

describe('getConversation', () => {
  it('returns null for non-existent id', () => {
    expect(getConversation('nope')).toBeNull()
  })

  it('returns the matching conversation', () => {
    const conv = makeConversation('abc')
    mockStorage['fbc_conversations'] = JSON.stringify([conv])
    expect(getConversation('abc')?.id).toBe('abc')
  })
})

describe('saveConversation', () => {
  it('inserts a new conversation at the front', () => {
    const conv = makeConversation('new')
    saveConversation(conv)
    const stored = JSON.parse(mockStorage['fbc_conversations'])
    expect(stored[0].id).toBe('new')
  })

  it('updates an existing conversation in place', () => {
    const conv = makeConversation('existing', 'Old Title')
    mockStorage['fbc_conversations'] = JSON.stringify([conv])

    saveConversation({ ...conv, title: 'New Title' })
    const stored = JSON.parse(mockStorage['fbc_conversations'])
    expect(stored).toHaveLength(1)
    expect(stored[0].title).toBe('New Title')
  })
})

describe('deleteConversation', () => {
  it('removes a conversation by id', () => {
    mockStorage['fbc_conversations'] = JSON.stringify([makeConversation('a'), makeConversation('b')])
    deleteConversation('a')
    const stored = JSON.parse(mockStorage['fbc_conversations'])
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe('b')
  })

  it('clears active conversation if deleted', () => {
    mockStorage['fbc_conversations'] = JSON.stringify([makeConversation('active')])
    mockStorage['fbc_active_conversation'] = 'active'
    deleteConversation('active')
    expect(mockStorage['fbc_active_conversation']).toBeUndefined()
  })
})

describe('generateTitle', () => {
  it('uses first user message as title', () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'show my lineup', timestamp: '' },
    ]
    expect(generateTitle(messages)).toBe('show my lineup')
  })

  it('truncates long messages', () => {
    const long = 'a'.repeat(60)
    const messages = [
      { id: '1', role: 'user' as const, content: long, timestamp: '' },
    ]
    const title = generateTitle(messages)
    expect(title.length).toBeLessThanOrEqual(50)
    expect(title).toContain('…')
  })

  it('returns "New Chat" when no user messages', () => {
    expect(generateTitle([])).toBe('New Chat')
    expect(generateTitle([
      { id: '1', role: 'assistant' as const, content: 'hello', timestamp: '' },
    ])).toBe('New Chat')
  })
})

describe('createNewConversation', () => {
  it('creates a conversation with unique id', () => {
    const c = createNewConversation()
    expect(c.id).toMatch(/^conv_/)
    expect(c.title).toBe('New Chat')
    expect(c.messages).toEqual([])
    expect(c.createdAt).toBeTruthy()
    expect(c.updatedAt).toBeTruthy()
  })

  it('generates different ids on successive calls', () => {
    const a = createNewConversation()
    const b = createNewConversation()
    expect(a.id).not.toBe(b.id)
  })
})
