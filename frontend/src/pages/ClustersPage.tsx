import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api, type Cluster } from '../api/client'
import { useDialogs } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'

export default function ClustersPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { openAddCluster } = useDialogs()
  const [deleteTarget, setDeleteTarget] = useState<Cluster | null>(null)

  const { data, isLoading, error } = useQuery({ queryKey: ['clusters'], queryFn: () => api.clusters() })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCluster(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clusters'] })
      toast.success('Cluster removed')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const test = useMutation({
    mutationFn: (id: string) => api.testCluster(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['clusters'] })
      if (r.connected) toast.success(`Connected — ${r.broker_count ?? 0} brokers`)
      else toast.error(r.error || 'Connection failed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <PageHeader
        title="Clusters"
        description="Manage Kafka cluster connections. Credentials stay encrypted on the server."
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
          { key: 'env', header: 'Environment', render: (c) => c.environment },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          {
            key: 'error',
            header: 'Error',
            render: (c) => (
              <span className="text-xs text-red-500 max-w-xs truncate block">{c.last_error || '—'}</span>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (c) => (
              <div className="flex items-center gap-1">
                <PermissionGuard permission="cluster.read">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); test.mutate(c.id) }}
                    className="p-1.5 text-sf-muted hover:text-sf-accent transition-colors rounded"
                    aria-label="Test connection"
                    title="Test connection"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${test.isPending ? 'animate-spin' : ''}`} />
                  </button>
                </PermissionGuard>
                <PermissionGuard permission="cluster.manage">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
                    className="p-1.5 text-sf-muted hover:text-red-500 transition-colors rounded"
                    aria-label="Delete cluster"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        title="Remove cluster?"
        description="This removes the cluster configuration from Kafkaesque. Kafka data is not affected."
        resourceName={deleteTarget?.name}
        confirmLabel="Remove cluster"
        loading={remove.isPending}
      />
    </>
  )
}
