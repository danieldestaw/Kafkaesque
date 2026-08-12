import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { api, type Broker } from '../api/client'
import { RequireCluster } from '../components/ClusterEmptyState'
import { useClusterId } from '../hooks/useClusterId'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'

function BrokersContent() {
  const clusterId = useClusterId()
  const [params] = useSearchParams()
  const highlightBroker = params.get('broker')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Broker | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['brokers', clusterId],
    queryFn: () => api.brokers(clusterId),
    enabled: !!clusterId,
  })

  const brokers = data?.items || []

  return (
    <>
      <PageHeader
        title="Brokers"
        description="Inspect broker nodes and partition leadership."
      />

      <div className="mb-4">
        <Input
          placeholder="Filter brokers…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={[
          { key: 'id', header: 'ID', render: (b) => <span className="font-mono">{b.id}</span>, className: 'text-right' },
          {
            key: 'host',
            header: 'Host',
            render: (b) => <span className="font-mono text-xs">{b.host}:{b.port}</span>,
          },
          { key: 'rack', header: 'Rack', render: (b) => b.rack || '—' },
          {
            key: 'controller',
            header: 'Role',
            render: (b) => (b.is_controller ? <StatusBadge status="Controller" /> : 'Broker'),
          },
          { key: 'partitions', header: 'Leader Partitions', render: (b) => b.partition_count, className: 'text-right' },
        ]}
        data={brokers}
        keyFn={(b) => String(b.id)}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No brokers found"
        filter={filter}
        filterFn={(b, f) =>
          String(b.id).includes(f) ||
          b.host.toLowerCase().includes(f.toLowerCase())
        }
        onRowClick={setSelected}
        selectedKey={selected ? String(selected.id) : highlightBroker || undefined}
      />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Broker ${selected?.id}`}
      >
        {selected && (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-sf-muted">Broker ID</dt>
              <dd className="mt-1 font-mono">{selected.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Controller</dt>
              <dd className="mt-1">{selected.is_controller ? 'Yes' : 'No'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-sf-muted">Host</dt>
              <dd className="mt-1 font-mono">{selected.host}:{selected.port}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Rack</dt>
              <dd className="mt-1">{selected.rack || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Leader partitions</dt>
              <dd className="mt-1 font-mono">{selected.partition_count}</dd>
            </div>
          </dl>
        )}
      </Drawer>
    </>
  )
}

export default function BrokersPage() {
  return (
    <RequireCluster resource="brokers">
      <BrokersContent />
    </RequireCluster>
  )
}
