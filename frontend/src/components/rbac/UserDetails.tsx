import { Drawer } from '../ui/Drawer'
import { RoleBadge, UserStatusBadge } from './Badges'
import type { UserRow } from './UserTable'

type Props = {
  open: boolean
  onClose: () => void
  user: UserRow | null
}

export function UserDetailsDrawer({ open, onClose, user }: Props) {
  if (!user) return null

  return (
    <Drawer open={open} onClose={onClose} title="User details" width="lg">
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-sf-muted">Account</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-sf-muted">Display name</dt>
            <dd className="mt-0.5">{user.display_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-sf-muted">Email</dt>
            <dd className="mt-0.5">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-sf-muted">Status</dt>
            <dd className="mt-0.5"><UserStatusBadge active={user.is_active !== false} /></dd>
          </div>
          <div>
            <dt className="text-xs text-sf-muted">Last login</dt>
            <dd className="mt-0.5 text-sf-muted">{user.last_login ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-sf-muted">Access</h3>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-sf-muted">Assigned role</dt>
            <dd className="mt-1"><RoleBadge role={user.role} /></dd>
          </div>
        </dl>
      </section>
    </Drawer>
  )
}
