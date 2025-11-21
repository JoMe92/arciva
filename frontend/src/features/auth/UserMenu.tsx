import React, { useState } from 'react'
import { useAuth } from './AuthContext'

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return null
  }

  const handleLogout = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await logout()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to log out'
      setError(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">{error}</div>
      ) : null}
      <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-xs shadow-lg">
        <span className="max-w-[160px] truncate font-medium text-[var(--text,#1F1E1B)]">{user.email}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="rounded-full border border-transparent bg-[var(--text,#1F1E1B)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white transition hover:bg-[var(--text,#1F1E1B)]/90 disabled:cursor-not-allowed disabled:bg-[var(--border,#E1D3B9)]"
        >
          {pending ? '...' : 'Log out'}
        </button>
      </div>
    </div>
  )
}

export default UserMenu
