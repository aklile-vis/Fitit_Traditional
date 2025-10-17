"use client"

import {
  ArrowTopRightOnSquareIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  Square3Stack3DIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { formatPrice } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import RemoveSavedModal from '@/components/RemoveSavedModal'
import { AnimatePresence } from 'framer-motion'

type Listing = {
  id: string
  title: string
  address?: string | null
  city?: string | null
  basePrice: number
  currency?: string | null
  coverImage?: string | null
  has3D?: boolean
}

export default function SavedListingsPage() {
  const { isAuthenticated } = useAuth()
  const [list, setList] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [propertyToRemove, setPropertyToRemove] = useState<{ id: string; title: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const listingIds = useMemo(() => new Set(list.map(l => l.id)), [list])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const r = await fetch('/api/saved', { cache: 'no-store' })
        if (!r.ok) {
          setError('Failed to load saved listings')
          return
        }
        const rows = await r.json()
        setList(Array.isArray(rows) ? rows : [])
      } catch (e) {
        setError('Failed to load saved listings')
      } finally {
        setLoading(false)
      }
    }
    if (isAuthenticated) void load()
  }, [isAuthenticated])

  const toggleSave = async (listingId: string) => {
    const isSaved = listingIds.has(listingId)
    
    if (isSaved) {
      // Show confirmation modal for removal
      const listing = list.find(l => l.id === listingId)
      if (listing) {
        setPropertyToRemove({ id: listingId, title: listing.title })
        setShowRemoveModal(true)
      }
    } else {
      // Direct add (no confirmation needed)
      setList(prev => [...prev, { id: listingId, title: 'Property', basePrice: 0 }])
      try {
        await fetch('/api/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId })
        })
      } catch {
        // Revert on failure
        setList(prev => prev.filter(l => l.id !== listingId))
      }
    }
  }

  const confirmRemove = async () => {
    if (!propertyToRemove) return
    
    // Optimistic update
    setList(prev => prev.filter(l => l.id !== propertyToRemove.id))
    
    try {
      await fetch(`/api/saved/${propertyToRemove.id}`, { method: 'DELETE' })
      setToast({ message: 'Removed from saved listings', type: 'success' })
    } catch {
      // Revert on failure
      setList(prev => [...prev, { 
        id: propertyToRemove.id, 
        title: propertyToRemove.title, 
        basePrice: 0 
      }])
      setToast({ message: 'Failed to remove from saved listings', type: 'error' })
    } finally {
      setShowRemoveModal(false)
      setPropertyToRemove(null)
      
      // Auto-hide toast after 3 seconds
      setTimeout(() => {
        setToast(null)
      }, 3000)
    }
  }

  const cancelRemove = () => {
    setShowRemoveModal(false)
    setPropertyToRemove(null)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        {/* Hero Section for Unauthenticated */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[color:var(--brand-50)] via-[color:var(--surface-0)] to-[color:var(--brand-100)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(198,138,63,0.1),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(198,138,63,0.08),transparent_50%)]"></div>
          
          <div className="container relative py-16 lg:py-24">
            <div className="text-center max-w-2xl mx-auto">
               <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-[color:var(--surface-border)] mb-6">
                 <BookmarkIcon className="h-4 w-4 text-[color:var(--brand-600)]" />
                 <span className="text-sm font-medium text-[color:var(--brand-700)]">Your Personal Collection</span>
               </div>
              
              <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-6">
                Saved Listings
              </h1>
              
              <p className="text-lg text-secondary mb-8">
                Sign in to access your saved properties and create your personal real estate collection.
              </p>
              
              <Link href="/login" className="btn btn-primary px-8 py-4 text-base font-semibold shadow-lg hover:shadow-xl">
                Sign In to Continue
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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
                 <BookmarkSolidIcon className="h-4 w-4 text-[color:var(--brand-600)]" />
                 <span className="text-sm font-medium text-[color:var(--brand-700)]">Your Personal Collection</span>
               </div>
              
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-3">
                  Saved Listings
                </h1>
                <p className="text-lg text-secondary max-w-2xl">
                  Your curated collection of favorite properties. Quick access to the homes and spaces that caught your eye.
                </p>
              </div>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[color:var(--brand-600)]">{list.length}</div>
                  <div className="text-sm text-muted">Saved Properties</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[color:var(--brand-600)]">{list.filter(l => l.has3D).length}</div>
                  <div className="text-sm text-muted">3D Ready</div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/listings" className="btn btn-primary px-6 py-3 text-base font-semibold shadow-lg hover:shadow-xl">
                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                Browse Properties
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        <div className="space-y-8">

        {loading && (
          <div className="glass rounded-2xl border border-[color:var(--surface-border)] p-8 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[color:var(--brand-500)] border-t-transparent"></div>
              <div>
                <h3 className="font-semibold text-primary">Loading Your Collection</h3>
                <p className="text-sm text-secondary">Fetching your saved properties...</p>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="glass rounded-2xl border border-[color:var(--danger-500)] bg-red-50/50 p-8 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-800">Error Loading Saved Listings</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && list.length === 0 && !error && (
          <div className="glass rounded-3xl border-2 border-dashed border-[color:var(--surface-border)] p-16 text-center">
            <div className="space-y-6 max-w-md mx-auto">
               <div className="p-4 rounded-full bg-[color:var(--brand-500-12)] w-20 h-20 mx-auto flex items-center justify-center">
                 <BookmarkIcon className="h-10 w-10 text-[color:var(--brand-600)]" />
               </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-primary">No saved listings yet</h3>
                <p className="text-secondary leading-relaxed">
                  Start building your personal collection by saving properties that catch your eye. 
                  Browse our listings and click the bookmark icon to save your favorites.
                </p>
              </div>
              <Link href="/listings" className="btn btn-primary px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl">
                Browse Properties
              </Link>
            </div>
          </div>
        )}

        {list.length > 0 && (
          <div className="glass space-y-6 border border-[color:var(--surface-border)] p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-primary">Your Saved Properties</h2>
              <div className="text-sm text-muted">
                {list.length} propert{list.length !== 1 ? 'ies' : 'y'} saved
              </div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {list.map((listing, index) => {
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
                    className="group relative overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                     {/* Bookmark Button */}
                     <div className="absolute right-4 top-4 z-10">
                       <button
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(listing.id) }}
                         className="rounded-full bg-white/90 p-2 shadow-sm hover:bg-white transition-colors"
                       >
                         <BookmarkSolidIcon className="h-5 w-5 text-[color:var(--brand-600)]" />
                       </button>
                     </div>

                    <Link href={`/listings/${listing.id}`} className="flex h-full flex-col">
                      {/* Image */}
                      <div className="relative h-64 overflow-hidden">
                        {imageSrc ? (
                          <Image
                            alt={listing.title}
                            src={imageSrc}
                            width={600}
                            height={360}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
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
                          <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <PhotoIcon className="h-10 w-10 mx-auto mb-2" />
                              <p className="text-xs">No Image</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Status Badge */}
                        <div className="absolute left-4 top-4">
                          {listing.has3D ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-600)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                              <Square3Stack3DIcon className="h-3 w-3" />
                              Immersive Ready
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 rounded-full bg-gray-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                              <BuildingOffice2Icon className="h-3 w-3" />
                              Standard Listing
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4 text-sm text-primary">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-primary group-hover:text-secondary">{listing.title}</h3>
                          <div className="flex items-center gap-2 text-[12px] text-muted">
                            <MapPinIcon className="h-4 w-4" />
                            {location || 'Location to be announced'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CurrencyDollarIcon className="h-5 w-5 text-[color:var(--brand-600)]" />
                          <span className="text-lg font-bold text-gray-900">
                            {formatPrice(listing.basePrice, listing.currency || 'ETB')}
                          </span>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="text-sm text-gray-500">View Details</div>
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400 group-hover:text-[color:var(--brand-600)] transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
        </div>
      </div>
      
      {/* Remove Confirmation Modal */}
      <RemoveSavedModal
        isOpen={showRemoveModal}
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
        propertyTitle={propertyToRemove?.title}
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
  )
}

