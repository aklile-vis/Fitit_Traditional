'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPinIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, CheckCircleIcon, MapIcon, EyeIcon, EyeSlashIcon, ArrowPathIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline'
import { geocodeAddress, formatAddress, isValidCoordinates, type GeocodingResult, type GeocodingError } from '@/lib/geocoding'
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

// New distinctive property pin (teardrop with home glyph) with theme-aware color
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

interface LocationInputProps {
  address: string
  city: string
  subCity: string
  latitude?: number | null
  longitude?: number | null
  onLocationChange: (coordinates: { latitude: number; longitude: number } | null) => void
  onAddressChange: (address: { address: string; city: string; subCity: string }) => void
  disabled?: boolean
}

interface MapMarker {
  lat: number
  lng: number
}

export default function LocationInput({
  address,
  city,
  subCity,
  latitude,
  longitude,
  onLocationChange,
  onAddressChange,
  disabled = false
}: LocationInputProps) {
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodingError, setGeocodingError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [mapMarker, setMapMarker] = useState<MapMarker | null>(null)
  const [isSelectingOnMap, setIsSelectingOnMap] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [mapInstance, setMapInstance] = useState<any>(null)
  const mapRef = useRef<any>(null)

  // Initialize map marker from existing coordinates
  useEffect(() => {
    if (latitude && longitude && isValidCoordinates(latitude, longitude)) {
      setMapMarker({ lat: latitude, lng: longitude })
      setManualLat(latitude.toString())
      setManualLng(longitude.toString())
      setShowMap(true)
    } else {
      setMapMarker(null)
      setShowMap(false)
    }
  }, [latitude, longitude])

  // Set up map reference when map is ready
  useEffect(() => {
    if (showMap && mapInstance) {
      // Map is ready, we can use the instance
    }
  }, [showMap, mapInstance])

  // Keep map view in sync when marker/map become available
  useEffect(() => {
    if (!showMap || !mapMarker) return
    const map = mapInstance || mapRef.current
    if (!map) return
    try { if (typeof map.invalidateSize === 'function') map.invalidateSize(true) } catch {}
    try { if (typeof map.setView === 'function') map.setView([mapMarker.lat, mapMarker.lng], 18) } catch {}
  }, [showMap, mapMarker, mapInstance])

  const handleMapReady = (map: any) => {
    setMapInstance(map)
    try {
      if (map && typeof map.on === 'function') {
        map.on('click', handleMapClick)
      }
    } catch {}
  }

  // Auto-geocode when address components change
  useEffect(() => {
    const fullAddress = formatAddress({ address, city, subCity, country: 'Ethiopia' })
    if (fullAddress && fullAddress.length > 10) {
      const timeoutId = setTimeout(() => {
        handleGeocode(fullAddress)
      }, 1000) // Debounce for 1 second

      return () => clearTimeout(timeoutId)
    }
  }, [address, city, subCity])

  const handleGeocode = async (addressToGeocode?: string) => {
    const targetAddress = addressToGeocode || formatAddress({ address, city, subCity, country: 'Ethiopia' })
    
    if (!targetAddress || targetAddress.length < 10) {
      setGeocodingError('Please enter a complete address')
      return
    }

    setIsGeocoding(true)
    setGeocodingError(null)

    try {
      const result = await geocodeAddress(targetAddress)
      
      if ('error' in result) {
        setGeocodingError(result.message)
        onLocationChange(null)
        setShowMap(false)
      } else {
        setMapMarker({ lat: result.latitude, lng: result.longitude })
        setManualLat(result.latitude.toString())
        setManualLng(result.longitude.toString())
        onLocationChange({ latitude: result.latitude, longitude: result.longitude })
        setGeocodingError(null)
        setShowMap(true)

        // Recenter map to the newly geocoded location if a map is shown
        try {
          const map = mapInstance || mapRef.current
          if (map && typeof map.setView === 'function') {
            map.setView([result.latitude, result.longitude], 18)
          }
        } catch {}
      }
    } catch (error) {
      setGeocodingError('Failed to geocode address')
      onLocationChange(null)
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleManualCoordinates = () => {
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    
    if (isValidCoordinates(lat, lng)) {
      setMapMarker({ lat, lng })
      onLocationChange({ latitude: lat, longitude: lng })
      setGeocodingError(null)
      setShowMap(true)
    } else {
      setGeocodingError('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.')
      setShowMap(false)
    }
  }

  const handleMapClick = (e: any) => {
    if (disabled) return
    if (!isSelectingOnMap) return
    
    const { lat, lng } = e.latlng
    setManualLat(lat.toFixed(6))
    setManualLng(lng.toFixed(6))
    setMapMarker({ lat, lng })
    onLocationChange({ latitude: lat, longitude: lng })
    setIsSelectingOnMap(false)
  }

  const recenterMap = () => {
    // Debug: verify recenter click handler fires and log current state
    try { console.log('[Map] Recenter clicked', { marker: mapMarker, hasMapInstance: !!mapInstance, hasRef: !!mapRef.current }) } catch {}
    if (!mapMarker) return

    const map = mapInstance || mapRef.current
    if (!map) return

    try { if (typeof map.invalidateSize === 'function') map.invalidateSize(true) } catch {}
    // Use a microtask to ensure size invalidation has applied before moving view
    setTimeout(() => {
      try {
        if (typeof map.flyTo === 'function') {
          map.flyTo([mapMarker.lat, mapMarker.lng], 18, { duration: 0.25 })
        } else if (typeof map.setView === 'function') {
          map.setView([mapMarker.lat, mapMarker.lng], 18)
        }
      } catch {}
    }, 0)
  }

  // Default center for Ethiopia (Addis Ababa)
  const defaultCenter: [number, number] = [9.0054, 38.7636]

  return (
    <div className="space-y-4">
      {/* Address Input Fields */}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted">Neighborhood</span>
          <div className="relative">
            <input
              value={address}
              name="address"
              onChange={(e) => onAddressChange({ address: e.target.value, city, subCity })}
              className="input h-11 w-full"
              placeholder="Bole around Edna mall"
              disabled={disabled}
            />
          </div>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted">City / Region</span>
          <div className="relative">
            <input
              value={city}
              name="city"
              onChange={(e) => onAddressChange({ address, city: e.target.value, subCity })}
              className="input h-11 w-full"
              placeholder="Addis Ababa"
              disabled={disabled}
            />
          </div>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted">Sub City</span>
          <div className="relative">
            <input
              required
              name="subCity"
              value={subCity}
              onChange={(e) => onAddressChange({ address, city, subCity: e.target.value })}
              className="input h-11 w-full"
              placeholder="Bole"
              disabled={disabled}
            />
          </div>
        </label>
      </div>

      {/* Geocoding Status and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isGeocoding && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              Finding location...
            </div>
          )}
          
          {geocodingError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {geocodingError}
            </div>
          )}
          
          {mapMarker && !isGeocoding && !geocodingError && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircleIcon className="h-4 w-4" />
              Location found
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleGeocode()}
            disabled={disabled || isGeocoding}
            className="btn btn-secondary flex items-center gap-2"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Find Location
          </button>
          
          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            disabled={disabled}
            className="btn btn-secondary flex items-center gap-2"
          >
            {showMap ? (
              <EyeSlashIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>

        </div>
      </div>

      {/* Interactive Map */}
      {showMap && (
        <div className="space-y-4">
          {/* Map Container */}
          <div className="relative">
            <div className="h-96 w-full rounded-lg border-2 border-gray-200 overflow-hidden">
              {L ? (
                <MapContainer
                  center={mapMarker ? [mapMarker.lat, mapMarker.lng] : defaultCenter}
                  zoom={mapMarker ? 18 : 10}
                  zoomControl={false}
                  style={{ height: '100%', width: '100%' }}
                  whenCreated={handleMapReady}
                  ref={mapRef}
                >
                  {/* Bridge to reliably obtain the Leaflet map instance */}
                  {/** This runs only on client and avoids SSR/ref pitfalls */}
                  <MapInstanceBridge onReady={handleMapReady} onClick={handleMapClick} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapMarker && (
                    <Marker 
                      position={[mapMarker.lat, mapMarker.lng]}
                      icon={createPropertyPinIcon()}
                    >
                      <Popup>
                        <div className="text-center">
                          <div className="font-semibold">Property Location</div>
                          <div className="text-sm text-gray-600">
                            {formatAddress({ address, city, subCity })}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {mapMarker.lat.toFixed(6)}, {mapMarker.lng.toFixed(6)}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gray-100">
                  <div className="text-center text-gray-500">
                    <MapPinIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Loading map...</p>
                  </div>
                </div>
              )}
            </div>
            
          {/* Map controls */}
          <div className="absolute top-2 right-2 z-[1000] pointer-events-none flex flex-col gap-1">
              {(() => {
                const canRecenter = Boolean(mapMarker && (mapInstance || mapRef.current))
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
            </div>
            
            {/* Map instructions */}
            <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-xs text-gray-600">
              {isSelectingOnMap ? 'Click on the map to select location' : 'Use "Select on Map" to pick a location'}
            </div>
          </div>

          {/* Manual Coordinate Input */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="input w-full"
                placeholder="9.0054"
                disabled={disabled}
              />
            </div>
            
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="input w-full"
                placeholder="38.7636"
                disabled={disabled}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleManualCoordinates}
              disabled={disabled}
              className="btn btn-secondary flex items-center gap-2"
            >
              <MapPinIcon className="h-4 w-4" />
              Update from Coordinates
            </button>
            <button
              type="button"
              onClick={() => { setShowMap(true); setIsSelectingOnMap(true) }}
              disabled={disabled || isSelectingOnMap}
              className={`btn btn-secondary flex items-center gap-2 ${isSelectingOnMap ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Select a location by clicking on the map"
            >
              <CursorArrowRaysIcon className="h-4 w-4" />
              {isSelectingOnMap ? 'Click on map…' : 'Select on Map'}
            </button>
          </div>
        </div>
      )}

      {/* Coordinate Display */}
      {mapMarker && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">Current Location</div>
          <div className="text-sm font-mono">
            {mapMarker.lat.toFixed(6)}, {mapMarker.lng.toFixed(6)}
          </div>
        </div>
      )}
    </div>
  )
}
