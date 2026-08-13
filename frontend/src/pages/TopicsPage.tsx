import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api, type Topic, type PartitionInfo } from '../api/client'
import { useClusterId } from '../hooks/useClusterId'
import { RequireCluster } from '../components/ClusterEmptyState'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { useDialogs } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { RowActionsMenu, type RowAction } from '../components/ui/RowActionsMenu'
import { cn } from '../lib/cn'

function isInternalTopic(t: Topic) {
  return t.internal || t.name.startsWith('__') || t.name.startsWith('_')
}

function canDeleteTopic(t: Topic) {
  return !isInternalTopic(t)
}

function TopicDetail({
  topic,
  partitions,
  loading,
}: {
  topic: Topic
  partitions?: PartitionInfo[]
  loading?: boolean
}) {
  const leaders = partitions ? [...new Set(partitions.map((p) => p.leader))].join(', ') : '—'
  const underRep = partitions?.filter((p) => p.under_replicated).length ?? 0
  const minIsr = partitions?.length
    ? Math.min(...partitions.map((p) => p.isr.length))
    : null

  return (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div className="col-span-2">
        <dt className="text-xs text-sf-muted">Topic name</dt>
        <dd className="mt-1 font-mono text-xs break-all">{topic.name}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Partitions</dt>
        <dd className="mt-1 font-mono">{topic.partitions}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Replication factor</dt>
        <dd className="mt-1 font-mono">{topic.replication_factor}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Type</dt>
        <dd className="mt-1">
          {isInternalTopic(topic) ? (
            <StatusBadge status="Internal" />
          ) : (
            <StatusBadge status="User" />
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Min ISR size</dt>
        <dd className="mt-1 font-mono">{loading ? '…' : minIsr ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Leaders</dt>
        <dd className="mt-1 font-mono text-xs">{loading ? '…' : leaders}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Under-replicated</dt>
        <dd className="mt-1 font-mono">{loading ? '…' : underRep}</dd>
      </div>
      {partitions && partitions.length > 0 && (
        <div className="col-span-2">
          <dt className="mb-2 text-xs text-sf-muted">Partition details</dt>
          <dd className="overflow-auto rounded-lg border border-sf-border">
            <table className="w-full text-xs">
              <thead className="bg-sf-input/60">
                <tr>
                  <th className="px-2 py-1.5 text-left">Part.</th>
                  <th className="px-2 py-1.5 text-left">Leader</th>
                  <th className="px-2 py-1.5 text-left">ISR</th>
                  <th className="px-2 py-1.5 text-right">Messages</th>
                </tr>
              </thead>
              <tbody>
                {partitions.map((p) => (
                  <tr key={p.partition} className="border-t border-sf-border/60">
                    <td className="px-2 py-1.5 font-mono">{p.partition}</td>
                    <td className="px-2 py-1.5 font-mono">{p.leader}</td>
                    <td className="px-2 py-1.5 font-mono">{p.isr.join(', ')}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{p.message_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </dd>
        </div>
      )}
    </dl>
  )
}

function TopicsContent() {
  const clusterId = useClusterId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { openCreateTopic, openProduceMessage } = useDialogs()
  const [filter, setFilter] = useState('')
  const [hideInternal, setHideInternal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [viewTopic, setViewTopic] = useState<Topic | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => api.topics(clusterId),
    enabled: !!clusterId,
  })

  const partitionQuery = useQuery({
    queryKey: ['partitions', clusterId, viewTopic?.name],
    queryFn: () => api.partitions(clusterId, viewTopic!.name),
    enabled: !!clusterId && !!viewTopic?.name,
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
  const visibleTopics = hideInternal ? topics.filter((t) => !isInternalTopic(t)) : topics

  const topicActions = (t: Topic): RowAction[] => {
    const actions: RowAction[] = [
      { label: 'View', onClick: () => setViewTopic(t) },
      {
        label: 'Browse messages',
        onClick: () => navigate(`/messages?topic=${encodeURIComponent(t.name)}`),
      },
      {
        label: 'Produce message',
        onClick: () => openProduceMessage(t.name),
      },
      {
        label: 'Configuration',
        onClick: () => setViewTopic(t),
      },
    ]
    if (canDeleteTopic(t)) {
      actions.push({
        label: 'Delete',
        destructive: true,
        onClick: () => setDeleteTarget(t.name),
      })
    }
    return actions
  }

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter topics…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm text-sf-muted">
          <input
            type="checkbox"
            checked={hideInternal}
            onChange={(e) => setHideInternal(e.target.checked)}
            className="rounded border-sf-border"
          />
          Hide internal topics
        </label>
      </div>

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (t) => (
              <span className={cn('font-mono text-xs', isInternalTopic(t) && 'text-sf-muted')}>
                {isInternalTopic(t) && (
                  <span className="mr-2 inline-flex scale-90">
                    <StatusBadge status="Internal" />
                  </span>
                )}
                <Link
                  to={`/messages?topic=${encodeURIComponent(t.name)}`}
                  className="text-sf-accent hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.name}
                </Link>
              </span>
            ),
          },
          { key: 'partitions', header: 'Partitions', render: (t) => t.partitions, className: 'text-right' },
          { key: 'rf', header: 'RF', render: (t) => t.replication_factor, className: 'text-right' },
          {
            key: 'type',
            header: 'Type',
            render: (t) => (isInternalTopic(t) ? 'Internal' : 'User'),
          },
          {
            key: 'actions',
            header: 'Actions',
            className: 'w-16 text-right',
            render: (t) => (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <RowActionsMenu actions={topicActions(t)} label={`Actions for ${t.name}`} />
              </div>
            ),
          },
        ]}
        data={visibleTopics}
        keyFn={(t) => t.name}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No topics found"
        emptyDescription="Create a topic or check cluster connectivity."
        filter={filter}
        filterFn={(t, f) => t.name.toLowerCase().includes(f.toLowerCase())}
        onRowClick={(t) => setViewTopic(t)}
      />

      <Drawer open={!!viewTopic} onClose={() => setViewTopic(null)} title={viewTopic?.name || 'Topic'}>
        {viewTopic && (
          <>
            <TopicDetail
              topic={viewTopic}
              partitions={partitionQuery.data?.items}
              loading={partitionQuery.isLoading}
            />
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/messages?topic=${encodeURIComponent(viewTopic.name)}`)}
              >
                Browse messages
              </Button>
              <PermissionGuard permission="message.publish">
                <Button variant="secondary" size="sm" onClick={() => openProduceMessage(viewTopic.name)}>
                  Produce message
                </Button>
              </PermissionGuard>
            </div>
          </>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
        title="Delete topic?"
        description="This permanently deletes the topic and its messages from Kafka. This action cannot be undone."
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
