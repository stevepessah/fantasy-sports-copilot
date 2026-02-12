import dynamic from 'next/dynamic'

// Lazy-load the chat interface (heavy client component)
const EnhancedChatInterface = dynamic(
  () => import('@/components/EnhancedChatInterface'),
  {
    ssr: false,
    loading: () => (
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
    ),
  },
)

export default function Home() {
  return (
    <main role="main">
      {/* SEO-visible content rendered server-side for crawlers */}
      <h1 className="sr-only">Fantasy Baseball Copilot — AI-Powered Fantasy Sports Assistant</h1>
      <p className="sr-only">
        Get AI-powered lineup optimization, trade analysis, waiver wire picks,
        and draft advice for your Yahoo Fantasy Baseball league.
      </p>

      <EnhancedChatInterface />
    </main>
  )
}
