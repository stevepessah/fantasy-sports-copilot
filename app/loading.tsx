export default function Loading() {
  return (
    <div className="h-[100dvh] bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex space-x-2 mb-4">
          <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce [animation-delay:0.2s]" />
          <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
        <p className="text-slate-400 text-sm">Loading Fantasy Baseball Copilot…</p>
      </div>
    </div>
  )
}
