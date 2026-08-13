#!/usr/bin/env bash
# Reconstruct Kafkaesque git history — NO git clean
set -euo pipefail
cd "$(dirname "$0")"

merge_branch() {
  git checkout master
  git merge --no-ff "$1" -m "merge: $1"
}

try_commit() {
  local msg="$1"
  shift
  git add "$@" 2>/dev/null || true
  git reset HEAD -- frontend/node_modules frontend/dist 2>/dev/null || true
  if git diff --cached --quiet; then
    echo "skip: $msg"
    return 0
  fi
  git commit -m "$msg"
}

git checkout -B master
if ! git rev-parse HEAD >/dev/null 2>&1; then
  git commit --allow-empty -m "chore: initialize repository"
fi

git checkout -B feat/project-foundation master
try_commit "chore: add Apache 2.0 license and gitignore" LICENSE .gitignore
try_commit "docs: add initial roadmap" ROADMAP.md
merge_branch feat/project-foundation

git checkout -B feat/backend-core master
try_commit "feat(backend): add Go module and configuration loader" backend/go.mod backend/go.sum backend/internal/config/config.go
try_commit "feat(backend): add domain models for users, clusters, and audit" backend/internal/models/models.go
try_commit "feat(backend): add credential encryption helpers" backend/internal/crypto/secret.go
try_commit "feat(backend): add PostgreSQL storage and initial schema migration" backend/internal/storage/store.go backend/internal/storage/migrations/001_init.sql backend/migrations/001_init.sql
try_commit "feat(backend): add application entrypoint with admin seed" backend/cmd/kafkaesque/main.go
try_commit "feat(backend): add HTTP server with health, metrics, and API skeleton" backend/internal/api/server.go backend/internal/api/handlers.go
try_commit "build(backend): add Dockerfile" backend/Dockerfile
merge_branch feat/backend-core

git checkout -B feat/auth master
try_commit "feat(storage): extend user schema for session tracking" backend/internal/storage/migrations/002_users_iam.sql
try_commit "feat(auth): implement JWT login, middleware, and session claims" backend/internal/auth/auth.go
merge_branch feat/auth

git checkout -B feat/kafka-client master
try_commit "feat(kafka): add franz-go client service for admin and messaging" backend/internal/kafkaclient/service.go
merge_branch feat/kafka-client

git checkout -B feat/kafka-api master
try_commit "feat(api): add Kafka REST endpoints for clusters, topics, messages, and consumers" backend/internal/api/handlers.go backend/internal/api/server.go
merge_branch feat/kafka-api

git checkout -B feat/iam-users master
try_commit "feat(iam): add user management API handlers" backend/internal/api/handlers_users.go backend/internal/api/server.go
merge_branch feat/iam-users

git checkout -B feat/rbac-database master
try_commit "feat(rbac): add roles, permissions schema and seed data" backend/internal/storage/migrations/003_rbac.sql
try_commit "feat(rbac): add role and permission store layer" backend/internal/storage/store_rbac.go
try_commit "feat(rbac): add permission matching utilities" backend/internal/authorization/rbac.go
try_commit "feat(api): add roles and permissions endpoints" backend/internal/api/handlers_roles.go backend/internal/api/server.go
try_commit "refactor(auth): resolve permissions from database at login" backend/internal/auth/auth.go backend/internal/api/handlers.go
merge_branch feat/rbac-database

git checkout -B test/backend master
try_commit "test(rbac): add permission matching unit tests" backend/internal/authorization/rbac_test.go
try_commit "test(api): add user handler integration tests" backend/internal/api/handlers_users_test.go
merge_branch test/backend

git checkout -B feat/frontend-scaffold master
try_commit "feat(frontend): scaffold React TypeScript app with Vite and Tailwind" frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.json frontend/postcss.config.js frontend/tailwind.config.js frontend/index.html frontend/src/main.tsx frontend/src/vite-env.d.ts frontend/src/index.css frontend/src/lib/cn.ts
try_commit "feat(frontend): add shared UI components" frontend/src/components/ui/
try_commit "feat(frontend): add API client types and request helpers" frontend/src/api/client.ts
try_commit "build(frontend): add nginx config and Dockerfile" frontend/Dockerfile frontend/nginx.conf
merge_branch feat/frontend-scaffold

git checkout -B feat/frontend-auth master
try_commit "feat(frontend): add authentication store and login page" frontend/src/stores/auth.tsx frontend/src/pages/LoginPage.tsx
try_commit "feat(frontend): add protected routing and app entry" frontend/src/App.tsx frontend/src/hooks/useClusterId.ts
merge_branch feat/frontend-auth

git checkout -B feat/frontend-shell master
try_commit "feat(frontend): add application layout and navigation" frontend/src/layouts/AppLayout.tsx
try_commit "feat(frontend): add cluster context and empty state" frontend/src/context/ClusterContext.tsx frontend/src/components/ClusterEmptyState.tsx
try_commit "feat(frontend): add toast and dialog providers" frontend/src/context/ToastContext.tsx frontend/src/context/DialogContext.tsx
try_commit "feat(frontend): add command palette for global search" frontend/src/components/CommandPalette.tsx frontend/src/hooks/useDebounce.ts
try_commit "feat(frontend): add permission types and hooks" frontend/src/auth/permissions.ts frontend/src/auth/usePermissions.ts frontend/src/components/rbac/PermissionGuard.tsx
merge_branch feat/frontend-shell

git checkout -B feat/frontend-kafka-ui master
try_commit "feat(frontend): add cluster management page and dialog" frontend/src/pages/ClustersPage.tsx frontend/src/components/dialogs/AddClusterDialog.tsx
try_commit "feat(frontend): add brokers and topics pages" frontend/src/pages/BrokersPage.tsx frontend/src/pages/TopicsPage.tsx frontend/src/components/dialogs/CreateTopicDialog.tsx
try_commit "feat(frontend): add message browser and producer" frontend/src/pages/MessagesPage.tsx frontend/src/components/drawers/MessageDrawer.tsx frontend/src/components/dialogs/ProduceMessageDialog.tsx
try_commit "feat(frontend): add consumer groups page" frontend/src/pages/ConsumersPage.tsx
try_commit "feat(frontend): add audit log page" frontend/src/pages/AuditPage.tsx
merge_branch feat/frontend-kafka-ui

git checkout -B feat/frontend-dashboard master
try_commit "feat(frontend): add metric history hook for dashboard charts" frontend/src/hooks/useMetricHistory.ts
try_commit "feat(frontend): add dashboard KPI cards and sparklines" frontend/src/components/dashboard/MetricCard.tsx frontend/src/pages/DashboardPage.tsx
try_commit "feat(frontend): add cluster metrics chart and health panel" frontend/src/components/dashboard/ClusterMetricsChart.tsx frontend/src/components/dashboard/ClusterHealthPanel.tsx frontend/src/components/dashboard/DashboardWidget.tsx
try_commit "feat(frontend): add topics chart, activity feed, and cluster load widgets" frontend/src/components/dashboard/TopTopicsChart.tsx frontend/src/components/dashboard/RecentActivity.tsx frontend/src/components/dashboard/ClusterLoad.tsx frontend/src/hooks/usePageTitle.ts frontend/src/pages/DashboardPage.tsx
merge_branch feat/frontend-dashboard

git checkout -B feat/frontend-admin master
try_commit "feat(frontend): add RBAC admin route guards and badges" frontend/src/components/rbac/AdminRoute.tsx frontend/src/components/rbac/Badges.tsx frontend/src/components/rbac/UserMenu.tsx frontend/src/App.tsx
try_commit "feat(frontend): add user management pages and dialogs" frontend/src/pages/admin/UsersPage.tsx frontend/src/components/rbac/UserTable.tsx frontend/src/components/rbac/UserDetails.tsx frontend/src/components/dialogs/AddUserDialog.tsx frontend/src/components/dialogs/EditUserDialog.tsx frontend/src/hooks/useRoles.ts
try_commit "feat(frontend): add role editor and roles page" frontend/src/pages/admin/RolesPage.tsx frontend/src/components/dialogs/RoleEditorDialog.tsx
try_commit "feat(frontend): add profile page" frontend/src/pages/ProfilePage.tsx
merge_branch feat/frontend-admin

git checkout -B fix/frontend-ux master
try_commit "fix(frontend): prevent dialog focus loss on parent re-render" frontend/src/components/ui/Dialog.tsx
try_commit "fix(frontend): render user action menu in portal to avoid clipping" frontend/src/components/rbac/UserTable.tsx
try_commit "feat(frontend): add notification bell from audit log" frontend/src/components/NotificationBell.tsx frontend/src/layouts/AppLayout.tsx
try_commit "feat(frontend): add favicon and page title support" frontend/public/favicon.svg frontend/index.html
merge_branch fix/frontend-ux

git checkout -B feat/docker master
try_commit "build: add Docker Compose stack for full platform" docker-compose.yml
try_commit "docs: add minimal README with quick start" README.md
merge_branch feat/docker

git checkout -B docs/readme-and-architecture master
try_commit "docs: add architecture overview" docs/architecture.md
try_commit "docs: add static documentation site for Vercel deployment" docs-site/
merge_branch docs/readme-and-architecture

git checkout master
if [ -n "$(git ls-files --others --exclude-standard)" ]; then
  try_commit "chore: add remaining project files" .
fi

git checkout master
echo "=== git status ==="
git status
echo "=== git log ==="
git log --oneline --all --decorate --graph | head -55
