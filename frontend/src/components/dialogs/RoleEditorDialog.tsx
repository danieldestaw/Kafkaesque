import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type PermissionGroup, type RoleRecord } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'

type Props = {
  open: boolean
  role: RoleRecord | null
  onClose: () => void
}

export function RoleEditorDialog({ open, role, onClose }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const isEdit = !!role

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [roleId, setRoleId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: permData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.permissions(),
    enabled: open,
  })

  const groups = permData?.items ?? []

  useEffect(() => {
    if (open) {
      setName(role?.name ?? '')
      setDescription(role?.description ?? '')
      setRoleId(role?.id ?? '')
      setSelected(new Set(role?.permissions ?? []))
    }
  }, [open, role?.id])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCategory = (group: PermissionGroup, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of group.permissions) {
        if (on) next.add(p.id)
        else next.delete(p.id)
      }
      return next
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      const perms = Array.from(selected)
      if (isEdit && role) {
        return api.updateRole(role.id, { name, description, permissions: perms })
      }
      return api.createRole({ id: roleId || undefined, name, description, permissions: perms })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success(isEdit ? 'Role updated' : 'Role created')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const permissionList = useMemo(
    () => groups.flatMap((g) => g.permissions.map((p) => ({ ...p, category: g.category }))),
    [groups],
  )

  const handleClose = () => {
    if (save.isPending) return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit role' : 'Create role'}
      description="Permissions are stored in the database and enforced by the backend."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => name.trim() && save.mutate()}
            loading={save.isPending}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {!isEdit && (
          <FormField label="Role ID" description="Optional slug (e.g. MANAGER). Auto-generated from name if empty.">
            <Input
              value={roleId}
              onChange={(e) => setRoleId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="MANAGER"
              data-autofocus
            />
          </FormField>
        )}
        <FormField label="Role name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-autofocus={isEdit}
          />
        </FormField>
        <FormField label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>

        <div>
          <h3 className="text-sm font-semibold mb-3">Permissions</h3>
          <div className="space-y-4">
            {groups.map((group) => {
              const ids = group.permissions.map((p) => p.id)
              const allOn = ids.every((id) => selected.has(id))
              const someOn = ids.some((id) => selected.has(id))
              return (
                <div key={group.category} className="rounded-lg border border-sf-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">{group.category}</span>
                    <button
                      type="button"
                      className="text-xs text-sf-accent hover:underline"
                      onClick={() => toggleCategory(group, !allOn)}
                    >
                      {allOn ? 'Clear all' : someOn ? 'Select all' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {group.permissions.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-sf-border/30"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                          className="rounded border-sf-border"
                        />
                        <span className="capitalize">{p.action.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-sf-muted font-mono ml-auto">{p.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
            {permissionList.length === 0 && (
              <p className="text-sm text-sf-muted">Loading permissions…</p>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
