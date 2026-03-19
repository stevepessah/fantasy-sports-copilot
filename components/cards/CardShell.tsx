'use client'

export function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="px-2 sm:px-3 py-1 sm:py-2 border-b border-slate-700 bg-slate-800/50">
        <div className="text-[11px] sm:text-sm font-bold">{title}</div>
      </div>
      <div className="p-1.5 sm:p-3">{children}</div>
    </div>
  )
}
