import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { api, type ACLInfo } from '../api/client'
import { RequireCluster } from '../components/ClusterEmptyState'
import { PermissionGuard } from '../components/rbac/PermissionGuard'
import { useClusterId } from '../hooks/useClusterId'
import { DataTable, PageHeader, StatusBadge } from '../components/ui/DataTable'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { FormField } from '../components/ui/FormField'
import { ConfirmDialog } from '../components/ui/Dialog'
import { Drawer } from '../components/ui/Drawer'
import { RowActionsMenu, type RowAction } from '../components/ui/RowActionsMenu'
import { useToast } from '../context/ToastContext'

const emptyACL: ACLInfo = {
  principal: '',
  host: '*',
  operation: 'READ',
  permission_type: 'ALLOW',
  resource_type: 'TOPIC',
  resource_name: '',
  pattern_type: 'LITERAL',
}

const OPERATIONS = [
  'READ', 'WRITE', 'CREATE', 'DELETE', 'ALTER', 'DESCRIBE',
  'CLUSTER_ACTION', 'DESCRIBE_CONFIGS', 'ALTER_CONFIGS', 'IDEMPOTENT_WRITE', 'ALL', 'ANY',
]

function ACLDetail({ acl }: { acl: ACLInfo }) {
  return (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div className="col-span-2">
        <dt className="text-xs text-sf-muted">Principal</dt>
        <dd className="mt-1 font-mono text-xs break-all">{acl.principal}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Host</dt>
        <dd className="mt-1 font-mono text-xs">{acl.host || '*'}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Pattern type</dt>
        <dd className="mt-1">{acl.pattern_type}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Resource</dt>
        <dd className="mt-1 font-mono text-xs">{acl.resource_type}:{acl.resource_name || '*'}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Operation</dt>
        <dd className="mt-1">{acl.operation}</dd>
      </div>
      <div>
        <dt className="text-xs text-sf-muted">Permission</dt>
        <dd className="mt-1"><StatusBadge status={acl.permission_type} /></dd>
      </div>
    </dl>
  )
}

function ACLsContent() {
  const clusterId = useClusterId()
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [resourceNameFilter, setResourceNameFilter] = useState('')
  const [form, setForm] = useState<ACLInfo>(emptyACL)
  const [viewAcl, setViewAcl] = useState<ACLInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ACLInfo | null>(null)
  const [showBroadWarning, setShowBroadWarning] = useState(false)

  const queryParams = useMemo(() => {
    const p: { resource_type?: string; resource_name?: string } = {}
    if (resourceTypeFilter) p.resource_type = resourceTypeFilter
    if (resourceNameFilter.trim()) p.resource_name = resourceNameFilter.trim()
    return Object.keys(p).length ? p : undefined
  }, [resourceTypeFilter, resourceNameFilter])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['acls', clusterId, queryParams],
    queryFn: () => api.acls(clusterId, queryParams),
    enabled: !!clusterId,
  })

  const create = useMutation({
    mutationFn: () => api.createACL(clusterId, form),
    onSuccess: () => {
      toast.success('ACL created')
      setForm(emptyACL)
      setShowBroadWarning(false)
      qc.invalidateQueries({ queryKey: ['acls', clusterId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (acl: ACLInfo) => api.deleteACL(clusterId, acl),
    onSuccess: () => {
      toast.success('ACL deleted')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['acls', clusterId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const acls = data?.items ?? []
  const isBroadPermission = form.operation === 'ALL' || form.operation === 'ANY' || form.resource_name === '*'

  const submitCreate = () => {
    if (isBroadPermission && !showBroadWarning) {
      setShowBroadWarning(true)
      return
    }
    create.mutate()
  }

  const aclActions = (a: ACLInfo): RowAction[] => [
    { label: 'View', onClick: () => setViewAcl(a) },
    {
      label: 'Edit',
      disabled: true,
      disabledReason: 'ACLs cannot be edited. Delete and recreate the ACL.',
      onClick: () => {},
    },
    {
      label: 'Delete',
      destructive: true,
      onClick: () => setDeleteTarget(a),
    },
  ]

  return (
    <>
      <PageHeader title="ACLs" description="View and manage Kafka ACLs (requires cluster authorization enabled)." />

      <PermissionGuard permission="acl.manage">
        <div className="mb-6 rounded-xl border border-sf-border bg-sf-panel p-4">
          <h2 className="mb-3 font-heading text-sm font-bold">Create ACL</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Principal" description="e.g. User:alice">
              <Input
                value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })}
                placeholder="User:alice"
              />
            </FormField>
            <FormField label="Host" description="Client host restriction">
              <Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="*" />
            </FormField>
            <FormField label="Resource type">
              <Select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })}>
                <option value="TOPIC">TOPIC</option>
                <option value="GROUP">GROUP</option>
                <option value="CLUSTER">CLUSTER</option>
                <option value="TRANSACTIONAL_ID">TRANSACTIONAL_ID</option>
                <option value="DELEGATION_TOKEN">DELEGATION_TOKEN</option>
              </Select>
            </FormField>
            <FormField label="Resource name" description="Use * for all resources of this type">
              <Input
                value={form.resource_name}
                onChange={(e) => setForm({ ...form, resource_name: e.target.value })}
                placeholder="orders or *"
              />
            </FormField>
            <FormField label="Pattern type">
              <Select value={form.pattern_type} onChange={(e) => setForm({ ...form, pattern_type: e.target.value })}>
                <option value="LITERAL">LITERAL</option>
                <option value="PREFIXED">PREFIXED</option>
                <option value="MATCH">MATCH</option>
                <option value="ANY">ANY</option>
              </Select>
            </FormField>
            <FormField label="Operation">
              <Select value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value })}>
                {OPERATIONS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Permission">
              <Select value={form.permission_type} onChange={(e) => setForm({ ...form, permission_type: e.target.value })}>
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
              </Select>
            </FormField>
          </div>

          {isBroadPermission && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Broad permission: <strong>{form.operation}</strong> on{' '}
                <strong>{form.resource_type}:{form.resource_name || '*'}</strong> grants wide access.
                Confirm only if this is intentional.
              </span>
            </div>
          )}

          {showBroadWarning && (
            <ConfirmDialog
              open={showBroadWarning}
              onClose={() => setShowBroadWarning(false)}
              onConfirm={() => {
                setShowBroadWarning(false)
                create.mutate()
              }}
              title="Create broad ACL?"
              description={`This ACL grants ${form.operation} on ${form.resource_type}:${form.resource_name || '*'} for ${form.principal}. Broad permissions can expose your entire cluster.`}
              confirmLabel="Create ACL anyway"
              loading={create.isPending}
            />
          )}

          <div className="mt-4">
            <Button onClick={submitCreate} loading={create.isPending} disabled={!form.principal.trim()}>
              Create ACL
            </Button>
          </div>
        </div>
      </PermissionGuard>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormField label="Search" className="min-w-[200px]">
          <Input placeholder="Principal or resource…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </FormField>
        <FormField label="Resource type">
          <Select value={resourceTypeFilter} onChange={(e) => setResourceTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="TOPIC">TOPIC</option>
            <option value="GROUP">GROUP</option>
            <option value="CLUSTER">CLUSTER</option>
            <option value="TRANSACTIONAL_ID">TRANSACTIONAL_ID</option>
            <option value="DELEGATION_TOKEN">DELEGATION_TOKEN</option>
          </Select>
        </FormField>
        <FormField label="Resource name">
          <Input
            placeholder="Filter by name…"
            value={resourceNameFilter}
            onChange={(e) => setResourceNameFilter(e.target.value)}
          />
        </FormField>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Apply filters
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'principal', header: 'Principal', render: (a) => <span className="font-mono text-xs">{a.principal}</span> },
          { key: 'host', header: 'Host', render: (a) => <span className="font-mono text-xs">{a.host || '*'}</span> },
          {
            key: 'resource',
            header: 'Resource',
            render: (a) => (
              <span className="font-mono text-xs">
                {a.resource_type}:{a.resource_name || '*'}
                <span className="ml-1 text-sf-muted">({a.pattern_type})</span>
              </span>
            ),
          },
          { key: 'op', header: 'Operation', render: (a) => a.operation },
          { key: 'perm', header: 'Permission', render: (a) => <StatusBadge status={a.permission_type} /> },
          {
            key: 'actions',
            header: 'Actions',
            className: 'w-16 text-right',
            render: (a) => (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <PermissionGuard permission="acl.manage">
                  <RowActionsMenu actions={aclActions(a)} label={`Actions for ${a.principal}`} />
                </PermissionGuard>
              </div>
            ),
          },
        ]}
        data={acls}
        keyFn={(a) => `${a.principal}-${a.resource_type}-${a.resource_name}-${a.operation}-${a.host}`}
        loading={isLoading}
        error={error ? (error as Error).message : undefined}
        emptyTitle="No ACLs"
        filter={search}
        filterFn={(a, f) =>
          `${a.principal} ${a.resource_name} ${a.resource_type}`.toLowerCase().includes(f.toLowerCase())
        }
        onRowClick={setViewAcl}
      />

      <Drawer open={!!viewAcl} onClose={() => setViewAcl(null)} title="ACL details">
        {viewAcl && (
          <>
            <ACLDetail acl={viewAcl} />
            <PermissionGuard permission="acl.manage">
              <div className="mt-6">
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(viewAcl)}>
                  Delete ACL
                </Button>
              </div>
            </PermissionGuard>
          </>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
        title="Delete ACL?"
        description="This removes the ACL from Kafka."
        resourceName={deleteTarget ? `${deleteTarget.principal} → ${deleteTarget.resource_type}:${deleteTarget.resource_name}` : undefined}
        confirmLabel="Delete ACL"
        loading={remove.isPending}
      />
    </>
  )
}

export default function ACLsPage() {
  return (
    <RequireCluster resource="ACLs">
      <ACLsContent />
    </RequireCluster>
  )
}
