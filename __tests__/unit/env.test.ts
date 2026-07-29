import { describe, it, expect, vi, afterEach } from 'vitest'
import { isNonProdEnvironment } from '@/lib/env'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isNonProdEnvironment', () => {
  it('is true for Vercel preview deployments', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('NODE_ENV', 'production')
    expect(isNonProdEnvironment()).toBe(true)
  })

  it('is true for Vercel development', () => {
    vi.stubEnv('VERCEL_ENV', 'development')
    expect(isNonProdEnvironment()).toBe(true)
  })

  it('is false for Vercel production', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')
    expect(isNonProdEnvironment()).toBe(false)
  })

  it('is true for local development (no VERCEL_ENV)', () => {
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('NODE_ENV', 'development')
    expect(isNonProdEnvironment()).toBe(true)
  })

  it('is false for non-Vercel production (no VERCEL_ENV)', () => {
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    expect(isNonProdEnvironment()).toBe(false)
  })
})
