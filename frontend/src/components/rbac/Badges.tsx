import { cn } from '../../lib/cn'
import type { Role } from '../../auth/permissions'

const roleStyles: Record<Role, string> = {
  ADMIN: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  OPERATOR: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  DEVELOPER: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  VIEWER: 'bg-sf-border/40 text-sf-muted border-sf-border',
}

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrator',
  OPERATOR: 'Operator',
  DEVELOPER: 'Developer',
  VIEWER: 'Viewer',
}

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const r = role.toUpperCase() as Role
  const style = roleStyles[r] ?? roleStyles.VIEWER
  const label = roleLabels[r] ?? role

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', style, className)}>
      {label}
    </span>
  )
}

export function PermissionBadge({ permission }: { permission: string }) {
  return (
    <span className="inline-flex items-center rounded border border-sf-border bg-sf-bg px-1.5 py-0.5 font-mono text-[10px] text-sf-muted">
      {permission}
    </span>
  )
}

export function UserStatusBadge({ active = true }: { active?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        active
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
          : 'bg-sf-border/40 text-sf-muted border-sf-border',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-sf-muted')} />
      {active ? 'Active' : 'Disabled'}
    </span>
  )
}

export function UserAvatar({ name, email, size = 'md' }: { name?: string; email?: string; size?: 'sm' | 'md' }) {
  const initial = (name || email || '?').charAt(0).toUpperCase()
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-sf-accent/15 font-medium text-sf-accent',
        size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm',
      )}
    >
      {initial}
    </div>
  )
}
