import { ChevronDown } from 'lucide-react'
import { useClusterContext } from '../../hooks/useClusterId'

function formatUptime(lastConnected?: string) {
  if (!lastConnected) return '—'
  const start = new Date(lastConnected).getTime()
  if (Number.isNaN(start)) return '—'
  const diff = Math.max(0, Date.now() - start)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

type Props = {
  refreshIntervalSec?: number
}

export function DashboardStatusBar({ refreshIntervalSec = 10 }: Props) {
  const { selectedCluster } = useClusterContext()
  const clusterLabel = selectedCluster?.name?.toLowerCase().replace(/\s+/g, '-') || '—'

  return (
    <div className="dashboard-status-bar mt-2 flex shrink-0 flex-col gap-2 rounded-lg border border-sf-border bg-sf-input/60 px-3 py-2 text-[10px] text-sf-muted sm:flex-row sm:items-center sm:justify-between sm:py-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Kafka Version: <span className="font-medium text-sf-text">{selectedCluster?.kafka_version || '—'}</span>
        </span>
        <span className="hidden sm:inline">|</span>
        <span>
          Cluster ID: <span className="font-mono font-medium text-sf-text">{clusterLabel}</span>
        </span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:inline">
          Uptime: <span className="font-medium text-sf-text">{formatUptime(selectedCluster?.last_connected_at)}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
        <span>Auto refresh: {refreshIntervalSec}s</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </div>
    </div>
  )
}
