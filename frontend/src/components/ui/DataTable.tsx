import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
  sortable?: boolean
}

type Props<T> = {
  columns: Column<T>[]
  data: T[]
  keyFn: (row: T) => string
  loading?: boolean
  error?: string
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  selectedKey?: string
  filter?: string
  filterFn?: (row: T, filter: string) => boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export function DataTable<T>({
  columns,
  data,
  keyFn,
  loading,
  error,
  emptyTitle = 'No data',
  emptyDescription,
  onRowClick,
  selectedKey,
  filter,
  filterFn,
}: Props<T>) {
  const filtered = filter && filterFn ? data.filter((r) => filterFn(r, filter)) : data

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-sf-border">
      <div className="overflow-auto max-h-[calc(100vh-16rem)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-sf-panel border-b border-sf-border">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-sf-muted',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-sf-border">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-sf-border/60" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <p className="font-medium">{emptyTitle}</p>
                  {emptyDescription && <p className="mt-1 text-sm text-sf-muted">{emptyDescription}</p>}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const key = keyFn(row)
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-sf-border transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-sf-accent/5',
                      selectedKey === key && 'bg-sf-accent/10',
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-2.5 align-top', col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  compact,
}: {
  title: string
  description?: string
  actions?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={cn(
      'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between',
      compact ? 'mb-3' : 'mb-6',
    )}>
      <div>
        <h1 className={cn('font-semibold tracking-tight', compact ? 'text-lg' : 'text-2xl')}>{title}</h1>
        {description && <p className={cn('text-sf-muted', compact ? 'text-xs mt-0.5' : 'mt-1 text-sm')}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const colors =
    s === 'CONNECTED' || s === 'HEALTHY' || s === 'STABLE'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      : s === 'UNREACHABLE' || s === 'DEGRADED' || s === 'DEAD'
        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
        : 'bg-sf-border/40 text-sf-muted border-sf-border'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', colors)}>
      {status}
    </span>
  )
}
