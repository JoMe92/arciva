import React from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'arciva-theme-mode'

type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const isThemeMode = (value: string | null | undefined): value is ThemeMode =>
  value === 'light' || value === 'dark'

const readStoredMode = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isThemeMode(stored) ? stored : null
}

const systemPrefersDark = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const getPreferredTheme = (): ThemeMode => {
  const stored = readStoredMode()
  if (stored) return stored
  return systemPrefersDark() ? 'dark' : 'light'
}

export const primeTheme = () => {
  if (typeof document === 'undefined') return
  const initial = getPreferredTheme()
  document.documentElement.dataset.theme = initial
}

const getInitialMode = (): ThemeMode => {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.dataset.theme
    if (isThemeMode(attr)) {
      return attr
    }
  }
  return getPreferredTheme()
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = React.useState<ThemeMode>(() => getInitialMode())

  const commitMode = React.useCallback((next: ThemeMode) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = next
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
    return next
  }, [])

  const setMode = React.useCallback(
    (next: ThemeMode) => {
      setModeState(commitMode(next))
    },
    [commitMode]
  )

  const toggle = React.useCallback(() => {
    setModeState((prev) => commitMode(prev === 'light' ? 'dark' : 'light'))
  }, [commitMode])

  React.useEffect(() => {
    const mediaQuery =
      typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    if (!mediaQuery) return
    const stored = readStoredMode()
    if (stored) return
    const handleChange = (event: MediaQueryListEvent) => {
      setModeState(commitMode(event.matches ? 'dark' : 'light'))
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [commitMode])

  const value = React.useMemo(() => ({ mode, setMode, toggle }), [mode, setMode, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
