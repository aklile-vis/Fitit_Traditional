'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AgentPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to agent login page
    router.push('/agent/login')
  }, [router])

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent-500)] mx-auto mb-4"></div>
        <p className="text-secondary text-lg">Redirecting to Agent Portal...</p>
      </div>
    </div>
  )
}

