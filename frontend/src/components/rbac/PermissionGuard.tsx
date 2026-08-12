import type { ReactNode } from 'react'
import { usePermissions } from '../../auth/usePermissions'
import type { Permission } from '../../auth/permissions'

type Props = {
  permission: Permission | string
  permissions?: (Permission | string)[]
  mode?: 'any' | 'all'
  children: ReactNode
  fallback?: ReactNode
}

/**
 * UX-only gate. Backend must independently enforce every permission.
 */
export function PermissionGuard({
  permission,
  permissions,
  mode = 'any',
  children,
  fallback = null,
}: Props) {
  const { can, canAny, canAll } = usePermissions()

  const allowed = permissions
    ? mode === 'all'
      ? canAll(...permissions)
      : canAny(...permissions)
    : can(permission)

  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}

type ProtectedActionProps = {
  permission: Permission | string
  children: ReactNode
  disabledHint?: string
}

/** Renders children disabled when permission is missing (for buttons/links). */
export function ProtectedAction({ permission, children, disabledHint }: ProtectedActionProps) {
  const { can } = usePermissions()
  if (can(permission)) return <>{children}</>

  return (
    <span
      className="inline-flex opacity-50 cursor-not-allowed"
      title={disabledHint ?? 'You do not have permission for this action'}
    >
      <span className="pointer-events-none">{children}</span>
    </span>
  )
}
