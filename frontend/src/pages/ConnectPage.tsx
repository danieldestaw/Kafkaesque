import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { api, type ConnectorInfo } from '../api/client'
import { RequireCluster } from '../components/ClusterEmptyState'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { useClusterId } from '../hooks/useClusterId'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'
import { Drawer } from '../components/ui/Drawer'
import { RowActionsMenu, type RowAction } from '../components/ui/RowActionsMenu'
import { useToast } from '../context/ToastContext'

const DEMO_CONNECTOR = {
  name: 'demo-heartbeat',
  config: {
    'connector.class': 'org.apache.kafka.connect.mirror.MirrorHeartbeatConnector',
    'tasks.max': '1',
    'source.cluster.alias': 'source',
    'target.cluster.alias': 'target',
    'source.cluster.bootstrap.servers': 'kafka:9092',
    'target.cluster.bootstrap.servers': 'kafka:9092',
    'replication.factor': '1',
    'emit.heartbeats.interval.seconds': '30',
  },
}

function taskSummary(c: ConnectorInfo) {
  const tasks = c.tasks ?? []
  if (tasks.length === 0) return '—'
  const running = tasks.filter((t) => t.state === 'RUNNING').length
  return `${running}/${tasks.length} running`
}

function connectorClassName(c: ConnectorInfo) {
  return c.config?.['connector.class'] || c.type || ''
}

function connectorTypeLabel(c: ConnectorInfo) {
  const cls = connectorClassName(c)
  if (!cls) return '—'
  return cls.split('.').pop() || cls
}

function ConnectorDetail({ connector }: { connector: ConnectorInfo }) {
  const fullClass = connectorClassName(connector)

  return (
    <dl className="grid gap-4 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="min-w-0">
          <dt className="text-xs text-sf-muted">Name</dt>
          <dd className="mt-1 truncate font-mono text-xs">{connector.name}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-sf-muted">State</dt>
          <dd className="mt-1"><StatusBadge status={connector.state || 'UNKNOWN'} /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-sf-muted">Type</dt>
          <dd className="mt-1 truncate">{connectorTypeLabel(connector)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-sf-muted">Tasks</dt>
          <dd className="mt-1">{taskSummary(connector)}</dd>
        </div>
      </div>

      {fullClass && (
        <div className="min-w-0">
          <dt className="text-xs text-sf-muted">Connector class</dt>
          <dd className="mt-1 break-all rounded-lg border border-sf-border bg-sf-input/40 p-2 font-mono text-[10px] leading-relaxed text-sf-muted">
            {fullClass}
          </dd>
        </div>
      )}

      {connector.tasks && connector.tasks.length > 0 && (
        <div className="min-w-0">
          <dt className="mb-2 text-xs text-sf-muted">Task status</dt>
          <dd className="overflow-auto rounded-lg border border-sf-border">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-sf-input/60">
                <tr>
                  <th className="w-12 px-2 py-1.5 text-left">Task</th>
                  <th className="w-24 px-2 py-1.5 text-left">State</th>
                  <th className="px-2 py-1.5 text-left">Worker</th>
                </tr>
              </thead>
              <tbody>
                {connector.tasks.map((t) => (
                  <tr key={t.id} className="border-t border-sf-border/60">
                    <td className="px-2 py-1.5 font-mono">{t.id}</td>
                    <td className="px-2 py-1.5"><StatusBadge status={t.state} /></td>
                    <td className="truncate px-2 py-1.5 font-mono text-[10px]" title={t.worker_id || undefined}>
                      {t.worker_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </dd>
        </div>
      )}

      {connector.config && Object.keys(connector.config).length > 0 && (
        <div>
          <dt className="mb-2 text-xs text-sf-muted">Configuration</dt>
          <dd className="max-h-48 overflow-auto rounded-lg border border-sf-border bg-sf-input/30 p-3 font-mono text-[10px] leading-relaxed">
            {Object.entries(connector.config).map(([k, v]) => (
              <div key={k}>
                <span className="text-sf-muted">{k}=</span>
                {v}
              </div>
            ))}
          </dd>
        </div>
      )}
    </dl>
  )
}

function ConnectContent() {
  const clusterId = useClusterId()
  const qc = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [viewConnector, setViewConnector] = useState<ConnectorInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConnectorInfo | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['connectors', clusterId],
    queryFn: () => api.connectors(clusterId),
    enabled: !!clusterId,
    refetchInterval: 10_000,
  })

  const restart = useMutation({
    mutationFn: (name: string) => api.restartConnector(clusterId, name),
    onSuccess: () => {
      toast.success('Connector restarted')
      qc.invalidateQueries({ queryKey: ['connectors', clusterId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (name: string) => api.deleteConnector(clusterId, name),
    onSuccess: () => {
      toast.success('Connector deleted')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['connectors', clusterId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const seedDemo = useMutation({
    mutationFn: () => api.createConnector(clusterId, DEMO_CONNECTOR),
    onSuccess: () => {
      toast.success('Demo connector created')
      qc.invalidateQueries({ queryKey: ['connectors', clusterId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const connectors = (data?.items as ConnectorInfo[]) ?? []
  const filtered = connectors.filter((c) => {
    if (stateFilter && (c.state || 'UNKNOWN').toUpperCase() !== stateFilter) return false
    return true
  })

  const connectorActions = (c: ConnectorInfo): RowAction[] => [
    { label: 'View details', onClick: () => setViewConnector(c) },
    {
      label: 'Restart',
      onClick: () => restart.mutate(c.name),
    },
    {
      label: 'Delete',
      destructive: true,
      onClick: () => setDeleteTarget(c),
    },
  ]

  return (
    <>
      <PageHeader
        title="Kafka Connect"
        description="Monitor connector status, tasks, and workers."
        actions={
          <PermissionGuard permission="connect.manage">
            <Button variant="secondary" onClick={() => seedDemo.mutate()} loading={seedDemo.isPending}>
              <Plus className="h-4 w-4" /> Add demo connector
            </Button>
          </PermissionGuard>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Filter connectors…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-lg border border-sf-border bg-sf-input px-3 py-2 text-sm"
        >
          <option value="">All states</option>
          <option value="RUNNING">Running</option>
          <option value="PAUSED">Paused</option>
          <option value="FAILED">Failed</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isFetching}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (c) => <span className="font-mono text-xs">{c.name}</span> },
          { key: 'state', header: 'State', render: (c) => <StatusBadge status={c.state || 'UNKNOWN'} /> },
          {
            key: 'tasks',
            header: 'Tasks',
            render: (c) => (
              <span className="text-xs">
                {c.tasks?.length ?? 0}
                {c.tasks && c.tasks.length > 0 && (
                  <span className="text-sf-muted"> ({taskSummary(c)})</span>
                )}
              </span>
            ),
          },
          {
            key: 'worker',
            header: 'Worker',
            render: (c) => (
              <span className="font-mono text-[10px] text-sf-muted">
                {c.tasks?.[0]?.worker_id?.split(':')[0] || '—'}
              </span>
            ),
          },
          {
            key: 'type',
            header: 'Type',
            className: 'max-w-[140px]',
            render: (c) => (
              <span className="block truncate text-xs" title={connectorClassName(c) || undefined}>
                {connectorTypeLabel(c)}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            className: 'w-16 text-right',
            render: (c) => (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <PermissionGuard permission="connect.manage">
                  <RowActionsMenu actions={connectorActions(c)} label={`Actions for ${c.name}`} />
                </PermissionGuard>
              </div>
            ),
          },
        ]}
        data={filtered}
        keyFn={(c) => c.name}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No connectors"
        emptyDescription='Click "Add demo connector" to register a test connector, or ensure connect_url is set on the cluster.'
        filter={filter}
        filterFn={(c, f) => c.name.toLowerCase().includes(f.toLowerCase())}
        onRowClick={setViewConnector}
      />

      <Drawer open={!!viewConnector} onClose={() => setViewConnector(null)} title={viewConnector?.name || 'Connector'}>
        {viewConnector && (
          <>
            <ConnectorDetail connector={viewConnector} />
            <PermissionGuard permission="connect.manage">
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => restart.mutate(viewConnector.name)} loading={restart.isPending}>
                  Restart
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(viewConnector)}>
                  Delete
                </Button>
              </div>
            </PermissionGuard>
          </>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.name)}
        title="Delete connector?"
        description="This removes the connector from Kafka Connect."
        resourceName={deleteTarget?.name}
        confirmLabel="Delete connector"
        loading={remove.isPending}
      />
    </>
  )
}

export default function ConnectPage() {
  return (
    <RequireCluster resource="connectors">
      <ConnectContent />
    </RequireCluster>
  )
}
