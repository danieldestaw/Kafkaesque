import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActivitySnapshot } from '../../hooks/useMetricHistory'
import { CHART } from '../../lib/chartColors'
import { DashboardPanel } from './DashboardWidget'

type Inventory = {
  brokers: number
  topics: number
  partitions: number
  consumerGroups: number
}

export type MessageActivityPoint = {
  label: string
  messagesIn: number
  messagesOut: number
}

const INVENTORY_COLORS = [CHART.primary, CHART.blue, CHART.green, CHART.orange]

function InventoryBars({ inventory }: { inventory: Inventory }) {
  const rows = [
    { name: 'Brokers', value: inventory.brokers },
    { name: 'Topics', value: inventory.topics },
    { name: 'Partitions', value: inventory.partitions },
    { name: 'Groups', value: inventory.consumerGroups },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-sf-muted">Cluster inventory</p>
      <div className="min-h-0 flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--sf-border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} stroke="var(--sf-muted)" axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={64}
              tick={{ fontSize: 9 }}
              stroke="var(--sf-muted)"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--sf-panel)',
                border: '1px solid var(--sf-border)',
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
              {rows.map((_, i) => (
                <Cell key={i} fill={INVENTORY_COLORS[i % INVENTORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LiveActivityChart({ data }: { data: MessageActivityPoint[] }) {
  const hasData = data.length >= 2

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-sf-border pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-sf-muted">Live activity (last 30 min)</p>

      {!hasData ? (
        <div className="flex flex-1 items-center justify-center rounded-lg bg-sf-input px-3 py-2 text-center text-[11px] text-sf-muted">
          Collecting samples…
        </div>
      ) : (
        <div className="min-h-0 flex-1 w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sf-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--sf-muted)" tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 9 }} stroke="var(--sf-muted)" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--sf-panel)',
                  border: '1px solid var(--sf-border)',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="messagesIn" name="Messages In" stroke={CHART.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="messagesOut" name="Messages Out" stroke={CHART.magenta} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function ClusterMetricsChart({
  inventory,
  messageActivity,
}: {
  inventory: Inventory
  activity?: ActivitySnapshot[]
  messageActivity: MessageActivityPoint[]
}) {
  return (
    <DashboardPanel
      title="Cluster Overview"
      compact
      action={
        <span className="rounded-md border border-sf-border bg-sf-input px-1.5 py-0.5 text-[9px] text-sf-muted">
          Last 30 min
        </span>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <InventoryBars inventory={inventory} />
        <LiveActivityChart data={messageActivity} />
      </div>
    </DashboardPanel>
  )
}
