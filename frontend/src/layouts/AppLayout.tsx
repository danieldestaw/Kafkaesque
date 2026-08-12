import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  FileText,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Network,
  Search,
  Server,
  Shield,
  Sun,
  UserCog,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CommandPalette } from '../components/CommandPalette'
import { CreateTopicDialog } from '../components/dialogs/CreateTopicDialog'
import { AddClusterDialog } from '../components/dialogs/AddClusterDialog'
import { ProduceMessageDialog } from '../components/dialogs/ProduceMessageDialog'
import { UserAvatar } from '../components/rbac/Badges'
import { UserMenu } from '../components/rbac/UserMenu'
import { NotificationBell } from '../components/NotificationBell'
import { useDialogs } from '../context/DialogContext'
import { ClusterProvider, useClusterContext } from '../context/ClusterContext'
import { usePermissions } from '../auth/usePermissions'
import { useAuth } from '../stores/auth'
import { api } from '../api/client'
import { cn } from '../lib/cn'
import { Select } from '../components/ui/Select'
import { StatusBadge } from '../components/ui/DataTable'

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clusters', label: 'Clusters', icon: Server },
  { to: '/brokers', label: 'Brokers', icon: Network },
  { to: '/topics', label: 'Topics', icon: Layers },
  { to: '/consumers', label: 'Consumers', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/audit', label: 'Audit', icon: FileText, permission: 'audit.read' as const },
]

const adminNav = [
  { to: '/admin/users', label: 'Users', icon: UserCog, permission: 'users.read' as const },
  { to: '/admin/roles', label: 'Roles', icon: Shield, permission: 'roles.read' as const },
]

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Server; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-sf-accent/10 text-sf-accent font-medium'
            : 'text-sf-muted hover:text-sf-text hover:bg-sf-border/30',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )
}

function AppLayoutInner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { openCommandPalette, dialogs, closeCommandPalette } = useDialogs()
  const { can, canAccessAdministration } = usePermissions()
  const { clusterId, setClusterId, clusters, isLoading, selectedCluster } = useClusterContext()
  const [dark, setDark] = useState(localStorage.getItem('sf_theme') === 'dark')

  const health = useQuery({
    queryKey: ['health', clusterId, 'sidebar'],
    queryFn: () => api.clusterHealth(clusterId) as Promise<{ status?: string }>,
    enabled: !!clusterId,
    refetchInterval: 60_000,
  })
  const clusterHealthStatus = health.data?.status || selectedCluster?.status || 'UNKNOWN'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('sf_theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openCommandPalette()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openCommandPalette])

  const visibleMainNav = mainNav.filter((item) => !item.permission || can(item.permission))

  return (
    <div className="min-h-screen flex flex-col bg-sf-bg">
      <header className="h-14 border-b border-sf-border bg-sf-panel/80 backdrop-blur-md flex items-center gap-3 px-4 shrink-0 sticky top-0 z-40">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-semibold tracking-tight flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sf-accent/10">
            <Activity className="h-4 w-4 text-sf-accent" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-semibold leading-none">Kafkaesque</div>
            <div className="text-[10px] text-sf-muted mt-0.5 leading-none">Kafka management &amp; observability</div>
          </div>
        </button>

        <div className="h-6 w-px bg-sf-border hidden sm:block" />

        {isLoading ? (
          <div className="h-9 w-44 animate-pulse rounded-md bg-sf-border/40" aria-label="Loading clusters" />
        ) : (
          <Select
            className="max-w-[220px] text-xs"
            value={clusterId}
            onChange={(e) => setClusterId(e.target.value)}
            aria-label="Select cluster"
            disabled={clusters.length === 0}
          >
            <option value="">
              {clusters.length === 0 ? 'No clusters' : 'Select cluster…'}
            </option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}

        {selectedCluster && <StatusBadge status={selectedCluster.status} />}

        <button
          type="button"
          className="ml-auto flex items-center gap-2 rounded-md border border-sf-border bg-sf-bg px-3 py-1.5 text-sm text-sf-muted hover:text-sf-text hover:border-sf-accent/40 transition-colors"
          onClick={openCommandPalette}
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline text-[10px] border border-sf-border rounded px-1 py-0.5 font-mono">⌘K</kbd>
        </button>

        <NotificationBell />

        <button
          type="button"
          className="rounded-md p-2 text-sf-muted hover:bg-sf-border/30 transition-colors"
          onClick={() => setDark((d) => !d)}
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <UserMenu />
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-52 border-r border-sf-border bg-sf-panel p-3 hidden md:flex flex-col shrink-0 overflow-y-auto">
          <nav className="space-y-0.5 flex-1">
            {visibleMainNav.map(({ to, label, icon }) => (
              <NavItem key={to} to={to} label={label} icon={icon} end={to === '/'} />
            ))}

            {canAccessAdministration() && (
              <>
                <div className="my-4 border-t border-sf-border" />
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sf-muted">
                  Administration
                </p>
                {adminNav
                  .filter((item) => can(item.permission))
                  .map(({ to, label, icon }) => (
                    <NavItem key={to} to={to} label={label} icon={icon} />
                  ))}
              </>
            )}
          </nav>

          <div className="mt-4 pt-4 border-t border-sf-border space-y-3 shrink-0">
            {selectedCluster && (
              <div className="rounded-lg border border-sf-border bg-sf-bg/50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sf-muted mb-1.5">
                  Cluster Status
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      clusterHealthStatus.toUpperCase() === 'HEALTHY'
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                        : 'bg-amber-500',
                    )}
                  />
                  <span className="text-xs font-semibold">{clusterHealthStatus.toUpperCase()}</span>
                </div>
              </div>
            )}
            {user && (
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <UserAvatar name={user.display_name} email={user.email} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{user.display_name || user.email}</p>
                  <p className="text-[10px] text-sf-muted capitalize truncate">
                    {user.role?.toLowerCase() || 'user'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-3 md:p-4 lg:p-5">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={dialogs.commandPalette}
        onClose={closeCommandPalette}
        clusterId={clusterId}
        onClusterChange={setClusterId}
      />
      <CreateTopicDialog />
      <AddClusterDialog />
      <ProduceMessageDialog />
    </div>
  )
}

export function AppLayout() {
  return (
    <ClusterProvider>
      <AppLayoutInner />
    </ClusterProvider>
  )
}
