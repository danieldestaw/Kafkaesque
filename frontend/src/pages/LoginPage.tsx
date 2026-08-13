import { FormEvent, useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Lock, Mail, Moon, Sun } from 'lucide-react'
import { useAuth } from '../stores/auth'
import { api } from '../api/client'
import { LoginHeroArt } from '../components/LoginHeroArt'
import { BrandLogo } from '../components/BrandLogo'

function readThemePreference(): boolean {
  const saved = localStorage.getItem('sf_theme')
  if (saved === 'dark') return true
  if (saved === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function LoginPage() {
  const { login, token, loading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const authConfig = useQuery({ queryKey: ['auth-config'], queryFn: () => api.authConfig() })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dark, setDark] = useState(readThemePreference)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('sf_theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const oidcToken = searchParams.get('token')
    if (oidcToken) {
      localStorage.setItem('sf_token', oidcToken)
      setSearchParams({}, { replace: true })
      window.location.href = '/'
    }
  }, [searchParams, setSearchParams])

  if (!loading && token) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  const showLocalLogin = authConfig.data?.local_login ?? true
  const showOidc = authConfig.data?.oidc_enabled

  return (
    <div className="login-page flex h-full w-full">
      {/* Hero — left half */}
      <aside className="relative hidden h-full min-h-full w-1/2 shrink-0 flex-col md:flex">
        <LoginHeroArt />
        <div className="relative z-10 flex flex-1 flex-col justify-end p-10 xl:p-14">
          <h2 className="font-heading text-3xl font-bold leading-tight text-white xl:text-4xl">
            Take Control of Your Kafka Infrastructure
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85 xl:text-base">
            Monitor brokers, topics, consumer groups, messages, integrations, and cluster health from one, unified control plane.
          </p>
        </div>
      </aside>

      {/* Form — right half */}
      <main className="login-form-panel relative flex h-full min-h-full w-full flex-col justify-center px-8 py-12 sm:px-12 md:w-1/2 lg:px-16 xl:px-20">
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-lg border border-sf-border bg-sf-input text-sf-muted transition-colors hover:text-sf-text"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="mx-auto w-full max-w-[380px]">
          <header className="mb-8">
            <div className="w-full max-w-[240px]">
              <BrandLogo />
              <p className="mt-4 text-sm leading-relaxed text-sf-muted">
                Enter your email and password to sign in to your account.
              </p>
            </div>
          </header>

          <form onSubmit={onSubmit} className="space-y-5">
            {showLocalLogin && (
              <>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-sf-text">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="text"
                      placeholder="name@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      autoFocus
                      required
                      className="login-input w-full py-3 pl-4 pr-11 text-sm text-sf-text placeholder:text-sf-muted"
                    />
                    <Mail className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-sf-muted" />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-sf-text">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="login-input w-full py-3 pl-4 pr-11 text-sm text-sf-text placeholder:text-sf-muted"
                    />
                    <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-sf-muted" />
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="login-btn-primary w-full py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in…
                    </span>
                  ) : (
                    'Login'
                  )}
                </button>
              </>
            )}

            {showOidc && (
              <>
                {showLocalLogin && (
                  <div className="relative py-1 text-center">
                    <span className="relative z-10 bg-sf-panel px-3 text-xs text-sf-muted">or</span>
                    <div className="absolute inset-x-0 top-1/2 border-t border-sf-border" />
                  </div>
                )}
                <a
                  href={authConfig.data?.oidc_login_url || '/api/v1/auth/oidc/login'}
                  className="login-btn-oauth flex w-full items-center justify-center gap-2.5 py-3 text-sm font-medium text-sf-text transition-colors"
                >
                  <GoogleIcon />
                  Sign in with SSO
                </a>
              </>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-sf-muted">
            Need access?{' '}
            <span className="font-semibold text-sf-text">Contact your administrator</span>
          </p>
        </div>
      </main>
    </div>
  )
}
