'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface ChatMarkdownProps {
  content: string
  className?: string
}

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 ml-1">{children}</ol>,
  li: ({ children }) => <li className="text-slate-200">{children}</li>,
  h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-white mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
  code: ({ children, className }) => {
    // Inline code vs code block
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <pre className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 overflow-x-auto my-2">
          <code className="text-xs text-slate-300 font-mono">{children}</code>
        </pre>
      )
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-slate-700/60 text-primary-400 text-xs font-mono">
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary-500/50 pl-3 my-2 text-slate-400 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-slate-700">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-2 py-1.5 text-slate-400 font-semibold text-xs uppercase">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 text-slate-300 border-b border-slate-700/30">{children}</td>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
      {children}
    </a>
  ),
  hr: () => <hr className="border-slate-700 my-3" />,
}

export default function ChatMarkdown({ content, className = '' }: ChatMarkdownProps) {
  return (
    <div className={`text-sm leading-relaxed text-slate-200 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
