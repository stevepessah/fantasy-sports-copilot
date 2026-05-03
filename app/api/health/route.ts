import { NextResponse } from 'next/server'
import { hasOpenAIConfig, hasYahooConfig, hasRedisConfig } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, 'ok' | 'unavailable' | 'error'> = {}

  checks.yahoo = hasYahooConfig() ? 'ok' : 'unavailable'
  checks.openai = hasOpenAIConfig() ? 'ok' : 'unavailable'

  if (hasRedisConfig()) {
    try {
      const { default: Redis } = await import('ioredis')
      const redis = new Redis(process.env.REDIS_URL!, {
        connectTimeout: 3000,
        maxRetriesPerRequest: 0,
        lazyConnect: true,
      })
      await redis.connect()
      await redis.ping()
      await redis.quit()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'error'
    }
  } else {
    checks.redis = 'unavailable'
  }

  const hasErrors = Object.values(checks).includes('error')

  return NextResponse.json(
    {
      status: hasErrors ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: hasErrors ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
