import { YahooApiError } from './oauth2'

/**
 * Stable, machine-readable codes the frontend branches on to show the right
 * guidance for a failed Yahoo request.
 */
export type YahooErrorCode =
  | 'yahoo_not_authorized' // 403 — the Yahoo app itself isn't approved for the Fantasy API
  | 'yahoo_auth_expired' // 401 — the user's token is invalid/expired; reconnecting fixes it
  | 'yahoo_rate_limited' // 999 — Yahoo is throttling requests
  | 'yahoo_error' // any other Yahoo/transport failure

export interface ClassifiedYahooError {
  /** HTTP status to return to the client. */
  httpStatus: number
  /** Stable code for the frontend to branch on. */
  code: YahooErrorCode
  /** User-facing, actionable message. */
  message: string
  /** Raw upstream detail for logs / debugging (never shown verbatim to users). */
  details: string
}

/**
 * Maps a thrown Yahoo error to a structured response. The 403 case is the
 * important one: as of ~2026-07-24 Yahoo gates the Fantasy Sports API behind a
 * per-app approval, so unapproved apps get 403 "This application is not
 * authorized to perform this action" on every endpoint even though OAuth login
 * still succeeds. That is NOT fixable by reconnecting, so we flag it distinctly.
 */
export function classifyYahooError(error: unknown): ClassifiedYahooError {
  const details = error instanceof Error ? error.message : String(error)

  if (error instanceof YahooApiError) {
    switch (error.status) {
      case 403:
        return {
          httpStatus: 403,
          code: 'yahoo_not_authorized',
          message:
            "Yahoo hasn't authorized this app to access the Fantasy Sports API. " +
            'This is an app-level approval issue with Yahoo (not your login), so reconnecting will not help. ' +
            'The app owner needs to request Fantasy Sports API access for this app at https://sports.yahoo.com/developer/.',
          details,
        }
      case 401:
        return {
          httpStatus: 401,
          code: 'yahoo_auth_expired',
          message: 'Your Yahoo session has expired. Please reconnect your Yahoo account.',
          details,
        }
      case 999:
        return {
          httpStatus: 429,
          code: 'yahoo_rate_limited',
          message: 'Yahoo is temporarily rate-limiting requests. Please try again in a bit.',
          details,
        }
    }
  }

  return {
    httpStatus: 502,
    code: 'yahoo_error',
    message: 'Something went wrong talking to Yahoo. Please try again.',
    details,
  }
}
