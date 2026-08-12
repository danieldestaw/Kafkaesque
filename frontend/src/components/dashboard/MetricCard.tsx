import { type LucideIcon } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

type Props = {
  label: string
  value: string | number
  subtitle: string
  icon: LucideIcon
  color: string
  sparkData: { v: number }[]
  sparkId: string
}

export function MetricCard({ label, value, subtitle, icon: Icon, color, sparkData, sparkId }: Props) {
  return (
    <div className="rounded-xl border border-sf-border bg-sf-panel p-3.5 flex flex-col min-h-[108px] transition-shadow hover:shadow-md hover:shadow-black/10">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mb-2"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="text-[11px] font-medium text-sf-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</div>
      <div className="text-[11px] text-sf-muted mt-0.5">{subtitle}</div>
      <div className="mt-auto pt-2 h-9 -mx-1" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`spark-${sparkId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#spark-${sparkId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
