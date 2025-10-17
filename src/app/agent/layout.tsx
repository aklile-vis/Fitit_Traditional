'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'

const PUBLIC_ROUTES = new Set(['/agent/login'])
const ALLOWED_ROLES = new Set(['AGENT', 'ADMIN'])

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()

  const isPublic = PUBLIC_ROUTES.has(pathname ?? '')
  const isAgent = user && ALLOWED_ROLES.has(user.role)

  useEffect(() => {
    if (isPublic || isLoading) return
    if (!isAuthenticated) {
      router.replace('/agent/login')
      return
    }
    if (!isAgent) {
      router.replace('/')
    }
  }, [isAuthenticated, isLoading, isAgent, isPublic, router])

  if (isPublic) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[color:var(--accent-500)]/60" />
      </div>
    )
  }

  if (!isAuthenticated || !isAgent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)] text-secondary">
        Redirecting…
      </div>
    )
  }

  return <>{children}</>
}
