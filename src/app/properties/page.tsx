"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LegacyPropertiesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/listings') }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Redirecting…</h2>
        <p className="text-gray-600 mb-8">This page moved to Listings.</p>
        <Link href="/listings" className="text-brand-strong underline hover:text-brand">Go to listings</Link>
      </div>
    </div>
  )
}
