'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { createPropertyPinIcon } from '@/lib/mapUtils'
import { formatPrice } from '@/lib/utils'
import { useMap } from 'react-leaflet'

// Dynamically import Leaflet only on client side
let L: any = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
}

// Dynamically import the map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })

// Custom Marker Component that handles hover properly
function HoverableMarker({ 
  listing, 
  onHover, 
  onHoverOut, 
  onClick 
}: { 
  listing: Listing
  onHover: (listing: Listing, position: { x: number; y: number }) => void
  onHoverOut: () => void
  onClick: (listingId: string) => void
}) {
  const map = useMap()
  const markerIcon = useRef<any>(null)
  if (!markerIcon.current) {
    markerIcon.current = createPropertyPinIcon()
  }

  const handleMouseOver = useCallback((e: any) => {
    if (listing.latitude && listing.longitude) {
      try {
        const point = map.latLngToContainerPoint([listing.latitude, listing.longitude])
        onHover(listing, { x: point.x, y: point.y - 20 })
      } catch (err) {
        console.error('Error in hover:', err)
      }
    }
  }, [map, listing, onHover])

  const handleMouseOut = useCallback(() => {
    onHoverOut()
  }, [onHoverOut])

  const handleClick = useCallback((e: any) => {
    // Navigate to listing on click
    onClick(listing.id)
  }, [onClick, listing.id])

  return (
    <Marker
      position={[listing.latitude!, listing.longitude!]}
      icon={markerIcon.current}
      interactive={true}
      riseOnHover={true}
      eventHandlers={{
        mouseover: handleMouseOver,
        mouseout: handleMouseOut,
        click: handleClick,
      }}
    />
  )
}

interface Listing {
  id: string
  title: string
  description?: string | null
  address?: string | null
  city?: string | null
  subCity?: string | null
  latitude?: number | null
  longitude?: number | null
  basePrice: number
  currency?: string | null
  coverImage?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  areaSqm?: number | null
}

interface ListingsMapViewProps {
  listings: Listing[]
  className?: string
  height?: string
}

export default function ListingsMapView({ listings, className = '', height = 'h-[600px]' }: ListingsMapViewProps) {
  const router = useRouter()
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [mapKey, setMapKey] = useState<number>(() => Date.now())
  const [hoverOrientation, setHoverOrientation] = useState<'above' | 'below' | null>(null)

  // Filter listings that have valid coordinates
  const listingsWithCoords = listings.filter(
    (listing) =>
      listing.latitude != null &&
      listing.longitude != null &&
      !isNaN(listing.latitude) &&
      !isNaN(listing.longitude) &&
      listing.latitude >= -90 &&
      listing.latitude <= 90 &&
      listing.longitude >= -180 &&
      listing.longitude <= 180
  )

  // Calculate map center and bounds
  const getMapCenter = () => {
    if (listingsWithCoords.length === 0) {
      return [9.145, 38.7666] // Default to Addis Ababa, Ethiopia
    }
    
    const avgLat = listingsWithCoords.reduce((sum, l) => sum + (l.latitude || 0), 0) / listingsWithCoords.length
    const avgLng = listingsWithCoords.reduce((sum, l) => sum + (l.longitude || 0), 0) / listingsWithCoords.length
    return [avgLat, avgLng]
  }

  const getMapBounds = () => {
    if (listingsWithCoords.length === 0) return null
    
    const lats = listingsWithCoords.map(l => l.latitude!).filter(Boolean)
    const lngs = listingsWithCoords.map(l => l.longitude!).filter(Boolean)
    
    if (lats.length === 0 || lngs.length === 0) return null
    
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ] as [[number, number], [number, number]]
  }

  // Helper: decide initial orientation based on available space
  const decideOrientation = useCallback((position: { x: number; y: number }) => {
    if (!mapContainerRef.current) return 'above' as const
    const containerRect = mapContainerRef.current.getBoundingClientRect()
    const cardWidth = 320
    const cardHeight = 280
    const padding = 10
    // If not enough space above, choose below
    if (position.y - cardHeight - padding < 0) return 'below'
    // If not enough space below, choose above
    if (position.y + cardHeight + padding > containerRect.height) return 'above'
    // Default prefer above
    return 'above'
  }, [])

  // Helper function to calculate adjusted position (clamps inside without flipping)
  const calculateAdjustedPosition = useCallback((
    position: { x: number; y: number },
    orientation: 'above' | 'below'
  ) => {
    if (!mapContainerRef.current) return position
    
    const containerRect = mapContainerRef.current.getBoundingClientRect()
    const cardWidth = 320
    const cardHeight = 280
    const padding = 10
    
    let adjustedX = position.x
    let adjustedY = position.y
    
    // Clamp horizontally
    if (position.x - cardWidth / 2 < padding) {
      adjustedX = cardWidth / 2 + padding
    } else if (position.x + cardWidth / 2 > containerRect.width - padding) {
      adjustedX = containerRect.width - cardWidth / 2 - padding
    }

    // Clamp vertically based on locked orientation (do not flip here)
    if (orientation === 'above') {
      // Ensure top >= padding; top equals y - cardHeight (because translateY(-100%))
      if (position.y - cardHeight < padding) {
        adjustedY = cardHeight + padding
      }
    } else {
      // orientation === 'below' -> ensure bottom <= container height - padding; bottom equals y + cardHeight
      if (position.y + cardHeight > containerRect.height - padding) {
        adjustedY = containerRect.height - cardHeight - padding
      }
    }
    
    return { x: adjustedX, y: adjustedY }
  }, [])

  useEffect(() => {
    if (!mapInstance || !hoveredListingId) return

    const listing = listingsWithCoords.find(l => l.id === hoveredListingId)
    if (!listing || !listing.latitude || !listing.longitude) return

    let rafId: number | null = null
    const updateHoverPosition = () => {
      if (rafId) return // Already scheduled
      
      rafId = requestAnimationFrame(() => {
        rafId = null
        try {
          const point = mapInstance.latLngToContainerPoint([listing.latitude!, listing.longitude!])
          const basePosition = { x: point.x, y: point.y - 20 }

          // Lock orientation for this hover to avoid flicker
          const locked = hoverOrientation ?? decideOrientation(basePosition)
          if (hoverOrientation == null) setHoverOrientation(locked)

          // Clamp position based on locked orientation
          const adjusted = calculateAdjustedPosition(basePosition, locked)
          
          // Only update if position changed significantly (more than 1px)
          setHoverPosition(prev => {
            if (!prev) return adjusted
            const dx = Math.abs(prev.x - adjusted.x)
            const dy = Math.abs(prev.y - adjusted.y)
            if (dx > 1 || dy > 1) {
              return adjusted
            }
            return prev // Keep previous position to avoid unnecessary re-renders
          })
        } catch (e) {
          // Ignore errors during map updates
        }
      })
    }

    mapInstance.on('move', updateHoverPosition)
    mapInstance.on('zoom', updateHoverPosition)

    // Initial position update
    updateHoverPosition()

    return () => {
      mapInstance.off('move', updateHoverPosition)
      mapInstance.off('zoom', updateHoverPosition)
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [mapInstance, hoveredListingId, listingsWithCoords, calculateAdjustedPosition, decideOrientation, hoverOrientation])

  // Ensure map stays interactive after navigating back (invalidate size and remount map)
  useEffect(() => {
    const refresh = () => {
      try { mapInstance?.invalidateSize?.(true) } catch {}
      setHoveredListingId(null)
      setHoverPosition(null)
      setMapKey(Date.now())
    }

    // When the page becomes visible or window regains focus, refresh the map
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [mapInstance])

  const handleMapReady = (map: any) => {
    setMapInstance(map)
    
    // Fit bounds to show all markers
    const bounds = getMapBounds()
    if (bounds && map && typeof map.fitBounds === 'function') {
      try {
        // Use setTimeout to ensure map is fully initialized
        setTimeout(() => {
          if (L && L.latLngBounds) {
            const leafletBounds = L.latLngBounds(bounds)
            map.fitBounds(leafletBounds, { padding: [50, 50] })
          }
        }, 100)
      } catch (e) {
        console.error('Error fitting bounds:', e)
      }
    }
  }

  const handleMarkerHover = useCallback((listing: Listing, position: { x: number; y: number }) => {
    setHoveredListingId(listing.id)
    // Decide and lock orientation at hover start
    const initial = decideOrientation(position)
    setHoverOrientation(initial)
    const adjusted = calculateAdjustedPosition(position, initial)
    setHoverPosition(adjusted)
  }, [calculateAdjustedPosition, decideOrientation])

  const handleMarkerHoverOut = useCallback(() => {
    // Hide immediately when leaving the pin
    setHoveredListingId(null)
    setHoverPosition(null)
    setHoverOrientation(null)
  }, [])

  const handleMarkerClick = useCallback((listingId: string) => {
    router.push(`/listings/${listingId}`)
  }, [router])

  const formatAddress = (listing: Listing): string => {
    const parts = []
    if (listing.address) parts.push(listing.address)
    if (listing.subCity) parts.push(listing.subCity)
    if (listing.city) parts.push(listing.city)
    return parts.join(', ') || 'Location'
  }

  if (!L) {
    return (
      <div className={`${className} ${height} rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    )
  }

  if (listingsWithCoords.length === 0) {
    return (
      <div className={`${className} ${height} rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">No listings with location data available</p>
        </div>
      </div>
    )
  }

  const center = getMapCenter()

  const hoveredListing = hoveredListingId ? listingsWithCoords.find(l => l.id === hoveredListingId) : null
  const hoveredImageSrc = hoveredListing?.coverImage
    ? `/api/files/binary?path=${encodeURIComponent(hoveredListing.coverImage)}&listingId=${encodeURIComponent(hoveredListing.id)}`
    : null

  return (
      <div 
        ref={mapContainerRef}
        className={`${className} ${height} rounded-lg border-2 border-gray-200 overflow-hidden relative`}
      >
      <MapContainer
        key={mapKey}
        center={[center[0], center[1]]}
        zoom={12}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
        whenCreated={handleMapReady}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {listingsWithCoords.map((listing) => (
          <HoverableMarker
            key={listing.id}
            listing={listing}
            onHover={handleMarkerHover}
            onHoverOut={handleMarkerHoverOut}
            onClick={handleMarkerClick}
          />
        ))}
      </MapContainer>
      
      {/* Custom Hover Card */}
      {hoveredListing && hoverPosition && (() => {
        // Calculate transform based on adjusted position - use stable calculation
        const containerRect = mapContainerRef.current?.getBoundingClientRect()
        const cardWidth = 320
        const padding = 10
        
        let transformX = '-50%'
        let transformY = hoverOrientation === 'below' ? '0%' : '-100%'
        
        if (containerRect && mapInstance && hoveredListing.latitude && hoveredListing.longitude) {
          try {
            // Get actual marker position to determine if card is above or below
            const markerPoint = mapInstance.latLngToContainerPoint([hoveredListing.latitude, hoveredListing.longitude])
            const markerY = markerPoint.y
            
            // If adjusted Y is significantly below marker Y, we're showing below
            // Orientation is locked; do not flip here to avoid flicker
            
            // Determine horizontal position - check if we're near edges
            const leftEdge = hoverPosition.x - cardWidth / 2
            const rightEdge = hoverPosition.x + cardWidth / 2
            
            if (leftEdge < padding) {
              transformX = '0%' // Align left edge
            } else if (rightEdge > containerRect.width - padding) {
              transformX = '-100%' // Align right edge
            } else {
              transformX = '-50%' // Center on marker
            }
          } catch (e) {
            // Fallback to defaults if calculation fails
          }
        }
        
        return (
          <div
            key={`hover-${hoveredListing.id}-${hoverPosition.x}-${hoverPosition.y}`}
            className="absolute pointer-events-none"
            style={{
              left: `${hoverPosition.x}px`,
              top: `${hoverPosition.y}px`,
              transform: `translate(${transformX}, ${transformY})`,
              zIndex: 10000,
            }}
          >
          <div
            className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 overflow-hidden transition-all duration-200"
            style={{ minWidth: '280px', maxWidth: '320px' }}
            // Hover card is non-interactive; hides as soon as you leave the pin
          >
            {/* Image */}
            {hoveredImageSrc ? (
              <div className="relative h-40 w-full">
                <Image
                  src={hoveredImageSrc}
                  alt={hoveredListing.title}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
            ) : (
              <div className="h-40 w-full bg-gray-200 flex items-center justify-center">
                <p className="text-sm text-gray-500">No Image</p>
              </div>
            )}
            
            {/* Content */}
            <div className="p-3 space-y-2">
              {/* Title */}
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                {hoveredListing.title}
              </h3>
              
              {/* Address */}
              {hoveredListing.address && (
                <p className="text-xs text-gray-600 line-clamp-1">
                  {formatAddress(hoveredListing)}
                </p>
              )}
              
              {/* Price */}
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-gray-900">
                  {formatPrice(hoveredListing.basePrice, hoveredListing.currency || 'ETB')}
                </span>
              </div>
              
              {/* Specs */}
              <div className="flex items-center gap-3 text-xs text-gray-600">
                {hoveredListing.bedrooms != null && hoveredListing.bedrooms !== undefined && (
                  <span>{hoveredListing.bedrooms} bed</span>
                )}
                {hoveredListing.bathrooms != null && hoveredListing.bathrooms !== undefined && (
                  <span>{hoveredListing.bathrooms} bath</span>
                )}
                {hoveredListing.areaSqm && hoveredListing.areaSqm > 0 && (
                  <span>{hoveredListing.areaSqm} m²</span>
                )}
              </div>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

