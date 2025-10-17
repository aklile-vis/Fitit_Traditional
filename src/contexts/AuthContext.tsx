'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' })
      if (!response.ok) {
        setUser(null)
        setToken(null)
        return
      }
      const data = await response.json().catch(() => ({}))
      if (data?.authenticated && data?.user) {
        setUser(data.user as User)
        setToken(data.token ?? null)
      } else {
        setUser(null)
        setToken(null)
      }
    } catch (err) {
      console.warn('[auth] session refresh failed', err)
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        return { success: false, error: data?.error || 'Invalid credentials' }
      }

      const normalizedRole = String(data?.user?.role || 'USER').toUpperCase() as User['role']
      const normalizedUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? null,
        avatar: data.user.avatar ?? undefined,
        role: normalizedRole,
      }

      setUser(normalizedUser)
      setToken(data.token ?? null)
      void refreshSession()

      return { success: true, user: normalizedUser }
    } catch (err) {
      return { success: false, error: (err as Error)?.message || 'Login failed' }
    }
  }, [refreshSession])

  const logout = useCallback(() => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setToken(null)
    // Redirect to login page after logout
    window.location.href = '/login'
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      refresh: refreshSession,
    }),
    [user, token, isLoading, login, logout, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
