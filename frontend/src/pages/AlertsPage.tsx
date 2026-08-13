import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Radio, RefreshCw, Trash2 } from 'lucide-react'
import { api, type AlertEvent, type AlertRule, type ConsumerGroup } from '../api/client'
import { RequireCluster } from '../components/ClusterEmptyState'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { useClusterId } from '../hooks/useClusterId'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { FormField } from '../components/ui/FormField'
import { useToast } from '../context/ToastContext'
import { cn } from '../lib/cn'

function AlertsContent() {
  const clusterId = useClusterId()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [ruleType, setRuleType] = useState('consumer_lag')
  const [threshold, setThreshold] = useState('5')
  const [live, setLive] = useState(true)

  const consumers = useQuery({
    queryKey: ['consumers', clusterId, 'alerts'],
    queryFn: () => api.consumerGroups(clusterId),
    enabled: !!clusterId,
    refetchInterval: live ? 5_000 : 15_000,
  })

  const maxLag = useMemo(() => {
    const groups = (consumers.data?.items as ConsumerGroup[]) ?? []
    return groups.reduce((m, g) => Math.max(m, g.max_lag ?? 0), 0)
  }, [consumers.data?.items])

  const rules = useQuery({
    queryKey: ['alert-rules', clusterId],
    queryFn: () => api.alertRules(clusterId),
    enabled: !!clusterId,
  })

  const events = useQuery({
    queryKey: ['alert-events', clusterId],
    queryFn: () => api.alertEvents(clusterId),
    enabled: !!clusterId,
    refetchInterval: live ? 5_000 : false,
  })

  const create = useMutation({
    mutationFn: () =>
      api.createAlertRule(clusterId, {
        name,
        rule_type: ruleType,
        threshold: Number(threshold),
        enabled: true,
      }),
    onSuccess: () => {
      toast.success('Alert rule created')
      setName('')
      qc.invalidateQueries({ queryKey: ['alert-rules', clusterId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAlertRule(clusterId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules', clusterId] }),
  })

  const resolve = useMutation({
    mutationFn: (id: string) => api.resolveAlertEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-events', clusterId] }),
  })

  const evaluate = useMutation({
    mutationFn: () => api.evaluateAlerts(clusterId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-events', clusterId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Live mode: backend evaluates every 15s; UI polls events every 5s and triggers evaluate every 15s.
  useEffect(() => {
    if (!live || !clusterId) return
    const id = setInterval(() => {
      if (!evaluate.isPending) evaluate.mutate()
    }, 15_000)
    return () => clearInterval(id)
  }, [live, clusterId]) // eslint-disable-line react-hooks/exhaustive-deps

  const lowestThreshold = useMemo(() => {
    const items = rules.data?.items ?? []
    if (items.length === 0) return null
    return Math.min(...items.map((r) => r.threshold))
  }, [rules.data?.items])

  const activeCount = useMemo(
    () => (events.data?.items ?? []).filter((e) => e.status === 'ACTIVE').length,
    [events.data?.items],
  )

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Define lag and health thresholds; events appear when rules fire."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={live ? 'primary' : 'secondary'}
              onClick={() => setLive((v) => !v)}
              title="Live monitoring polls events every 5s and evaluates rules every 15s"
            >
              <Radio className={cn('h-4 w-4', live && 'animate-pulse')} />
              {live ? 'Live on' : 'Live off'}
            </Button>
            <PermissionGuard permission="alert.manage">
              <Button
                variant="secondary"
                onClick={() => evaluate.mutate()}
                loading={evaluate.isPending}
              >
                <RefreshCw className="h-4 w-4" /> Run check now
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <div className="mb-6 rounded-lg border border-sf-border bg-sf-bg/50 px-4 py-3 text-sm space-y-1">
        <p>
          Current <strong>max consumer lag</strong>:{' '}
          <span className="font-mono font-semibold">{maxLag}</span>
          {lowestThreshold != null && (
            <> · lowest threshold: <span className="font-mono">{lowestThreshold}</span></>
          )}
          {live && (
            <> · <span className="text-emerald-600 dark:text-emerald-400">Live monitoring active</span></>
          )}
          {activeCount > 0 && (
            <> · <span className="text-amber-600">{activeCount} active event(s)</span></>
          )}
        </p>
        {maxLag === 0 && (
          <p className="text-sf-muted text-xs">
            Lag is 0 while consumers keep up. Stop <code className="text-xs">service-a</code> in{' '}
            <code className="text-xs">examples/kafka-test</code> to build lag for testing.
          </p>
        )}
      </div>

      <PermissionGuard permission="alert.manage">
        <div className="mb-6 rounded-lg border border-sf-border p-4 grid gap-3 sm:grid-cols-4 items-end">
          <FormField label="Rule name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="High consumer lag" />
          </FormField>
          <FormField label="Type">
            <Select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
              <option value="consumer_lag">Consumer lag (max)</option>
              <option value="offline_partitions">Offline partitions</option>
            </Select>
          </FormField>
          <FormField label="Threshold" description="Event when max lag is greater than this value">
            <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </FormField>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!name.trim()}>
            Add rule
          </Button>
        </div>
      </PermissionGuard>

      <h3 className="text-sm font-semibold mb-2">Rules</h3>
      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (r: AlertRule) => r.name },
          { key: 'type', header: 'Type', render: (r) => r.rule_type },
          { key: 'threshold', header: 'Threshold', render: (r) => r.threshold, className: 'text-right font-mono text-xs' },
          {
            key: 'del',
            header: '',
            render: (r) => (
              <PermissionGuard permission="alert.manage">
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </PermissionGuard>
            ),
          },
        ]}
        data={rules.data?.items ?? []}
        keyFn={(r) => r.id}
        loading={rules.isLoading}
        emptyTitle="No alert rules"
      />

      <h3 className="text-sm font-semibold mb-2 mt-8">Recent events</h3>
      <DataTable
        columns={[
          { key: 'severity', header: 'Severity', render: (e: AlertEvent) => <StatusBadge status={e.severity} /> },
          { key: 'message', header: 'Message', render: (e) => <span className="text-xs">{e.message}</span> },
          { key: 'status', header: 'Status', render: (e) => e.status },
          { key: 'time', header: 'When', render: (e) => new Date(e.created_at).toLocaleString() },
          {
            key: 'resolve',
            header: '',
            render: (e) =>
              e.status === 'ACTIVE' ? (
                <Button variant="ghost" size="sm" onClick={() => resolve.mutate(e.id)}>
                  Resolve
                </Button>
              ) : null,
          },
        ]}
        data={events.data?.items ?? []}
        keyFn={(e) => e.id}
        loading={events.isLoading}
        emptyTitle="No alert events"
        emptyDescription={live ? 'Live monitoring will show events when thresholds are exceeded.' : 'Turn on Live or click Run check now.'}
      />
    </>
  )
}

export default function AlertsPage() {
  return (
    <RequireCluster resource="alerts">
      <AlertsContent />
    </RequireCluster>
  )
}
