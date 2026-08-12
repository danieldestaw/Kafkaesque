import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, type PlatformUser } from '../../api/client'
import { useAuth } from '../../stores/auth'
import { usePermissions } from '../../auth/usePermissions'
import { usePageTitle } from '../../hooks/usePageTitle'
import { PermissionGuard } from '../../components/rbac/PermissionGuard'
import { UserTable, type UserRow } from '../../components/rbac/UserTable'
import { UserDetailsDrawer } from '../../components/rbac/UserDetails'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { AddUserDialog } from '../../components/dialogs/AddUserDialog'
import { EditUserDialog } from '../../components/dialogs/EditUserDialog'

function formatLastLogin(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  return d.toLocaleDateString()
}

function toRow(u: PlatformUser): UserRow {
  return {
    id: u.id,
    display_name: u.display_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active !== false,
    last_login: formatLastLogin(u.last_login_at),
  }
}

export default function UsersPage() {
  usePageTitle('Users')
  const { user: currentUser } = useAuth()
  const { can } = usePermissions()
  const toast = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [selected, setSelected] = useState<UserRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users(),
  })

  const users = useMemo(() => (data?.items ?? []).map(toRow), [data?.items])

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['users'] }), [qc])

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      invalidate()
      toast.success('User deleted')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const disable = useMutation({
    mutationFn: (id: string) => api.disableUser(id),
    onSuccess: () => {
      invalidate()
      toast.success('User disabled')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const enable = useMutation({
    mutationFn: (id: string) => api.enableUser(id),
    onSuccess: () => {
      invalidate()
      toast.success('User enabled')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetPw = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.resetUserPassword(id, { password, reason: 'admin reset' }),
    onSuccess: () => {
      invalidate()
      toast.success('Password reset')
      setResetTarget(null)
      setNewPassword('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeUserSessions(id),
    onSuccess: () => toast.success('Sessions revoked'),
    onError: (e: Error) => toast.error(e.message),
  })

  const rowActions = useCallback(
    (u: UserRow) => [
      { label: 'View user', onClick: () => setSelected(u) },
      {
        label: 'Edit user',
        onClick: () => setEditTarget(u),
        disabled: !can('users.update'),
      },
      {
        label: 'Reset password',
        onClick: () => {
          setResetTarget(u)
          setNewPassword('')
        },
        disabled: !can('users.reset_password'),
      },
      {
        label: u.is_active ? 'Disable account' : 'Enable account',
        onClick: () => (u.is_active ? disable.mutate(u.id) : enable.mutate(u.id)),
        disabled: !can('users.disable') || u.id === currentUser?.id,
        disabledReason: u.id === currentUser?.id ? 'Cannot disable yourself' : undefined,
      },
      {
        label: 'Delete user',
        onClick: () => setDeleteTarget(u),
        destructive: true,
        disabled: !can('users.delete') || u.id === currentUser?.id,
      },
      {
        label: 'Revoke sessions',
        onClick: () => revoke.mutate(u.id),
        disabled: !can('users.update'),
      },
      {
        label: 'View audit activity',
        onClick: () => navigate('/audit'),
        disabled: !can('audit.read'),
      },
    ],
    [can, currentUser?.id, disable, enable, navigate, revoke],
  )

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage platform users, roles, and access."
        actions={
          <PermissionGuard permission="users.create">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add user
            </Button>
          </PermissionGuard>
        }
      />

      <UserTable
        users={users}
        loading={isLoading}
        onRowClick={setSelected}
        emptyTitle={error ? 'Failed to load users' : 'No users found'}
        emptyDescription={error ? (error as Error).message : undefined}
        rowActions={rowActions}
      />

      <UserDetailsDrawer open={!!selected} onClose={() => setSelected(null)} user={selected} />

      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <EditUserDialog user={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        title="Delete user?"
        description="This will permanently remove the user account."
        resourceName={deleteTarget?.display_name || deleteTarget?.email}
        confirmLabel="Delete user"
        loading={remove.isPending}
      />

      <Dialog
        open={!!resetTarget}
        onClose={() => {
          if (resetPw.isPending) return
          setResetTarget(null)
          setNewPassword('')
        }}
        title="Reset password"
        description={`Set a new password for ${resetTarget?.email}. Active sessions will be invalidated.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResetTarget(null)
                setNewPassword('')
              }}
              disabled={resetPw.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                resetTarget &&
                newPassword.length >= 6 &&
                resetPw.mutate({ id: resetTarget.id, password: newPassword })
              }
              loading={resetPw.isPending}
              disabled={newPassword.length < 6}
            >
              Reset password
            </Button>
          </>
        }
      >
        <FormField label="New password" required description="Minimum 6 characters">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            data-autofocus
            autoComplete="new-password"
          />
        </FormField>
      </Dialog>
    </>
  )
}
