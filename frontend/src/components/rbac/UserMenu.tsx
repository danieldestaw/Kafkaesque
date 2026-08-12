import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, User, Users, Shield } from 'lucide-react'
import { useAuth } from '../../stores/auth'
import { usePermissions } from '../../auth/usePermissions'
import { UserAvatar } from './Badges'
import { cn } from '../../lib/cn'

export function UserMenu() {
  const { user, logout } = useAuth()
  const { canAccessAdministration } = usePermissions()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-sf-border bg-sf-bg px-2 py-1.5 text-sm hover:border-sf-accent/40 transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar name={user.display_name} email={user.email} />
        <span className="hidden md:inline max-w-[120px] truncate text-xs">
          {user.display_name || user.email}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-sf-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-sf-border bg-sf-panel shadow-lg py-1 z-50 animate-scale-in"
        >
          <div className="px-3 py-2 border-b border-sf-border mb-1">
            <p className="text-sm font-medium truncate">{user.display_name || user.email}</p>
            <p className="text-xs text-sf-muted truncate">{user.email}</p>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-sf-border/30"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-sf-muted" /> Profile
          </Link>
          {canAccessAdministration() && (
            <>
              <Link
                to="/admin/users"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-sf-border/30"
                onClick={() => setOpen(false)}
              >
                <Users className="h-4 w-4 text-sf-muted" /> Users
              </Link>
              <Link
                to="/admin/roles"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-sf-border/30"
                onClick={() => setOpen(false)}
              >
                <Shield className="h-4 w-4 text-sf-muted" /> Roles
              </Link>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-sf-border/30 text-red-600 dark:text-red-400"
            onClick={() => { setOpen(false); logout(); navigate('/login') }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
