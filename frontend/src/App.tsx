import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './stores/auth'
import { ToastProvider } from './context/ToastContext'
import { DialogProvider } from './context/DialogContext'
import { AppLayout } from './layouts/AppLayout'
import { AdminRoute } from './components/rbac/AdminRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClustersPage from './pages/ClustersPage'
import BrokersPage from './pages/BrokersPage'
import TopicsPage from './pages/TopicsPage'
import MessagesPage from './pages/MessagesPage'
import ConsumersPage from './pages/ConsumersPage'
import AuditPage from './pages/AuditPage'
import ProfilePage from './pages/ProfilePage'
import UsersPage from './pages/admin/UsersPage'
import RolesPage from './pages/admin/RolesPage'

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
})

function Protected({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sf-accent border-t-transparent" />
      </div>
    )
  }
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ToastProvider>
          <DialogProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/"
                  element={
                    <Protected>
                      <AppLayout />
                    </Protected>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="clusters" element={<ClustersPage />} />
                  <Route path="brokers" element={<BrokersPage />} />
                  <Route path="topics" element={<TopicsPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="consumers" element={<ConsumersPage />} />
                  <Route path="consumer-groups" element={<Navigate to="/consumers" replace />} />
                  <Route path="audit" element={<AuditPage />} />
                  <Route path="profile/*" element={<ProfilePage />} />
                  <Route
                    path="admin/users"
                    element={
                      <AdminRoute permission="users.read">
                        <UsersPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="admin/roles"
                    element={
                      <AdminRoute permission="roles.read">
                        <RolesPage />
                      </AdminRoute>
                    }
                  />
                </Route>
              </Routes>
            </BrowserRouter>
          </DialogProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
