import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as authApi from '../../shared/api/auth'

export type AuthContextValue = {
  user: authApi.AuthUser | null
  initializing: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<authApi.AuthUser | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let active = true
    authApi
      .me()
      .then((current) => {
        if (active) {
          setUser(current)
        }
      })
      .catch(() => {
        if (active) {
          setUser(null)
        }
      })
      .finally(() => {
        if (active) {
          setInitializing(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const nextUser = await authApi.login({ email: normalizeEmail(email), password })
      queryClient.clear()
      setUser(nextUser)
    },
    [queryClient],
  )

  const handleSignup = useCallback(
    async (email: string, password: string) => {
      const nextUser = await authApi.signup({ email: normalizeEmail(email), password })
      queryClient.clear()
      setUser(nextUser)
    },
    [queryClient],
  )

  const handleLogout = useCallback(async () => {
    await authApi.logout()
    queryClient.clear()
    setUser(null)
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      login: handleLogin,
      signup: handleSignup,
      logout: handleLogout,
    }),
    [user, initializing, handleLogin, handleSignup, handleLogout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
