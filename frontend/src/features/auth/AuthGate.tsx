import React, { useCallback, useState } from 'react'
import StoneTrailLogo from '../../components/StoneTrailLogo'
import { useAuth } from './AuthContext'

type AuthMode = 'login' | 'signup'

const MIN_PASSWORD_LENGTH = 8

export const AuthGate: React.FC = () => {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (submitting) return
      setError(null)
      setSubmitting(true)
      try {
        if (mode === 'login') {
          await login(email, password)
        } else {
          await signup(email, password)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed'
        setError(message || 'Authentication failed')
      } finally {
        setSubmitting(false)
      }
    },
    [email, login, mode, password, signup, submitting],
  )

  const switchMode = useCallback(() => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'))
    setError(null)
  }, [])

  const heading = mode === 'login' ? 'Sign back in' : 'Create your account'
  const actionLabel = mode === 'login' ? 'Log in' : 'Sign up'
  const toggleLabel = mode === 'login' ? "Don't have an account?" : 'Already registered?'
  const toggleCta = mode === 'login' ? 'Create one' : 'Log in instead'

  const isDisabled = submitting || !email.trim() || password.length < MIN_PASSWORD_LENGTH

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--surface-subtle,#FBF7EF)] text-[var(--text,#1F1E1B)]">
      <div className="auth-visual" aria-hidden />
      <div className="auth-visual-veil" aria-hidden />
      <div className="relative flex min-h-screen flex-col">
        <div className="mx-auto w-full max-w-7xl px-6 pt-8 sm:px-8 lg:px-10">
          <StoneTrailLogo title="Archiver" slogan="Archiver organize once, find forever." className="drop-shadow-sm" />
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 pb-12 pt-6 sm:pt-10 lg:pb-16">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-3xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/92 p-6 shadow-[0_20px_60px_rgba(31,30,27,0.16)] backdrop-blur"
          >
            <div className="mb-4">
              <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
              <p className="text-sm text-[var(--text-muted,#6B645B)]">
                {mode === 'login' ? 'Access your Archiver library.' : 'Choose a strong password (8+ characters).'}
              </p>
            </div>
            <label className="mb-4 block text-sm font-medium text-[var(--text-muted,#6B645B)]">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[var(--text,#1F1E1B)] outline-none focus-visible:border-[var(--text,#1F1E1B)]"
              />
            </label>
            <label className="mb-4 block text-sm font-medium text-[var(--text-muted,#6B645B)]">
              Password
              <input
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[var(--text,#1F1E1B)] outline-none focus-visible:border-[var(--text,#1F1E1B)]"
              />
            </label>
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : null}
            <button
              type="submit"
              disabled={isDisabled}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--text,#1F1E1B)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--text,#1F1E1B)]/90 disabled:cursor-not-allowed disabled:bg-[var(--border,#E1D3B9)]"
            >
              {submitting ? 'Please wait…' : actionLabel}
            </button>
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted,#6B645B)]">
              <span>{toggleLabel}</span>
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-[var(--text,#1F1E1B)] hover:underline"
              >
                {toggleCta}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AuthGate
