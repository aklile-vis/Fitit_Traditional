"use client"

import {
  ArrowTopRightOnSquareIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  Square3Stack3DIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { formatPrice } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import WizardWarningModal from '@/components/WizardWarningModal'

type Listing = {
  id: string
  unitId: string
  title: string
  address?: string | null
  city?: string | null
  basePrice: number
  currency?: string | null
  coverImage?: string | null
  isPublished?: boolean
}

export default function MyListingsPage() {
  const { isAuthenticated, user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [status, setStatus] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuOpenFor) return
      const ref = menuRefs.current[menuOpenFor]
      if (ref && !ref.contains(target)) setMenuOpenFor(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpenFor])

  useEffect(() => {
    const load = async () => {
      setStatus('Loading your listings…')
      try {
        const r = await fetch('/api/listings/mine', { cache: 'no-store' })
        const data = await r.json()
        if (!r.ok) { setStatus(data?.error || 'Failed to load'); return }
        setListings(Array.isArray(data) ? data : [])
        setStatus('')
      } catch (e) {
        setStatus('Failed to load')
      }
    }
    if (isAuthenticated) void load()
  }, [isAuthenticated])

  const openDeletePrompt = (listing: Listing) => {
    setMenuOpenFor(null)
    setConfirm({ id: listing.id, title: listing.title })
  }

  const performDelete = async () => {
    if (!confirm?.id) return
    if (deletingId) return
    const id = confirm.id
    setDeletingId(id)
    setStatus('')
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as any)?.error || 'Failed to delete listing')
      }
      setListings((prev) => prev.filter((l) => l.id !== id))
      setConfirm(null)
      setToast({ message: 'Listing deleted successfully', type: 'success' })
    } catch (err) {
      const message = (err as Error)?.message || 'Failed to delete listing'
      setStatus(message)
      setToast({ message: 'Failed to delete listing', type: 'error' })
    } finally {
      setDeletingId(null)
      
      // Auto-hide toast after 3 seconds
      setTimeout(() => {
        setToast(null)
      }, 3000)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[color:var(--brand-50)] via-[color:var(--surface-0)] to-[color:var(--brand-100)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(198,138,63,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(198,138,63,0.08),transparent_50%)]"></div>
        
        <div className="container relative py-12 lg:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-[color:var(--surface-border)]">
                <BuildingOffice2Icon className="h-4 w-4 text-[color:var(--brand-600)]" />
                <span className="text-sm font-medium text-[color:var(--brand-700)]">Agent Dashboard</span>
              </div>
              
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-3">
                  My Listings
                </h1>
                <p className="text-lg text-secondary max-w-2xl">
                  Manage and track all your property listings. Create, edit, and monitor your real estate portfolio.
                </p>
              </div>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[color:var(--brand-600)]">{listings.length}</div>
                  <div className="text-sm text-muted">Total Listings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[color:var(--brand-600)]">{listings.filter(l => l.isPublished).length}</div>
                  <div className="text-sm text-muted">Published</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[color:var(--brand-600)]">{listings.length}</div>
                  <div className="text-sm text-muted">Total Listings</div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/agent/upload" className="btn btn-primary px-6 py-3 text-base font-semibold shadow-lg hover:shadow-xl">
                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                Create New Listing
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        <div className="space-y-8">

        {status && (
          <div className="glass rounded-2xl border border-[color:var(--surface-border)] p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-[color:var(--brand-500-12)]">
                <BuildingOffice2Icon className="h-5 w-5 text-[color:var(--brand-600)]" />
              </div>
              <div>
                <h3 className="font-semibold text-primary">Status Update</h3>
                <p className="text-sm text-secondary">{status}</p>
              </div>
            </div>
          </div>
        )}

        {!status && listings.length === 0 && (
          <div className="glass rounded-3xl border-2 border-dashed border-[color:var(--surface-border)] p-16 text-center">
            <div className="space-y-6 max-w-md mx-auto">
              <div className="p-4 rounded-full bg-[color:var(--brand-500-12)] w-20 h-20 mx-auto flex items-center justify-center">
                <BuildingOffice2Icon className="h-10 w-10 text-[color:var(--brand-600)]" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-primary">No listings yet</h3>
                <p className="text-secondary leading-relaxed">
                  Start building your real estate portfolio by creating your first listing.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/agent/upload" className="btn btn-primary px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl">
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  Create Your First Listing
                </Link>
              </div>
            </div>
          </div>
        )}

        {listings.length > 0 && (
          <div className="glass space-y-6 border border-[color:var(--surface-border)] p-8 rounded-3xl shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-primary">Your Property Portfolio</h2>
              <div className="text-sm text-muted">
                {listings.length} listing{listings.length !== 1 ? 's' : ''} total
              </div>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing, index) => {
                const imageSrc = listing.coverImage
                  ? `/api/files/binary?path=${encodeURIComponent(listing.coverImage)}&listingId=${encodeURIComponent(listing.id)}`
                  : null
                const location = [listing.address, listing.city].filter(Boolean).join(', ')
                return (
                  <motion.div
                    key={listing.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.45, delay: index * 0.05 }}
                    className="group relative overflow-hidden rounded-3xl border-2 border-[color:var(--surface-border)] bg-gradient-to-br from-white to-[color:var(--surface-1)] shadow-lg hover:shadow-2xl hover:border-[color:var(--brand-300)] transition-all duration-500 hover:-translate-y-2"
                  >
                    {/* Status Badges */}
                    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-sm ${
                        listing.isPublished 
                          ? 'bg-gradient-to-r from-green-600 to-green-500' 
                          : 'bg-gradient-to-r from-yellow-600 to-yellow-500'
                      }`}>
                        {listing.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>

                    {/* Type Badge + Actions */}
                    <div className="absolute right-4 top-4 z-10 flex items-center gap-3">

                      {/* Quick actions menu */}
                      <div className="relative" ref={(el) => { menuRefs.current[listing.id] = el }}>
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={menuOpenFor === listing.id}
                          className="rounded-full bg-white/95 backdrop-blur-sm p-3 shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200 hover:scale-110"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenFor(prev => prev === listing.id ? null : listing.id) }}
                          title="More actions"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5 text-gray-600" />
                        </button>
                        {menuOpenFor === listing.id && (
                          <div
                            role="menu"
                            className="absolute right-0 top-[calc(100%+8px)] z-20 w-48 overflow-hidden rounded-2xl border-2 border-[color:var(--surface-border)] bg-white shadow-2xl backdrop-blur-sm"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                          >
                            <Link
                              role="menuitem"
                              href={`/agent/edit/${encodeURIComponent(listing.id)}`}
                              className="flex items-center gap-3 px-4 py-3 text-sm text-secondary hover:bg-[color:var(--surface-hover)] hover:text-primary transition-colors"
                              onClick={() => setMenuOpenFor(null)}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Listing
                            </Link>
                            <button
                              role="menuitem"
                              type="button"
                              className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm text-[color:var(--danger-500)] hover:bg-red-50 transition-colors"
                              disabled={deletingId === listing.id}
                              onClick={() => { openDeletePrompt(listing) }}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              {deletingId === listing.id ? 'Deleting…' : 'Delete Listing'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <Link href={`/listings/${listing.id}`} className="flex h-full flex-col">
                      {/* Image */}
                      <div className="relative h-72 overflow-hidden rounded-t-3xl">
                        {imageSrc ? (
                          <Image
                            alt={listing.title}
                            src={imageSrc}
                            width={640}
                            height={360}
                            className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                            loading="lazy"
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              target.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <PhotoIcon className="h-16 w-16 mx-auto mb-3 opacity-50" />
                              <p className="text-sm font-medium">No Image Available</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Fallback for failed images */}
                        <div className="h-full w-full bg-gradient-to-br from-gray-200 to-gray-300 items-center justify-center hidden">
                          <div className="text-center text-gray-500">
                            <PhotoIcon className="h-16 w-16 mx-auto mb-3 opacity-50" />
                            <p className="text-sm font-medium">Image failed to load</p>
                          </div>
                        </div>
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col p-8">
                        <div className="space-y-4 mb-6">
                          <h3 className="text-2xl font-bold text-gray-900 group-hover:text-[color:var(--brand-600)] transition-colors leading-tight">
                            {listing.title}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPinIcon className="h-4 w-4 text-[color:var(--brand-500)]" />
                            <span className="font-medium">{location || 'Location to be announced'}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 rounded-xl bg-[color:var(--brand-500-12)]">
                            <CurrencyDollarIcon className="h-6 w-6 text-[color:var(--brand-600)]" />
                          </div>
                          <span className="text-2xl font-bold text-gray-900">
                            {formatPrice(listing.basePrice, listing.currency || 'ETB')}
                          </span>
                        </div>
                        
                        <div className="mt-auto flex items-center justify-between pt-6 border-t border-[color:var(--surface-border)]">
                          <div className="text-sm font-semibold text-[color:var(--brand-600)]">
                            View Details
                          </div>
                          <div className="p-2 rounded-full bg-[color:var(--brand-500-12)] group-hover:bg-[color:var(--brand-500-18)] transition-colors">
                            <ArrowTopRightOnSquareIcon className="h-5 w-5 text-[color:var(--brand-600)] group-hover:text-[color:var(--brand-700)] transition-colors" />
                          </div>
                        </div>
                      </div>
                    </Link>

                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
        
        <WizardWarningModal
          isOpen={!!confirm}
          onConfirm={performDelete}
          onCancel={() => setConfirm(null)}
          title="Delete listing?"
          message={`"${confirm?.title ?? ''}" will be removed from your listings. This action cannot be undone.`}
          confirmText={deletingId && confirm?.id === deletingId ? 'Deleting…' : 'Delete'}
          cancelText="Cancel"
        />
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed bottom-6 right-6 z-50 max-w-sm"
            >
              <div className={`rounded-2xl border p-4 shadow-lg backdrop-blur-sm ${
                toast.type === 'success' 
                  ? 'bg-green-50/90 border-green-200 text-green-800' 
                  : 'bg-red-50/90 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {toast.type === 'success' ? (
                      <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{toast.message}</p>
                  </div>
                  <button
                    onClick={() => setToast(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  )
}


