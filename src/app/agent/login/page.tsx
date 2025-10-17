'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BuildingOfficeIcon,
  EyeIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'

import { useAuth } from '@/contexts/AuthContext'

export default function AgentLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { login, user, isAuthenticated, isLoading: authLoading, logout } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (isAuthenticated && (user?.role === 'AGENT' || user?.role === 'ADMIN')) {
      router.replace('/agent/dashboard')
    }
  }, [authLoading, isAuthenticated, user?.role, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const result = await login(email, password)
    if (!result.success) {
      setError(result.error || 'Invalid credentials')
      setIsLoading(false)
      return
    }

    const role = result.user?.role || user?.role
    if (role === 'AGENT' || role === 'ADMIN') {
      router.push('/agent/dashboard')
    } else {
      setError('Agent access required. Contact support to upgrade your account.')
      logout()
    }

    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="surface-soft border border-surface p-8 shadow-[var(--shadow-soft-raised)]">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-gradient-to-br from-[color:var(--sand-400)] to-[color:var(--sand-600)] p-3 text-overlay shadow-[var(--shadow-soft)]">
                <BuildingOfficeIcon className="h-8 w-8" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-primary">Agent Portal</h1>
            <p className="text-secondary">Upload and manage 3D property models</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 px-4 py-3 text-sm text-secondary">
                {error}
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-surface bg-[color:var(--surface-input)] py-3 pl-10 pr-4 text-primary placeholder:text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
                  placeholder="agent@example.com"
                  required
                />
                <EyeIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-surface bg-[color:var(--surface-input)] py-3 pl-10 pr-4 text-primary placeholder:text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
                  placeholder="Enter your password"
                  required
                />
                <LockClosedIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="btn btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[rgba(255,255,255,0.85)]"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Need access?{' '}
            <button
              type="button"
              className="text-secondary underline decoration-dotted underline-offset-4 transition-colors hover:text-primary"
              onClick={() => router.push('/register')}
            >
              Request an agent account
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
