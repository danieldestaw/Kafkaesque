import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { RequireCluster } from '../components/ClusterEmptyState'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { useClusterId } from '../hooks/useClusterId'
import { DataTable, PageHeader } from '../components/ui/DataTable'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useToast } from '../context/ToastContext'

function SchemasContent() {
  const clusterId = useClusterId()
  const toast = useToast()
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [schemaText, setSchemaText] = useState('')
  const [newSubject, setNewSubject] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schemas', clusterId],
    queryFn: () => api.schemas(clusterId),
    enabled: !!clusterId,
  })

  const schemaDetail = useQuery({
    queryKey: ['schema', clusterId, selected],
    queryFn: () => api.getSchema(clusterId, selected!),
    enabled: !!clusterId && !!selected,
  })

  const subjects = data?.items ?? []

  const register = async () => {
    if (!newSubject.trim() || !schemaText.trim()) return
    try {
      await api.registerSchema(clusterId, newSubject.trim(), { schema: schemaText, schema_type: 'AVRO' })
      toast.success('Schema registered')
      setNewSubject('')
      setSchemaText('')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to register schema')
    }
  }

  return (
    <>
      <PageHeader
        title="Schema Registry"
        description="Browse and register Avro/JSON schemas via Confluent Schema Registry."
      />

      <PermissionGuard permission="schema.write">
        <div className="mb-6 rounded-lg border border-sf-border p-4 space-y-3">
          <h3 className="text-sm font-semibold">Register schema</h3>
          <Input placeholder="Subject name (e.g. orders-value)" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
          <textarea
            className="w-full min-h-[120px] rounded-md border border-sf-border bg-sf-bg px-3 py-2 font-mono text-xs"
            placeholder='{"type":"record","name":"Order",...}'
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
          />
          <Button onClick={register} disabled={!newSubject.trim() || !schemaText.trim()}>Register</Button>
        </div>
      </PermissionGuard>

      <div className="mb-4">
        <Input placeholder="Filter subjects…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
      </div>

      <DataTable
        columns={[{ key: 'subject', header: 'Subject', render: (s) => <span className="font-mono text-xs">{s}</span> }]}
        data={subjects}
        keyFn={(s) => s}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No schemas"
        emptyDescription="Configure schema_registry_url on the cluster or register a schema."
        filter={filter}
        filterFn={(s, f) => s.toLowerCase().includes(f.toLowerCase())}
        onRowClick={setSelected}
        selectedKey={selected ?? undefined}
      />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ?? 'Schema'}>
        {schemaDetail.isLoading && <p className="text-sm text-sf-muted">Loading…</p>}
        {schemaDetail.data && (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-sf-bg rounded-lg p-3 border border-sf-border">
            {schemaDetail.data.schema}
          </pre>
        )}
      </Drawer>
    </>
  )
}

export default function SchemasPage() {
  return (
    <RequireCluster resource="schemas">
      <SchemasContent />
    </RequireCluster>
  )
}
