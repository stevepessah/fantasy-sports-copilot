import { describe, it, expect } from 'vitest'
import { YahooApiError } from '@/lib/yahoo/oauth2'
import { classifyYahooError } from '@/lib/yahoo/errors'

const notAuthorizedBody = `<?xml version="1.0" encoding="UTF-8"?>
<error xml:lang="en-us">
 <description>This application is not authorized to perform this action.</description>
 <detail/>
</error>`

describe('YahooApiError', () => {
  it('captures status and parses the <description>', () => {
    const err = new YahooApiError(403, notAuthorizedBody)
    expect(err.status).toBe(403)
    expect(err.description).toBe('This application is not authorized to perform this action.')
    expect(err.message).toContain('403')
    expect(err instanceof Error).toBe(true)
  })

  it('tolerates a body without a description', () => {
    const err = new YahooApiError(500, 'boom')
    expect(err.status).toBe(500)
    expect(err.description).toBeUndefined()
  })
})

describe('classifyYahooError', () => {
  it('maps a 403 to the app-approval gate (not fixable by reconnecting)', () => {
    const result = classifyYahooError(new YahooApiError(403, notAuthorizedBody))
    expect(result.code).toBe('yahoo_not_authorized')
    expect(result.httpStatus).toBe(403)
    expect(result.message).toMatch(/sports\.yahoo\.com\/developer/)
    expect(result.message.toLowerCase()).toContain('reconnect')
  })

  it('maps a 401 to an expired session', () => {
    const result = classifyYahooError(new YahooApiError(401, 'token_rejected'))
    expect(result.code).toBe('yahoo_auth_expired')
    expect(result.httpStatus).toBe(401)
    expect(result.message.toLowerCase()).toContain('reconnect')
  })

  it('maps a 999 to rate limiting', () => {
    const result = classifyYahooError(new YahooApiError(999, 'rate limited'))
    expect(result.code).toBe('yahoo_rate_limited')
    expect(result.httpStatus).toBe(429)
  })

  it('falls back to a generic error for other Yahoo statuses', () => {
    const result = classifyYahooError(new YahooApiError(500, 'server error'))
    expect(result.code).toBe('yahoo_error')
    expect(result.httpStatus).toBe(502)
  })

  it('handles non-Yahoo errors (e.g. network failures)', () => {
    const result = classifyYahooError(new Error('fetch failed'))
    expect(result.code).toBe('yahoo_error')
    expect(result.details).toContain('fetch failed')
  })
})
