import { Server } from 'lucide-react'
import { useClusterContext } from '../context/ClusterContext'
import { useDialogs } from '../context/DialogContext'
import { Button } from './ui/Button'

type Props = {
  resource?: string
}

export function ClusterEmptyState({ resource = 'this page' }: Props) {
  const { isLoading, hasClusters, clusterId, setClusterId, clusters } = useClusterContext()
  const { openAddCluster } = useDialogs()

  if (isLoading) {
    return (
      <div className="rounded-lg border border-sf-border bg-sf-panel p-8 space-y-4">
        <div className="h-5 w-48 animate-pulse rounded bg-sf-border/60" />
        <div className="h-4 w-72 animate-pulse rounded bg-sf-border/40" />
        <div className="h-10 w-32 animate-pulse rounded bg-sf-border/40" />
      </div>
    )
  }

  if (!hasClusters) {
    return (
      <div className="rounded-lg border border-sf-border bg-sf-panel p-10 text-center max-w-lg mx-auto mt-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sf-accent/10 mb-4">
          <Server className="h-6 w-6 text-sf-accent" />
        </div>
        <h2 className="text-lg font-semibold">No Kafka cluster connected</h2>
        <p className="text-sm text-sf-muted mt-2 leading-relaxed">
          Connect a Kafka cluster to start managing topics, brokers, messages, and consumer groups.
        </p>
        <Button className="mt-6" onClick={openAddCluster}>
          Add cluster
        </Button>
      </div>
    )
  }

  if (!clusterId) {
    return (
      <div className="rounded-lg border border-sf-border bg-sf-panel p-10 text-center max-w-lg mx-auto mt-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sf-accent/10 mb-4">
          <Server className="h-6 w-6 text-sf-accent" />
        </div>
        <h2 className="text-lg font-semibold">Select a cluster</h2>
        <p className="text-sm text-sf-muted mt-2">
          Choose a Kafka cluster to continue viewing {resource}.
        </p>
        <div className="mt-6 flex flex-col gap-2 items-center">
          {clusters.map((c) => (
            <Button key={c.id} variant="secondary" onClick={() => setClusterId(c.id)}>
              {c.name}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export function RequireCluster({
  children,
  resource,
}: {
  children: React.ReactNode
  resource?: string
}) {
  const { clusterReady } = useClusterContext()

  if (!clusterReady) {
    return <ClusterEmptyState resource={resource} />
  }

  return <>{children}</>
}
