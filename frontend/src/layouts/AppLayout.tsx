import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  Network,
  Plug,
  Search,
  Server,
  Shield,
  Sun,
  UserCog,
  Users,
  Database,
  KeyRound,
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
import { BrandLogo } from '../components/BrandLogo'
import { Select } from '../components/ui/Select'
import { StatusBadge } from '../components/ui/DataTable'

const SIDEBAR_KEY = 'sf_sidebar_collapsed'

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clusters', label: 'Clusters', icon: Server },
  { to: '/brokers', label: 'Brokers', icon: Network },
  { to: '/topics', label: 'Topics', icon: Layers },
  { to: '/consumers', label: 'Consumers', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/schemas', label: 'Schemas', icon: Database, permission: 'schema.read' as const },
  { to: '/connect', label: 'Connect', icon: Plug, permission: 'connect.read' as const },
  { to: '/acls', label: 'ACLs', icon: KeyRound, permission: 'acl.read' as const },
  { to: '/alerts', label: 'Alerts', icon: Bell, permission: 'alert.manage' as const },
  { to: '/audit', label: 'Audit', icon: FileText, permission: 'audit.read' as const },
]

const adminNav = [
  { to: '/admin/users', label: 'Users', icon: UserCog, permission: 'users.read' as const },
  { to: '/admin/roles', label: 'Roles', icon: Shield, permission: 'roles.read' as const },
]

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
}: {
  to: string
  label: string
  icon: typeof Server
  end?: boolean
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'sidebar-nav-item flex items-center gap-3 px-3 py-2.5 text-sm text-white/80',
          collapsed && 'justify-center px-2',
          isActive && 'active font-medium text-white',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function AppLayoutInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { openCommandPalette, dialogs, closeCommandPalette } = useDialogs()
  const { can, canAccessAdministration } = usePermissions()
  const { clusterId, setClusterId, clusters, isLoading, selectedCluster } = useClusterContext()
  const [dark, setDark] = useState(localStorage.getItem('sf_theme') === 'dark')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)

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
    localStorage.setItem(SIDEBAR_KEY, String(collapsed))
  }, [collapsed])

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

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const visibleMainNav = mainNav.filter((item) => !item.permission || can(item.permission))

  const sidebarContent = (isCollapsed: boolean) => (
    <>
      <div
        className={cn(
          'sidebar-brand shrink-0 border-b border-white/10 px-3 py-3',
          isCollapsed && 'px-2 py-3',
        )}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className={cn(
            'block w-full text-left transition-opacity hover:opacity-90',
            isCollapsed && 'flex justify-center',
          )}
          title="Kafkaesque"
        >
          <BrandLogo variant="sidebar" collapsed={isCollapsed} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        {visibleMainNav.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} end={to === '/'} collapsed={isCollapsed} />
        ))}

        {canAccessAdministration() && (
          <>
            {!isCollapsed && (
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Administration
              </p>
            )}
            {isCollapsed && <div className="my-2 mx-2 border-t border-white/15" />}
            {adminNav
              .filter((item) => can(item.permission))
              .map(({ to, label, icon }) => (
                <NavItem key={to} to={to} label={label} icon={icon} collapsed={isCollapsed} />
              ))}
          </>
        )}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-white/15 p-2">
        {selectedCluster && !isCollapsed && (
          <div className="rounded-lg bg-white/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
              Cluster Status
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  clusterHealthStatus.toUpperCase() === 'HEALTHY'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-amber-400',
                )}
              />
              <span className="text-xs font-semibold text-white">{clusterHealthStatus.toUpperCase()}</span>
            </div>
          </div>
        )}

        {user && !isCollapsed && (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <UserAvatar name={user.display_name} email={user.email} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{user.display_name || user.email}</p>
              <p className="truncate text-[10px] capitalize text-white/55">{user.role?.toLowerCase() || 'user'}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'sidebar-nav-item flex w-full items-center gap-2 px-3 py-2 text-xs text-white/70',
            isCollapsed && 'justify-center px-2',
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-sf-bg">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex h-screen flex-col shrink-0 overflow-hidden bg-sf-sidebar transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-60',
        )}
      >
        {sidebarContent(collapsed)}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative flex h-full w-60 flex-col bg-sf-sidebar shadow-xl animate-slide-left">
            {sidebarContent(false)}
          </aside>
        </div>
      )}

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-40 flex h-14 shrink-0 items-center gap-2 border-b border-sf-border bg-sf-panel px-3 sm:gap-3 sm:px-4">
          <button
            type="button"
            className="rounded-lg p-2 text-sf-muted transition-colors hover:bg-sf-input md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {isLoading ? (
            <div className="h-9 w-44 animate-pulse rounded-lg bg-sf-input" aria-label="Loading clusters" />
          ) : (
            <Select
              wrapperClassName="min-w-0 max-w-[140px] flex-1 sm:max-w-[220px] sm:flex-none"
              className="text-xs"
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

          {selectedCluster && (
            <span className="hidden sm:inline-flex">
              <StatusBadge status={selectedCluster.status} />
            </span>
          )}

          <button
            type="button"
            className="ml-auto flex items-center gap-2 rounded-lg border border-sf-border bg-sf-input px-3 py-1.5 text-sm text-sf-muted transition-colors hover:text-sf-text"
            onClick={openCommandPalette}
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-sf-border bg-sf-panel px-1 py-0.5 font-mono text-[10px] sm:inline">
              ⌘K
            </kbd>
          </button>

          <NotificationBell />

          <button
            type="button"
            className="rounded-lg p-2 text-sf-muted transition-colors hover:bg-sf-input"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <UserMenu />
        </header>

        <main className="app-main dashboard-main min-h-0 flex-1 overflow-auto p-3 sm:p-4 lg:p-5">
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
