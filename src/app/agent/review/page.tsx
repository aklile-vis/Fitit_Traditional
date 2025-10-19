"use client"

import Link from "next/link"
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import ListingSuccessModal from '@/components/ListingSuccessModal'
import {
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PhotoIcon,
  PlayCircleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PauseIcon,
} from "@heroicons/react/24/outline"
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'

// Custom Video Player Component
function CustomVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<any>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative max-h-[90vh] w-full max-w-5xl bg-black rounded-xl overflow-hidden shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full max-h-[90vh] object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Center Play/Pause Overlay */}
      {!isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="bg-[color:var(--accent-500)] rounded-full p-6 shadow-2xl transform hover:scale-110 transition-transform">
            <PlayCircleIcon className="h-16 w-16 text-white" />
          </div>
        </div>
      )}

      {/* Custom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div className="px-4 pt-4">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[color:var(--accent-500)] hover:h-2 transition-all"
            style={{
              background: `linear-gradient(to right, var(--accent-500) 0%, var(--accent-500) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`
            }}
          />
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <PauseIcon className="h-6 w-6 text-white" />
              ) : (
                <PlayCircleIcon className="h-6 w-6 text-white" />
              )}
            </button>

            {/* Volume Button */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="h-6 w-6 text-white" />
              ) : (
                <SpeakerWaveIcon className="h-6 w-6 text-white" />
              )}
            </button>

            {/* Time Display */}
            <div className="text-white text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="h-6 w-6 text-white" />
              ) : (
                <ArrowsPointingOutIcon className="h-6 w-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
          has3D: false,
          glbPath: undefined,
          ifcPath: undefined,
          usdPath: undefined,
          filePath: undefined,
          fileName: undefined,
          elementsCount: 0,
          aiEnrichment: null,
          topologyPath: undefined,
          processedAt: undefined,
          editorChanges: null,
          unitId: undefined,
          viewerLink: undefined,
        },
      }
      setDraft(normalized)
    } catch {
      // ignore parse/storage errors
    }
  }, [])

  // Build absolute URLs for stored paths
  const toAbsolute = (url: string) => (url?.startsWith('http') ? url : `/api/files/binary?path=${encodeURIComponent(url)}`)

  // Lightbox state
  type Viewer = { type: 'image' | 'video'; index: number; isFloorPlan?: boolean } | null
  const [viewer, setViewer] = useState<Viewer>(null)


  const onCardKeyDown = (e: React.KeyboardEvent, open: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
  }
  

  // Media viewer functions - defined before early return to maintain hook order
  const closeViewer = useCallback(() => setViewer(null), [])
  
  // Create combined media list for unified navigation
  const getCombinedMedia = useCallback((): Array<{ type: 'image' | 'video'; index: number; url: string }> => {
    if (!draft?.media) return []
    const combined: Array<{ type: 'image' | 'video'; index: number; url: string }> = []
    
    // Add all images first
    draft.media.images.forEach((img: string, index: number) => {
      combined.push({ type: 'image', index, url: img })
    })
    
    // Add all videos after images
    draft.media.videos.forEach((video: any, index: number) => {
      const videoUrl = typeof video === 'string' ? video : video?.url
      if (videoUrl) {
        combined.push({ type: 'video', index, url: videoUrl })
      }
    })
    
    return combined
  }, [draft?.media])
  
  const nextViewer = useCallback(() => {
    if (!viewer) return
    const combined = getCombinedMedia()
    if (!combined.length) return
    const currentIndex = combined.findIndex(item => 
      item.type === viewer.type && item.index === viewer.index
    )
    if (currentIndex === -1) return
    const nextIndex = (currentIndex + 1) % combined.length
    const nextItem = combined[nextIndex]
    setViewer({ type: nextItem.type, index: nextItem.index })
  }, [viewer, getCombinedMedia])
  
  const prevViewer = useCallback(() => {
    if (!viewer) return
    const combined = getCombinedMedia()
    if (!combined.length) return
    const currentIndex = combined.findIndex(item => 
      item.type === viewer.type && item.index === viewer.index
    )
    if (currentIndex === -1) return
    const prevIndex = (currentIndex - 1 + combined.length) % combined.length
    const prevItem = combined[prevIndex]
    setViewer({ type: prevItem.type, index: prevItem.index })
  }, [viewer, getCombinedMedia])

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


  // Router and auth hooks - defined before early return
  const router = useRouter()
  const { token, user } = useAuth()
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

  const { title, subtitle, pricing, propertyType, location, specs, description, amenities, features, media } = draft


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
        images: media.images.filter((url: string) => url && url.trim() !== ''),
        videos: media.videos.map((v: any) => typeof v === 'string' ? v : v?.url).filter((url: string) => url && url.trim() !== ''),
        floorPlans: media.floorPlans.map((fp: any) => typeof fp === 'string' ? fp : fp?.url).filter((url: string) => url && url.trim() !== ''),
        coverImage: media.coverImage,
        propertyType: subtype, // Send the actual property type (e.g., "Apartment", "Villa")
        bedrooms: specs.bedrooms,
        bathrooms: specs.bathrooms,
        areaSqm: specs.areaSqm,
        amenities: draft?.amenities || [],
        features: draft?.features || [],
        isPublished: true, // Mark as published when submitted from here
        immersive: {
          has3D: false,
          glbPath: undefined,
          ifcPath: undefined,
          usdPath: undefined,
          filePath: undefined,
          fileName: undefined,
          elementsCount: 0,
          aiEnrichment: null,
          topologyPath: undefined,
          processedAt: undefined,
          editorChanges: null,
          unitId: undefined,
        },
        // unitId is intentionally omitted if not present in the draft
      }
      
      // If editing, send PUT to update existing listing
      let response: Response
      let editingId: string | null = null
      try { editingId = sessionStorage.getItem('agent:editingListingId') } catch {}
      
      if (editingId) {
        // Try to update existing listing
        response = await fetch(`/api/listings/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        
        // If update fails because listing doesn't exist, fallback to creating new listing
        if (!response.ok) {
          const errorData = await response.json()
          if (errorData.error && errorData.error.includes('No record was found')) {
            console.warn('Listing not found for update, creating new listing instead')
            // Clear the invalid editing ID and create new listing
            sessionStorage.removeItem('agent:editingListingId')
            response = await fetch('/api/listings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            })
          }
        }
      } else {
        // Create new listing
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

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary">
      {/* Step Indicator */}
      <div className="border-b border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
        <div className="container py-6">
          <div className="flex items-center justify-center space-x-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                    step <= 3
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)] text-white'
                      : 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)] text-white'
                  }`}
                >
                  {step}
                </div>
                <div className="ml-3 text-sm">
                  <p className={`font-medium ${step <= 3 ? 'text-primary' : 'text-muted'}`}>
                    {step === 1 ? 'Property Details' : step === 2 ? 'Media Upload' : 'Review'}
                  </p>
                </div>
                {step < 3 && (
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
          
            <header className="space-y-3 text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-4 py-2 text-xs uppercase tracking-[0.4em] text-muted">
                <PhotoIcon className="h-4 w-4" /> Step 3: Review
              </div>
              <h2 className="headline text-3xl">Final Review & Preview</h2>
              <p className="mx-auto max-w-2xl text-sm text-muted">
                This is exactly what buyers will see when browsing your property listing. Review all details before publishing.
              </p>
             </header>
          
        </div>
      </div>

      {/* Hero Media Grid Section */}
      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 rounded-2xl overflow-hidden">
          {/* Main Large Image */}
          <div 
            className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[600px] cursor-pointer group overflow-hidden rounded-2xl"
            onClick={() => setViewer({ type: 'image', index: 0 })}
          >
            <img
              src={toAbsolute(media.coverImage || media.images[0])}
              alt="Cover"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            
            {/* Media Count Badges */}
            <div className="absolute bottom-4 right-4 flex gap-2">
              <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
                <PhotoIcon className="h-5 w-5 text-[color:var(--accent-500)]" />
                <span className="text-sm font-semibold text-primary">{media.images.length}</span>
              </div>
              {media.videos.length > 0 && (
                <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
                  <PlayCircleIcon className="h-5 w-5 text-[color:var(--accent-500)]" />
                  <span className="text-sm font-semibold text-primary">{media.videos.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail Grid (Right Side - Hidden on Mobile) */}
          <div className="hidden lg:grid grid-rows-3 gap-3 h-[600px]">
            {(() => {
              const imageThumbs = media.images.slice(1, 4)
              const videoThumbs = media.videos.slice(0, Math.max(0, 3 - imageThumbs.length))
              const tiles = [...imageThumbs, ...videoThumbs].slice(0, 3)
              const totalMedia = media.images.length + media.videos.length

              return tiles.map((item, idx) => {
                const isVideoTile = idx >= imageThumbs.length

                if (isVideoTile) {
                  const videoUrl = typeof item === 'string' ? item : (item as any)?.url
                  if (!videoUrl || typeof videoUrl !== 'string') {
                    console.warn('Skipping invalid video item in hero grid:', item)
                    return null
                  }
                  const src = toAbsolute(videoUrl)
                  const videoIndex = media.videos.findIndex((v: any) => (typeof v === 'string' ? v === videoUrl : v?.url === videoUrl))
                  if (videoIndex < 0) {
                    console.warn('Video not found in media.videos list:', videoUrl)
                    return null
                  }
                  const isLast = idx === 2 && totalMedia > 4

                  return (
                    <div
                      key={`vid-${idx}-${videoIndex}`}
                      className="relative h-full w-full cursor-pointer group overflow-hidden rounded-xl"
                      onClick={() => setViewer({ type: 'video', index: videoIndex })}
                    >
                      <video
                        src={src}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <PlayCircleIcon className="h-12 w-12 text-white" />
                      </div>

                      {isLast && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                          <span className="text-3xl font-bold text-white">+{totalMedia - 4}</span>
                        </div>
                      )}
                    </div>
                  )
                }

                // Image tile
                const imageUrl = item as string
                if (!imageUrl || typeof imageUrl !== 'string') {
                  console.warn('Skipping invalid image item in hero grid:', item)
                  return null
                }
                const src = toAbsolute(imageUrl)
                const imageIndex = media.images.indexOf(imageUrl)
                const isLast = idx === 2 && totalMedia > 4

                return (
                  <div
                    key={`img-${idx}-${imageIndex}`}
                    className="relative h-full w-full cursor-pointer group overflow-hidden rounded-xl"
                    onClick={() => setViewer({ type: 'image', index: imageIndex >= 0 ? imageIndex : idx + 1 })}
                  >
                    <img
                      src={src}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />

                    {/* Image counter on bottom right image */}
                    {idx === 2 && (
                      <div className="absolute bottom-2 right-2">
                        <button className="flex items-center gap-1 bg-gray-800/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-white hover:bg-gray-700/90 transition-colors">
                          <PhotoIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{totalMedia}</span>
                        </button>
                      </div>
                    )}

                    {isLast && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                        <span className="text-3xl font-bold text-white">+{totalMedia - 4}</span>
                      </div>
                    )}
                  </div>
                )
              }).filter(Boolean)
            })()}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8">
        <div className="space-y-8">
          {/* Top Section - Title, Stats, Description, Amenities */}
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
                  <svg className="h-6 w-6 text-[color:var(--accent-500)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 10v8M21 18V12a3 3 0 00-3-3H8a3 3 0 00-3 3" />
                    <path d="M3 14h18" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-primary">{specs.bedrooms}</p>
                <p className="text-sm text-muted">Bedrooms</p>
              </div>
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10">
                  <svg className="h-6 w-6 text-[color:var(--accent-500)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 10V8a2 2 0 114 0v2" />
                    <path d="M4 13h16v2a3 3 0 01-3 3H7a3 3 0 01-3-3v-2z" />
                    <path d="M7 18v2M17 18v2" />
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
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10">
                          <CheckBadgeIcon className="h-4 w-4 text-[color:var(--accent-500)]" />
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
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10">
                          <CheckBadgeIcon className="h-4 w-4 text-[color:var(--accent-500)]" />
                        </div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Column - Agent Card (Sticky) */}
          <aside className="space-y-6">
            <div className="sticky top-20 space-y-6">
              {/* Agent Card */}
              <section className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-lg">
                <h3 className="text-xl font-semibold text-primary mb-4">Listed by</h3>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-[color:var(--surface-2)] overflow-hidden flex items-center justify-center">
                    {user?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt={user?.name || "Agent"} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-secondary">{(user?.name || "Agent").slice(0,1)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-primary truncate">{user?.name || "Agent"}</div>
                    <div className="text-xs text-secondary truncate">Real Estate Agent</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Email</span>
                    <span className="font-medium text-primary truncate max-w-[60%]">{user?.email || "Not provided"}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <a
                    href={user?.email ? `mailto:${user.email}` : undefined}
                    className="btn btn-primary w-full justify-center text-base"
                  >
                    Email Agent
                  </a>
                  <Link
                    href="/profile"
                    className="btn btn-secondary w-full justify-center text-base"
                  >
                    View Profile
                  </Link>
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
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Available
                    </span>
                  </div>
                </div>
              </section>

              {/* Property Stats */}
              <section className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6">
                <h3 className="font-semibold text-primary mb-4">Property Stats</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Total Media</dt>
                    <dd className="font-medium text-primary">{media.images.length + media.videos.length} files</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Floor Plans</dt>
                    <dd className="font-medium text-primary">
                      {media.floorPlans.filter((fp: any) => {
                        const url = typeof fp === 'string' ? fp : fp?.url
                        return url && url.trim() !== ''
                      }).length} available
                    </dd>
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

        {/* Property Gallery - Full Width */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-primary">Property Gallery</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
            
            {/* Add More Images Placeholders - fill remaining grid slots */}
            {(() => {
              const imageCount = media.images.length
              const maxColumns = 5 // xl:grid-cols-5
              const placeholdersNeeded = imageCount > 0 ? (maxColumns - (imageCount % maxColumns)) % maxColumns || maxColumns : maxColumns
              
              return Array.from({ length: placeholdersNeeded }).map((_, idx) => (
                <Link
                  key={`placeholder-${idx}`}
                  href="/agent/upload/media?restore=1"
                  className="group relative flex h-56 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-1)] cursor-pointer transition-all hover:border-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)]/5 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accent-500)]/10 transition-colors group-hover:bg-[color:var(--accent-500)]/20">
                    <svg className="h-8 w-8 text-[color:var(--accent-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-muted group-hover:text-[color:var(--accent-500)]">Add More</span>
                </Link>
              ))
            })()}
          </div>
        </section>

        {/* Video Tours - Full Width */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-primary">Video Tours ({media.videos?.length || 0})</h2>
          {media.videos?.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {media.videos.map((video: any, index: number) => {
                // Handle both string URLs and objects with url property
                const videoUrl = typeof video === 'string' ? video : video?.url
                
                // Skip if no valid URL
                if (!videoUrl || typeof videoUrl !== 'string') {
                  console.warn('Invalid video data:', video)
                  return null
                }
                
                
                return (
                <figure
                  key={`video-${index}-${video}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewer({ type: 'video', index })}
                  onKeyDown={(e) => onCardKeyDown(e, () => setViewer({ type: 'video', index }))}
                  className="group relative overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)] shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <video
                    src={toAbsolute(videoUrl)}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-64 w-full object-cover"
                    controls={false}
                    onLoadedMetadata={(e) => {
                      // Seek to 1 second to get a better thumbnail
                      e.currentTarget.currentTime = 1
                    }}
                    onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}) }}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 1 }}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:bg-black/10">
                    <div className="bg-black/70 backdrop-blur-sm rounded-full p-4">
                      <PlayCircleIcon className="h-14 w-14 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <p className="text-sm font-semibold text-white">Video Tour</p>
                  </div>
                </figure>
                )
              }).filter(Boolean)}
            </div>
          ) : (
            <div className="text-center py-8 text-muted">
              <p>No videos uploaded yet</p>
            </div>
          )}
        </section>

        {/* Bottom Section - Floor Plans */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Left Column - Floor Plans */}
          <div className="space-y-8">

            {/* Floor Plans */}
            {media.floorPlans.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-primary">Floor Plans</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {media.floorPlans.map((floorPlan: any) => {
                    // Handle different data structures - floorPlan could be a string URL or an object
                    const floorPlanUrlRaw = typeof floorPlan === 'string' ? floorPlan : floorPlan?.url
                    
                    // Skip if no valid URL
                    if (!floorPlanUrlRaw) {
                      console.warn('Invalid floor plan data:', floorPlan)
                      return null
                    }
                    
                    const floorPlanUrl = floorPlanUrlRaw.startsWith('http')
                      ? floorPlanUrlRaw
                      : `/api/files/binary?path=${encodeURIComponent(floorPlanUrlRaw)}`
                    
                    const isPDF = floorPlanUrlRaw.includes('.pdf')
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
                        key={floorPlanUrlRaw}
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
                            <p className="font-medium text-primary truncate">{typeof floorPlan === 'object' ? floorPlan.name || 'Floor Plan' : 'Floor Plan'}</p>
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
                  }).filter(Boolean)}
                </div>
              </section>
            )}

          </div>
        </div>
        </div>
      </div>

      {/* Step 3 Navigation */}
      <div className="container py-8">
        <div className="flex justify-between">
          <Link href="/agent/upload/media?restore=1" className="btn btn-secondary">
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

      {/* Media viewer modal (minimal, with arrows) */}
      {viewer && (() => {
        let list, current, src, currentPosition, totalCount
        
        if (viewer.isFloorPlan) {
          // Handle floor plan images and PDFs
          list = media.floorPlans
          current = media.floorPlans[viewer.index]
          src = current ? toAbsolute(current.url) : ''
          currentPosition = viewer.index + 1
          totalCount = list.length
        } else {
          // Handle combined images and videos
          const combined = getCombinedMedia()
          const currentIndex = combined.findIndex(item => 
            item.type === viewer.type && item.index === viewer.index
          )
          
          if (currentIndex === -1) {
            console.error('Current viewer item not found in combined media')
            return null
          }
          
          const currentItem = combined[currentIndex]
          currentPosition = currentIndex + 1
          totalCount = combined.length
          
          // Get the actual media item
          if (currentItem.type === 'image') {
            current = media.images[currentItem.index]
            src = toAbsolute(current as string)
          } else {
            current = media.videos[currentItem.index]
            const videoUrl = typeof current === 'string' ? current : current?.url
            src = videoUrl ? toAbsolute(videoUrl) : ''
          }
        }

        const isPdf = current && (
          (typeof current === 'string' && current.includes('.pdf')) ||
          (typeof current === 'object' && current.url && current.url.includes('.pdf'))
        )

        // Don't render if no valid source
        if (!src) {
          console.error('No valid source for viewer:', { viewer, current, src })
          return null
        }

        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            onClick={closeViewer}
          >
            {/* Close button - fixed to screen corner */}
            <button
              type="button"
              onClick={closeViewer}
              aria-label="Close viewer"
              className="fixed right-6 top-6 z-20 rounded-full bg-black/90 backdrop-blur-sm border border-white/20 p-4 text-white hover:bg-black hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/60 transition-all duration-200 shadow-lg"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {/* Navigation arrows - fixed to bottom of screen */}
            {totalCount > 1 && (
              <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
                <div className="inline-flex items-center gap-3 rounded-full bg-black/90 backdrop-blur-sm border border-white/20 px-4 py-3 pointer-events-auto shadow-lg">
                  <button
                    type="button"
                    onClick={prevViewer}
                    aria-label="Previous"
                    className="rounded-full p-3 text-white hover:bg-white/20 hover:border-white/40 border border-transparent focus:outline-none focus:ring-2 focus:ring-white/60 transition-all duration-200"
                  >
                    <ChevronLeftIcon className="h-6 w-6" />
                  </button>
                  <span className="text-sm text-white font-semibold px-3 py-1 bg-white/10 rounded-full">
                    {currentPosition} / {totalCount}
                  </span>
                  <button
                    type="button"
                    onClick={nextViewer}
                    aria-label="Next"
                    className="rounded-full p-3 text-white hover:bg-white/20 hover:border-white/40 border border-transparent focus:outline-none focus:ring-2 focus:ring-white/60 transition-all duration-200"
                  >
                    <ChevronRightIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            )}

            {/* Content container - centered */}
            <div
              className="flex items-center justify-center w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {isPdf ? (
                // PDF viewer with fallback
                <iframe
                  src={`${src}#toolbar=0&navpanes=0&scrollbar=1&zoom=FitH`}
                  className="max-h-[90vh] w-full max-w-5xl rounded"
                  title="PDF Viewer"
                  onError={() => {
                    // Fallback: open in new tab if iframe fails
                    window.open(src, '_blank')
                  }}
                />
              ) : viewer.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="max-h-[90vh] w-auto max-w-full object-contain rounded-2xl" />
              ) : (
                <CustomVideoPlayer src={src} />
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
