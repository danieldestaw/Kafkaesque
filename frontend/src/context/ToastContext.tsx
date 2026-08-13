import { CheckCircle2, AlertTriangle, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'

type ToastType = 'success' | 'error' | 'warning'

type Toast = {
  id: string
  type: ToastType
  message: string
}

type ToastContextValue = {
  toast: (type: ToastType, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = crypto.randomUUID()
      setToasts((t) => [...t, { id, type, message }])
      setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  const value: ToastContextValue = {
    toast: add,
    success: (m) => add('success', m),
    error: (m) => add('error', m),
    warning: (m) => add('warning', m),
  }

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
  }

  const colors = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    error: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-slide-up',
                colors[t.type],
              )}
              role="status"
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
