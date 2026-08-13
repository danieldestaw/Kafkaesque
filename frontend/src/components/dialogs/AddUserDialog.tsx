import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useRoles } from '../../hooks/useRoles'
import { useToast } from '../../context/ToastContext'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

type Props = {
  open: boolean
  onClose: () => void
}

const EMPTY = {
  email: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  role: 'DEVELOPER',
}

export function AddUserDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: rolesData } = useRoles()
  const roles = rolesData?.items ?? []

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setErrors({})
    }
  }, [open])

  const set = (field: keyof typeof EMPTY, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => {
      if (!e[field]) return e
      const next = { ...e }
      delete next[field]
      return next
    })
  }

  const create = useMutation({
    mutationFn: () =>
      api.createUser({
        email: form.email.trim(),
        display_name: form.displayName.trim(),
        password: form.password,
        role: form.role,
        is_active: true,
      }),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`User ${u.email} created`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.email.trim()) e.email = 'Email is required'
    if (!form.displayName.trim()) e.displayName = 'Full name is required'
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleClose = () => {
    if (create.isPending) return
    onClose()
  }

  const handleSubmit = () => {
    if (!validate()) return
    create.mutate()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add user"
      description="Create a new platform user. Permissions are assigned through the selected role."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={create.isPending}>
            Create user
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Email / username" required error={errors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={!!errors.email}
            data-autofocus
            autoComplete="off"
          />
        </FormField>
        <FormField label="Full name" required error={errors.displayName}>
          <Input
            value={form.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            error={!!errors.displayName}
            autoComplete="off"
          />
        </FormField>
        <FormField label="Password" required error={errors.password}>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            error={!!errors.password}
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Confirm password" required error={errors.confirmPassword}>
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            error={!!errors.confirmPassword}
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Role" required>
          <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
            {roles.length > 0
              ? roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              : (
                <>
                  <option value="DEVELOPER">Developer</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="ADMIN">Administrator</option>
                </>
              )}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value="active" disabled>
            <option value="active">Active</option>
          </Select>
        </FormField>
      </div>
    </Dialog>
  )
}
