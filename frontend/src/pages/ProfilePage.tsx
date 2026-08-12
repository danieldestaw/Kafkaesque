import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../stores/auth'
import { usePermissions } from '../auth/usePermissions'
import { usePageTitle } from '../hooks/usePageTitle'
import { api } from '../api/client'
import { RoleBadge, UserAvatar, UserStatusBadge } from '../components/rbac/Badges'
import { PageHeader } from '../components/ui/DataTable'
import { Card } from '../components/ui/Card'
import { FormField } from '../components/ui/FormField'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useToast } from '../context/ToastContext'

export default function ProfilePage() {
  usePageTitle('Account')
  const { user, logout } = useAuth()
  const { permissions } = usePermissions()
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const changePw = useMutation({
    mutationFn: () => api.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      toast.success('Password changed — please sign in again')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      logout()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!user) return null

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword

  return (
    <>
      <PageHeader title="Account" description="Manage your profile and security." />

      <div className="max-w-2xl space-y-4">
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <UserAvatar name={user.display_name} email={user.email} />
            <div>
              <h2 className="font-semibold">{user.display_name || user.email}</h2>
              <p className="text-sm text-sf-muted">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={user.role} />
                <UserStatusBadge active={user.is_active !== false} />
              </div>
            </div>
          </div>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-sf-muted">User ID</dt>
              <dd className="mt-0.5 font-mono text-xs">{user.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-sf-muted">Permissions</dt>
              <dd className="mt-0.5">{permissions.length} via role</dd>
            </div>
            {user.last_login_at && (
              <div>
                <dt className="text-xs text-sf-muted">Last login</dt>
                <dd className="mt-0.5">{new Date(user.last_login_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <h3 className="font-medium mb-1">Change password</h3>
          <p className="text-sm text-sf-muted mb-4">
            Changing your password will sign you out of all sessions.
          </p>
          <div className="space-y-4 max-w-md">
            <FormField label="Current password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </FormField>
            <FormField label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirm new password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <Button
              onClick={() => changePw.mutate()}
              loading={changePw.isPending}
              disabled={!canSubmit}
            >
              Change password
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
