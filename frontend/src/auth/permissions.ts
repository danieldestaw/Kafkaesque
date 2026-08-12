/**
 * Frontend permission mirror of backend/internal/authorization/rbac.go
 * Keep in sync when backend permissions change.
 * Future IAM permissions (users.*, roles.*) are defined but not yet enforced server-side.
 */

export type Role = 'ADMIN' | 'OPERATOR' | 'DEVELOPER' | 'VIEWER'

export type Permission =
  | 'cluster.read'
  | 'cluster.manage'
  | 'topic.read'
  | 'topic.create'
  | 'topic.update'
  | 'topic.delete'
  | 'message.read'
  | 'message.publish'
  | 'consumer.read'
  | 'consumer.manage'
  | 'schema.read'
  | 'schema.write'
  | 'connect.read'
  | 'connect.manage'
  | 'acl.read'
  | 'acl.manage'
  | 'audit.read'
  | 'alert.manage'
  // Future IAM — frontend-ready, backend TBD
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.disable'
  | 'users.reset_password'
  | 'roles.read'
  | 'roles.create'
  | 'roles.update'
  | 'roles.delete'
  | 'roles.assign'
  | 'system.settings'

/** Permissions currently enforced by the backend RBAC layer */
const BACKEND_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'cluster.read', 'cluster.manage',
    'topic.read', 'topic.create', 'topic.update', 'topic.delete',
    'message.read', 'message.publish',
    'consumer.read', 'consumer.manage',
    'schema.read', 'schema.write',
    'connect.read', 'connect.manage',
    'acl.read', 'acl.manage',
    'audit.read', 'alert.manage',
  ],
  OPERATOR: [
    'cluster.read', 'cluster.manage',
    'topic.read', 'topic.create', 'topic.update', 'topic.delete',
    'message.read', 'message.publish',
    'consumer.read', 'consumer.manage',
    'schema.read', 'connect.read', 'connect.manage',
    'acl.read', 'audit.read', 'alert.manage',
  ],
  DEVELOPER: [
    'cluster.read',
    'topic.read', 'topic.create',
    'message.read', 'message.publish',
    'consumer.read',
    'schema.read', 'connect.read',
  ],
  VIEWER: [
    'cluster.read',
    'topic.read',
    'message.read',
    'consumer.read',
    'schema.read', 'connect.read',
    'acl.read',
  ],
}

/** IAM permissions — enforced by backend for ADMIN role */
const FUTURE_IAM_PERMISSIONS: Partial<Record<Role, Permission[]>> = {
  ADMIN: [
    'users.read', 'users.create', 'users.update', 'users.delete',
    'users.disable', 'users.reset_password',
    'roles.read', 'roles.assign',
    'system.settings',
  ],
}

export function permissionsForRole(role: string | undefined): Permission[] {
  const r = normalizeRole(role)
  if (!r) return []
  const base = BACKEND_ROLE_PERMISSIONS[r] ?? []
  const future = FUTURE_IAM_PERMISSIONS[r] ?? []
  return [...base, ...future]
}

export function normalizeRole(role: string | undefined): Role | null {
  const upper = role?.toUpperCase()
  if (upper === 'ADMIN' || upper === 'OPERATOR' || upper === 'DEVELOPER' || upper === 'VIEWER') {
    return upper
  }
  return null
}

export function matchPermission(granted: Permission[], required: Permission | string): boolean {
  if (granted.includes(required as Permission)) return true
  const [ns] = required.split('.')
  return granted.includes(`${ns}.*` as Permission)
}

export function hasPermission(role: string | undefined, required: Permission | string): boolean {
  return matchPermission(permissionsForRole(role), required)
}

export type BuiltinRoleDefinition = {
  id: Role
  name: string
  description: string
  permissions: Permission[]
}

export const BUILTIN_ROLES: BuiltinRoleDefinition[] = [
  {
    id: 'ADMIN',
    name: 'Administrator',
    description: 'Full platform access including future user and role management.',
    permissions: permissionsForRole('ADMIN'),
  },
  {
    id: 'OPERATOR',
    name: 'Operator',
    description: 'Manage Kafka infrastructure. Cannot manage users or roles.',
    permissions: permissionsForRole('OPERATOR'),
  },
  {
    id: 'DEVELOPER',
    name: 'Developer',
    description: 'Inspect clusters, topics, messages; publish and create topics.',
    permissions: permissionsForRole('DEVELOPER'),
  },
  {
    id: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access to Kafka resources and audit logs.',
    permissions: permissionsForRole('VIEWER'),
  },
]

/** Backend-enforced IAM permissions are now available via API */
export const FEATURES = {
  userManagementApi: true,
  roleManagementApi: true,
  sessionManagement: true,
  mfa: false,
} as const
