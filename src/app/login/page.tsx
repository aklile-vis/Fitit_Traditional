'use client'

import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'


export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login, isAuthenticated, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      // Always redirect to listings page for regular users, agents go to dashboard
      const destination = user?.role === 'AGENT' ? '/agent/dashboard' : '/listings'
      router.replace(destination)
    }
  }, [isAuthenticated, user?.role, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    const result = await login(email, password)

    if (result.success) {
      // Always redirect to listings page for regular users, agents go to dashboard
      const destination = result.user?.role === 'AGENT' ? '/agent/dashboard' : '/listings'
      router.replace(destination)
    } else {
      setError(result.error || 'Login failed')
    }

    setIsLoading(false)
  }

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8 text-xs text-secondary shadow-[var(--shadow-soft)]">
          <div className="text-center">
            <h1 className="text-[26px] font-semibold tracking-tight text-primary">Sign in</h1>
            <p className="mt-2 text-xs text-muted">
              Access immersive listings, configure materials, and manage customized experiences.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-red-500/30 bg-red-50 px-4 py-3 text-xs text-red-700"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input text-sm"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-11 text-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted">
              <label className="flex items-center gap-2">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-[color:var(--surface-border)] bg-transparent text-[color:var(--brand-600)] focus:ring-[color:var(--brand-500)]"
                />
                <span>Remember me</span>
              </label>
              <Link href="/forgot-password" className="font-medium text-brand-strong hover:text-brand">
                Forgot password?
              </Link>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="btn btn-primary w-full justify-center py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--brand-500-28)] border-t-[color:var(--brand-600)]" />
                  Signing in…
                </div>
              ) : (
                'Sign in'
              )}
            </motion.button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[color:var(--surface-border)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[color:var(--surface-1)] px-2 text-muted">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] px-4 py-3 text-sm font-medium text-muted transition-all duration-200 hover:border-brand hover:bg-brand-soft hover:text-brand-strong hover:shadow-md"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] px-4 py-3 text-sm font-medium text-muted transition-all duration-200 hover:border-brand hover:bg-brand-soft hover:text-brand-strong hover:shadow-md"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </motion.button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-brand-strong hover:text-brand">
              Create one here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
