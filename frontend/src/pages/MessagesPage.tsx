import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Radio, RefreshCw, Send } from 'lucide-react'
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

function messageRowKey(m: Message) {
  return `${m.partition}-${m.offset}`
}

function mergeMessages(existing: Message[], incoming: Message[]) {
  const seen = new Set(existing.map(messageRowKey))
  const next = [...existing]
  for (const m of incoming) {
    const key = messageRowKey(m)
    if (seen.has(key)) continue
    seen.add(key)
    next.push(m)
  }
  return next
}

function MessagesContent() {
  const clusterId = useClusterId()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const topic = params.get('topic') || ''
  const { openProduceMessage } = useDialogs()
  const [partition, setPartition] = useState('')
  const [offset, setOffset] = useState('')
  const [selected, setSelected] = useState<Message | null>(null)
  const [olderMessages, setOlderMessages] = useState<Message[]>([])
  const [tailCursor, setTailCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [liveTail, setLiveTail] = useState(false)
  const [liveMessages, setLiveMessages] = useState<Message[]>([])

  const tailMode = partition.trim() === '' && offset.trim() === ''

  const { data: topicsData } = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => api.topics(clusterId),
    enabled: !!clusterId,
  })

  const topics = (topicsData?.items as Topic[]) || []
  const activeTopic = topic || topics[0]?.name || ''

  useEffect(() => {
    setOlderMessages([])
    setTailCursor(null)
    setHasMore(false)
    setLiveMessages([])
    setLiveTail(false)
  }, [clusterId, activeTopic, partition, offset])

  useEffect(() => {
    if (!liveTail || !clusterId || !activeTopic) return
    const ws = new WebSocket(api.liveTailURL(clusterId, activeTopic, partition.trim() ? Number(partition) : undefined))
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as Message
        setLiveMessages((prev) => mergeMessages(prev, [msg]).slice(-100))
      } catch {
        /* ignore malformed */
      }
    }
    return () => ws.close()
  }, [liveTail, clusterId, activeTopic, partition])

  const messages = useQuery({
    queryKey: ['messages', clusterId, activeTopic, partition, offset],
    queryFn: () => {
      const q = new URLSearchParams({ limit: '50' })
      if (!tailMode) {
        q.set('partition', partition.trim() || '0')
        if (offset.trim()) q.set('offset', offset.trim())
      }
      return api.messages(clusterId, activeTopic, q)
    },
    enabled: !!clusterId && !!activeTopic,
  })

  useEffect(() => {
    if (messages.data?.mode === 'tail') {
      setTailCursor(messages.data.cursor || null)
      setHasMore(messages.data.has_more ?? false)
      setOlderMessages([])
    }
  }, [messages.data])

  const displayedMessages = useMemo(() => {
    if (liveTail && liveMessages.length > 0) {
      return liveMessages
    }
    if (!tailMode) {
      return messages.data?.items ?? []
    }
    return mergeMessages(messages.data?.items ?? [], olderMessages)
  }, [liveTail, liveMessages, tailMode, messages.data?.items, olderMessages])

  const loadOlder = useCallback(async () => {
    if (!tailMode || !tailCursor || !hasMore || loadingMore || !clusterId || !activeTopic) return
    setLoadingMore(true)
    try {
      const q = new URLSearchParams({ limit: '50', cursor: tailCursor })
      const res = await api.messages(clusterId, activeTopic, q)
      setOlderMessages((prev) => mergeMessages(prev, res.items))
      setTailCursor(res.cursor || null)
      setHasMore(res.has_more ?? false)
    } finally {
      setLoadingMore(false)
    }
  }, [activeTopic, clusterId, hasMore, loadingMore, tailCursor, tailMode])

  const refresh = () => {
    setOlderMessages([])
    setTailCursor(null)
    setHasMore(false)
    queryClient.invalidateQueries({ queryKey: ['messages', clusterId, activeTopic, partition, offset] })
  }

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
        <Input
          className="w-24"
          value={partition}
          onChange={(e) => setPartition(e.target.value)}
          placeholder="Part."
          aria-label="Partition"
        />
        <Input
          className="w-32"
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          placeholder="Offset"
          aria-label="Offset"
        />
        <Button variant="secondary" onClick={refresh} disabled={messages.isFetching || !activeTopic}>
          <RefreshCw className={`h-4 w-4 ${messages.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
        {tailMode && (
          <Button
            variant={liveTail ? 'primary' : 'secondary'}
            onClick={() => setLiveTail((v) => !v)}
            disabled={!activeTopic}
          >
            <Radio className={`h-4 w-4 ${liveTail ? 'animate-pulse' : ''}`} />
            {liveTail ? 'Live tail on' : 'Live tail'}
          </Button>
        )}
      </div>

      {liveTail && (
        <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">Streaming new messages via WebSocket…</p>
      )}

      {tailMode && !messages.isLoading && !messages.error && activeTopic && (
        <p className="mb-3 text-sm text-sf-muted">
          {olderMessages.length === 0
            ? 'Showing latest 50 messages across all partitions'
            : `Showing ${displayedMessages.length} messages across all partitions`}
        </p>
      )}

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
            render: (m) => <span className="font-mono text-xs max-w-xl truncate block">{m.value || '—'}</span>,
          },
        ]}
        data={displayedMessages}
        keyFn={messageRowKey}
        loading={messages.isLoading}
        error={messages.error ? (messages.error as Error).message : undefined}
        emptyTitle="No messages"
        emptyDescription={
          tailMode
            ? 'Publish a message or wait for producers to send events to this topic.'
            : 'Try a different partition or offset, or publish a message.'
        }
        onRowClick={setSelected}
        selectedKey={selected ? messageRowKey(selected) : undefined}
      />

      {tailMode && hasMore && !messages.isLoading && !messages.error && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadOlder} loading={loadingMore}>
            <ChevronDown className="h-4 w-4" />
            Show older messages
          </Button>
        </div>
      )}

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
