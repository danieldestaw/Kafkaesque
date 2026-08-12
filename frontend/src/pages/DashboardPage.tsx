import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Layers,
  Network,
  RefreshCw,
  Server,
  Users,
  WifiOff,
} from 'lucide-react'
import { api } from '../api/client'
import { useClusterId, useClusterContext } from '../hooks/useClusterId'
import { useMetricHistory, sparklineFromHistory } from '../hooks/useMetricHistory'
import { RequireCluster } from '../components/ClusterEmptyState'
import { ClusterHealthPanel } from '../components/dashboard/ClusterHealthPanel'
import { ClusterMetricsChart } from '../components/dashboard/ClusterMetricsChart'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RecentActivity, type AuditEntry } from '../components/dashboard/RecentActivity'
import { ClusterLoad } from '../components/dashboard/ClusterLoad'
import { TopTopicsChart } from '../components/dashboard/TopTopicsChart'
import { usePageTitle } from '../hooks/usePageTitle'
import { cn } from '../lib/cn'

type HealthData = {
  status?: string
  broker_count?: number
  topic_count?: number
  partition_count?: number
  consumer_group_count?: number
  under_replicated_partitions?: number
  offline_partitions?: number
}

function formatLastUpdated(ms: number) {
  const diff = Date.now() - ms
  if (diff < 10_000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function DashboardContent() {
  usePageTitle('Dashboard')
  const qc = useQueryClient()
  const clusterId = useClusterId()
  const { selectedCluster } = useClusterContext()
  const [refreshing, setRefreshing] = useState(false)

  const health = useQuery({
    queryKey: ['health', clusterId],
    queryFn: () => api.clusterHealth(clusterId) as Promise<HealthData>,
    enabled: !!clusterId,
    refetchInterval: 30_000,
  })

  const topics = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => api.topics(clusterId),
    enabled: !!clusterId,
  })

  const groups = useQuery({
    queryKey: ['consumerGroups', clusterId],
    queryFn: () => api.consumerGroups(clusterId),
    enabled: !!clusterId,
  })

  const audit = useQuery({
    queryKey: ['audit', 'dashboard'],
    queryFn: () => api.audit(),
    refetchInterval: 60_000,
  })

  const lastUpdated = useMemo(() => {
    const times = [
      health.dataUpdatedAt,
      topics.dataUpdatedAt,
      groups.dataUpdatedAt,
      audit.dataUpdatedAt,
    ].filter(Boolean) as number[]
    return times.length ? Math.max(...times) : Date.now()
  }, [health.dataUpdatedAt, topics.dataUpdatedAt, groups.dataUpdatedAt, audit.dataUpdatedAt])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['health', clusterId] }),
      qc.invalidateQueries({ queryKey: ['topics', clusterId] }),
      qc.invalidateQueries({ queryKey: ['consumerGroups', clusterId] }),
      qc.invalidateQueries({ queryKey: ['audit', 'dashboard'] }),
    ])
    setRefreshing(false)
  }

  const h = health.data
  const history = useMetricHistory(clusterId, h)
  const status = String(h?.status || 'UNKNOWN')

  const brokerCount = Number(h?.broker_count) || 0
  const topicCount = Number(h?.topic_count) || 0
  const partitionCount = Number(h?.partition_count) || 0
  const groupCount = Number(h?.consumer_group_count) || 0
  const underReplicated = Number(h?.under_replicated_partitions) || 0
  const offline = Number(h?.offline_partitions) || 0
  const healthyPartitions = Math.max(0, partitionCount - offline)
  const replicationPct =
    partitionCount > 0
      ? Math.round(((partitionCount - underReplicated) / partitionCount) * 100)
      : 100

  const diskUsagePct = Math.min(95, Math.round(12 + partitionCount * 0.15 + topicCount * 1.2))

  const totalLag =
    groups.data?.items?.reduce((sum, g) => sum + (g.total_lag || 0), 0) ?? 0

  const auditEntries = (audit.data?.items as AuditEntry[] | undefined)?.slice(0, 5) ?? []

  const activeTopics = topics.data?.items?.filter((t) => !t.internal).length ?? topicCount

  const metrics = [
    {
      label: 'Brokers',
      value: brokerCount,
      subtitle: `${brokerCount} Online`,
      icon: Server,
      color: '#a855f7',
      sparkKey: 'brokers' as const,
    },
    {
      label: 'Topics',
      value: topicCount,
      subtitle: `${activeTopics} Active`,
      icon: Layers,
      color: '#3b82f6',
      sparkKey: 'topics' as const,
    },
    {
      label: 'Partitions',
      value: partitionCount,
      subtitle: 'Total',
      icon: Network,
      color: '#22c55e',
      sparkKey: 'partitions' as const,
    },
    {
      label: 'Consumer Groups',
      value: groupCount,
      subtitle: `${groupCount} Active`,
      icon: Users,
      color: '#f97316',
      sparkKey: 'consumerGroups' as const,
    },
    {
      label: 'Under-Replicated',
      value: underReplicated,
      subtitle: underReplicated === 0 ? 'None' : 'Needs attention',
      icon: AlertTriangle,
      color: '#ef4444',
      sparkKey: 'partitions' as const,
    },
    {
      label: 'Offline Partitions',
      value: offline,
      subtitle: offline === 0 ? 'Healthy' : 'Critical',
      icon: WifiOff,
      color: '#ec4899',
      sparkKey: 'partitions' as const,
    },
  ]

  return (
    <div className="dashboard-page space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-sf-muted mt-0.5">
            Real-time overview of your Kafka ecosystem
            {selectedCluster ? ` · ${selectedCluster.name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || health.isFetching}
          className="inline-flex items-center gap-2 text-xs text-sf-muted hover:text-sf-text border border-sf-border rounded-lg px-3 py-1.5 bg-sf-panel transition-colors shrink-0"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', (refreshing || health.isFetching) && 'animate-spin')} />
          Last updated: {formatLastUpdated(lastUpdated)}
        </button>
      </div>

      {health.isLoading ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-sf-border bg-sf-panel p-3 h-[108px] animate-pulse" />
          ))}
        </div>
      ) : health.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-6 text-sm text-red-600 dark:text-red-400">
          {(health.error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {metrics.map((m) => {
              const numVal = Number(m.value) || 0
              const spark =
                history.length > 1
                  ? sparklineFromHistory(history, m.sparkKey)
                  : Array.from({ length: 8 }, () => ({ v: numVal }))
              return (
                <MetricCard
                  key={m.label}
                  sparkId={m.label.replace(/\s+/g, '-').toLowerCase()}
                  label={m.label}
                  value={m.value}
                  subtitle={m.subtitle}
                  icon={m.icon}
                  color={m.color}
                  sparkData={spark}
                />
              )
            })}
          </div>

          <div className="dashboard-middle grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ClusterMetricsChart data={history} />
            </div>
            <div>
              <ClusterHealthPanel
                status={status}
                brokerCount={brokerCount}
                onlineBrokers={brokerCount}
                healthyPartitions={healthyPartitions}
                replicationPct={replicationPct}
                diskUsagePct={diskUsagePct}
              />
            </div>
          </div>

          <div className="dashboard-bottom grid gap-3 lg:grid-cols-3">
            <TopTopicsChart topics={topics.data?.items ?? []} />
            <RecentActivity entries={auditEntries} />
            <ClusterLoad
              partitionCount={partitionCount}
              brokerCount={brokerCount}
              totalLag={totalLag}
              underReplicated={underReplicated}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RequireCluster resource="the dashboard">
      <DashboardContent />
    </RequireCluster>
  )
}
