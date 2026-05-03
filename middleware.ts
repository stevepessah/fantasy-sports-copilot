import { NextResponse, type NextRequest } from 'next/server'

const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  '/api/chat': { windowMs: 60_000, maxRequests: 20 },
  '/api/yahoo/auth': { windowMs: 60_000, maxRequests: 10 },
  '/api/yahoo/callback': { windowMs: 60_000, maxRequests: 10 },
  default: { windowMs: 60_000, maxRequests: 100 },
}

const windows = new Map<string, number[]>()

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.ip ||
    'unknown'
  )
}

function getRateLimit(pathname: string) {
  for (const [route, limit] of Object.entries(RATE_LIMITS)) {
    if (route !== 'default' && pathname.startsWith(route)) {
      return limit
    }
  }
  return RATE_LIMITS.default
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next()
  }

  const ip = getClientIp(request)
  const pathname = request.nextUrl.pathname
  const { windowMs, maxRequests } = getRateLimit(pathname)

  const key = `${ip}:${pathname}`
  const now = Date.now()

  let timestamps = windows.get(key)
  if (!timestamps) {
    timestamps = []
    windows.set(key, timestamps)
  }

  // Slide the window: remove expired timestamps
  const cutoff = now - windowMs
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift()
  }

  if (timestamps.length >= maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(windowMs / 1000)),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  timestamps.push(now)

  // Periodic cleanup: prune stale keys every ~500 requests
  if (Math.random() < 0.002) {
    for (const [k, ts] of windows) {
      if (ts.length === 0 || ts[ts.length - 1] < cutoff) {
        windows.delete(k)
      }
    }
  }

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(maxRequests))
  response.headers.set(
    'X-RateLimit-Remaining',
    String(maxRequests - timestamps.length),
  )
  return response
}

export const config = {
  matcher: '/api/:path*',
}
