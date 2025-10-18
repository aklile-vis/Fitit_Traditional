"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

import { useAuth } from '@/contexts/AuthContext'

export default function EditListingRedirectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!id) return
      try {
        // Load current listing + unit to prefill the upload wizard
        const res = await fetch(`/api/listings/${encodeURIComponent(id)}`, { cache: 'no-store' })
        const payload = await res.json().catch(() => null)
        if (!active) return
        if (!res.ok || !payload?.listing) {
          setError(payload?.error || 'Listing not found')
          return
        }

        const listing = payload.listing as any
        const unit = payload.unit as any

        // Step 1 data for details page
        const step1 = {
          form: {
            title: String(listing.title || ''),
            basePrice: String(listing.basePrice ?? ''),
            description: String(listing.description || ''),
            address: String(listing.address || ''),
            city: String(listing.city || ''),
            subCity: String(listing.subCity || ''),
            bedrooms: listing.bedrooms != null ? String(listing.bedrooms) : '',
            bathrooms: listing.bathrooms != null ? String(listing.bathrooms) : '',
            areaSqm: listing.areaSqm != null ? String(listing.areaSqm) : '',
            currency: String(listing.currency || 'ETB'),
            // Parse arrays from JSON strings if present
            amenities: (() => { try { return listing.amenities ? JSON.parse(listing.amenities) : [] } catch { return [] } })(),
            features: (() => { try { return listing.features ? JSON.parse(listing.features) : [] } catch { return [] } })(),
          },
          propertyType: String(listing.propertyType || ''),
        }

        // Step 2 data for media page
        const images: Array<{ url: string; isCover?: boolean }> = []
        if (listing.coverImage) {
          images.push({ url: listing.coverImage, isCover: true })
        }
        // Also include any image media attached to the unit
        if (Array.isArray(unit?.media)) {
          const unitImages = unit.media
            .filter((m: any) => m?.type === 'IMAGE' && m?.url)
            .map((m: any) => ({ url: m.url }))
          for (const img of unitImages) {
            if (!images.find((i) => i.url === img.url)) images.push(img)
          }
        }
        const floorPlans: Array<{ url: string; name: string }> = (() => {
          try { return listing.floorPlans ? JSON.parse(listing.floorPlans) : [] } catch { return [] }
        })()

        // Videos from unit media
        const videos: Array<{ url: string }> = Array.isArray(unit?.media)
          ? unit.media
              .filter((m: any) => m?.type === 'VIDEO' && m?.url)
              .map((m: any) => ({ url: m.url }))
          : []

        // Floor plans from unit media (role FLOORPLAN) merged with listing JSON
        if (Array.isArray(unit?.media)) {
          const fpFromMedia = unit.media
            .filter((m: any) => m?.type === 'DOCUMENT' && (m?.role === 'FLOORPLAN' || m?.caption))
            .map((m: any) => ({ url: m.url, name: m.caption || 'Floor Plan' }))
          for (const fp of fpFromMedia) {
            if (!floorPlans.find((f) => f.url === fp.url)) floorPlans.push(fp)
          }
        }

        const step2 = { images, videos, floorPlans }

        // Persist to sessionStorage for the upload wizard to restore
        try {
          // Clear the published flag to prevent data clearing
          sessionStorage.removeItem('agent:published')
          sessionStorage.setItem('agent:uploadStep1', JSON.stringify(step1))
          sessionStorage.setItem('agent:uploadStep2', JSON.stringify(step2))
          sessionStorage.setItem('agent:editingListingId', String(id))
        } catch {
          // ignore storage errors
        }

        // Jump into the upload wizard
        router.replace('/agent/upload/details')
      } catch (err) {
        if (!active) return
        setError((err as Error)?.message || 'Failed to prepare edit flow')
      }
    }
    run()
    return () => { active = false }
  }, [id, router])

  if (!isAuthenticated || (user && !(user.role === 'AGENT' || user.role === 'ADMIN'))) {
    return (
      <div className="min-h-screen flex items-center justify-center text-secondary">
        You must be signed in as an agent.
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-secondary">
      {error ? (
        <div className="text-center space-y-4">
          <p className="text-sm">{error}</p>
          <Link href="/agent/my-listings" className="btn btn-secondary">Back to My Listings</Link>
        </div>
      ) : (
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[color:var(--accent-500)] mx-auto mb-3" />
          <p className="text-sm">Preparing editor…</p>
        </div>
      )}
    </div>
  )
}
