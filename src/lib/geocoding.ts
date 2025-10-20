// Geocoding service using OpenStreetMap Nominatim API
// Free service that doesn't require API keys

export interface GeocodingResult {
  latitude: number
  longitude: number
  displayName: string
  address: {
    houseNumber?: string
    road?: string
    suburb?: string
    city?: string
    state?: string
    country?: string
    postcode?: string
  }
}

export interface GeocodingError {
  error: string
  message: string
}

/**
 * Geocode an address to get latitude and longitude coordinates
 * @param address - The address string to geocode
 * @returns Promise with geocoding result or error
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | GeocodingError> {
  try {
    // Clean and format the address
    const cleanAddress = address.trim().replace(/\s+/g, ' ')
    
    if (!cleanAddress) {
      return {
        error: 'INVALID_ADDRESS',
        message: 'Address cannot be empty'
      }
    }

    // Use OpenStreetMap Nominatim API
    const encodedAddress = encodeURIComponent(cleanAddress)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1&countrycodes=et`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EstatePro/1.0 (Real Estate Platform)'
      }
    })

    if (!response.ok) {
      return {
        error: 'API_ERROR',
        message: `Geocoding service error: ${response.status}`
      }
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return {
        error: 'NO_RESULTS',
        message: 'No results found for this address'
      }
    }

    const result = data[0]
    
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
      address: {
        houseNumber: result.address?.house_number,
        road: result.address?.road,
        suburb: result.address?.suburb,
        city: result.address?.city || result.address?.town,
        state: result.address?.state,
        country: result.address?.country,
        postcode: result.address?.postcode
      }
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    return {
      error: 'NETWORK_ERROR',
      message: 'Failed to connect to geocoding service'
    }
  }
}

/**
 * Format a full address from individual components
 * @param address - Address components
 * @returns Formatted address string
 */
export function formatAddress(address: {
  address?: string
  city?: string
  subCity?: string
  country?: string
}): string {
  const parts = []
  
  if (address.address) parts.push(address.address)
  if (address.subCity) parts.push(address.subCity)
  if (address.city) parts.push(address.city)
  if (address.country) parts.push(address.country)
  
  return parts.join(', ')
}

/**
 * Validate coordinates
 * @param latitude - Latitude to validate
 * @param longitude - Longitude to validate
 * @returns True if coordinates are valid
 */
export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  )
}
