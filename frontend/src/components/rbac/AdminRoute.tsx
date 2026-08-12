import { Navigate } from 'react-router-dom'
import { usePermissions } from '../../auth/usePermissions'

export function AdminRoute({ children, permission }: { children: React.ReactNode; permission: string }) {
  const { can } = usePermissions()
  if (!can(permission)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
