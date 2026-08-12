import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useDialogs } from '../../context/DialogContext'
import { useToast } from '../../context/ToastContext'
import { useClusterContext } from '../../context/ClusterContext'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FormError, FormField, FormSuccess } from '../ui/FormField'
import { Input } from '../ui/Input'

export function CreateTopicDialog() {
  const { dialogs, closeCreateTopic } = useDialogs()
  const { clusterId } = useClusterContext()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [partitions, setPartitions] = useState('3')
  const [rf, setRf] = useState('1')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState('')

  const create = useMutation({
    mutationFn: () =>
      api.createTopic(clusterId, {
        name: name.trim(),
        partitions: parseInt(partitions, 10),
        replication_factor: parseInt(rf, 10),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics', clusterId] })
      setSuccess(name.trim())
      toast.success(`Topic "${name.trim()}" created`)
      setTimeout(() => {
        setName('')
        setSuccess('')
        closeCreateTopic()
      }, 1200)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Topic name is required'
    else if (!/^[a-zA-Z0-9._-]+$/.test(name.trim())) e.name = 'Invalid topic name characters'
    const p = parseInt(partitions, 10)
    if (isNaN(p) || p < 1) e.partitions = 'Must be at least 1'
    const r = parseInt(rf, 10)
    if (isNaN(r) || r < 1) e.rf = 'Must be at least 1'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = () => {
    if (!validate()) return
    create.mutate()
  }

  const handleClose = () => {
    if (create.isPending) return
    setErrors({})
    setSuccess('')
    closeCreateTopic()
  }

  return (
    <Dialog
      open={dialogs.createTopic}
      onClose={handleClose}
      title="Create topic"
      description="Create a new Kafka topic in the selected cluster."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={create.isPending} disabled={!!success || !clusterId}>
            Create topic
          </Button>
        </>
      }
    >
      {!clusterId ? (
        <FormError message="Select a cluster before creating a topic." />
      ) : success ? (
        <FormSuccess message={`Topic created — ${success}`} />
      ) : (
        <div className="space-y-4">
          <FormField label="Topic name" required error={errors.name} description="Use letters, numbers, dots, dashes, and underscores.">
            <Input
              placeholder="banking.transactions"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!errors.name}
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Partitions" required error={errors.partitions}>
              <Input
                type="number"
                min={1}
                value={partitions}
                onChange={(e) => setPartitions(e.target.value)}
                error={!!errors.partitions}
              />
            </FormField>
            <FormField label="Replication factor" required error={errors.rf}>
              <Input
                type="number"
                min={1}
                value={rf}
                onChange={(e) => setRf(e.target.value)}
                error={!!errors.rf}
              />
            </FormField>
          </div>
          {create.isError && <FormError message={(create.error as Error).message} />}
        </div>
      )}
    </Dialog>
  )
}
