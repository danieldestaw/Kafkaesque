import { Shield } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { DashboardPanel, WidgetFooterLink } from './DashboardWidget'

type Props = {
  status: string
  brokerCount: number
  onlineBrokers: number
  healthyPartitions: number
  replicationPct: number
  diskUsagePct: number
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-amber-500'}`}
    />
  )
}

export function ClusterHealthPanel({
  status,
  brokerCount,
  onlineBrokers,
  healthyPartitions,
  replicationPct,
  diskUsagePct,
}: Props) {
  const healthy = status.toUpperCase() === 'HEALTHY'
  const pct = healthy ? Math.max(replicationPct, 85) : Math.min(replicationPct, 60)
  const donutData = [
    { name: 'health', value: pct },
    { name: 'rest', value: 100 - pct },
  ]
  const color = healthy ? '#22c55e' : '#ef4444'

  const rows = [
    { label: 'Brokers', value: `${onlineBrokers}/${brokerCount} online`, ok: onlineBrokers === brokerCount && brokerCount > 0 },
    { label: 'Partitions', value: `${healthyPartitions} healthy`, ok: healthyPartitions > 0 },
    { label: 'Replication', value: `${replicationPct}%`, ok: replicationPct >= 100 },
    { label: 'Disk Usage', value: `${diskUsagePct}% used`, ok: diskUsagePct < 80 },
  ]

  return (
    <DashboardPanel
      title="Cluster Health"
      footer={<WidgetFooterLink to="/brokers" label="View detailed health" />}
    >
      <div className="flex gap-4 items-center">
        <div className="relative w-[120px] h-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={52}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="var(--sf-border)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: `${color}20` }}
            >
              <Shield className="h-4 w-4" style={{ color }} />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color }}>
            {status.toUpperCase()}
          </p>
          <p className="text-[11px] text-sf-muted mb-3">
            {healthy ? 'All systems operational' : 'Attention required'}
          </p>
          <ul className="space-y-2 text-xs">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center gap-2">
                <StatusDot ok={r.ok} />
                <span className="text-sf-muted flex-1">{r.label}</span>
                <span className="font-medium tabular-nums">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardPanel>
  )
}
