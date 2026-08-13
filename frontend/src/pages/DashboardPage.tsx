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
import { useActivityHistory, sparklineFromActivity } from '../hooks/useMetricHistory'
import { RequireCluster } from '../components/ClusterEmptyState'
import { ClusterHealthPanel } from '../components/dashboard/ClusterHealthPanel'
import { ClusterMetricsChart, type MessageActivityPoint } from '../components/dashboard/ClusterMetricsChart'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RecentActivity, type AuditEntry } from '../components/dashboard/RecentActivity'
import { ClusterLoad } from '../components/dashboard/ClusterLoad'
import { TopTopicsChart } from '../components/dashboard/TopTopicsChart'
import { DashboardStatusBar } from '../components/dashboard/DashboardStatusBar'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button } from '../components/ui/Button'
import { CHART } from '../lib/chartColors'

const REFRESH_SEC = 10

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

function buildMessageActivity(
  auditEntries: AuditEntry[],
  lagHistory: ReturnType<typeof useActivityHistory>,
): MessageActivityPoint[] {
  if (lagHistory.length >= 2) {
    return lagHistory.map((point, i) => {
      const prev = i > 0 ? lagHistory[i - 1] : point
      const consumed = Math.max(0, prev.totalLag - point.totalLag)
      const published = auditEntries.filter((e) => {
        const t = new Date(e.created_at).getTime()
        return Math.abs(t - point.ts) < 60_000 && e.action.includes('PUBLISH')
      }).length
      return {
        label: point.label,
        messagesIn: consumed,
        messagesOut: published,
      }
    })
  }

  const now = Date.now()
  const buckets: MessageActivityPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const ts = now - i * 5 * 60_000
    const label = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const inWindow = auditEntries.filter((e) => {
      const t = new Date(e.created_at).getTime()
      return t >= ts - 5 * 60_000 && t <= ts + 5 * 60_000
    })
    buckets.push({
      label,
      messagesIn: 0,
      messagesOut: inWindow.filter((e) => e.action.includes('PUBLISH')).length,
    })
  }
  return buckets
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
    refetchInterval: REFRESH_SEC * 1000,
  })

  const topics = useQuery({
    queryKey: ['topics', clusterId],
    queryFn: () => api.topics(clusterId),
    enabled: !!clusterId,
    refetchInterval: REFRESH_SEC * 1000,
  })

  const groups = useQuery({
    queryKey: ['consumerGroups', clusterId],
    queryFn: () => api.consumerGroups(clusterId),
    enabled: !!clusterId,
    refetchInterval: REFRESH_SEC * 1000,
  })

  const audit = useQuery({
    queryKey: ['audit', 'dashboard'],
    queryFn: () => api.audit(),
    refetchInterval: REFRESH_SEC * 1000,
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
  const maxLag =
    groups.data?.items?.reduce((m, g) => Math.max(m, g.max_lag || 0), 0) ?? 0

  const activityHistory = useActivityHistory(clusterId, {
    total_lag: totalLag,
    max_lag: maxLag,
    under_replicated_partitions: underReplicated,
    offline_partitions: offline,
  })

  const auditEntries = (audit.data?.items as AuditEntry[] | undefined) ?? []
  const auditSlice = auditEntries.slice(0, 8)
  const messageActivity = useMemo(
    () => buildMessageActivity(auditSlice, activityHistory),
    [auditSlice, activityHistory],
  )

  const activeTopics = topics.data?.items?.filter((t) => !t.internal).length ?? topicCount

  const metrics = [
    {
      label: 'Brokers',
      value: brokerCount,
      subtitle: `${brokerCount} online`,
      icon: Server,
      color: CHART.primary,
      sparkKey: 'underReplicated' as const,
    },
    {
      label: 'Topics',
      value: topicCount,
      subtitle: `${activeTopics} active`,
      icon: Layers,
      color: CHART.blue,
      sparkKey: 'totalLag' as const,
    },
    {
      label: 'Partitions',
      value: partitionCount,
      subtitle: 'Total',
      icon: Network,
      color: CHART.green,
      sparkKey: 'underReplicated' as const,
    },
    {
      label: 'Consumer Groups',
      value: groupCount,
      subtitle: `${groupCount} active`,
      icon: Users,
      color: CHART.orange,
      sparkKey: 'maxLag' as const,
    },
    {
      label: 'Under-Replicated',
      value: underReplicated,
      subtitle: underReplicated === 0 ? 'None' : 'Needs attention',
      icon: AlertTriangle,
      color: '#ef4444',
      sparkKey: 'underReplicated' as const,
    },
    {
      label: 'Offline Partitions',
      value: offline,
      subtitle: offline === 0 ? 'Healthy' : 'Critical',
      icon: WifiOff,
      color: CHART.magenta,
      sparkKey: 'offlinePartitions' as const,
    },
  ]

  return (
    <div className="dashboard-page">
      <div className="dashboard-header-row flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-sf-muted">
            Real-time overview of your Kafka ecosystem
            {selectedCluster ? ` — ${selectedCluster.name}` : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          loading={refreshing || health.isFetching}
          className="shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Last updated: {formatLastUpdated(lastUpdated)}</span>
        </Button>
      </div>

      {health.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 dashboard-metrics-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[108px] animate-pulse rounded-xl border border-sf-border bg-sf-panel p-3" />
          ))}
        </div>
      ) : health.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-6 text-sm text-red-600 dark:text-red-400">
          {(health.error as Error).message}
        </div>
      ) : (
        <>
          <div className="dashboard-metrics-grid grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {metrics.map((m) => {
              const numVal = Number(m.value) || 0
              const useActivity = ['maxLag', 'totalLag', 'underReplicated', 'offlinePartitions'].includes(m.sparkKey)
              const spark =
                useActivity && activityHistory.length > 1
                  ? sparklineFromActivity(activityHistory, m.sparkKey)
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

          <div className="dashboard-middle">
            <div className="min-h-0 h-full overflow-hidden">
              <ClusterMetricsChart
                inventory={{
                  brokers: brokerCount,
                  topics: topicCount,
                  partitions: partitionCount,
                  consumerGroups: groupCount,
                }}
                messageActivity={messageActivity}
              />
            </div>
            <div className="min-h-0 h-full overflow-hidden">
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

          <div className="dashboard-bottom">
            <TopTopicsChart topics={topics.data?.items ?? []} />
            <RecentActivity entries={auditEntries} />
            <ClusterLoad
              partitionCount={partitionCount}
              brokerCount={brokerCount}
              totalLag={totalLag}
              underReplicated={underReplicated}
            />
          </div>

          <DashboardStatusBar refreshIntervalSec={REFRESH_SEC} />
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
