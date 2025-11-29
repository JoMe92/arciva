import React from 'react'
import { useTheme } from '../shared/theme'

export interface ThemeToggleProps {
  className?: string
}

const SunIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    role="presentation"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    <g strokeLinecap="round">
      <line x1="12" y1="3" x2="12" y2="1" />
      <line x1="12" y1="23" x2="12" y2="21" />
      <line x1="4.22" y1="4.22" x2="2.81" y2="2.81" />
      <line x1="21.19" y1="21.19" x2="19.78" y2="19.78" />
      <line x1="3" y1="12" x2="1" y2="12" />
      <line x1="23" y1="12" x2="21" y2="12" />
      <line x1="4.22" y1="19.78" x2="2.81" y2="21.19" />
      <line x1="21.19" y1="2.81" x2="19.78" y2="4.22" />
    </g>
  </svg>
)

const MoonIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    role="presentation"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <path
      d="M21 14.5A8.5 8.5 0 0 1 10.5 4 6.5 6.5 0 1 0 21 14.5Z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M21 14.5A8.5 8.5 0 0 1 10.5 4" />
  </svg>
)

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { mode, toggle } = useTheme()
  const next = mode === 'light' ? 'dark' : 'light'
  const Icon = mode === 'light' ? MoonIcon : SunIcon

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors border-[var(--border,#E3DBCF)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#C78772)] ${className}`}
      aria-pressed={mode === 'dark'}
      aria-label={`Switch to ${next} mode`}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border,#E3DBCF)] bg-[var(--surface-subtle,#FBF7EF)]">
        <Icon />
      </span>
      <span className="hidden sm:inline">{mode === 'light' ? 'Light mode' : 'Dark mode'}</span>
      <span className="sm:hidden capitalize">{mode}</span>
    </button>
  )
}

export default ThemeToggle
