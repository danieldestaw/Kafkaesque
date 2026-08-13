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

function isFlatSparkline(data: { v: number }[]) {
  if (data.length < 2) return true
  const first = data[0]?.v ?? 0
  return data.every((d) => d.v === first)
}

export function MetricCard({ label, value, subtitle, icon: Icon, color, sparkData, sparkId }: Props) {
  const showSpark = !isFlatSparkline(sparkData)

  return (
    <div className="flex min-h-[80px] flex-col rounded-xl border border-sf-border bg-sf-panel p-2.5 transition-shadow hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20">
      <div className="flex items-start gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-medium uppercase tracking-wide text-sf-muted">{label}</div>
          <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
          <div className="truncate text-[10px] text-sf-muted">{subtitle}</div>
        </div>
      </div>
      <div className="mt-1.5">
        {showSpark ? (
          <div className="h-7 -mx-0.5 overflow-hidden" aria-hidden>
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
        ) : (
          <div className="h-1 overflow-hidden rounded-full bg-sf-input" aria-hidden>
            <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: `${color}40` }} />
          </div>
        )}
      </div>
    </div>
  )
}
