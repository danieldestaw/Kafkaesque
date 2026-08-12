import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { api, type ConsumerGroup } from '../api/client'
import { RequireCluster } from '../components/ClusterEmptyState'
import { useClusterId } from '../hooks/useClusterId'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'

function ConsumersContent() {
  const clusterId = useClusterId()
  const [params] = useSearchParams()
  const highlightGroup = params.get('group')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<ConsumerGroup | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['consumers', clusterId],
    queryFn: () => api.consumerGroups(clusterId),
    enabled: !!clusterId,
  })

  const groups = (data?.items as ConsumerGroup[]) || []

  return (
    <>
      <PageHeader
        title="Consumer Groups"
        description="Monitor consumer group state and lag."
      />

      <div className="mb-4">
        <Input
          placeholder="Filter consumer groups…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={[
          {
            key: 'group',
            header: 'Group ID',
            render: (g) => <span className="font-mono text-xs">{g.group_id}</span>,
          },
          { key: 'state', header: 'State', render: (g) => <StatusBadge status={g.state} /> },
          { key: 'members', header: 'Members', render: (g) => g.members, className: 'text-right' },
          { key: 'topics', header: 'Topics', render: (g) => g.topics, className: 'text-right' },
          { key: 'lag', header: 'Total Lag', render: (g) => g.total_lag, className: 'text-right font-mono text-xs' },
          { key: 'max', header: 'Max Lag', render: (g) => g.max_lag, className: 'text-right font-mono text-xs' },
        ]}
        data={groups}
        keyFn={(g) => g.group_id}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No consumer groups"
        filter={filter}
        filterFn={(g, f) => g.group_id.toLowerCase().includes(f.toLowerCase())}
        onRowClick={setSelected}
        selectedKey={selected?.group_id || highlightGroup || undefined}
      />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.group_id || 'Consumer Group'}
      >
        {selected && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-sf-muted">State</dt>
              <dd className="mt-1"><StatusBadge status={selected.state} /></dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Members</dt>
              <dd className="mt-1 font-mono">{selected.members}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Total lag</dt>
              <dd className="mt-1 font-mono text-lg">{selected.total_lag.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Max lag</dt>
              <dd className="mt-1 font-mono">{selected.max_lag.toLocaleString()}</dd>
            </div>
            {selected.total_lag > 1000 && (
              <p className="text-amber-600 dark:text-amber-400 text-xs rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                ⚠ Consumer group has high lag
              </p>
            )}
          </dl>
        )}
      </Drawer>
    </>
  )
}

export default function ConsumersPage() {
  return (
    <RequireCluster resource="consumer groups">
      <ConsumersContent />
    </RequireCluster>
  )
}
