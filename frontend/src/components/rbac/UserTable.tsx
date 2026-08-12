import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { RoleBadge, UserStatusBadge } from './Badges'
import { cn } from '../../lib/cn'

export type UserRow = {
  id: string
  display_name: string
  email: string
  role: string
  is_active?: boolean
  last_login?: string
}

type Action = {
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
  disabledReason?: string
}

type Props = {
  users: UserRow[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (user: UserRow) => void
  rowActions?: (user: UserRow) => Action[]
}

export function UserTable({
  users,
  loading,
  emptyTitle = 'No users',
  emptyDescription,
  onRowClick,
  rowActions,
}: Props) {
  const [menu, setMenu] = useState<{ userId: string; x: number; y: number } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [menu])

  const openMenu = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ userId, x: rect.right - 192, y: rect.bottom + 4 })
  }

  const menuUser = menu ? users.find((u) => u.id === menu.userId) : null
  const menuActions = menuUser ? rowActions?.(menuUser) ?? [] : []

  if (loading) {
    return (
      <div className="rounded-xl border border-sf-border overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-sf-border animate-pulse bg-sf-border/20" />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-sf-border px-6 py-12 text-center bg-sf-panel">
        <p className="font-medium">{emptyTitle}</p>
        {emptyDescription && <p className="text-sm text-sf-muted mt-1">{emptyDescription}</p>}
      </div>
    )
  }

  return (
    <>
      <div ref={tableRef} className="rounded-xl border border-sf-border bg-sf-panel w-full">
        <table className="w-full text-sm">
          <thead className="bg-sf-bg/50 border-b border-sf-border">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-sf-muted">User</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-sf-muted">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-sf-muted">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-sf-muted">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-sf-muted">Last login</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const actions = rowActions?.(u) ?? []
              return (
                <tr
                  key={u.id}
                  className={cn(
                    'border-b border-sf-border last:border-0 h-11',
                    onRowClick && 'cursor-pointer hover:bg-sf-accent/5',
                  )}
                  onClick={() => onRowClick?.(u)}
                >
                  <td className="px-4 py-2 font-medium">{u.display_name || u.email}</td>
                  <td className="px-4 py-2 text-sf-muted">{u.email}</td>
                  <td className="px-4 py-2"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-2"><UserStatusBadge active={u.is_active !== false} /></td>
                  <td className="px-4 py-2 text-xs text-sf-muted tabular-nums">{u.last_login ?? '—'}</td>
                  <td className="px-2 py-2">
                    {actions.length > 0 && (
                      <button
                        type="button"
                        className="p-1.5 rounded-md hover:bg-sf-border/40 text-sf-muted"
                        onClick={(e) => openMenu(e, u.id)}
                        aria-label="User actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {menu &&
        createPortal(
          <div
            className="fixed z-[100] w-48 rounded-lg border border-sf-border bg-sf-panel shadow-xl py-1"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {menuActions.map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={a.disabled}
                title={a.disabled ? a.disabledReason : undefined}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-sf-border/30 disabled:opacity-50 disabled:cursor-not-allowed',
                  a.destructive && 'text-red-600 dark:text-red-400',
                )}
                onClick={() => {
                  setMenu(null)
                  a.onClick()
                }}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

export function FeatureNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
      <p className="font-medium text-amber-700 dark:text-amber-400">{title}</p>
      <div className="mt-1 text-sf-muted leading-relaxed">{children}</div>
    </div>
  )
}
