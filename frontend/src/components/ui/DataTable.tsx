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
    <div className="overflow-hidden rounded-xl border border-sf-border bg-sf-panel shadow-sm">
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-12rem)] sm:max-h-[calc(100vh-14rem)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-sf-border bg-sf-input/80">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sf-muted sm:px-4',
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
                <tr key={i} className="border-b border-sf-border/60">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-sf-input" />
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
                      'border-b border-sf-border/60 transition-colors last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-sf-primary-light/40',
                      selectedKey === key && 'bg-sf-primary-light/60',
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-3 py-2.5 align-top sm:px-4', col.className)}>
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
        <h1 className={cn('font-heading font-bold tracking-tight', compact ? 'text-lg' : 'text-2xl')}>{title}</h1>
        {description && <p className={cn('text-sf-muted', compact ? 'text-xs mt-0.5' : 'mt-1 text-sm')}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const colors =
    s === 'CONNECTED' || s === 'HEALTHY' || s === 'STABLE' || s === 'ONLINE' || s === 'RUNNING'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
      : s === 'UNREACHABLE' || s === 'DEGRADED' || s === 'DEAD' || s === 'FAILED'
        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
        : s === 'RUNNING'
          ? 'bg-sf-primary-light text-sf-primary border-sf-primary/20'
          : 'bg-sf-input text-sf-muted border-sf-border'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', colors)}>
      {status}
    </span>
  )
}
