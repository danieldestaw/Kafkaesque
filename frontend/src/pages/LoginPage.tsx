import { FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Activity,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Moon,
  Shield,
  Sun,
  User,
  Zap,
} from 'lucide-react'
import { useAuth } from '../stores/auth'
import { cn } from '../lib/cn'

const FEATURES = [
  { icon: Layers, label: 'Topic & partition management' },
  { icon: Activity, label: 'Real-time cluster health' },
  { icon: Shield, label: 'Role-based access control' },
  { icon: Zap, label: 'Consumer lag monitoring' },
]

function readThemePreference(): boolean {
  const saved = localStorage.getItem('sf_theme')
  if (saved === 'dark') return true
  if (saved === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function LoginPage() {
  const { login, token, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dark, setDark] = useState(readThemePreference)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('sf_theme', dark ? 'dark' : 'light')
  }, [dark])

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

  return (
    <div
      className={cn(
        'login-page relative min-h-screen overflow-hidden transition-colors duration-300',
        dark ? 'bg-[#07070f] text-zinc-100' : 'bg-slate-50 text-slate-900',
      )}
    >
      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => setDark((v) => !v)}
        className={cn(
          'absolute top-5 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
          dark
            ? 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
            : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800 shadow-sm',
        )}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className={cn(
            'login-orb login-orb-a absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full blur-[100px]',
            dark ? 'bg-purple-600/20' : 'bg-purple-400/25',
          )}
        />
        <div
          className={cn(
            'login-orb login-orb-b absolute top-1/3 -right-24 h-[420px] w-[420px] rounded-full blur-[100px]',
            dark ? 'bg-indigo-600/15' : 'bg-indigo-400/20',
          )}
        />
        <div
          className={cn(
            'login-orb login-orb-c absolute -bottom-32 left-1/3 h-[360px] w-[360px] rounded-full blur-[90px]',
            dark ? 'bg-violet-500/10' : 'bg-violet-400/15',
          )}
        />
        <div
          className={cn('absolute inset-0', dark ? 'opacity-[0.035]' : 'opacity-[0.04]')}
          style={{
            backgroundImage: dark
              ? 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)'
              : 'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Brand panel — desktop only */}
        <aside
          className={cn(
            'hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between p-12 xl:p-16 border-r',
            dark ? 'border-white/[0.06]' : 'border-slate-200/80',
          )}
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
                <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">Kafkaesque</p>
                <p className={cn('text-xs', dark ? 'text-zinc-500' : 'text-slate-500')}>
                  Kafka Management
                </p>
              </div>
            </div>

            <h2 className="mt-16 text-4xl xl:text-5xl font-bold tracking-tight leading-[1.15] max-w-lg">
              Manage your Kafka ecosystem with{' '}
              <span className="bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                confidence
              </span>
            </h2>
            <p className={cn('mt-5 text-base max-w-md leading-relaxed', dark ? 'text-zinc-400' : 'text-slate-600')}>
              Monitor brokers, topics, consumer groups, and cluster health — all from one unified control plane.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 max-w-lg">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm backdrop-blur-sm',
                  dark
                    ? 'border-white/[0.06] bg-white/[0.03] text-zinc-400'
                    : 'border-slate-200/80 bg-white/70 text-slate-600 shadow-sm',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />
                {label}
              </li>
            ))}
          </ul>
        </aside>

        {/* Login form */}
        <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[420px]">
            {/* Mobile brand */}
            <div className="mb-8 text-center lg:hidden">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25 mb-4">
                <Activity className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Kafkaesque</h1>
              <p className={cn('text-sm mt-1', dark ? 'text-zinc-500' : 'text-slate-500')}>
                Kafka management &amp; observability
              </p>
            </div>

            <div
              className={cn(
                'rounded-2xl border p-8 backdrop-blur-xl transition-colors',
                dark
                  ? 'border-white/[0.08] bg-white/[0.04] shadow-2xl shadow-black/40'
                  : 'border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/60',
              )}
            >
              <div className="mb-7 hidden lg:block">
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className={cn('text-sm mt-1', dark ? 'text-zinc-500' : 'text-slate-500')}>
                  Sign in to your account to continue
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="username"
                    className={cn('block text-xs font-medium mb-1.5', dark ? 'text-zinc-400' : 'text-slate-600')}
                  >
                    Email or username
                  </label>
                  <div className="relative">
                    <User
                      className={cn(
                        'absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none',
                        dark ? 'text-zinc-500' : 'text-slate-400',
                      )}
                    />
                    <input
                      id="username"
                      type="text"
                      placeholder="admin or you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      autoFocus
                      required
                      className={cn(
                        'w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50',
                        dark
                          ? 'border-white/[0.08] bg-white/[0.04] text-zinc-100 placeholder:text-zinc-600'
                          : 'border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400',
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className={cn('block text-xs font-medium mb-1.5', dark ? 'text-zinc-400' : 'text-slate-600')}
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className={cn(
                        'absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none',
                        dark ? 'text-zinc-500' : 'text-slate-400',
                      )}
                    />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className={cn(
                        'w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50',
                        dark
                          ? 'border-white/[0.08] bg-white/[0.04] text-zinc-100 placeholder:text-zinc-600'
                          : 'border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className={cn(
                        'absolute right-3 top-1/2 -translate-y-1/2 transition-colors',
                        dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-700',
                      )}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p
                    className={cn(
                      'text-sm rounded-xl border px-3.5 py-2.5',
                      dark
                        ? 'text-red-400 border-red-500/20 bg-red-500/10'
                        : 'text-red-600 border-red-200 bg-red-50',
                    )}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    'w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all',
                    'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500',
                    'shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2',
                    dark ? 'focus:ring-offset-[#07070f]' : 'focus:ring-offset-slate-50',
                    'disabled:opacity-60 disabled:pointer-events-none',
                  )}
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
