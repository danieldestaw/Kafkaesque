import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { api } from '../api/client'
import { cn } from '../lib/cn'
import { Button } from './ui/Button'

type AuditEntry = {
  id?: string
  created_at: string
  action: string
  resource: string
  result: string
  user_email?: string
}

const READ_AT_KEY = 'sf_notifications_read_at'

function formatActivity(entry: AuditEntry) {
  const action = entry.action.replace(/_/g, ' ').toLowerCase()
  const resource = entry.resource.replace(/^[^:]+:/, '')
  if (entry.action.startsWith('LOGIN')) {
    return `User ${entry.user_email || 'unknown'} ${action}`
  }
  return `${action} — ${resource}`
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [readAt, setReadAt] = useState(() => Number(localStorage.getItem(READ_AT_KEY) || 0))

  const { data } = useQuery({
    queryKey: ['audit', 'notifications'],
    queryFn: () => api.audit(),
    refetchInterval: 60_000,
  })

  const entries = useMemo(
    () => ((data?.items as AuditEntry[]) ?? []).slice(0, 20),
    [data?.items],
  )

  const unreadCount = useMemo(
    () => entries.filter((e) => new Date(e.created_at).getTime() > readAt).length,
    [entries, readAt],
  )

  const markAllRead = useCallback(() => {
    const now = Date.now()
    localStorage.setItem(READ_AT_KEY, String(now))
    setReadAt(now)
  }, [])

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-md p-2 text-sf-muted hover:bg-sf-border/30 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sf-accent px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-sf-border bg-sf-panel shadow-xl">
            <div className="flex items-center justify-between border-b border-sf-border px-4 py-3">
              <h3 className="text-sm font-semibold">Activity</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-sf-accent hover:underline"
                  onClick={markAllRead}
                >
                  Mark all as read
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-auto py-1">
              {entries.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-sf-muted">No recent activity</li>
              ) : (
                entries.map((e) => {
                  const isUnread = new Date(e.created_at).getTime() > readAt
                  return (
                    <li key={`${e.created_at}-${e.action}-${e.resource}`}>
                      <button
                        type="button"
                        className={cn(
                          'w-full text-left px-4 py-2.5 hover:bg-sf-border/30 transition-colors',
                          isUnread && 'bg-sf-accent/5',
                        )}
                        onClick={() => {
                          setOpen(false)
                          navigate('/audit')
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {isUnread && (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sf-accent" />
                          )}
                          <div className={cn('min-w-0 flex-1', !isUnread && 'ml-3.5')}>
                            <p className="text-xs leading-relaxed truncate">{formatActivity(e)}</p>
                            <p className="text-[10px] text-sf-muted mt-0.5">{relativeTime(e.created_at)}</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            <div className="border-t border-sf-border px-4 py-2">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => { setOpen(false); navigate('/audit') }}>
                View full audit log
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
