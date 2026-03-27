'use client'

export default function AuthRequiredMessage() {
  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="text-center max-w-xs space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-300">Yahoo account required</p>
          <p className="text-xs text-slate-500 mt-1">Connect your Yahoo Fantasy account to view this page.</p>
        </div>
        <a
          href="/api/yahoo/auth"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:from-indigo-700 active:to-violet-700 text-xs font-semibold text-white shadow-sm shadow-indigo-500/25 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.51a4.5 4.5 0 00-6.364-6.364L4.5 8.25" />
          </svg>
          Connect Yahoo
        </a>
      </div>
    </div>
  )
}

/** Check whether an error string indicates a 401 auth failure */
export function isAuthError(error: string): boolean {
  return /\b401\b/.test(error) || /not authenticated/i.test(error)
}
