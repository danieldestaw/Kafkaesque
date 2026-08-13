import { CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { DashboardPanel, WidgetFooterLink } from './DashboardWidget'

export type AuditEntry = {
  created_at: string
  action: string
  resource: string
  result: string
  user_email?: string
}

function activityLabel(entry: AuditEntry) {
  const action = entry.action.replace(/_/g, ' ').toLowerCase()
  const resource = entry.resource.replace(/^[^:]+:/, '').replace(/^topic:/i, '')
  if (entry.action.includes('TOPIC') && entry.action.includes('CREAT')) {
    return `Topic '${resource}' created`
  }
  if (entry.action.includes('CONSUMER') || entry.action.includes('GROUP')) {
    return `Consumer group ${resource} joined`
  }
  if (entry.action.startsWith('LOGIN')) {
    return `User ${entry.user_email || 'unknown'} login success`
  }
  if (entry.action.includes('PUBLISH')) {
    return `Message published to ${resource}`
  }
  if (entry.action.includes('UPDAT')) {
    return `Topic '${resource}' updated`
  }
  return `${action} — ${resource}`
}

function ResultBadge({ result }: { result: string }) {
  const r = result.toUpperCase()
  const style =
    r === 'SUCCESS'
      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25'
      : r === 'FAILURE'
        ? 'bg-red-500/15 text-red-500 border-red-500/25'
        : 'bg-blue-500/15 text-blue-400 border-blue-500/25'
  const label = r === 'SUCCESS' ? 'SUCCESS' : r === 'FAILURE' ? 'FAILED' : 'INFO'
  return (
    <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide', style)}>
      {label}
    </span>
  )
}

export function RecentActivity({ entries }: { entries: AuditEntry[] }) {
  const visible = entries.slice(0, 4)
  return (
    <DashboardPanel
      title="Recent Activity"
      compact
      footer={<WidgetFooterLink to="/audit" label="View all activity" />}
    >
      {visible.length === 0 ? (
        <p className="text-sm text-sf-muted py-4 text-center">No recent activity.</p>
      ) : (
        <ul className="space-y-2 overflow-hidden">
          {visible.map((e) => (
            <li key={`${e.created_at}-${e.action}-${e.resource}`} className="flex items-start gap-2 text-[11px]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <time className="w-[4.5rem] shrink-0 font-mono text-[9px] tabular-nums text-sf-muted">
                {new Date(e.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </time>
              <span className="min-w-0 flex-1 truncate leading-snug">{activityLabel(e)}</span>
              <ResultBadge result={e.result} />
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}
