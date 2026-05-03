'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-slate-900">
        <div className="h-[100dvh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-white mb-3">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
