import { CHART } from '../../lib/chartColors'
import { DashboardPanel, WidgetFooterLink } from './DashboardWidget'

type BarProps = {
  label: string
  value: number
  color: string
  caption?: string
}

function LoadBar({ label, value, color, caption }: BarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-sf-muted">{label}</span>
        <span className="font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sf-border/50">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {caption && <p className="mt-0.5 text-[9px] leading-tight text-sf-muted">{caption}</p>}
    </div>
  )
}

type Props = {
  partitionCount: number
  brokerCount: number
  totalLag: number
  underReplicated: number
}

/** Kafka-oriented load indicators derived from live cluster metadata. */
export function ClusterLoad({ partitionCount, brokerCount, totalLag, underReplicated }: Props) {
  const partitionsPerBroker = brokerCount > 0 ? partitionCount / brokerCount : 0
  const partitionLoad = Math.min(95, Math.round((partitionsPerBroker / 100) * 100))
  const lagLoad = Math.min(95, Math.round(Math.log10(totalLag + 1) * 18))
  const replicationLoad = underReplicated > 0 ? Math.min(95, underReplicated * 12) : 8

  return (
    <DashboardPanel
      title="Cluster Load"
      compact
      footer={<WidgetFooterLink to="/consumers" label="View consumer groups" />}
    >
      <div className="flex h-full min-h-0 flex-col justify-center space-y-2.5 py-0.5">
        <LoadBar
          label="Partition density"
          value={partitionLoad}
          color={CHART.primary}
          caption={`${Math.round(partitionsPerBroker)} partitions / broker`}
        />
        <LoadBar
          label="Consumer lag"
          value={lagLoad}
          color={CHART.magenta}
          caption={
            totalLag > 0 ? `${totalLag.toLocaleString()} messages behind` : 'No significant lag'
          }
        />
        <LoadBar
          label="Replication stress"
          value={replicationLoad}
          color={CHART.green}
          caption={underReplicated > 0 ? `${underReplicated} under-replicated` : 'Fully replicated'}
        />
      </div>
    </DashboardPanel>
  )
}
