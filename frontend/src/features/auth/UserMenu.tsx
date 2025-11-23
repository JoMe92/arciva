import React, { useState } from 'react'
import LogoutIcon from '../../shared/icons/LogoutIcon'
import { useAuth } from './AuthContext'

type UserMenuProps = {
  variant?: 'full' | 'compact'
  className?: string
}

/**
 * Header-level account control that surfaces logout in a consistent spot.
 * Compact mode hides the text label for tight spaces (e.g., mobile toolbars).
 */
export const UserMenu: React.FC<UserMenuProps> = ({ variant = 'full', className = '' }) => {
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
    <div className={`relative flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] font-semibold text-[var(--text,#1F1E1B)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] disabled:cursor-not-allowed disabled:opacity-70"
        aria-busy={pending}
        title="Log out"
      >
        <LogoutIcon className="h-4 w-4" aria-hidden />
        {variant === 'full' ? <span className="hidden sm:inline">Logout</span> : null}
        <span className="sr-only">Log out</span>
      </button>
      {error ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-10 max-w-xs rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-700 shadow-lg">
          {error}
        </div>
      ) : null}
    </div>
  )
}

export default UserMenu
