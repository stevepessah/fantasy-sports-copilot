'use client'

import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useRef } from 'react'

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  undoAction?: () => void
  duration?: number // ms, default 5000
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <ToastBubble key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastBubble({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true))
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300) // wait for exit animation
    }, toast.duration ?? 5000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast, onDismiss])

  const handleUndo = () => {
    toast.undoAction?.()
    setVisible(false)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  const bgColor =
    toast.type === 'success'
      ? 'bg-green-600/90 border-green-500/50'
      : toast.type === 'error'
        ? 'bg-red-600/90 border-red-500/50'
        : 'bg-slate-700/90 border-slate-600/50'

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg text-white text-sm font-medium transition-all duration-300 ${bgColor} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.undoAction && (
        <button
          onClick={handleUndo}
          className="shrink-0 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 text-xs font-bold transition-colors"
        >
          Undo
        </button>
      )}
    </div>
  )
}
