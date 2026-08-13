import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'

type AuditEntry = {
  created_at: string
  user_email: string
  action: string
  resource: string
  result: string
  reason?: string
}

export default function AuditPage() {
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['audit'], queryFn: () => api.audit() })

  const entries = (data?.items as AuditEntry[]) || []

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Sensitive operations recorded for compliance and troubleshooting."
      />

      <div className="mb-4">
        <Input
          placeholder="Filter by action, user, resource…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={[
          {
            key: 'time',
            header: 'Time',
            render: (a) => (
              <span className="text-xs whitespace-nowrap">
                {new Date(a.created_at).toLocaleString()}
              </span>
            ),
          },
          { key: 'user', header: 'User', render: (a) => a.user_email || '—' },
          { key: 'action', header: 'Action', render: (a) => <span className="font-mono text-xs">{a.action}</span> },
          { key: 'resource', header: 'Resource', render: (a) => <span className="text-xs">{a.resource}</span> },
          { key: 'result', header: 'Result', render: (a) => <StatusBadge status={a.result} /> },
        ]}
        data={entries}
        keyFn={(a) => `${a.created_at}-${a.action}-${a.resource}`}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No audit entries"
        filter={filter}
        filterFn={(a, f) => {
          const q = f.toLowerCase()
          return (
            a.action.toLowerCase().includes(q) ||
            (a.user_email || '').toLowerCase().includes(q) ||
            a.resource.toLowerCase().includes(q)
          )
        }}
        onRowClick={setSelected}
      />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Audit event">
        {selected && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-sf-muted">Timestamp</dt>
              <dd className="mt-1">{new Date(selected.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">User</dt>
              <dd className="mt-1">{selected.user_email}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Action</dt>
              <dd className="mt-1 font-mono">{selected.action}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Resource</dt>
              <dd className="mt-1">{selected.resource}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Result</dt>
              <dd className="mt-1"><StatusBadge status={selected.result} /></dd>
            </div>
            {selected.reason && (
              <div>
                <dt className="text-xs text-sf-muted">Reason</dt>
                <dd className="mt-1">{selected.reason}</dd>
              </div>
            )}
          </dl>
        )}
      </Drawer>
    </>
  )
}
