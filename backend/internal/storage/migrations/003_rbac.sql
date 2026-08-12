-- Database-backed RBAC: roles, permissions, role_permissions

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- Seed permissions (idempotent)
INSERT INTO permissions (id, category, action, description) VALUES
    ('cluster.read', 'cluster', 'read', 'View clusters and health'),
    ('cluster.manage', 'cluster', 'manage', 'Create, update, and delete clusters'),
    ('topic.read', 'topics', 'read', 'View topics and partitions'),
    ('topic.create', 'topics', 'create', 'Create topics'),
    ('topic.update', 'topics', 'update', 'Alter topic configuration'),
    ('topic.delete', 'topics', 'delete', 'Delete topics'),
    ('message.read', 'messages', 'read', 'Browse messages'),
    ('message.publish', 'messages', 'publish', 'Produce messages'),
    ('consumer.read', 'consumers', 'read', 'View consumer groups'),
    ('consumer.manage', 'consumers', 'manage', 'Reset offsets and manage groups'),
    ('schema.read', 'schema', 'read', 'View schemas'),
    ('schema.write', 'schema', 'write', 'Register and edit schemas'),
    ('connect.read', 'connect', 'read', 'View connectors'),
    ('connect.manage', 'connect', 'manage', 'Manage connectors'),
    ('acl.read', 'acl', 'read', 'View ACLs'),
    ('acl.manage', 'acl', 'manage', 'Manage ACLs'),
    ('audit.read', 'audit', 'read', 'View audit log'),
    ('alert.manage', 'alerts', 'manage', 'Manage alert rules'),
    ('users.read', 'users', 'read', 'View users'),
    ('users.create', 'users', 'create', 'Create users'),
    ('users.update', 'users', 'update', 'Update users'),
    ('users.delete', 'users', 'delete', 'Delete users'),
    ('users.disable', 'users', 'disable', 'Enable or disable users'),
    ('users.reset_password', 'users', 'reset_password', 'Reset user passwords'),
    ('roles.read', 'roles', 'read', 'View roles'),
    ('roles.create', 'roles', 'create', 'Create roles'),
    ('roles.update', 'roles', 'update', 'Update roles and permissions'),
    ('roles.delete', 'roles', 'delete', 'Delete roles'),
    ('roles.assign', 'roles', 'assign', 'Assign roles to users'),
    ('system.settings', 'system', 'settings', 'Manage system settings')
ON CONFLICT (id) DO NOTHING;

-- Seed default roles
INSERT INTO roles (id, name, description, is_system) VALUES
    ('ADMIN', 'Administrator', 'Full platform access including user and role management.', TRUE),
    ('OPERATOR', 'Operator', 'Manage Kafka infrastructure. Cannot manage users or roles.', TRUE),
    ('DEVELOPER', 'Developer', 'Inspect clusters, topics, messages; publish and create topics.', TRUE),
    ('VIEWER', 'Viewer', 'Read-only access to Kafka resources and audit logs.', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ADMIN permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ADMIN', id FROM permissions
ON CONFLICT DO NOTHING;

-- OPERATOR permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'OPERATOR', unnest(ARRAY[
    'cluster.read','cluster.manage',
    'topic.read','topic.create','topic.update','topic.delete',
    'message.read','message.publish',
    'consumer.read','consumer.manage',
    'schema.read','connect.read','connect.manage',
    'acl.read','audit.read','alert.manage'
]::TEXT[])
ON CONFLICT DO NOTHING;

-- DEVELOPER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'DEVELOPER', unnest(ARRAY[
    'cluster.read',
    'topic.read','topic.create',
    'message.read','message.publish',
    'consumer.read',
    'schema.read','connect.read'
]::TEXT[])
ON CONFLICT DO NOTHING;

-- VIEWER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'VIEWER', unnest(ARRAY[
    'cluster.read',
    'topic.read',
    'message.read',
    'consumer.read',
    'schema.read','connect.read',
    'acl.read'
]::TEXT[])
ON CONFLICT DO NOTHING;
