import { useEffect, useRef, useState } from 'react'

export type ActivitySnapshot = {
  ts: number
  label: string
  totalLag: number
  maxLag: number
  underReplicated: number
  offlinePartitions: number
}

const MAX_POINTS = 30
const WINDOW_MS = 30 * 60 * 1000
const MIN_INTERVAL_MS = 15_000

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function useActivityHistory(
  clusterId: string | undefined,
  data: {
    total_lag?: number
    max_lag?: number
    under_replicated_partitions?: number
    offline_partitions?: number
  } | undefined,
) {
  const [history, setHistory] = useState<ActivitySnapshot[]>([])
  const lastTs = useRef(0)
  const lastCluster = useRef<string | undefined>(undefined)

  const totalLag = Number(data?.total_lag) || 0
  const maxLag = Number(data?.max_lag) || 0
  const underReplicated = Number(data?.under_replicated_partitions) || 0
  const offlinePartitions = Number(data?.offline_partitions) || 0

  useEffect(() => {
    if (clusterId !== lastCluster.current) {
      lastCluster.current = clusterId
      lastTs.current = 0
      setHistory([])
    }
  }, [clusterId])

  useEffect(() => {
    if (!data || !clusterId) return

    const now = Date.now()
    if (lastTs.current && now - lastTs.current < MIN_INTERVAL_MS) return
    lastTs.current = now

    const snap: ActivitySnapshot = {
      ts: now,
      label: formatTime(now),
      totalLag,
      maxLag,
      underReplicated,
      offlinePartitions,
    }

    setHistory((prev) => {
      const cutoff = now - WINDOW_MS
      const next = [...prev.filter((p) => p.ts >= cutoff), snap]
      return next.slice(-MAX_POINTS)
    })
  }, [clusterId, data, totalLag, maxLag, underReplicated, offlinePartitions])

  return history
}

export function activityHasVariation(history: ActivitySnapshot[]): boolean {
  if (history.length < 2) return false
  const keys: (keyof Pick<ActivitySnapshot, 'totalLag' | 'maxLag' | 'underReplicated' | 'offlinePartitions'>)[] = [
    'totalLag',
    'maxLag',
    'underReplicated',
    'offlinePartitions',
  ]
  return keys.some((key) => {
    const vals = history.map((h) => h[key])
    return Math.max(...vals) !== Math.min(...vals)
  })
}

export function sparklineFromActivity(
  history: ActivitySnapshot[],
  key: keyof Pick<ActivitySnapshot, 'totalLag' | 'maxLag' | 'underReplicated' | 'offlinePartitions'>,
) {
  if (history.length === 0) {
    return [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }]
  }
  return history.map((h) => ({ v: h[key] }))
}
