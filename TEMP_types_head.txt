export interface User {
  id: string
  name: string | null
  email: string
  avatar?: string
  role: 'USER' | 'AGENT' | 'ADMIN'
}

export interface Property {
  id: string
  title: string
  price: number
  location: string
  address: string
  bedrooms: number
  bathrooms: number
  sqft: number
  type: PropertyType
  status: PropertyStatus
  images: string[]
  description: string
  features: string[]
  amenities: string[]
  yearBuilt?: number
  lotSize?: number
  parking?: number
  heating?: string
  cooling?: string
  agent: {
    id: string
    name: string
    email: string
    phone: string
    avatar: string
    rating: number
    propertiesSold: number
  }
  coordinates?: {
    lat: number
    lng: number
  }
  virtualTour?: string
  createdAt: string
  updatedAt: string
  customizationOptions?: {
    flooring: string[]
    wall_paint: string[]
    kitchen_cabinets: string[]
    kitchen_countertops: string[]
    lighting: string[]
    furniture: string[]
    curtains: string[]
  }
}

export type PropertyType = 
  | 'house'
  | 'apartment'
  | 'condo'
  | 'townhouse'
  | 'villa'
  | 'penthouse'
  | 'loft'
  | 'studio'
  | 'duplex'
  | 'mansion'

export type PropertyStatus = 
  | 'for-sale'
  | 'for-rent'
  | 'sold'
  | 'rented'
  | 'pending'
  | 'off-market'

export interface SearchFilters {
  query?: string
  type?: PropertyType
  status?: PropertyStatus
  minPrice?: number
  maxPrice?: number
  minBedrooms?: number
  minBathrooms?: number
  minSqft?: number
  maxSqft?: number
  location?: string
  sortBy?: 'price' | 'price-desc' | 'sqft' | 'bedrooms' | 'newest'
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface PropertyImage {
  id: string
  url: string
  alt: string
  isPrimary: boolean
}
