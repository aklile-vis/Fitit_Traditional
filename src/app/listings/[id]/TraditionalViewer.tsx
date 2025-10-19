"use client"

import { useEffect, useState, useRef } from "react"
import Link from 'next/link'

import {
  MapPinIcon,
  PhotoIcon,
  PlayCircleIcon,
  TagIcon,
  CubeTransparentIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline"
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'

// Inline icons for property specs (match listings page)
const BedIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 10v8M21 18V12a3 3 0 00-3-3H8a3 3 0 00-3 3" />
    <path d="M3 14h18" />
  </svg>
)

const BathIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M7 10V8a2 2 0 114 0v2" />
    <path d="M4 13h16v2a3 3 0 01-3 3H7a3 3 0 01-3-3v-2z" />
    <path d="M7 18v2M17 18v2" />
  </svg>
)

const AreaIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <ArrowsPointingOutIcon {...props} />
)

export type ListingUnitPayload = {
  listing: any
  unit: any
  agent?: {
    id: string
    name: string | null
    email: string
    phone?: string | null
    jobTitle?: string | null
    agencyName?: string | null
    avatarUrl?: string | null
  } | null
}

export type ListingReviewShape = {
  title: string
  subtitle: string
  status: string
  pricing: { basePrice: string; currency: string }
  propertyType: string
  location: string
  address: string
  city: string
  subCity: string
  specs: { bedrooms: number; bathrooms: number; areaSqm: number }
  description: string
  amenities: string[]
  features: string[]
  media: {
    images: string[]
    videos: { url: string; label: string }[]
    floorPlans: { url: string; name: string }[]
    coverImage: string
  }
  immersive: {
    has3D: boolean
    glbPath?: string
    viewerLink?: string
    processedAt?: string
  }
}

export default function TraditionalViewer({ listing }: { listing?: ListingUnitPayload | null }) {
  const [heroIndex, setHeroIndex] = useState(0)
  const [viewer, setViewer] = useState<{ type: 'image' | 'video'; index: number; isFloorPlan?: boolean } | null>(null)
  const initialCoverSet = useRef(false)

  // Show loading state if no data is available yet
  if (!listing) {
    return (
      <div className="min-h-screen bg-[color:var(--app-background)] text-primary flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent-500)] mx-auto"></div>
          <p className="text-lg text-secondary">Loading property details...</p>
        </div>
      </div>
    )
  }

  // Use real data if available, otherwise show no data message
  const realData = listing?.listing
  const realUnit = listing?.unit
  const agent = listing?.agent ?? null
  
  if (!realData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">No Listing Data</h1>
          <p className="text-gray-600 mb-6">This listing is not available or has been removed.</p>
          <Link href="/listings" className="btn btn-primary">
            Browse Other Listings
          </Link>
        </div>
      </div>
    )
  }

  const data = {
    title: realData.title || 'Property Listing',
    subtitle: realData.description || 'Beautiful property for sale',
    pricing: { 
      basePrice: realData.basePrice?.toString() || '0', 
      currency: realData.currency || 'ETB' 
    },
    propertyType: realData.propertyType || 'Property',
    address: realData.address || 'Address not specified',
    city: realData.city || '',
    subCity: realData.subCity || '',
    specs: {
      bedrooms: realData.bedrooms || 0,
      bathrooms: realData.bathrooms || 0,
      areaSqm: realData.areaSqm || 0
    },
    description: realData.description || 'No description available',
    amenities: realData.amenities ? (() => {
      try { return JSON.parse(realData.amenities) } 
      catch { return [] }
    })() : [],
    features: realData.features ? (() => {
      try { return JSON.parse(realData.features) } 
      catch { return [] }
    })() : [],
    media: {
      images: [
        ...(realData.coverImage ? [realData.coverImage] : []),
        // Handle fileUpload.images as both array and JSON string
        ...(Array.isArray(realUnit?.fileUpload?.images) ? realUnit.fileUpload.images : []),
        ...(typeof realUnit?.fileUpload?.images === 'string' ? (() => {
          try { return JSON.parse(realUnit.fileUpload.images || '[]') } 
          catch { return [] }
        })() : []),
        // Handle all image media types
        ...(realUnit?.media?.filter((m: any) => m.type === 'IMAGE').map((m: any) => m.url) || [])
      ].filter((url, index, arr) => arr.indexOf(url) === index), // Remove duplicates
      videos: [
        // Handle fileUpload.videos as both array and JSON string
        ...(Array.isArray(realUnit?.fileUpload?.videos) ? realUnit.fileUpload.videos : []),
        ...(typeof realUnit?.fileUpload?.videos === 'string' ? (() => {
          try { return JSON.parse(realUnit.fileUpload.videos || '[]') } 
          catch { return [] }
        })() : []),
        ...(realUnit?.media?.filter((m: any) => m.type === 'VIDEO').map((m: any) => ({ url: m.url, label: m.caption || 'Video Tour' })) || [])
      ],
      floorPlans: [
        ...(realData.floorPlans ? (() => {
          try { return JSON.parse(realData.floorPlans) } 
          catch { return [] }
        })() : []),
        // Handle fileUpload.floorPlans as both array and JSON string
        ...(Array.isArray(realUnit?.fileUpload?.floorPlans) ? realUnit.fileUpload.floorPlans : []),
        ...(typeof realUnit?.fileUpload?.floorPlans === 'string' ? (() => {
          try { return JSON.parse(realUnit.fileUpload.floorPlans || '[]') } 
          catch { return [] }
        })() : []),
        ...(realUnit?.media?.filter((m: any) => m.type === 'DOCUMENT' && m.role === 'FLOORPLAN').map((m: any) => ({ url: m.url, name: m.caption || 'Floor Plan' })) || [])
      ],
      coverImage: realData.coverImage || ''
    },
    immersive: {
      has3D: realData.has3D || false,
      glbPath: realUnit?.fileUpload?.glbPath || '',
      viewerLink: `/listings/${realData.id}`,
      processedAt: realData.updatedAt?.toString() || ''
    }
  }

  const { title, subtitle, pricing, propertyType, address, city, subCity, specs, description, amenities, features, media, immersive } = data

  // Build a human-friendly "Listed" label from createdAt
  const listedLabel = (() => {
    try {
      const created = realData?.createdAt ? new Date(realData.createdAt) : null
      if (!created || isNaN(created.getTime())) return "Unknown"
      const now = new Date()
      const diffMs = now.getTime() - created.getTime()
      const mins = Math.floor(diffMs / 60000)
      if (mins < 1) return "Just now"
      if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
      const days = Math.floor(hours / 24)
      if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
      // Fallback to date for older items
      return created.toLocaleDateString()
    } catch {
      return "Unknown"
    }
  })()


  // Build absolute URLs for stored paths
  const toAbsolute = (url: string) => {
    if (url?.startsWith('http')) return url
    const listingId = realData?.id
    return listingId 
      ? `/api/files/binary?path=${encodeURIComponent(url)}&listingId=${encodeURIComponent(listingId)}`
      : `/api/files/binary?path=${encodeURIComponent(url)}`
  }

  // Combine images and videos for carousel
  const allMedia = [
    ...media.images.filter(img => img).map((img, index) => ({ type: 'image' as const, url: img, index })),
    ...media.videos.filter(video => video && video.url).map((video, index) => ({ type: 'video' as const, url: video.url, index, label: video.label }))
  ]

  // Set hero index to cover image when media is available (only on initial load)
  useEffect(() => {
    if (media.coverImage && media.images.length > 0 && !initialCoverSet.current) {
      const coverIndex = media.images.findIndex(img => img === media.coverImage)
      if (coverIndex >= 0) {
        setHeroIndex(coverIndex)
        initialCoverSet.current = true
      }
    }
  }, [media.coverImage, media.images])

  // Carousel navigation functions
  const nextHeroMedia = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (allMedia.length > 0) {
      setHeroIndex((prev) => {
        const newIndex = (prev + 1) % allMedia.length
        return newIndex
      })
    }
  }

  const prevHeroMedia = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (allMedia.length > 0) {
      setHeroIndex((prev) => {
        const newIndex = (prev - 1 + allMedia.length) % allMedia.length
        return newIndex
      })
    }
  }

  const openViewer = (type: 'image' | 'video', index: number, isFloorPlan = false) => {
    setViewer({ type, index, isFloorPlan })
  }

  const closeViewer = () => {
    setViewer(null)
  }

  const currentHeroMedia = allMedia[heroIndex]
  const heroUrl = currentHeroMedia ? toAbsolute(currentHeroMedia.url) : 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1600&q=80'

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary">
      {/* Hero Media Carousel Section */}
      <div className="group relative h-[400px] overflow-hidden bg-black cursor-pointer sm:h-[500px]" onClick={() => openViewer(currentHeroMedia?.type || 'image', currentHeroMedia?.index || 0)}>
        {currentHeroMedia?.type === 'video' ? (
          <video
            src={heroUrl}
            className="h-full w-full object-contain bg-black"
            muted
            playsInline
            loop
            autoPlay
          />
        ) : (
          <img 
            src={heroUrl} 
            alt={title}
            className="h-full w-full object-contain bg-black"
          />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Click to view overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="bg-black/70 rounded-full p-4">
            {currentHeroMedia?.type === 'video' ? (
              <PlayCircleIcon className="h-12 w-12 text-white" />
            ) : (
              <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            )}
          </div>
        </div>
        
        {/* Property Badge */}
        <div className="absolute left-6 top-6 z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold shadow-lg">
            <TagIcon className="h-4 w-4 text-[color:var(--accent-500)]" />
            {propertyType}
          </span>
        </div>

        {/* 3D Tour Badge */}
        {immersive.has3D && (
          <div className="absolute right-6 top-6 z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-500)] px-4 py-2 text-sm font-semibold text-white shadow-lg">
              <CubeTransparentIcon className="h-5 w-5" />
              3D Virtual Tour Available
            </span>
          </div>
        )}

        {/* Carousel Navigation Arrows */}
        {allMedia.length > 1 && (
          <>
            <button
              onClick={prevHeroMedia}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/60 p-2 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40 sm:left-4 sm:p-3"
              aria-label="Previous media"
            >
              <ChevronLeftIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
              onClick={nextHeroMedia}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/60 p-2 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40 sm:right-4 sm:p-3"
              aria-label="Next media"
            >
              <ChevronRightIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </>
        )}

        {/* Media Counter & Indicator Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 sm:bottom-6 sm:gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
            {currentHeroMedia?.type === 'video' ? (
              <PlayCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <PhotoIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
            <span>{heroIndex + 1} / {allMedia.length}</span>
          </div>
        </div>

        {/* Dot Indicators */}
        {allMedia.length > 1 && allMedia.length <= 10 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 sm:bottom-20 sm:gap-2">
            {allMedia.map((mediaItem, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  setHeroIndex(index)
                }}
                className={`h-2 rounded-full transition-all duration-300 sm:h-3 ${
                  index === heroIndex 
                    ? 'w-6 bg-white sm:w-8' 
                    : 'w-2 bg-white/50 hover:bg-white/80 sm:w-2'
                }`}
                aria-label={`Go to ${mediaItem.type} ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="container py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Left Column - Property Details */}
          <div className="space-y-8">
            {/* Title & Price */}
            <section className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-primary sm:text-4xl">{title}</h1>
                  <p className="text-base text-secondary sm:text-lg">{subtitle}</p>
                  <div className="flex gap-3 text-muted">
                    <MapPinIcon className="h-6 w-6 flex-shrink-0 mt-0.5 sm:h-8 sm:w-8" />
                    <div className="space-y-1">
                      <div className="text-sm font-medium sm:text-base">{address}</div>
                      <div className="text-xs text-muted sm:text-sm">
                        {(() => {
                          const parts = []
                          if (subCity) parts.push(subCity)
                          if (city && city.toLowerCase() !== subCity?.toLowerCase()) {
                            parts.push(city)
                          }
                          return parts.join(', ')
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-3xl font-bold text-[color:var(--accent-500)] sm:text-4xl">
                    {pricing.currency} {pricing.basePrice}
                  </p>
                </div>
              </div>
            </section>

            {/* Key Stats */}
            <section className="grid grid-cols-3 gap-2 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 sm:gap-4 sm:p-6">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10 sm:h-12 sm:w-12">
                  <BedIcon className="h-8 w-8 text-[color:var(--accent-500)]" />
                </div>
                <p className="text-xl font-bold text-primary sm:text-2xl">{specs.bedrooms}</p>
                <p className="text-xs text-muted sm:text-sm">Bedrooms</p>
              </div>
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10 sm:h-12 sm:w-12">
                  <BathIcon className="h-8 w-8 text-[color:var(--accent-500)]" />
                </div>
                <p className="text-xl font-bold text-primary sm:text-2xl">{specs.bathrooms}</p>
                <p className="text-xs text-muted sm:text-sm">Bathrooms</p>
              </div>
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10 sm:h-12 sm:w-12">
                  <AreaIcon className="h-8 w-8 text-[color:var(--accent-500)]" />
                </div>
                <p className="text-xl font-bold text-primary sm:text-2xl">{specs.areaSqm}</p>
                <p className="text-xs text-muted sm:text-sm">Sqm</p>
              </div>
            </section>

            {/* Description */}
            <section className="space-y-4 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-primary sm:text-2xl">About This Property</h2>
              <p className="text-sm leading-relaxed text-secondary sm:text-base">{description}</p>
            </section>

            {/* Amenities & Features */}
            <section className="space-y-6 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-primary sm:text-2xl">Amenities & Features</h2>
              
              {amenities.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Amenities</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {amenities.map((item: any) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-secondary">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                          <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {features && features.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[color:var(--surface-border)]">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Special Features</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {features.map((item: any) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-secondary">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                          <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Photo Gallery */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary sm:text-2xl">Property Gallery</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {media.images.filter(path => path).map((path, index) => {
                  const imageUrl = path.startsWith('http') 
                    ? path 
                    : `/api/files/binary?path=${encodeURIComponent(path)}`
                  
                  return (
                    <figure
                      key={path}
                      className="group relative overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
                      onClick={() => openViewer('image', index)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openViewer('image', index)
                        }
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={`Property photo ${index + 1}`}
                        className="h-56 w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                    </figure>
                  )
                })}
              </div>
            </section>

            {/* Video Tours */}
            {media.videos.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-primary sm:text-2xl">Video Tours</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {media.videos.filter(video => video && video.url).map((video, index) => (
                    <figure
                      key={video.url}
                      className="group relative overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
                      onClick={() => openViewer('video', index)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openViewer('video', index)
                        }
                      }}
                    >
                      <video
                        src={toAbsolute(video.url)}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-64 w-full object-cover"
                        controls={false}
                        onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}) }}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:opacity-0">
                        <svg className="h-16 w-16 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <p className="text-sm font-medium text-white">{video.label || 'Video Tour'}</p>
                      </div>
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {/* Floor Plans */}
            {media.floorPlans.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-primary sm:text-2xl">Floor Plans</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {media.floorPlans.filter(fp => fp && fp.url).map((floorPlan, index) => {
                    const floorPlanUrl = floorPlan.url.startsWith('http')
                      ? floorPlan.url
                      : `/api/files/binary?path=${encodeURIComponent(floorPlan.url)}`
                    
                    const isPDF = floorPlan.url.includes('.pdf')
                    const isImage = !isPDF

                    // Extract filename from URL with better handling
                    const extractFilename = (url: string) => {
                      // If it's a direct filename, use it
                      if (url.includes('/') && url.split('/').pop()?.includes('.')) {
                        return url.split('/').pop()?.split('?')[0] || 'Unknown File'
                      }
                      // If it's a numeric ID or encoded path, try to decode or use a generic name
                      const pathParts = url.split('/')
                      const lastPart = pathParts[pathParts.length - 1]
                      
                      // If it looks like a numeric ID, create a descriptive name
                      if (/^\d+$/.test(lastPart)) {
                        return `Floor Plan ${lastPart}${isPDF ? '.pdf' : '.jpg'}`
                      }
                      
                      // Try to decode URL-encoded filename
                      try {
                        const decoded = decodeURIComponent(lastPart)
                        if (decoded.includes('.')) {
                          return decoded
                        }
                      } catch (e) {
                        // If decoding fails, continue with fallback
                      }
                      
                      // Final fallback
                      return `Floor Plan ${index + 1}${isPDF ? '.pdf' : '.jpg'}`
                    }

                    const filename = extractFilename(floorPlan.url)

                    const handleFloorPlanClick = () => {
                      if (isImage) {
                        openViewer('image', index, true)
                      } else {
                        // Open PDF floor plan in new tab
                        window.open(floorPlanUrl, '_blank')
                      }
                    }

                    return (
                      <div
                        key={floorPlan.url}
                        className={`flex items-center gap-4 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 ${
                          isImage ? 'cursor-pointer hover:bg-[color:var(--surface-2)] transition-colors' : ''
                        }`}
                        onClick={isImage ? handleFloorPlanClick : undefined}
                        role={isImage ? 'button' : undefined}
                        tabIndex={isImage ? 0 : undefined}
                        onKeyDown={isImage ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleFloorPlanClick()
                          }
                        } : undefined}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10">
                          {isPDF ? (
                            <svg className="h-6 w-6 text-[color:var(--accent-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          ) : (
                            <svg className="h-6 w-6 text-[color:var(--accent-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-primary truncate">
                              {floorPlan.name || filename}
                            </p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              isPDF 
                                ? 'bg-[color:var(--accent-500)]/10 text-[color:var(--accent-500)]' 
                                : 'bg-[color:var(--accent-500)]/10 text-[color:var(--accent-500)]'
                            }`}>
                              {isPDF ? 'PDF' : 'Image'}
                            </span>
                          </div>
                          <p className="text-xs text-muted">
                            {isPDF ? 'PDF Document' : 'Image File'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFloorPlanClick()
                          }}
                          className="btn btn-primary text-sm"
                        >
                          Open
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Contact Card (Sticky) */}
          <aside className="space-y-6">
            <div className="sticky top-20 space-y-6">
              {/* Contact/Inquiry Card */}
              {/* Agent Card */}
              <section className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 shadow-lg sm:p-6">
                <h3 className="text-lg font-semibold text-primary mb-4 sm:text-xl">Listed by</h3>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-[color:var(--surface-2)] overflow-hidden flex items-center justify-center">
                    {agent?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={agent.avatarUrl} alt={agent?.name || "Agent"} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-secondary">{(agent?.name || "Agent").slice(0,1)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-primary truncate">{agent?.name || "Agent"}</div>
                    <div className="text-xs text-secondary truncate">{agent?.jobTitle || agent?.agencyName || "Real Estate Agent"}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Phone</span>
                    <span className="font-medium text-primary">{agent?.phone || "Not provided"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Email</span>
                    <span className="font-medium text-primary truncate max-w-[60%]">{agent?.email || "Not provided"}</span>
                  </div>
                  {agent?.agencyName && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Agency</span>
                      <span className="font-medium text-primary">{agent.agencyName}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  <a
                    href={agent?.phone ? `tel:${agent.phone}` : undefined}
                    className="btn btn-primary w-full justify-center text-base disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-disabled={!agent?.phone}
                  >
                    Call Agent
                  </a>
                  <a
                    href={agent?.email ? `mailto:${agent.email}` : undefined}
                    className="btn btn-secondary w-full justify-center text-base"
                  >
                    Email Agent
                  </a>
                </div>
                <div className="mt-6 pt-6 border-t border-[color:var(--surface-border)] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Property ID</span>
                    <span className="font-medium text-primary">EST-{Math.floor(Math.random() * 100000)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Listed</span>
                    <span className="font-medium text-primary">{listedLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Status</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Available
                    </span>
                  </div>
                </div>
              </section>

              {/* 3D Virtual Tour Card */}
              {immersive.has3D && (
                <section className="rounded-2xl border-2 border-[color:var(--accent-500)] bg-gradient-to-br from-[color:var(--accent-500)]/5 to-transparent p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-500)]">
                      <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary">3D Virtual Tour</h3>
                      <p className="text-xs text-muted">Explore in 3D</p>
                    </div>
                  </div>
                  <p className="text-sm text-secondary mb-4">
                    Experience this property in immersive 3D. Walk through every room from the comfort of your home.
                  </p>
                  {immersive.viewerLink && (
                    <button className="btn btn-primary w-full justify-center">
                      Launch 3D Tour
                    </button>
                  )}
                </section>
              )}

              {/* Quick Stats */}
              <section className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 sm:p-6">
                <h3 className="font-semibold text-primary mb-4">Property Stats</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Total Media</dt>
                    <dd className="font-medium text-primary">{media.images.length + media.videos.length} files</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Type</dt>
                    <dd className="font-medium text-primary">{propertyType}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Location</dt>
                    <dd className="font-medium text-primary">{city}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </aside>
        </div>
      </div>

      {/* Media viewer modal (minimal, with arrows) */}
      {viewer && (() => {
        let list, current, src
        
        if (viewer.isFloorPlan) {
          // Handle floor plan images and PDFs
          list = media.floorPlans
          current = media.floorPlans[viewer.index]
          src = current ? toAbsolute(current.url) : ''
        } else {
          // Handle regular images and videos
          list = viewer.type === 'image' ? media.images : media.videos
          current = list[viewer.index]
          src = viewer.type === 'image' ? toAbsolute(current as string) : toAbsolute((current as {url:string}).url)
        }

        const isPdf = current && (
          (typeof current === 'string' && current.includes('.pdf')) ||
          (typeof current === 'object' && current.url && current.url.includes('.pdf'))
        )

        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            onClick={closeViewer}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-6xl"
              onClick={(e) => e.stopPropagation()}
            >
              {isPdf ? (
                // PDF viewer with fallback
                <div className="w-full h-full">
                  <iframe
                    src={`${src}#toolbar=0&navpanes=0&scrollbar=1&zoom=FitH`}
                    className="mx-auto max-h-[90vh] w-full max-w-full rounded"
                    title="PDF Viewer"
                    onError={() => {
                      // Fallback: open in new tab if iframe fails
                      window.open(src, '_blank')
                    }}
                  />
                </div>
              ) : viewer.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="mx-auto max-h-[90vh] w-auto max-w-full object-contain rounded-2xl" />
              ) : (
                <video
                  src={src}
                  className="mx-auto max-h-[90vh] w-auto max-w-full rounded-2xl"
                  controls
                  autoPlay
                />
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={closeViewer}
                aria-label="Close viewer"
                className="absolute right-4 top-4 rounded-full bg-black/70 p-3 text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              {/* Navigation arrows - only show for multiple items */}
              {list.length > 1 && (
                <div className={`absolute inset-x-0 ${viewer.type === 'video' ? 'bottom-20' : 'bottom-4'} flex justify-center pointer-events-none`}>
                  <div className="inline-flex items-center gap-3 rounded-full bg-black/70 px-3 py-2 pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const newIndex = (viewer.index - 1 + list.length) % list.length
                        setViewer({ ...viewer, index: newIndex })
                      }}
                      aria-label="Previous"
                      className="rounded-full p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
                    >
                      <ChevronLeftIcon className="h-6 w-6" />
                    </button>
                    <span className="text-sm text-white font-medium px-2">
                      {viewer.index + 1} / {list.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newIndex = (viewer.index + 1) % list.length
                        setViewer({ ...viewer, index: newIndex })
                      }}
                      aria-label="Next"
                      className="rounded-full p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
                    >
                      <ChevronRightIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
