import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { RefreshCw, Send } from 'lucide-react'
import { api, type Message, type Topic } from '../api/client'
import { useClusterId } from '../hooks/useClusterId'
import { RequireCluster } from '../components/ClusterEmptyState'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { useDialogs } from '../context/DialogContext'
import { Button } from '../components/ui/Button'
import { DataTable, PageHeader } from '../components/ui/DataTable'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { MessageDrawer } from '../components/drawers/MessageDrawer'

function MessagesContent() {
  const clusterId = useClusterId()
  const [params, setParams] = useSearchParams()
  const topic = params.get('topic') || ''
  const { openProduceMessage } = useDialogs()
  const [partition, setPartition] = useState('0')
  const [offset, setOffset] = useState('')
  const [selected, setSelected] = useState<Message | null>(null)

  const { data: topicsData } = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => api.topics(clusterId),
    enabled: !!clusterId,
  })

  const topics = (topicsData?.items as Topic[]) || []
  const activeTopic = topic || topics[0]?.name || ''

  const messages = useQuery({
    queryKey: ['messages', clusterId, activeTopic, partition, offset],
    queryFn: () => {
      const q = new URLSearchParams({ partition, limit: '50' })
      if (offset) q.set('offset', offset)
      return api.messages(clusterId, activeTopic, q)
    },
    enabled: !!clusterId && !!activeTopic,
  })

  return (
    <>
      <PageHeader
        title="Messages"
        description="Browse and inspect Kafka messages."
        actions={
          <PermissionGuard permission="message.publish">
            <Button onClick={() => openProduceMessage(activeTopic)} disabled={!activeTopic}>
              <Send className="h-4 w-4" /> Produce message
            </Button>
          </PermissionGuard>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <Select
          className="max-w-md"
          value={activeTopic}
          onChange={(e) => setParams({ topic: e.target.value })}
          aria-label="Topic"
          disabled={topics.length === 0}
        >
          {topics.length === 0 ? (
            <option value="">No topics available</option>
          ) : (
            topics.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))
          )}
        </Select>
        <Input className="w-24" value={partition} onChange={(e) => setPartition(e.target.value)} placeholder="Part." aria-label="Partition" />
        <Input className="w-32" value={offset} onChange={(e) => setOffset(e.target.value)} placeholder="Offset" aria-label="Offset" />
        <Button variant="secondary" onClick={() => messages.refetch()} disabled={messages.isFetching || !activeTopic}>
          <RefreshCw className={`h-4 w-4 ${messages.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <DataTable
        columns={[
          {
            key: 'time',
            header: 'Timestamp',
            render: (m) => <span className="text-xs whitespace-nowrap">{m.timestamp}</span>,
          },
          { key: 'part', header: 'Part.', render: (m) => m.partition, className: 'text-right font-mono text-xs' },
          { key: 'offset', header: 'Offset', render: (m) => m.offset, className: 'text-right font-mono text-xs' },
          {
            key: 'key',
            header: 'Key',
            render: (m) => <span className="font-mono text-xs max-w-[140px] truncate block">{m.key || '—'}</span>,
          },
          {
            key: 'value',
            header: 'Value',
            render: (m) => <span className="font-mono text-xs max-w-xl truncate block">{m.value}</span>,
          },
        ]}
        data={(messages.data?.items as Message[]) || []}
        keyFn={(m) => `${m.partition}-${m.offset}`}
        loading={messages.isLoading}
        error={messages.error ? (messages.error as Error).message : undefined}
        emptyTitle="No messages"
        emptyDescription="Try a different partition or offset, or publish a message."
        onRowClick={setSelected}
        selectedKey={selected ? `${selected.partition}-${selected.offset}` : undefined}
      />

      <MessageDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        message={selected}
      />
    </>
  )
}

export default function MessagesPage() {
  return (
    <RequireCluster resource="messages">
      <MessagesContent />
    </RequireCluster>
  )
}
