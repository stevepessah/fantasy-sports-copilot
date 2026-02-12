'use client'

/** Reusable skeleton shimmer building blocks */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-slate-700/60 ${className}`} />
  )
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-700/40 ${className}`} />
  )
}

/** Skeleton that mimics the PlayerStats card layout */
export function PlayerStatsSkeleton() {
  return (
    <div className="mt-2 space-y-2">
      <SkeletonLine className="h-3 w-24" />
      {/* Season stats box */}
      <div className="p-2 sm:p-2.5 bg-slate-700/30 rounded-lg space-y-2">
        <SkeletonLine className="h-3 w-20" />
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-2 gap-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <SkeletonLine className="h-2 w-6" />
              <SkeletonLine className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>
      {/* Historical section */}
      <div className="p-2 sm:p-2.5 bg-slate-700/20 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonLine className="h-3 w-16" />
          <SkeletonLine className="h-5 w-16 rounded" />
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-2 gap-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <SkeletonLine className="h-2 w-6" />
              <SkeletonLine className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Skeleton that mimics a roster list table */
export function RosterListSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="h-4 w-20" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <SkeletonBlock className="w-6 h-6 rounded-md" />
          <div className="flex-1 space-y-1">
            <SkeletonLine className="h-3.5 w-32" />
            <SkeletonLine className="h-2.5 w-20" />
          </div>
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <SkeletonLine key={j} className="h-3 w-8" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Skeleton for a generic card */
export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 bg-slate-800/50">
        <SkeletonLine className="h-4 w-40" />
      </div>
      <div className="p-3 space-y-3">
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-3/4" />
        <SkeletonLine className="h-3 w-1/2" />
        <div className="flex gap-2 mt-4">
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
