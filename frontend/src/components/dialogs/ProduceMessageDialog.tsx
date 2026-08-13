import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useDialogs } from '../../context/DialogContext'
import { useToast } from '../../context/ToastContext'
import { useClusterContext } from '../../context/ClusterContext'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FormField, FormSuccess } from '../ui/FormField'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { CodeEditor } from '../ui/CodeEditor'

type PublishResult = { partition: number; offset: number; timestamp?: string }

export function ProduceMessageDialog() {
  const { dialogs, closeProduceMessage } = useDialogs()
  const { clusterId } = useClusterContext()
  const qc = useQueryClient()
  const toast = useToast()
  const [topic, setTopic] = useState('')
  const [partition, setPartition] = useState('auto')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('{\n  "event": "transaction.created"\n}')
  const [jsonError, setJsonError] = useState('')
  const [result, setResult] = useState<PublishResult | null>(null)

  const { data: topicsData } = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => api.topics(clusterId),
    enabled: !!clusterId && dialogs.produceMessage,
  })

  useEffect(() => {
    if (dialogs.produceMessage) {
      setTopic(dialogs.produceTopic || '')
      setResult(null)
      setJsonError('')
    }
  }, [dialogs.produceMessage, dialogs.produceTopic])

  const publish = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        key,
        value,
        reason: 'UI publish',
      }
      if (partition !== 'auto') body.partition = parseInt(partition, 10)
      return api.publish(clusterId, topic, body)
    },
    onSuccess: (data) => {
      const r = data as PublishResult
      setResult(r)
      qc.invalidateQueries({ queryKey: ['messages', clusterId, topic] })
      toast.success(`Published to partition ${r.partition} offset ${r.offset}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validate = () => {
    try {
      JSON.parse(value)
      setJsonError('')
      return true
    } catch {
      setJsonError('Value must be valid JSON')
      return false
    }
  }

  const onSubmit = () => {
    if (!topic) return
    if (!validate()) return
    publish.mutate()
  }

  const handleClose = () => {
    if (publish.isPending) return
    setResult(null)
    closeProduceMessage()
  }

  const topicItems = (topicsData?.items as Array<{ name: string }>) || []

  return (
    <Dialog
      open={dialogs.produceMessage}
      onClose={handleClose}
      title="Produce message"
      description="Publish a message to a Kafka topic."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={publish.isPending} disabled={!clusterId || !topic}>
            Publish
          </Button>
        </>
      }
    >
      {result ? (
        <FormSuccess
          message={`Published — partition ${result.partition}, offset ${result.offset}`}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Topic" required>
              <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">Select topic…</option>
                {topicItems.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Partition">
              <Select value={partition} onChange={(e) => setPartition(e.target.value)}>
                <option value="auto">Auto</option>
                {[0, 1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={String(p)}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Key">
            <Input placeholder="Optional message key" value={key} onChange={(e) => setKey(e.target.value)} />
          </FormField>
          <FormField label="Value" required>
            <CodeEditor value={value} onChange={setValue} error={jsonError} />
          </FormField>
        </div>
      )}
    </Dialog>
  )
}
