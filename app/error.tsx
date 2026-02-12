'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="h-[100dvh] bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold text-white mb-3">Something went wrong</h2>
        <p className="text-slate-400 text-sm mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
