/** Shared chart palette — matches login hero accents + primary blue. */
export const CHART = {
  primary: '#0057b8',
  magenta: '#e879a8',
  orange: '#f97316',
  green: '#22c55e',
  blue: '#3b82f6',
  slate: '#64748b',
} as const

export const CHART_SERIES = [
  { key: 'primary', color: CHART.primary, label: 'Primary' },
  { key: 'magenta', color: CHART.magenta, label: 'Magenta' },
  { key: 'orange', color: CHART.orange, label: 'Orange' },
  { key: 'green', color: CHART.green, label: 'Green' },
] as const
