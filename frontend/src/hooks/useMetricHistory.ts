import { useEffect, useRef, useState } from 'react'

export type MetricSnapshot = {
  ts: number
  label: string
  brokers: number
  topics: number
  partitions: number
  consumerGroups: number
}

const MAX_POINTS = 30
const WINDOW_MS = 30 * 60 * 1000
const SEED_POINTS = 12

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function seedHistory(
  values: Pick<MetricSnapshot, 'brokers' | 'topics' | 'partitions' | 'consumerGroups'>,
  now: number,
): MetricSnapshot[] {
  const interval = WINDOW_MS / (SEED_POINTS - 1)
  return Array.from({ length: SEED_POINTS }, (_, i) => {
    const ts = now - (SEED_POINTS - 1 - i) * interval
    return { ts, label: formatTime(ts), ...values }
  })
}

export function useMetricHistory(
  clusterId: string | undefined,
  data: {
    broker_count?: number
    topic_count?: number
    partition_count?: number
    consumer_group_count?: number
  } | undefined,
) {
  const [history, setHistory] = useState<MetricSnapshot[]>([])
  const lastTs = useRef(0)
  const seeded = useRef(false)
  const lastCluster = useRef<string | undefined>(undefined)

  const brokers = Number(data?.broker_count) || 0
  const topics = Number(data?.topic_count) || 0
  const partitions = Number(data?.partition_count) || 0
  const consumerGroups = Number(data?.consumer_group_count) || 0

  useEffect(() => {
    if (clusterId !== lastCluster.current) {
      lastCluster.current = clusterId
      seeded.current = false
      lastTs.current = 0
      setHistory([])
    }
  }, [clusterId])

  useEffect(() => {
    if (!data || !clusterId) return

    const now = Date.now()
    const values = { brokers, topics, partitions, consumerGroups }

    if (!seeded.current) {
      seeded.current = true
      lastTs.current = now
      setHistory(seedHistory(values, now))
      return
    }

    if (now - lastTs.current < 10_000) return
    lastTs.current = now

    const snap: MetricSnapshot = { ts: now, label: formatTime(now), ...values }

    setHistory((prev) => {
      const cutoff = now - WINDOW_MS
      const next = [...prev.filter((p) => p.ts >= cutoff), snap]
      return next.slice(-MAX_POINTS)
    })
  }, [clusterId, data, brokers, topics, partitions, consumerGroups])

  return history
}

export function sparklineFromHistory(
  history: MetricSnapshot[],
  key: keyof Pick<MetricSnapshot, 'brokers' | 'topics' | 'partitions' | 'consumerGroups'>,
) {
  if (history.length === 0) {
    return [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }]
  }
  return history.map((h) => ({ v: h[key] }))
}
