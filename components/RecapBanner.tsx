'use client'

import { useState, useEffect, useRef } from 'react'

const COLLAPSED_MAX_HEIGHT = 108

export default function RecapBanner({
  loading,
  summary,
}: {
  loading: boolean
  summary: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [needsClamp, setNeedsClamp] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    setExpanded(false)
  }, [summary])

  useEffect(() => {
    if (!textRef.current) return
    setNeedsClamp(textRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT)
  }, [summary])

  if (!loading && !summary) return null

  return (
    <div className="mb-5 rounded-xl border border-slate-700/50 bg-gradient-to-r from-slate-800/60 to-slate-800/40 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-sm shrink-0" aria-hidden>
          ✦
        </span>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded bg-slate-700/60 animate-pulse" />
              <div className="h-3.5 w-11/12 rounded bg-slate-700/60 animate-pulse" />
              <div className="h-3.5 w-4/5 rounded bg-slate-700/60 animate-pulse" />
            </div>
          ) : (
            <>
              <div
                className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                style={{
                  maxHeight: expanded || !needsClamp ? '600px' : `${COLLAPSED_MAX_HEIGHT}px`,
                }}
              >
                <p
                  ref={textRef}
                  className="text-sm leading-relaxed text-slate-200"
                >
                  {summary}
                </p>
              </div>
              {needsClamp && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {expanded ? 'Read less' : 'Read more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
