import * as Sentry from '@sentry/nextjs'

type ErrorSeverity = 'warning' | 'error' | 'fatal'

interface ErrorContext {
  source: string
  metadata?: Record<string, unknown>
}

/**
 * Report an error with structured context.
 * Routes to Sentry when configured, always logs to console.
 */
export function reportError(
  error: unknown,
  context: ErrorContext,
  severity: ErrorSeverity = 'error',
): void {
  const message = error instanceof Error ? error.message : String(error)

  const logFn = severity === 'warning' ? console.warn : console.error
  logFn(`[${context.source}]`, message, context.metadata ?? '')

  try {
    Sentry.withScope((scope) => {
      scope.setTag('source', context.source)
      scope.setLevel(severity)
      if (context.metadata) {
        scope.setExtras(context.metadata)
      }
      if (error instanceof Error) {
        Sentry.captureException(error)
      } else {
        Sentry.captureMessage(message, severity)
      }
    })
  } catch {
    // Sentry not initialized — console logging above is sufficient
  }
}
