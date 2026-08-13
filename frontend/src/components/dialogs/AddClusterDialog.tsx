import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api, type ClusterCreateBody } from '../../api/client'
import { useDialogs } from '../../context/DialogContext'
import { useToast } from '../../context/ToastContext'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FormError, FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { cn } from '../../lib/cn'

type TestResult = {
  connected: boolean
  error?: string
  broker_count?: number
  topic_count?: number
  kafka_version?: string
}

export function AddClusterDialog() {
  const { dialogs, closeAddCluster } = useDialogs()
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<ClusterCreateBody>({
    name: '',
    bootstrap_servers: 'kafka:9092',
    environment: 'DEVELOPMENT',
    tls: false,
    sasl_mechanism: '',
    sasl_username: '',
    sasl_password: '',
    schema_registry_url: '',
    connect_url: '',
  })
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const test = useMutation({
    mutationFn: () => api.testConnection(form),
    onSuccess: (data) => setTestResult(data),
    onError: (e: Error) => setTestResult({ connected: false, error: e.message }),
  })

  const save = useMutation({
    mutationFn: () => api.createCluster(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clusters'] })
      toast.success(`Cluster "${form.name}" saved`)
      handleClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Cluster name is required'
    if (!form.bootstrap_servers.trim()) e.bootstrap = 'Bootstrap servers are required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleClose = () => {
    if (save.isPending || test.isPending) return
    setTestResult(null)
    setErrors({})
    closeAddCluster()
  }

  const set = (patch: Partial<ClusterCreateBody>) => {
    setForm((f) => ({ ...f, ...patch }))
    setTestResult(null)
  }

  return (
    <Dialog
      open={dialogs.addCluster}
      onClose={handleClose}
      title="Connect cluster"
      description="Add a Kafka cluster. Credentials are stored encrypted on the server."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => validate() && test.mutate()}
            loading={test.isPending}
          >
            Test connection
          </Button>
          <Button
            onClick={() => validate() && save.mutate()}
            loading={save.isPending}
          >
            Save cluster
          </Button>
        </>
      }
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-sf-muted mb-3">Connection</h3>
          <div className="space-y-4">
            <FormField label="Cluster name" required error={errors.name}>
              <Input
                placeholder="Demo Kafka"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                error={!!errors.name}
                autoFocus
              />
            </FormField>
            <FormField
              label="Bootstrap servers"
              required
              error={errors.bootstrap}
              description="Comma-separated broker addresses, e.g. kafka:9092"
            >
              <Input
                placeholder="kafka:9092"
                value={form.bootstrap_servers}
                onChange={(e) => set({ bootstrap_servers: e.target.value })}
                error={!!errors.bootstrap}
                className="font-mono text-xs"
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-sf-muted mb-3">Security</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Security protocol">
              <Select
                value={form.tls ? 'SSL' : 'PLAINTEXT'}
                onChange={(e) => set({ tls: e.target.value !== 'PLAINTEXT' })}
              >
                <option value="PLAINTEXT">PLAINTEXT</option>
                <option value="SSL">SSL / TLS</option>
              </Select>
            </FormField>
            <FormField label="SASL mechanism">
              <Select
                value={form.sasl_mechanism || ''}
                onChange={(e) => set({ sasl_mechanism: e.target.value })}
              >
                <option value="">None</option>
                <option value="PLAIN">PLAIN</option>
                <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                <option value="SCRAM-SHA-512">SCRAM-SHA-512</option>
              </Select>
            </FormField>
            {form.sasl_mechanism && (
              <>
                <FormField label="Username">
                  <Input
                    value={form.sasl_username || ''}
                    onChange={(e) => set({ sasl_username: e.target.value })}
                  />
                </FormField>
                <FormField label="Password">
                  <Input
                    type="password"
                    value={form.sasl_password || ''}
                    onChange={(e) => set({ sasl_password: e.target.value })}
                  />
                </FormField>
              </>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-sf-muted mb-3">Enterprise integrations</h3>
          <div className="space-y-4">
            <FormField label="Schema Registry URL" description="e.g. http://schema-registry:8081">
              <Input
                value={form.schema_registry_url || ''}
                onChange={(e) => set({ schema_registry_url: e.target.value })}
                placeholder="http://schema-registry:8081"
                className="font-mono text-xs"
              />
            </FormField>
            <FormField label="Kafka Connect URL" description="e.g. http://connect:8083">
              <Input
                value={form.connect_url || ''}
                onChange={(e) => set({ connect_url: e.target.value })}
                placeholder="http://connect:8083"
                className="font-mono text-xs"
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-sf-muted mb-3">Environment</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => set({ environment: env })}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                  form.environment === env
                    ? 'border-sf-accent bg-sf-accent/10 text-sf-accent'
                    : 'border-sf-border hover:border-sf-accent/40',
                  env === 'PRODUCTION' && form.environment === env && 'border-amber-500/50 bg-amber-500/10 text-amber-600',
                )}
              >
                {env.charAt(0) + env.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        {testResult && (
          <div
            className={cn(
              'rounded-lg border px-4 py-3 text-sm',
              testResult.connected
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-red-500/30 bg-red-500/10',
            )}
          >
            {testResult.connected ? (
              <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Connection successful</p>
                  <p className="text-xs mt-1 opacity-80">
                    Brokers: {testResult.broker_count ?? '—'}
                    {testResult.topic_count != null && ` · Topics: ${testResult.topic_count}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Connection failed</p>
                  <p className="text-xs mt-1 opacity-80">{testResult.error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {save.isError && <FormError message={(save.error as Error).message} />}
      </div>
    </Dialog>
  )
}
