import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function WidgetFooterLink({
  to,
  label,
  className,
}: {
  to: string
  label: string
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-sf-accent hover:underline mt-auto pt-3',
        className,
      )}
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  )
}

export function DashboardPanel({
  title,
  children,
  footer,
  action,
  className,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-sf-border bg-sf-panel p-4 h-full flex flex-col overflow-visible shadow-sm shadow-black/5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
      {footer}
    </div>
  )
}
