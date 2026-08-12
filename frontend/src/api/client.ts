const API_BASE = ''

export type User = {
  id: string
  email: string
  display_name: string
  role: string
  is_active?: boolean
  last_login_at?: string
  password_changed_at?: string
  created_at?: string
  permissions?: string[]
}

export type PlatformUser = User & {
  updated_at?: string
}

export type RoleRecord = {
  id: string
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  user_count?: number
  created_at?: string
  updated_at?: string
}

/** @deprecated use RoleRecord */
export type RoleDefinition = RoleRecord & { builtin?: boolean }

export type PermissionRecord = {
  id: string
  category: string
  action: string
  description: string
}

export type PermissionGroup = {
  category: string
  permissions: PermissionRecord[]
}

export type Cluster = {
  id: string
  name: string
  bootstrap_servers: string
  environment: string
  status: string
  kafka_version?: string
  last_error?: string
}

export type ClusterCreateBody = {
  name: string
  bootstrap_servers: string
  environment: string
  tls?: boolean
  sasl_mechanism?: string
  sasl_username?: string
  sasl_password?: string
  kafka_version?: string
}

export type SearchResult = {
  type: 'cluster' | 'topic' | 'consumer_group' | 'broker'
  id: string
  label: string
  cluster_id?: string
}

export type TestConnectionResult = {
  connected: boolean
  error?: string
  broker_count?: number
  topic_count?: number
  partition_count?: number
  kafka_version?: string
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('sf_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/api/v1/me'),
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<{ status: string }>('/api/v1/me/password', { method: 'POST', body: JSON.stringify(body) }),
  users: () => request<{ items: PlatformUser[] }>('/api/v1/users'),
  getUser: (id: string) => request<PlatformUser>(`/api/v1/users/${id}`),
  createUser: (body: {
    email: string
    display_name: string
    password: string
    role: string
    is_active?: boolean
  }) => request<PlatformUser>('/api/v1/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: object) =>
    request<PlatformUser>(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request<void>(`/api/v1/users/${id}`, { method: 'DELETE' }),
  disableUser: (id: string) =>
    request<{ status: string }>(`/api/v1/users/${id}/disable`, { method: 'POST' }),
  enableUser: (id: string) =>
    request<{ status: string }>(`/api/v1/users/${id}/enable`, { method: 'POST' }),
  resetUserPassword: (id: string, body: { password: string; reason?: string }) =>
    request<{ status: string }>(`/api/v1/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revokeUserSessions: (id: string) =>
    request<{ status: string }>(`/api/v1/users/${id}/revoke-sessions`, { method: 'POST' }),
  userAudit: (id: string) => request<{ items: object[] }>(`/api/v1/users/${id}/audit`),
  roles: () => request<{ items: RoleRecord[] }>('/api/v1/roles'),
  getRole: (id: string) => request<RoleRecord>(`/api/v1/roles/${id}`),
  createRole: (body: { id?: string; name: string; description?: string; permissions: string[] }) =>
    request<RoleRecord>('/api/v1/roles', { method: 'POST', body: JSON.stringify(body) }),
  updateRole: (id: string, body: { name: string; description?: string; permissions: string[] }) =>
    request<RoleRecord>(`/api/v1/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRole: (id: string) => request<void>(`/api/v1/roles/${id}`, { method: 'DELETE' }),
  permissions: () => request<{ items: PermissionGroup[] }>('/api/v1/permissions'),
  clusters: () => request<{ items: Cluster[] }>('/api/v1/clusters'),
  createCluster: (body: ClusterCreateBody) =>
    request<Cluster>('/api/v1/clusters', { method: 'POST', body: JSON.stringify(body) }),
  deleteCluster: (id: string) =>
    request<void>(`/api/v1/clusters/${id}`, { method: 'DELETE' }),
  testConnection: (body: ClusterCreateBody) =>
    request<TestConnectionResult>('/api/v1/clusters/test-connection', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  testCluster: (id: string) =>
    request<TestConnectionResult>(`/api/v1/clusters/${id}/test`, { method: 'POST' }),
  clusterHealth: (id: string) => request<object>(`/api/v1/clusters/${id}/health`),
  brokers: (id: string) => request<{ items: Broker[] }>(`/api/v1/clusters/${id}/brokers`),
  topics: (id: string) => request<{ items: Topic[] }>(`/api/v1/clusters/${id}/topics`),
  createTopic: (id: string, body: object) =>
    request<object>(`/api/v1/clusters/${id}/topics`, { method: 'POST', body: JSON.stringify(body) }),
  deleteTopic: (clusterId: string, topic: string) =>
    request<void>(`/api/v1/clusters/${clusterId}/topics/${encodeURIComponent(topic)}`, { method: 'DELETE' }),
  messages: (clusterId: string, topic: string, params: URLSearchParams) =>
    request<{ items: Message[] }>(`/api/v1/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/messages?${params}`),
  publish: (clusterId: string, topic: string, body: object) =>
    request<{ partition: number; offset: number }>(`/api/v1/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  consumerGroups: (id: string) =>
    request<{ items: ConsumerGroup[] }>(`/api/v1/clusters/${id}/consumer-groups`),
  audit: () => request<{ items: object[] }>('/api/v1/audit'),
  search: (q: string, clusterId?: string) => {
    const params = new URLSearchParams({ q })
    if (clusterId) params.set('cluster_id', clusterId)
    return request<{ items: SearchResult[] }>(`/api/v1/search?${params}`)
  },
}

export type Broker = {
  id: number
  host: string
  port: number
  rack?: string
  is_controller: boolean
  partition_count: number
}

export type Topic = {
  name: string
  partitions: number
  replication_factor: number
  internal: boolean
}

export type ConsumerGroup = {
  group_id: string
  state: string
  members: number
  topics: number
  total_lag: number
  max_lag: number
}

export type Message = {
  topic: string
  partition: number
  offset: number
  timestamp: string
  key?: string
  value: string
  headers?: Record<string, string>
}
