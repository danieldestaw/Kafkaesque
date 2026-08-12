import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Topic } from '../../api/client'
import { DashboardPanel, WidgetFooterLink } from './DashboardWidget'

const COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f97316', '#64748b']

export function TopTopicsChart({ topics }: { topics: Topic[] }) {
  const visible = topics.filter((t) => !t.internal).sort((a, b) => b.partitions - a.partitions)
  const top = visible.slice(0, 4)
  const restPartitions = visible.slice(4).reduce((s, t) => s + t.partitions, 0)
  const totalPartitions = visible.reduce((s, t) => s + t.partitions, 0) || 1

  const slices = [
    ...top.map((t) => ({ name: t.name, value: t.partitions })),
    ...(restPartitions > 0 ? [{ name: 'others', value: restPartitions }] : []),
  ]

  if (slices.length === 0) {
    return (
      <DashboardPanel title="Top Topics by Messages" footer={<WidgetFooterLink to="/topics" label="View all topics" />}>
        <p className="text-sm text-sf-muted py-8 text-center">No topics found.</p>
      </DashboardPanel>
    )
  }

  return (
    <DashboardPanel
      title="Top Topics by Messages"
      footer={<WidgetFooterLink to="/topics" label="View all topics" />}
    >
      <div className="flex gap-3 items-center">
        <div className="relative w-[130px] h-[130px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={52}
                dataKey="value"
                stroke="none"
              >
                {slices.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--sf-panel)',
                  border: '1px solid var(--sf-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  `${((value / totalPartitions) * 100).toFixed(1)}%`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold tabular-nums">{visible.length}</span>
            <span className="text-[9px] text-sf-muted text-center leading-tight">Total<br />Topics</span>
          </div>
        </div>

        <ul className="flex-1 space-y-2 min-w-0">
          {slices.map((s, i) => (
            <li key={s.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-sf-muted">{s.name}</span>
              </span>
              <span className="font-semibold tabular-nums shrink-0">
                {((s.value / totalPartitions) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardPanel>
  )
}
