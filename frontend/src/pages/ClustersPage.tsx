import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api, type Cluster } from '../api/client'
import { useDialogs } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Drawer } from '../components/ui/Drawer'
import { RowActionsMenu, type RowAction } from '../components/ui/RowActionsMenu'

function formatWhen(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function ClusterDetail({ cluster }: { cluster: Cluster }) {
  return (
    <dl className="grid gap-4 text-sm">
      <div className="rounded-lg border border-sf-border bg-sf-input/40 p-3 text-xs text-sf-muted leading-relaxed">
        This is the Kafkaesque connection record only. Removing it does not delete brokers, topics, or data in Kafka.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-sf-muted">Name</dt>
          <dd className="mt-1 font-medium">{cluster.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-sf-muted">Environment</dt>
          <dd className="mt-1">{cluster.environment}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-sf-muted">Bootstrap servers</dt>
          <dd className="mt-1 font-mono text-xs break-all">{cluster.bootstrap_servers}</dd>
        </div>
        <div>
          <dt className="text-xs text-sf-muted">Status</dt>
          <dd className="mt-1"><StatusBadge status={cluster.status} /></dd>
        </div>
        <div>
          <dt className="text-xs text-sf-muted">Kafka version</dt>
          <dd className="mt-1 font-mono text-xs">{cluster.kafka_version || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-sf-muted">Last connected</dt>
          <dd className="mt-1 text-xs">{formatWhen(cluster.last_connected_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-sf-muted">Schema Registry</dt>
          <dd className="mt-1 font-mono text-xs break-all">{cluster.schema_registry_url || '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-sf-muted">Kafka Connect URL</dt>
          <dd className="mt-1 font-mono text-xs break-all">{cluster.connect_url || '—'}</dd>
        </div>
        {cluster.last_error && (
          <div className="col-span-2">
            <dt className="text-xs text-sf-muted">Last error</dt>
            <dd className="mt-1 text-xs text-red-600 dark:text-red-400">{cluster.last_error}</dd>
          </div>
        )}
      </div>
    </dl>
  )
}

export default function ClustersPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { openAddCluster } = useDialogs()
  const [deleteTarget, setDeleteTarget] = useState<Cluster | null>(null)
  const [viewTarget, setViewTarget] = useState<Cluster | null>(null)
  const [editMode, setEditMode] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['clusters'], queryFn: () => api.clusters() })

  const detail = useQuery({
    queryKey: ['cluster', viewTarget?.id],
    queryFn: () => api.getCluster(viewTarget!.id),
    enabled: !!viewTarget?.id,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCluster(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clusters'] })
      toast.success('Cluster removed from Kafkaesque')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const test = useMutation({
    mutationFn: (id: string) => api.testCluster(id),
    onSuccess: (r, id) => {
      qc.invalidateQueries({ queryKey: ['clusters'] })
      if (viewTarget?.id === id) qc.invalidateQueries({ queryKey: ['cluster', id] })
      if (r.connected) toast.success(`Connected — ${r.broker_count ?? 0} brokers`)
      else toast.error(r.error || 'Connection failed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clusterActions = (c: Cluster): RowAction[] => [
    {
      label: 'View',
      onClick: () => {
        setEditMode(false)
        setViewTarget(c)
      },
    },
    {
      label: 'Edit',
      onClick: () => {
        setEditMode(true)
        setViewTarget(c)
      },
    },
    {
      label: 'Test connection',
      onClick: () => test.mutate(c.id),
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
        title="Clusters"
        description="Manage Kafka cluster connections stored in Kafkaesque. Credentials stay encrypted on the server."
        actions={
          <PermissionGuard permission="cluster.manage">
            <Button onClick={openAddCluster}>
              <Plus className="h-4 w-4" /> Add cluster
            </Button>
          </PermissionGuard>
        }
      />

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
          {
            key: 'bootstrap',
            header: 'Bootstrap',
            render: (c) => <span className="font-mono text-xs">{c.bootstrap_servers}</span>,
          },
          {
            key: 'version',
            header: 'Version',
            render: (c) => <span className="font-mono text-xs">{c.kafka_version || '—'}</span>,
          },
          { key: 'env', header: 'Environment', render: (c) => c.environment },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          {
            key: 'connected',
            header: 'Last connected',
            render: (c) => <span className="text-xs text-sf-muted">{formatWhen(c.last_connected_at)}</span>,
          },
          {
            key: 'integrations',
            header: 'Integrations',
            render: (c) => (
              <span className="text-xs text-sf-muted">
                {[c.schema_registry_url && 'Schema Registry', c.connect_url && 'Connect'].filter(Boolean).join(', ') || '—'}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            className: 'w-16 text-right',
            render: (c) => (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <PermissionGuard permission="cluster.read">
                  <RowActionsMenu actions={clusterActions(c)} label={`Actions for ${c.name}`} />
                </PermissionGuard>
              </div>
            ),
          },
        ]}
        data={data?.items || []}
        keyFn={(c) => c.id}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No clusters configured"
        emptyDescription="Add a cluster to get started."
        onRowClick={(c) => {
          setEditMode(false)
          setViewTarget(c)
        }}
      />

      <Drawer
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title={editMode ? `Edit — ${viewTarget?.name}` : viewTarget?.name || 'Cluster'}
      >
        {viewTarget && (
          <>
            {editMode && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                Connection settings cannot be updated in place. Remove this cluster from Kafkaesque and add it again with new settings. Your Kafka cluster and data are not affected.
              </div>
            )}
            <ClusterDetail cluster={detail.data || viewTarget} />
            <div className="mt-6 flex flex-wrap gap-2">
              <PermissionGuard permission="cluster.read">
                <Button variant="secondary" size="sm" onClick={() => test.mutate(viewTarget.id)} loading={test.isPending}>
                  Test connection
                </Button>
              </PermissionGuard>
              <PermissionGuard permission="cluster.manage">
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(viewTarget)}>
                  Remove from Kafkaesque
                </Button>
              </PermissionGuard>
            </div>
          </>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        title="Remove cluster from Kafkaesque?"
        description="This only removes the cluster connection from Kafkaesque. It does not delete your Kafka cluster, brokers, topics, messages, or consumer groups."
        resourceName={deleteTarget?.name}
        confirmLabel="Remove from Kafkaesque"
        loading={remove.isPending}
      />
    </>
  )
}
