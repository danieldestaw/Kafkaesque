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
        'inline-flex items-center gap-1 text-[11px] font-medium text-sf-accent hover:underline mt-auto pt-2',
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
  compact,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-sf-border bg-sf-panel shadow-sm shadow-black/5',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold">{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {footer && <div className="shrink-0">{footer}</div>}
    </div>
  )
}
