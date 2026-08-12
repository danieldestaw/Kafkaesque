import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Props = {
  label: string
  description?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function FormField({ label, description, error, required, children, className }: Props) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {description && <p className="text-xs text-sf-muted">{description}</p>}
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function FormSuccess({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
      <span>✓</span>
      {message}
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
      <span>×</span>
      {message}
    </div>
  )
}
