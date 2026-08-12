import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MetricSnapshot } from '../../hooks/useMetricHistory'
import { DashboardPanel } from './DashboardWidget'

const SERIES = [
  { key: 'brokers' as const, label: 'Brokers', color: '#a855f7' },
  { key: 'topics' as const, label: 'Topics', color: '#3b82f6' },
  { key: 'partitions' as const, label: 'Partitions', color: '#22c55e' },
  { key: 'consumerGroups' as const, label: 'Consumer Groups', color: '#f97316' },
]

export function ClusterMetricsChart({ data }: { data: MetricSnapshot[] }) {
  const chartData =
    data.length > 0
      ? data
      : [{ label: '—', brokers: 0, topics: 0, partitions: 0, consumerGroups: 0 }]

  return (
    <DashboardPanel
      title="Cluster Metrics"
      action={
        <span className="text-[10px] text-sf-muted border border-sf-border rounded-md px-2 py-0.5 bg-sf-bg/50">
          Last 30 minutes
        </span>
      }
    >
      <div className="dashboard-chart shrink-0">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--sf-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--sf-muted)" tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="var(--sf-muted)" tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--sf-panel)',
                border: '1px solid var(--sf-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#area-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardPanel>
  )
}
