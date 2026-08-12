import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Cluster } from '../api/client'

type ClusterContextValue = {
  clusterId: string
  setClusterId: (id: string) => void
  clusters: Cluster[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  selectedCluster: Cluster | null
  hasClusters: boolean
  clusterReady: boolean
}

const ClusterContext = createContext<ClusterContextValue | null>(null)

export function ClusterProvider({ children }: { children: ReactNode }) {
  const [clusterId, setClusterIdState] = useState(() => localStorage.getItem('sf_cluster') || '')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.clusters(),
  })

  const clusters = data?.items ?? []

  const setClusterId = useCallback((id: string) => {
    setClusterIdState(id)
    if (id) {
      localStorage.setItem('sf_cluster', id)
    } else {
      localStorage.removeItem('sf_cluster')
    }
  }, [])

  // Sync selection with loaded clusters: auto-select first, or clear stale IDs
  useEffect(() => {
    if (isLoading) return

    if (clusters.length === 0) {
      setClusterIdState((current) => {
        if (current) localStorage.removeItem('sf_cluster')
        return ''
      })
      return
    }

    setClusterIdState((current) => {
      const exists = clusters.some((c) => c.id === current)
      if (exists) return current
      const next = clusters[0].id
      localStorage.setItem('sf_cluster', next)
      return next
    })
  }, [isLoading, clusters])

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === clusterId) ?? null,
    [clusters, clusterId],
  )

  const value: ClusterContextValue = {
    clusterId: selectedCluster ? clusterId : '',
    setClusterId,
    clusters,
    isLoading,
    isError,
    error: error as Error | null,
    selectedCluster,
    hasClusters: clusters.length > 0,
    clusterReady: !isLoading && clusters.length > 0 && !!selectedCluster,
  }

  return <ClusterContext.Provider value={value}>{children}</ClusterContext.Provider>
}

export function useClusterContext() {
  const ctx = useContext(ClusterContext)
  if (!ctx) {
    throw new Error('useClusterContext must be used within ClusterProvider')
  }
  return ctx
}

export function useClusterId(): string {
  return useClusterContext().clusterId
}
