'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPinIcon, GlobeAltIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'

// Dynamically import Leaflet only on client side
let L: any = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
  
  // Fix for default markers in Next.js
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })
}

// Create a custom red marker icon
const createCustomIcon = (color: string = 'red') => {
  if (!L) return null
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: ${color};
      width: 25px;
      height: 25px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        transform: rotate(45deg);
        color: white;
        font-size: 12px;
        font-weight: bold;
        margin-top: -2px;
      ">📍</div>
    </div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 24],
  })
}

// Distinctive property pin (teardrop with home glyph) – theme-aware to match upload/details
// Uses CSS var --accent-500 when available; falls back to provided color
const createPropertyPinIcon = (color: string = '#7c3aed') => {
  if (!L) return null
  return L.divIcon({
    className: 'custom-property-pin',
    html: `
      <div aria-label="Property location" style="
        position: relative;
        width: 34px;
        height: 34px;
        transform: rotate(-45deg);
        border-radius: 50% 50% 50% 0;
        background: var(--accent-500, ${color});
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 3px rgba(17,24,39,0.45), 0 6px 14px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span class="animate-ping" style="
          position: absolute;
          left: 50%;
          top: 50%;
          width: 38px;
          height: 38px;
          transform: translate(-50%, -50%) rotate(45deg);
          border-radius: 9999px;
          background: var(--accent-500, ${color});
          opacity: 0.28;
          pointer-events: none;
          z-index: 0;
        "></span>
        <div style="
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          position: relative;
          z-index: 1;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-5v-6h-4v6H5a2 2 0 0 1-2-2V10z"></path>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
  })
}

// Dynamically import the map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })
const MapInstanceBridge = dynamic(() => import('./MapInstanceBridge'), { ssr: false })

interface MapDisplayProps {
  latitude: number | null
  longitude: number | null
  address?: string | null
  city?: string | null
  subCity?: string | null
  title?: string
  className?: string
  height?: string
  showAddress?: boolean
}

interface MapMarker {
  lat: number
  lng: number
  title?: string
  address?: string
}

export default function MapDisplay({
  latitude,
  longitude,
  address,
  city,
  subCity,
  title,
  className = '',
  height = 'h-64',
  showAddress = true
}: MapDisplayProps) {
  const [mapMarker, setMapMarker] = useState<MapMarker | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)

  // Initialize map marker from coordinates
  useEffect(() => {
    if (latitude && longitude && isValidCoordinates(latitude, longitude)) {
      setMapMarker({
        lat: latitude,
        lng: longitude,
        title: title || 'Property Location',
        address: formatAddress({ address, city, subCity })
      })
      setError(null)
    } else {
      setMapMarker(null)
      if (latitude !== null || longitude !== null) {
        setError('Invalid coordinates provided')
      }
    }
  }, [latitude, longitude, title, address, city, subCity])

  const isValidCoordinates = (lat: number, lng: number): boolean => {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !isNaN(lat) &&
      !isNaN(lng)
    )
  }

  const formatAddress = (addr: {
    address?: string | null
    city?: string | null
    subCity?: string | null
  }): string => {
    const parts = []
    if (addr.address) parts.push(addr.address)
    if (addr.subCity) parts.push(addr.subCity)
    if (addr.city) parts.push(addr.city)
    return parts.join(', ')
  }

  const openInMaps = () => {
    if (!mapMarker) return
    
    const mapsUrl = `https://www.google.com/maps?q=${mapMarker.lat},${mapMarker.lng}`
    window.open(mapsUrl, '_blank')
  }

  const handleMapReady = (map: any) => {
    setMapInstance(map)
  }

  const recenterMap = () => {
    if (!mapMarker || !mapInstance) return
    try { if (typeof mapInstance.invalidateSize === 'function') mapInstance.invalidateSize(true) } catch {}
    setTimeout(() => {
      try {
        if (typeof mapInstance.flyTo === 'function') {
          mapInstance.flyTo([mapMarker.lat, mapMarker.lng], 18, { duration: 0.25 })
        } else if (typeof mapInstance.setView === 'function') {
          mapInstance.setView([mapMarker.lat, mapMarker.lng], 18)
        }
      } catch {}
    }, 0)
  }

  if (!mapMarker) {
    return (
      <div className={`${className} ${height} rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center`}>
        <div className="text-center text-gray-500">
          <MapPinIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No location data available</p>
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
      </div>
    )
  }

  // Don't render map if Leaflet is not available (SSR)
  if (!L) {
    return (
      <div className={`${className} ${height} rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center`}>
        <div className="text-center text-gray-500">
          <MapPinIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className} space-y-3`}>
      {/* Map Container */}
      <div className="relative">
        <div className="h-96 w-full rounded-lg border-2 border-gray-200 overflow-hidden">
          <MapContainer
            center={[mapMarker.lat, mapMarker.lng]}
            zoom={18}
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
            whenCreated={handleMapReady}
          >
            {/* Bridge to reliably obtain the Leaflet map instance */}
            <MapInstanceBridge onReady={handleMapReady} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker 
              position={[mapMarker.lat, mapMarker.lng]}
              icon={createPropertyPinIcon()}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-semibold">{mapMarker.title}</div>
                  {mapMarker.address && (
                    <div className="text-sm text-gray-600 mt-1">
                      {mapMarker.address}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {mapMarker.lat.toFixed(6)}, {mapMarker.lng.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
        
        {/* Map controls */}
        <div className="absolute top-2 right-2 z-[1000] pointer-events-none flex flex-col gap-1">
          {(() => {
            const canRecenter = Boolean(mapMarker && mapInstance)
            return (
              <button
                onClick={recenterMap}
                disabled={!canRecenter}
                className={`pointer-events-auto bg-white border border-gray-300 p-2 rounded-lg shadow-lg transition-colors ${canRecenter ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                title="Recenter on location"
                aria-label="Recenter on location"
              >
                <ArrowPathIcon className="h-4 w-4 text-gray-700" />
              </button>
            )
          })()}
          <button
            onClick={openInMaps}
            className="pointer-events-auto bg-white hover:bg-gray-50 border border-gray-300 p-2 rounded-lg shadow-lg transition-colors"
            title="Open in Google Maps"
          >
            <GlobeAltIcon className="h-4 w-4 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Address and coordinates info */}
      {showAddress && (
        <div className="space-y-2">
          {/* Address */}
          {mapMarker.address && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Address</div>
              <div className="text-sm font-medium">{mapMarker.address}</div>
            </div>
          )}
          
          {/* Coordinates */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Coordinates</div>
            <div className="text-sm font-mono text-gray-700">
              {mapMarker.lat.toFixed(6)}, {mapMarker.lng.toFixed(6)}
            </div>
          </div>
          
          
        </div>
      )}
    </div>
  )
}
