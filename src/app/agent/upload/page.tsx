'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AgentUploadPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to Step 1 (details page)
    router.replace('/agent/upload/details')
  }, [router])

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--accent-500)] mx-auto mb-4"></div>
        <p className="text-muted">Redirecting to upload form...</p>
      </div>
    </div>
  )
}