"use client"

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function LegacyPropertyRedirect() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  useEffect(() => {
    router.replace(`/listings/${id}`)
  }, [router, id])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Redirecting…</h2>
        <p className="text-gray-600 mb-8">This page moved to Listings.</p>
        <Link href={`/listings/${id}`} className="text-brand-strong underline hover:text-brand">Go to listing</Link>
      </div>
    </div>
  )
}
