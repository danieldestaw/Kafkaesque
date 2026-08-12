import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { usePermissions } from '../../auth/usePermissions'
import { useRoles } from '../../hooks/useRoles'
import { useToast } from '../../context/ToastContext'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { UserRow } from '../rbac/UserTable'

type Props = {
  user: UserRow | null
  open: boolean
  onClose: () => void
}

type FormState = {
  display_name: string
  email: string
  role: string
  is_active: boolean
}

export function EditUserDialog({ user, open, onClose }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = usePermissions()
  const { data: rolesData } = useRoles()
  const roles = rolesData?.items ?? []

  const [form, setForm] = useState<FormState>({
    display_name: '',
    email: '',
    role: 'DEVELOPER',
    is_active: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user && open) {
      setForm({
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active !== false,
      })
      setErrors({})
    }
  }, [user?.id, open])

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const update = useMutation({
    mutationFn: () =>
      api.updateUser(user!.id, {
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        role: form.role,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.display_name.trim()) e.display_name = 'Full name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleClose = () => {
    if (update.isPending) return
    onClose()
  }

  if (!user) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Edit user"
      description={`Update account details for ${user.email}.`}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => validate() && update.mutate()}
            loading={update.isPending}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Full name" required error={errors.display_name}>
          <Input
            value={form.display_name}
            onChange={(e) => set('display_name', e.target.value)}
            error={!!errors.display_name}
            data-autofocus
          />
        </FormField>
        <FormField label="Email / username" required error={errors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={!!errors.email}
          />
        </FormField>
        {can('roles.assign') ? (
          <FormField label="Role">
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              {roles.length > 0
                ? roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))
                : (
                  <>
                    <option value="ADMIN">Administrator</option>
                    <option value="OPERATOR">Operator</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="VIEWER">Viewer</option>
                  </>
                )}
            </Select>
          </FormField>
        ) : (
          <FormField label="Role">
            <Input value={form.role} disabled />
          </FormField>
        )}
        <FormField label="Status">
          <Select
            value={form.is_active ? 'active' : 'disabled'}
            onChange={(e) => set('is_active', e.target.value === 'active')}
            disabled={!can('users.disable')}
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </FormField>
      </div>
    </Dialog>
  )
}
