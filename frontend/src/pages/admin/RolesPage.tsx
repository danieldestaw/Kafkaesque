import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api, type RoleRecord } from '../../api/client'
import { usePageTitle } from '../../hooks/usePageTitle'
import { usePermissions } from '../../auth/usePermissions'
import { PermissionGuard } from '../../components/rbac/PermissionGuard'
import { PermissionBadge, RoleBadge } from '../../components/rbac/Badges'
import { RoleEditorDialog } from '../../components/dialogs/RoleEditorDialog'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../context/ToastContext'

export default function RolesPage() {
  usePageTitle('Roles')
  const { can } = usePermissions()
  const toast = useToast()
  const qc = useQueryClient()
  const [editorRole, setEditorRole] = useState<RoleRecord | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.roles(),
  })

  const roles = data?.items ?? []

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role deleted')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditorRole(null)
    setEditorOpen(true)
  }

  const openEdit = (role: RoleRecord) => {
    setEditorRole(role)
    setEditorOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Roles"
        description="Roles and permissions are stored in the database and enforced by the backend."
        actions={
          <PermissionGuard permission="roles.create">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create role
            </Button>
          </PermissionGuard>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-sf-border animate-pulse bg-sf-border/20" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <p className="text-sm text-red-600">{(error as Error).message}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{role.name}</h3>
                  <p className="text-xs text-sf-muted font-mono mt-0.5">{role.id}</p>
                  <p className="text-sm text-sf-muted mt-2 leading-relaxed line-clamp-2">{role.description}</p>
                </div>
                <RoleBadge role={role.id} />
              </div>
              <p className="text-xs text-sf-muted mt-3">
                {role.user_count ?? 0} users · {role.permissions.length} permissions
                {role.is_system ? ' · System role' : ''}
              </p>
              <div className="flex flex-wrap gap-1 mt-3 max-h-16 overflow-hidden">
                {role.permissions.slice(0, 6).map((p) => (
                  <PermissionBadge key={p} permission={p} />
                ))}
                {role.permissions.length > 6 && (
                  <span className="text-[10px] text-sf-muted">+{role.permissions.length - 6} more</span>
                )}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-sf-border">
                {can('roles.update') && (
                  <Button variant="secondary" size="sm" onClick={() => openEdit(role)}>
                    Edit
                  </Button>
                )}
                {can('roles.delete') && !role.is_system && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => setDeleteTarget(role)}
                    disabled={(role.user_count ?? 0) > 0}
                    title={(role.user_count ?? 0) > 0 ? 'Remove users from this role first' : undefined}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <RoleEditorDialog
        open={editorOpen}
        role={editorRole}
        onClose={() => setEditorOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        title="Delete role?"
        description="This will permanently remove the role."
        resourceName={deleteTarget?.name}
        confirmLabel="Delete role"
        loading={remove.isPending}
      />
    </>
  )
}
