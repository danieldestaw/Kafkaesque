import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, User } from '../api/client'

type AuthCtx = {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('sf_token'))
  const [loading, setLoading] = useState(!!token)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    api.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('sf_token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const refreshUser = async () => {
    if (!token) return
    const u = await api.me()
    setUser(u)
  }

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    localStorage.setItem('sf_token', res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const logout = () => {
    localStorage.removeItem('sf_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}
