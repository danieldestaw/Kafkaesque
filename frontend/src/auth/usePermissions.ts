import { useMemo } from 'react'
import { useAuth } from '../stores/auth'
import {
  hasPermission,
  matchPermission,
  normalizeRole,
  permissionsForRole,
  type Permission,
  type Role,
} from './permissions'

export function usePermissions() {
  const { user } = useAuth()

  return useMemo(() => {
    const role = normalizeRole(user?.role)
    const permissions = (user?.permissions?.length ? user.permissions : permissionsForRole(user?.role)) as Permission[]

    return {
      user,
      role,
      permissions,
      can: (permission: Permission | string) =>
        user?.permissions?.length
          ? matchPermission(permissions, permission)
          : hasPermission(user?.role, permission),
      canAny: (...required: (Permission | string)[]) =>
        required.some((p) =>
          user?.permissions?.length
            ? matchPermission(permissions, p)
            : hasPermission(user?.role, p),
        ),
      canAll: (...required: (Permission | string)[]) =>
        required.every((p) =>
          user?.permissions?.length
            ? matchPermission(permissions, p)
            : hasPermission(user?.role, p),
        ),
      canAccessAdministration: () =>
        matchPermission(permissions, 'users.read') || matchPermission(permissions, 'roles.read'),
    }
  }, [user])
}

export function useRequirePermission(permission: Permission | string): boolean {
  const { can } = usePermissions()
  return can(permission)
}

export type { Permission, Role }
