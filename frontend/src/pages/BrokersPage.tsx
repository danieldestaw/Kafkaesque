import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api, type Broker } from '../api/client'
import { RequireCluster } from '../components/ClusterEmptyState'
import { useClusterId } from '../hooks/useClusterId'
import { Button } from '../components/ui/Button'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { RowActionsMenu, type RowAction } from '../components/ui/RowActionsMenu'

function brokerStatus(b: Broker) {
  return b.partition_count >= 0 ? 'ONLINE' : 'UNKNOWN'
}

function BrokersContent() {
  const clusterId = useClusterId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const highlightBroker = params.get('broker')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Broker | null>(null)

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['brokers', clusterId],
    queryFn: () => api.brokers(clusterId),
    enabled: !!clusterId,
  })

  const refresh = useMutation({
    mutationFn: () => qc.invalidateQueries({ queryKey: ['brokers', clusterId] }),
  })

  const brokers = data?.items || []

  const brokerActions = (b: Broker): RowAction[] => [
    {
      label: 'View details',
      onClick: () => setSelected(b),
    },
    {
      label: 'View partitions',
      onClick: () => navigate(`/topics?broker=${b.id}`),
    },
    {
      label: 'Refresh',
      onClick: () => refresh.mutate(),
    },
  ]

  return (
    <>
      <PageHeader
        title="Brokers"
        description="Inspect broker nodes, controller role, and partition leadership."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refresh.mutate()} loading={isFetching || refresh.isPending}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Filter by broker ID or host…"
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
            key: 'role',
            header: 'Role',
            render: (b) => (b.is_controller ? <StatusBadge status="Controller" /> : 'Broker'),
          },
          {
            key: 'controller',
            header: 'Controller',
            render: (b) => (b.is_controller ? 'Yes' : 'No'),
          },
          {
            key: 'partitions',
            header: 'Leader partitions',
            render: (b) => b.partition_count,
            className: 'text-right',
          },
          {
            key: 'status',
            header: 'Status',
            render: (b) => <StatusBadge status={brokerStatus(b)} />,
          },
          {
            key: 'actions',
            header: 'Actions',
            className: 'w-16 text-right',
            render: (b) => (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <RowActionsMenu actions={brokerActions(b)} label={`Actions for broker ${b.id}`} />
              </div>
            ),
          },
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
              <dt className="text-xs text-sf-muted">Status</dt>
              <dd className="mt-1"><StatusBadge status={brokerStatus(selected)} /></dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Role</dt>
              <dd className="mt-1">{selected.is_controller ? 'Controller' : 'Broker'}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Leader partitions</dt>
              <dd className="mt-1 font-mono">{selected.partition_count}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-sf-muted">Host</dt>
              <dd className="mt-1 font-mono">{selected.host}:{selected.port}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Rack</dt>
              <dd className="mt-1">{selected.rack || '—'}</dd>
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
