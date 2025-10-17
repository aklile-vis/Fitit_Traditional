"use client"

import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import ListingSuccessModal from '@/components/ListingSuccessModal'
import {
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  CubeTransparentIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PhotoIcon,
  PlayCircleIcon,
  TagIcon,
} from "@heroicons/react/24/outline"
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'


export default function AgentListingReviewPage() {
  const [draft, setDraft] = useState<any>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('agent:reviewDraft')
      if (!raw) return
      const parsed = JSON.parse(raw)
      // Basic shape guard and normalisation
      const normalized: any = {
        title: typeof parsed?.title === 'string' ? parsed.title : '',
        subtitle: typeof parsed?.subtitle === 'string' ? parsed.subtitle : '',
        status: 'Draft',
        pricing: {
          basePrice: typeof parsed?.pricing?.basePrice === 'string' ? parsed.pricing.basePrice : String(parsed?.pricing?.basePrice || ''),
          currency: typeof parsed?.pricing?.currency === 'string' ? parsed.pricing.currency : 'ETB',
        },
        propertyType: typeof parsed?.propertyType === 'string' ? parsed.propertyType : '',
        location: typeof parsed?.location === 'string' ? parsed.location : '',
        address: typeof parsed?.address === 'string' ? parsed.address : '',
        city: typeof parsed?.city === 'string' ? parsed.city : '',
        subCity: typeof parsed?.subCity === 'string' ? parsed.subCity : '',
        specs: {
          bedrooms: parsed?.specs?.bedrooms || '0',
          bathrooms: parsed?.specs?.bathrooms || '1',
          areaSqm: Number(parsed?.specs?.areaSqm || 0),
        },
        description: typeof parsed?.description === 'string' ? parsed.description : '',
        amenities: Array.isArray(parsed?.amenities) ? parsed.amenities : [],
        features: Array.isArray(parsed?.features) ? parsed.features : [],
        media: {
          images: Array.isArray(parsed?.media?.images) ? parsed.media.images.filter((url: string) => {
            // Filter out problematic URLs and log them for debugging
            if (url.includes('file_storage/processed/renders/') || url === 'placeholder.jpg') {
              console.warn('Filtering out problematic image URL:', url)
              return false
            }
            return true
          }) : [],
          videos: Array.isArray(parsed?.media?.videos) ? parsed.media.videos : [],
          floorPlans: Array.isArray(parsed?.media?.floorPlans) ? parsed.media.floorPlans : [],
          coverImage: parsed?.media?.coverImage || null,
        },
        immersive: {
          has3D: Boolean(parsed?.immersive?.has3D),
          glbPath: parsed?.immersive?.glbPath || undefined,
          ifcPath: parsed?.immersive?.ifcPath || undefined,
          usdPath: parsed?.immersive?.usdPath || undefined,
          filePath: parsed?.immersive?.filePath || undefined,
          fileName: parsed?.immersive?.fileName || undefined,
          elementsCount: parsed?.immersive?.elementsCount || 0,
          aiEnrichment: parsed?.immersive?.aiEnrichment || null,
          topologyPath: parsed?.immersive?.topologyPath || undefined,
          processedAt: parsed?.immersive?.processedAt || undefined,
          editorChanges: parsed?.immersive?.editorChanges || null,
          unitId: parsed?.immersive?.unitId || undefined,
          viewerLink: parsed?.immersive?.viewerLink || undefined,
        },
      }
      setDraft(normalized)
    } catch {
      // ignore parse/storage errors
    }
  }, [])

  // Build absolute URLs for stored paths
  const toAbsolute = (url: string) => (url?.startsWith('http') ? url : `/api/files/binary?path=${encodeURIComponent(url)}`)

// Hero carousel state
  const [heroIndex, setHeroIndex] = useState(0)

  // Lightbox state
  type Viewer = { type: 'image' | 'video'; index: number; isFloorPlan?: boolean } | null
  const [viewer, setViewer] = useState<Viewer>(null)


  // Hero carousel navigation
  const nextHeroMedia = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (allMedia.length > 0) {
      setHeroIndex((prev) => (prev + 1) % allMedia.length)
    }
  }

  const prevHeroMedia = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (allMedia.length > 0) {
      setHeroIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length)
    }
  }

  const openHeroInViewer = () => {
    if (allMedia.length > 0 && currentHeroMedia) {
      if (currentHeroMedia.type === 'image') {
        setViewer({ type: 'image', index: currentHeroMedia.index })
      } else {
        setViewer({ type: 'video', index: currentHeroMedia.index })
      }
    }
  }


  const onCardKeyDown = (e: React.KeyboardEvent, open: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
  }
  

  // Media viewer functions - defined before early return to maintain hook order
  const closeViewer = useCallback(() => setViewer(null), [])
  const nextViewer = useCallback(() => {
    if (!viewer || !draft?.media) return
    const list = viewer.type === 'image' ? draft.media.images : draft.media.videos
    if (!list?.length) return
    setViewer({ type: viewer.type, index: (viewer.index + 1) % list.length })
  }, [viewer, draft?.media?.images, draft?.media?.videos])
  const prevViewer = useCallback(() => {
    if (!viewer || !draft?.media) return
    const list = viewer.type === 'image' ? draft.media.images : draft.media.videos
    if (!list?.length) return
    setViewer({ type: viewer.type, index: (viewer.index - 1 + list.length) % list.length })
  }, [viewer, draft?.media?.images, draft?.media?.videos])

  // Keyboard + scroll lock while viewer is open - defined before early return
  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeViewer(); return }
      // Allow native seeking for videos; only hijack arrows for images
      if (viewer.type === 'image') {
        if (e.key === 'ArrowRight') { e.preventDefault(); nextViewer() }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); prevViewer() }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [viewer, closeViewer, nextViewer, prevViewer])


  // Set hero index to cover image when media is available - defined before early return
  useEffect(() => {
    if (draft?.media?.coverImage && draft?.media?.images?.length > 0) {
      const coverIndex = draft.media.images.findIndex((img: string) => img === draft.media.coverImage)
      if (coverIndex >= 0) {
        setHeroIndex(coverIndex)
      }
    }
  }, [draft?.media?.coverImage, draft?.media?.images])

  // Router and auth hooks - defined before early return
  const router = useRouter()
  const { token } = useAuth()
  const [isPublishing, setIsPublishing] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [publishedListingTitle, setPublishedListingTitle] = useState('')

  // Keyboard support for error modal
  useEffect(() => {
    if (!showErrorModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowErrorModal(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { 
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow 
    }
  }, [showErrorModal])

  if (!draft) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">No Draft Data</h1>
          <p className="text-gray-600 mb-6">Please complete the upload process to review your listing.</p>
          <Link href="/agent/upload/details" className="btn btn-primary">
            Start Upload Process
          </Link>
        </div>
      </div>
    )
  }

  const { title, subtitle, pricing, propertyType, location, specs, description, amenities, features, media, immersive } = draft


  const publishListing = async () => {
    if (!token) {
      console.error("Authentication token not found.")
      // Optionally, redirect to login or show an error message
      return
    }

    setIsPublishing(true)

    try {
      // Extract property type from the stored format
      let subtype: string = propertyType.split(' / ')[1] || propertyType.split(' / ')[0] || 'Other'

      if (propertyType.includes('Commercial')) {
        subtype = propertyType.split(' / ')[1] || 'Other Commercial'
      } else if (propertyType.includes('Residential')) {
        subtype = propertyType.split(' / ')[1] || 'Other Residential'
      }

      const payload = {
        title: title,
        description: description,
        basePrice: parseFloat(pricing.basePrice.replace(/,/g, '')), // Changed from 'price' to 'basePrice'
        currency: pricing.currency,
        address: location.split(', ')[0],
        city: location.split(', ')[2] || location.split(', ')[1], // Use the last part as city
        subCity: location.split(', ')[1] || draft?.subCity || '', // Use the middle part as subCity
        images: media.images,
        videos: media.videos.map((v: any) => v.url),
        floorPlans: media.floorPlans,
        coverImage: media.coverImage,
        propertyType: subtype, // Send the actual property type (e.g., "Apartment", "Villa")
        bedrooms: specs.bedrooms,
        bathrooms: specs.bathrooms,
        areaSqm: specs.areaSqm,
        amenities: draft?.amenities || [],
        features: draft?.features || [],
        isPublished: true, // Mark as published when submitted from here
        immersive: {
          has3D: immersive.has3D,
          glbPath: immersive.glbPath,
          ifcPath: immersive.ifcPath,
          usdPath: immersive.usdPath,
          filePath: immersive.filePath,
          fileName: immersive.fileName,
          elementsCount: immersive.elementsCount,
          aiEnrichment: immersive.aiEnrichment,
          topologyPath: immersive.topologyPath,
          processedAt: immersive.processedAt,
          editorChanges: immersive.editorChanges,
          unitId: immersive.unitId,
        },
        // unitId is intentionally omitted if not present in the draft
      }
      
      // If editing, send PUT to update existing listing
      let response: Response
      let editingId: string | null = null
      try { editingId = sessionStorage.getItem('agent:editingListingId') } catch {}
      if (editingId) {
        response = await fetch(`/api/listings/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch('/api/listings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to publish listing')
      }

      await response.json()
      
      // Clear all upload data after successful publication
      sessionStorage.removeItem('agent:uploadStep1')
      sessionStorage.removeItem('agent:uploadStep2')
      sessionStorage.removeItem('agent:uploadStep3')
      sessionStorage.removeItem('agent:reviewDraft')
      sessionStorage.removeItem('agent:editingListingId')
      sessionStorage.removeItem('agent:editorChanges')
      
      // Set flag to indicate successful publishing
      sessionStorage.setItem('agent:published', 'true')
      
      // Show success modal instead of redirecting
      setPublishedListingTitle(draft?.title || 'Your listing')
      setShowSuccessModal(true)
    } catch (error: any) {
      console.error('Error publishing listing:', error.message)
      // Display error message in modal
      setErrorMessage(`Error publishing listing: ${error.message}`)
      setShowErrorModal(true)
    } finally {
      setIsPublishing(false)
    }
  }

  // Combine images and videos for carousel
  const allMedia = [
    ...media.images.map((img: string, index: number) => ({ type: 'image' as const, url: img, index })),
    ...media.videos.map((video: any, index: number) => ({ type: 'video' as const, url: video.url, index, label: video.label }))
  ]

  // Get current hero media based on carousel index
  const currentHeroMedia = allMedia.length > 0 ? allMedia[heroIndex] : null
  const heroUrl = currentHeroMedia ? toAbsolute(currentHeroMedia.url) : 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1600&q=80'

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary">
      {/* Step Indicator */}
      <div className="border-b border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
        <div className="container py-6">
          <div className="flex items-center justify-center space-x-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                    step <= 3
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)] text-white'
                      : 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)] text-white'
                  }`}
                >
                  {step === 4 ? <ClipboardDocumentListIcon className="h-5 w-5" /> : step}
                </div>
                <div className="ml-3 text-sm">
                  <p className={`font-medium ${step <= 4 ? 'text-primary' : 'text-muted'}`}>
                    {step === 1 ? 'Property Details' : step === 2 ? 'Media Upload' : step === 3 ? '3D Pipeline' : 'Review & Preview'}
                  </p>
                </div>
                {step < 4 && (
                  <div className={`ml-8 h-px w-16 ${step < 3 ? 'bg-[color:var(--accent-500)]' : 'bg-[color:var(--accent-500)]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review Header */}
      <div className="border-b border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
        <div className="container py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 px-4 py-1.5 text-xs uppercase tracking-[0.35em] text-[color:var(--accent-500)]">
                <ClipboardDocumentListIcon className="h-4 w-4" /> Step 4 of 4
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary">Final Review & Preview</h1>
                <p className="mt-2 max-w-2xl text-lg text-secondary">
                  This is exactly what buyers will see when browsing your property listing. Review all details before publishing.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/agent/upload?restore=1" className="btn btn-secondary">
                Back to Edit
              </Link>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={publishListing}
                disabled={isPublishing}
              >
                {isPublishing ? 'Publishing...' : 'Publish Listing'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Media Carousel Section */}
      <div 
        className="relative h-[500px] overflow-hidden bg-black cursor-pointer group"
        onClick={openHeroInViewer}
      >
        {/* Media Content */}
        {currentHeroMedia?.type === 'video' ? (
          <video
            src={heroUrl}
            className="h-full w-full object-contain bg-black"
            muted
            playsInline
            loop
            autoPlay
            controls={false}
            onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}) }}
            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
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
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/60 p-3 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Previous media"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              onClick={nextHeroMedia}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/60 p-3 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Next media"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Media Counter & Indicator Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            {currentHeroMedia?.type === 'video' ? (
              <PlayCircleIcon className="h-5 w-5" />
            ) : (
              <PhotoIcon className="h-5 w-5" />
            )}
            <span>{heroIndex + 1} / {allMedia.length}</span>
          </div>
        </div>

        {/* Dot Indicators */}
        {allMedia.length > 1 && allMedia.length <= 10 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            {allMedia.map((mediaItem, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  setHeroIndex(index)
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === heroIndex 
                    ? 'w-8 bg-white' 
                    : 'w-2 bg-white/50 hover:bg-white/80'
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
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-primary">{title}</h1>
                  <p className="text-lg text-secondary">{subtitle}</p>
                  <div className="flex gap-3 text-muted">
                    <MapPinIcon className="h-8 w-8 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-base font-medium">{draft.address}</div>
                      <div className="text-sm text-muted">
                        {draft.subCity && draft.city ? `${draft.subCity}, ${draft.city}` : draft.city || draft.subCity || ''}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-[color:var(--accent-500)]">
                    {pricing.currency} {pricing.basePrice}
                  </p>
                </div>
              </div>
            </section>

            {/* Key Stats */}
            <section className="grid grid-cols-3 gap-4 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10">
                  <svg className="h-6 w-6 text-[color:var(--accent-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 6v12a2 2 0 002 2h14a2 2 0 002-2V6M3 6V4a2 2 0 012-2h14a2 2 0 012 2v2M7 8h10M7 8v8M17 8v8M9 10h6M9 14h6" />
                    <circle cx="12" cy="10" r="1" fill="currentColor" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 10h2" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-primary">{specs.bedrooms}</p>
                <p className="text-sm text-muted">Bedrooms</p>
              </div>
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10">
                  <svg className="h-6 w-6 text-[color:var(--accent-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h18M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8V6a2 2 0 012-2h14a2 2 0 012 2v2M7 10h10M7 10v4M17 10v4M9 12h6" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h2M5 4v2M5 4l1 1M7 4l-1 1M5 6h2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5v1M6 6v1M6 7v1" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-primary">{specs.bathrooms}</p>
                <p className="text-sm text-muted">Bathrooms</p>
              </div>
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10">
                  <svg className="h-6 w-6 text-[color:var(--accent-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3V3zM3 12h18M12 3v18" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-primary">{specs.areaSqm}</p>
                <p className="text-sm text-muted">Sqm</p>
              </div>
            </section>

            {/* Description */}
            <section className="space-y-4 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8">
              <h2 className="text-2xl font-semibold text-primary">About This Property</h2>
              <p className="text-base leading-relaxed text-secondary">{description}</p>
            </section>

            {/* Amenities & Features */}
            <section className="space-y-6 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8">
              <h2 className="text-2xl font-semibold text-primary">Amenities & Features</h2>
              
              {amenities.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Amenities</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {amenities.map((item: string) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-secondary">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                          <CheckBadgeIcon className="h-4 w-4 text-green-600" />
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
                    {features.map((item: string) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-secondary">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                          <CheckBadgeIcon className="h-4 w-4 text-blue-600" />
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
              <h2 className="text-2xl font-semibold text-primary">Property Gallery</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {media.images.map((path: string, index: number) => {
                  const imageUrl = path.startsWith('http') 
                    ? path 
                    : `/api/files/binary?path=${encodeURIComponent(path)}`
                  const isCoverImage = media.coverImage === path
                  
                  return (
                    <figure
                      key={path}
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewer({ type: 'image', index })}
                      onKeyDown={(e) => onCardKeyDown(e, () => setViewer({ type: 'image', index }))}
                      className="group relative overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
                    >
                      <img
                        src={imageUrl}
                        alt={`Property photo ${index + 1}`}
                        className="h-56 w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      {isCoverImage && (
                        <div className="absolute left-2 top-2 rounded-full bg-[color:var(--accent-500)] px-2 py-1 text-xs font-medium text-white">
                          Cover Photo
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                    </figure>
                  )
                })}
              </div>
            </section>

            {/* Video Tours */}
            {media.videos.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-primary">Video Tours</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {media.videos.map((video: any, index: number) => (
                    <figure
                      key={video.url}
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewer({ type: 'video', index })}
                      onKeyDown={(e) => onCardKeyDown(e, () => setViewer({ type: 'video', index }))}
                      className="group relative overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
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
                        <PlayCircleIcon className="h-16 w-16 text-white drop-shadow-lg" />
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
                <h2 className="text-2xl font-semibold text-primary">Floor Plans</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {media.floorPlans.map((floorPlan: any) => {
                    const floorPlanUrl = floorPlan.url.startsWith('http')
                      ? floorPlan.url
                      : `/api/files/binary?path=${encodeURIComponent(floorPlan.url)}`
                    
                    const isPDF = floorPlan.url.includes('.pdf')
                    const isImage = !isPDF

                    const handleFloorPlanClick = () => {
                      if (isImage) {
                        // For images, open in viewer with floor plan flag
                        setViewer({ type: 'image', index: 0, isFloorPlan: true })
                      } else {
                        // For PDFs, open in new tab
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
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-500)]/10">
                          {isPDF ? (
                            <svg className="h-7 w-7 text-[color:var(--accent-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="h-7 w-7 text-[color:var(--accent-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-primary truncate">{floorPlan.name}</p>
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

            {/* 3D Virtual Tour Preview */}
            {immersive.has3D && (
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-primary">3D Virtual Tour</h2>
                <div className="space-y-4">
                  {/* 3D Model Preview */}
                  <div className="aspect-video bg-gray-100 rounded-xl border border-[color:var(--surface-border)] overflow-hidden">
                    {immersive.glbPath ? (
                      <iframe 
                        src={`/agent/3d-viewer?model=${encodeURIComponent(immersive.glbPath)}&embedded=true&controls=true`}
                        className="w-full h-full"
                        title="3D Virtual Tour Preview"
                        allow="fullscreen"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <CubeTransparentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">3D Model Loading...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 3D Details */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4">
                      <h3 className="font-medium text-primary">Model Information</h3>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted">File Name</dt>
                          <dd className="font-medium text-primary">{immersive.fileName || '3D Model'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">Elements</dt>
                          <dd className="font-medium text-primary">{immersive.elementsCount}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">Processed</dt>
                          <dd className="font-medium text-primary">
                            {immersive.processedAt ? new Date(immersive.processedAt).toLocaleDateString() : 'Recently'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    
                    {/* Editor Changes Summary */}
                    {immersive.editorChanges && (
                      <div className="space-y-3 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4">
                        <h3 className="font-medium text-primary">Customizations</h3>
                        <div className="space-y-2 text-sm">
                          {immersive.editorChanges.materialAssignments && Object.keys(immersive.editorChanges.materialAssignments).length > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-muted">Materials Updated</dt>
                              <dd className="font-medium text-primary">{Object.keys(immersive.editorChanges.materialAssignments).length}</dd>
                            </div>
                          )}
                          {immersive.editorChanges.navigation?.guidedViews && immersive.editorChanges.navigation.guidedViews.length > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-muted">Saved Views</dt>
                              <dd className="font-medium text-primary">{immersive.editorChanges.navigation.guidedViews.length}</dd>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <dt className="text-muted">Last Updated</dt>
                            <dd className="font-medium text-primary">
                              {immersive.editorChanges.updatedAt ? new Date(immersive.editorChanges.updatedAt).toLocaleDateString() : 'Recently'}
                            </dd>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 3D Features */}
                  <div className="rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4">
                    <h3 className="font-medium text-primary mb-3">3D Features</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-secondary">Interactive Navigation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-secondary">Material Customization</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-secondary">AI-Enhanced</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-secondary">Mobile Compatible</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Contact Card (Sticky) */}
          <aside className="space-y-6">
            <div className="sticky top-20 space-y-6">
              {/* Contact/Inquiry Card */}
              <section className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-lg">
                <h3 className="text-xl font-semibold text-primary mb-4">Interested in this property?</h3>
                <div className="space-y-4">
                  <button className="btn btn-primary w-full justify-center text-base">
                    Schedule a Viewing
                  </button>
                  <button className="btn btn-secondary w-full justify-center text-base">
                    Contact Agent
                  </button>
                  <button className="btn btn-outline w-full justify-center text-base">
                    Request Info
                  </button>
                </div>
                
                <div className="mt-6 pt-6 border-t border-[color:var(--surface-border)] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Property ID</span>
                    <span className="font-medium text-primary">EST-{Math.floor(Math.random() * 100000)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Listed</span>
                    <span className="font-medium text-primary">Just now</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Status</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      <CheckBadgeIcon className="h-3 w-3" />
                      Available
                    </span>
                  </div>
                </div>
              </section>

              {/* 3D Virtual Tour Card */}
              {immersive.has3D && (
                <section className="rounded-2xl border-2 border-[color:var(--accent-500)] bg-gradient-to-br from-[color:var(--accent-500)]/5 to-transparent p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-500)]">
                      <CubeTransparentIcon className="h-7 w-7 text-white" />
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
                    <Link href={immersive.viewerLink} className="btn btn-primary w-full justify-center">
                      Launch 3D Tour
                    </Link>
                  )}
                </section>
              )}

              {/* Quick Stats */}
              <section className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6">
                <h3 className="font-semibold text-primary mb-4">Property Stats</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Total Media</dt>
                    <dd className="font-medium text-primary">{media.images.length + media.videos.length} files</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Floor Plans</dt>
                    <dd className="font-medium text-primary">{media.floorPlans.length} available</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Type</dt>
                    <dd className="font-medium text-primary">{propertyType}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Location</dt>
                    <dd className="font-medium text-primary">{draft.city}</dd>
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
                      onClick={prevViewer}
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
                      onClick={nextViewer}
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

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-xl">
            {/* Close button */}
            <button
              onClick={() => setShowErrorModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-[color:var(--surface-2)] hover:text-primary transition-colors"
              aria-label="Close modal"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            
            {/* Error icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            
            {/* Error content */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-primary mb-2">Publishing Failed</h3>
              <p className="text-sm text-secondary mb-6">{errorMessage}</p>
              
              {/* Action buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="btn btn-secondary"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    router.push('/agent/upload/details')
                  }}
                  className="btn btn-primary"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <ListingSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        listingTitle={publishedListingTitle}
      />
    </div>
  )
}

