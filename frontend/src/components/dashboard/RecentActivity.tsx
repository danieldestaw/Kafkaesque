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
  const resource = entry.resource.replace(/^[^:]+:/, '')
  if (entry.action.includes('TOPIC') && entry.action.includes('CREAT')) {
    return `Topic ${resource} created`
  }
  if (entry.action.includes('CONSUMER') || entry.action.includes('GROUP')) {
    return `Consumer group ${resource} joined`
  }
  if (entry.action.startsWith('LOGIN')) {
    return `User ${entry.user_email || 'unknown'} ${action}`
  }
  if (entry.action.includes('UPDAT')) {
    return `Topic ${resource} updated`
  }
  if (entry.action.includes('BROKER') || entry.action.includes('HEARTBEAT')) {
    return `Broker ${resource} heartbeat`
  }
  return `${action} — ${resource}`
}

function ResultBadge({ result }: { result: string }) {
  const r = result.toUpperCase()
  const style =
    r === 'SUCCESS'
      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
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
  return (
    <DashboardPanel
      title="Recent Activity"
      footer={<WidgetFooterLink to="/audit" label="View all activity" />}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-sf-muted py-6 text-center">No recent activity.</p>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((e) => (
            <li key={`${e.created_at}-${e.action}-${e.resource}`} className="flex gap-2 text-sm items-start">
              <time className="text-[10px] text-sf-muted font-mono shrink-0 pt-0.5 tabular-nums w-14">
                {new Date(e.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </time>
              <span className="text-xs leading-snug flex-1 min-w-0">{activityLabel(e)}</span>
              <ResultBadge result={e.result} />
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}
