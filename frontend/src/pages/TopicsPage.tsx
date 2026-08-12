import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api, type Topic } from '../api/client'
import { useClusterId } from '../hooks/useClusterId'
import { RequireCluster } from '../components/ClusterEmptyState'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { useDialogs } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'
import { DataTable, PageHeader } from '../components/ui/DataTable'
import { Input } from '../components/ui/Input'

function TopicsContent() {
  const clusterId = useClusterId()
  const qc = useQueryClient()
  const toast = useToast()
  const { openCreateTopic, openProduceMessage } = useDialogs()
  const [filter, setFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => api.topics(clusterId),
    enabled: !!clusterId,
  })

  const remove = useMutation({
    mutationFn: (topic: string) => api.deleteTopic(clusterId, topic),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics', clusterId] })
      toast.success('Topic deleted')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const topics = (data?.items as Topic[]) || []

  return (
    <>
      <PageHeader
        title="Topics"
        description="Browse and manage Kafka topics in the selected cluster."
        actions={
          <>
            <PermissionGuard permission="message.publish">
              <Button variant="secondary" onClick={() => openProduceMessage()}>
                Produce message
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="topic.create">
              <Button onClick={openCreateTopic}>
                <Plus className="h-4 w-4" /> Create topic
              </Button>
            </PermissionGuard>
          </>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Filter topics…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (t) => (
              <Link
                to={`/messages?topic=${encodeURIComponent(t.name)}`}
                className="font-mono text-xs text-sf-accent hover:underline"
              >
                {t.name}
              </Link>
            ),
          },
          { key: 'partitions', header: 'Partitions', render: (t) => t.partitions, className: 'text-right' },
          { key: 'rf', header: 'RF', render: (t) => t.replication_factor, className: 'text-right' },
          { key: 'internal', header: 'Internal', render: (t) => (t.internal ? 'Yes' : 'No') },
          {
            key: 'actions',
            header: '',
            render: (t) =>
              !t.name.startsWith('__') ? (
                <PermissionGuard permission="topic.delete">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(t.name) }}
                    className="text-sf-muted hover:text-red-500 transition-colors p-1"
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </PermissionGuard>
              ) : null,
          },
        ]}
        data={topics}
        keyFn={(t) => t.name}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No topics found"
        emptyDescription="Create a topic or check cluster connectivity."
        filter={filter}
        filterFn={(t, f) => t.name.toLowerCase().includes(f.toLowerCase())}
        onRowClick={(t) => openProduceMessage(t.name)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
        title="Delete topic?"
        description="This action cannot be undone."
        resourceName={deleteTarget || undefined}
        confirmLabel="Delete topic"
        loading={remove.isPending}
      />
    </>
  )
}

export default function TopicsPage() {
  return (
    <RequireCluster resource="topics">
      <TopicsContent />
    </RequireCluster>
  )
}
