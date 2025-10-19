"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from 'next/link'

import {
  CheckBadgeIcon,
  MapPinIcon,
  PhotoIcon,
  PlayCircleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PauseIcon,
  PhoneIcon,
  UserIcon,
} from "@heroicons/react/24/outline"
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'

// Custom Icons for Telegram and WhatsApp
const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
)

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
  </svg>
)

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
  // Lightbox state
  type Viewer = { type: 'image' | 'video'; index: number; isFloorPlan?: boolean } | null
  const [viewer, setViewer] = useState<Viewer>(null)

  const onCardKeyDown = (e: React.KeyboardEvent, open: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
  }

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
      images: (() => {
        const allImages = [
          ...(realData.coverImage ? [realData.coverImage] : []),
          // Handle fileUpload.images as both array and JSON string
          ...(Array.isArray(realUnit?.fileUpload?.images) ? realUnit.fileUpload.images : []),
          ...(typeof realUnit?.fileUpload?.images === 'string' ? (() => {
            try { return JSON.parse(realUnit.fileUpload.images || '[]') } 
            catch { return [] }
          })() : []),
          // Handle all image media types
          ...(realUnit?.media?.filter((m: any) => m.type === 'IMAGE').map((m: any) => m.url) || [])
        ]
        // Deduplicate by URL
        return [...new Set(allImages.filter(url => url && url.trim() !== ''))]
      })(),
      videos: (() => {
        const allVideos = [
          // Handle fileUpload.videos as both array and JSON string
          ...(Array.isArray(realUnit?.fileUpload?.videos) ? realUnit.fileUpload.videos : []),
          ...(typeof realUnit?.fileUpload?.videos === 'string' ? (() => {
            try { return JSON.parse(realUnit.fileUpload.videos || '[]') } 
            catch { return [] }
          })() : []),
          ...(realUnit?.media?.filter((m: any) => m.type === 'VIDEO').map((m: any) => ({ url: m.url, label: m.caption || 'Video Tour' })) || [])
        ]
        // Deduplicate by URL
        const seen = new Set()
        return allVideos.filter((video: any) => {
          const url = typeof video === 'string' ? video : video?.url
          if (!url || seen.has(url)) return false
          seen.add(url)
          return true
        })
      })(),
      floorPlans: (() => {
        const allFloorPlans = [
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
        ]
        
        // Deduplicate by URL
        const seen = new Set()
        return allFloorPlans.filter((fp: any) => {
          const url = typeof fp === 'string' ? fp : fp?.url
          if (!url || seen.has(url)) return false
          seen.add(url)
          return true
        })
      })(),
      coverImage: realData.coverImage || ''
    },
    immersive: {
      has3D: realData.has3D || false,
      glbPath: realUnit?.fileUpload?.glbPath || '',
      viewerLink: `/listings/${realData.id}`,
      processedAt: realData.updatedAt?.toString() || ''
    }
  }

  const { title, subtitle, pricing, propertyType, address, city, subCity, specs, description, amenities, features, media } = data

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

  // Media viewer functions
  const closeViewer = useCallback(() => setViewer(null), [])
  
  // Create combined media list for unified navigation
  const getCombinedMedia = useCallback((): Array<{ type: 'image' | 'video'; index: number; url: string }> => {
    if (!media) return []
    const combined: Array<{ type: 'image' | 'video'; index: number; url: string }> = []
    
    // Add all images first
    media.images.forEach((img: string, index: number) => {
      combined.push({ type: 'image', index, url: img })
    })
    
    // Add all videos after images
    media.videos.forEach((video: any, index: number) => {
      const videoUrl = typeof video === 'string' ? video : video?.url
      if (videoUrl) {
        combined.push({ type: 'video', index, url: videoUrl })
      }
    })
    
    return combined
  }, [media])
  
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

  // Keyboard + scroll lock while viewer is open
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

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary">
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
                  <div className="flex gap-3 text-muted">
                    <MapPinIcon className="h-8 w-8 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-base font-medium">{address}</div>
                      <div className="text-sm text-muted">
                        {subCity && city ? `${subCity}, ${city}` : city || subCity || ''}
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
                    <span className="text-muted">Email</span>
                    <span className="font-medium text-primary truncate max-w-[60%]">{agent?.email || "Not provided"}</span>
                  </div>
                  {agent?.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Phone</span>
                      <span className="font-medium text-primary">{agent.phone}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  <Link
                    href={`/profile/${agent?.id}`}
                    className="btn btn-primary w-full justify-center text-base"
                  >
                    <UserIcon className="h-5 w-5 mr-2" />
                    Agent Profile
                  </Link>
                  {agent?.phone && (
                    <div className="flex gap-2">
                      <a
                        href={`tel:${agent.phone}`}
                        className="btn flex-1 justify-center p-3 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                        title="Call Agent"
                      >
                        <PhoneIcon className="h-5 w-5 text-gray-600" />
                      </a>
                      <a
                        href={`https://t.me/+${agent.phone.replace(/^\+/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn flex-1 justify-center p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200"
                        title="Message on Telegram"
                      >
                        <TelegramIcon className="h-5 w-5 text-blue-500" />
                      </a>
                      <a
                        href={`https://wa.me/${agent.phone.replace(/^\+/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn flex-1 justify-center p-3 bg-green-50 hover:bg-green-100 border border-green-200"
                        title="Message on WhatsApp"
                      >
                        <WhatsAppIcon className="h-5 w-5 text-green-500" />
                      </a>
                    </div>
                  )}
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
                    <dd className="font-medium text-primary">{city}</dd>
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
                  {media.floorPlans.map((floorPlan: any, fpIndex: number) => {
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
                        key={`floorplan-${fpIndex}-${floorPlanUrlRaw}`}
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
    </div>
  )
}
