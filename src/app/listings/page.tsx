"use client"

import {
  ArrowTopRightOnSquareIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  ArrowsPointingOutIcon,
  Square3Stack3DIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  BookmarkIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useRef } from 'react'

import { formatPrice } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import RemoveSavedModal from '@/components/RemoveSavedModal'

// Inline icons for bed, bath, and area to better reflect specs
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

type Listing = {
  id: string
  title: string
  description?: string | null
  address?: string | null
  city?: string | null
  subCity?: string | null
  latitude?: number | null
  longitude?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  areaSqm?: number | null
  basePrice: number
  currency?: string | null
  coverImage?: string | null
  amenities?: string | null
  features?: string | null
  propertyType?: string | null // Add property type field
  createdAt?: string
  updatedAt?: string
}

type Filters = {
  query: string
  minPrice: string
  maxPrice: string
  bedrooms: string[]
  bathrooms: string[]
  propertyType: string[]
  city: string
}

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'area-low' | 'area-high' | 'bedrooms-low' | 'bedrooms-high'

// Property type options from the details page
const RESIDENTIAL_TYPES = [
  'Apartment',
  'Townhouse',
  'Villa Compound',
  'Land',
  'Building',
  'Villa',
  'Penthouse',
  'Hotel Apartment',
  'Floor',
] as const

const COMMERCIAL_TYPES = [
  'Office',
  'Shop',
  'Warehouse',
  'Labour Camp',
  'Bulk Unit',
  'Floor',
  'Building',
  'Factory',
  'Industrial Land',
  'Mixed Use Land',
  'Showroom',
  'Other Commercial',
] as const

const BED_OPTIONS = ['Studio', '1', '2', '3', '4', '5', '6', '7', '8+'] as const
const BATH_OPTIONS = ['1', '2', '3', '4', '5', '6+'] as const

export default function ListingsIndexPage() {
  const searchParams = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [status, setStatus] = useState('')
  const [filters, setFilters] = useState<Filters>({
    query: '',
    minPrice: '',
    maxPrice: '',
    bedrooms: [],
    bathrooms: [],
    propertyType: [],
    city: ''
  })
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [animatingBookmarks, setAnimatingBookmarks] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [propertyToRemove, setPropertyToRemove] = useState<{ id: string; title: string } | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)
  const [isLoading, setIsLoading] = useState(false)
  const [showBedBathDropdown, setShowBedBathDropdown] = useState(false)
  const [showPropertyTypeDropdown, setShowPropertyTypeDropdown] = useState(false)
  const [propertyCategory, setPropertyCategory] = useState<'Residential' | 'Commercial'>('Residential')
  const bedBathRef = useRef<HTMLDivElement>(null)
  const propertyTypeRef = useRef<HTMLDivElement>(null)
  const [showHas3DDropdown, setShowHas3DDropdown] = useState(false)
  const has3DRef = useRef<HTMLDivElement>(null)
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const cityRef = useRef<HTMLDivElement>(null)
  const [showPriceDropdown, setShowPriceDropdown] = useState(false)
  const priceRef = useRef<HTMLDivElement>(null)
  const { user, isAuthenticated } = useAuth()
  const isAgent = user?.role === 'AGENT' || user?.role === 'ADMIN'

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setStatus('Loading listings…')
      try {
        const response = await fetch('/api/listings?published=true')
        const json = await response.json()
        if (!response.ok) {
          setStatus(json.error || 'Unable to load listings right now')
          return
        }
        setListings(json)
        setStatus('')
      } catch (error) {
        console.error('Failed to load listings', error)
        setStatus('Unable to load listings right now')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // Initialize filters from URL query params (from Home page)
  useEffect(() => {
    if (!searchParams) return
    const q = searchParams.get('query') || ''
    const minPrice = searchParams.get('minPrice') || ''
    const maxPrice = searchParams.get('maxPrice') || ''
    const minBedsParam = searchParams.get('minBedrooms')
    const minBathsParam = searchParams.get('minBathrooms')
    const minBeds = minBedsParam ? Number(minBedsParam) : NaN
    const minBaths = minBathsParam ? Number(minBathsParam) : NaN

    setFilters(prev => ({
      ...prev,
      query: q,
      minPrice,
      maxPrice,
      bedrooms: Number.isFinite(minBeds)
        ? (BED_OPTIONS.filter(opt => {
            if (opt === 'Studio') return 0 >= minBeds
            if (opt === '8+') return 8 >= minBeds
            return Number(opt) >= minBeds
          }) as unknown as string[])
        : prev.bedrooms,
      bathrooms: Number.isFinite(minBaths)
        ? (BATH_OPTIONS.filter(opt => {
            if (opt === '6+') return 6 >= minBaths
            return Number(opt) >= minBaths
          }) as unknown as string[])
        : prev.bathrooms,
    }))
  }, [searchParams])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, sortBy])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bedBathRef.current && !bedBathRef.current.contains(event.target as Node)) {
        setShowBedBathDropdown(false)
      }
      if (propertyTypeRef.current && !propertyTypeRef.current.contains(event.target as Node)) {
        setShowPropertyTypeDropdown(false)
      }
      if (has3DRef.current && !has3DRef.current.contains(event.target as Node)) {
        setShowHas3DDropdown(false)
      }
      if (priceRef.current && !priceRef.current.contains(event.target as Node)) {
        setShowPriceDropdown(false)
      }
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) {
        setShowCityDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const filteredAndSortedListings = useMemo(() => {
    const { query, minPrice, maxPrice, bedrooms, bathrooms, propertyType, has3D, city } = filters
    
    let filtered = listings.filter((listing) => {
      // Text search
      if (query.trim()) {
        const location = [listing.address, listing.city, listing.subCity].filter(Boolean).join(' ')
        const haystack = `${listing.title} ${listing.description || ''} ${location}`.toLowerCase()
        if (!haystack.includes(query.trim().toLowerCase())) return false
      }
      
      // Price range
      if (minPrice) {
        const min = Number(minPrice)
        if (listing.basePrice < min) return false
      }
      if (maxPrice) {
        const max = Number(maxPrice)
        if (listing.basePrice > max) return false
      }
      
      // Bedrooms - check if any selected bedroom count matches
      if (bedrooms.length > 0) {
        const listingBeds = listing.bedrooms ?? 0
        const bedMatch = bedrooms.some(bed => {
          if (bed === 'Studio') return listingBeds === 0
          if (bed === '8+') return listingBeds >= 8
          return listingBeds === Number(bed)
        })
        if (!bedMatch) return false
      }
      
      // Bathrooms - check if any selected bathroom count matches
      if (bathrooms.length > 0) {
        const listingBaths = listing.bathrooms ?? 0
        const bathMatch = bathrooms.some(bath => {
          if (bath === '6+') return listingBaths >= 6
          return listingBaths === Number(bath)
        })
        if (!bathMatch) return false
      }
      
      // Property type filter
      if (propertyType.length > 0) {
        const listingPropertyType = listing.propertyType
        if (!listingPropertyType) return false // Skip if no property type set
        
        // Check if listing's property type matches any selected types
        const matchesPropertyType = propertyType.some(selectedType => 
          listingPropertyType.toLowerCase() === selectedType.toLowerCase()
        )
        if (!matchesPropertyType) return false
      }
      
      // 3D availability
      if (has3D) {
        const wants3D = has3D === 'yes'
        if (wants3D && !listing.has3D) return false
        if (!wants3D && listing.has3D) return false
      }
      
      // City filter
      if (city) {
        if (listing.city?.toLowerCase() !== city.toLowerCase()) return false
      }
      
      return true
    })
    
    // Sort the filtered results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt || b.updatedAt || '').getTime() - new Date(a.createdAt || a.updatedAt || '').getTime()
        case 'oldest':
          return new Date(a.createdAt || a.updatedAt || '').getTime() - new Date(b.createdAt || b.updatedAt || '').getTime()
        case 'price-low':
          return a.basePrice - b.basePrice
        case 'price-high':
          return b.basePrice - a.basePrice
        case 'area-low':
          return (a.areaSqm || 0) - (b.areaSqm || 0)
        case 'area-high':
          return (b.areaSqm || 0) - (a.areaSqm || 0)
        case 'bedrooms-low':
          return (a.bedrooms || 0) - (b.bedrooms || 0)
        case 'bedrooms-high':
          return (b.bedrooms || 0) - (a.bedrooms || 0)
        default:
          return 0
      }
    })
    
    return filtered
  }, [listings, filters, sortBy])

  // Helper functions
  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const toggleBedroomFilter = (bedroom: string) => {
    setFilters(prev => ({
      ...prev,
      bedrooms: prev.bedrooms.includes(bedroom)
        ? prev.bedrooms.filter(b => b !== bedroom)
        : [...prev.bedrooms, bedroom]
    }))
  }

  const toggleBathroomFilter = (bathroom: string) => {
    setFilters(prev => ({
      ...prev,
      bathrooms: prev.bathrooms.includes(bathroom)
        ? prev.bathrooms.filter(b => b !== bathroom)
        : [...prev.bathrooms, bathroom]
    }))
  }

  // Clear only bed and bath selections (used by dropdown Reset)
  const clearBedBathFilters = () => {
    setFilters(prev => ({
      ...prev,
      bedrooms: [],
      bathrooms: []
    }))
  }

  const togglePropertyTypeFilter = (propertyType: string) => {
    setFilters(prev => ({
      ...prev,
      propertyType: prev.propertyType.includes(propertyType)
        ? prev.propertyType.filter(p => p !== propertyType)
        : [...prev.propertyType, propertyType]
    }))
  }

  const clearPropertyTypeFilters = () => {
    setFilters(prev => ({
      ...prev,
      propertyType: []
    }))
  }

  const clearFilters = () => {
    setFilters({
      query: '',
      minPrice: '',
      maxPrice: '',
      bedrooms: [],
      bathrooms: [],
      propertyType: [],
      city: ''
    })
  }

  // Load saved listings for authenticated users
  useEffect(() => {
    let cancelled = false
    const loadSaved = async () => {
      if (!isAuthenticated) { setFavorites(new Set()); return }
      try {
        const r = await fetch('/api/saved', { cache: 'no-store' })
        if (!r.ok) return
        const rows = await r.json()
        if (cancelled) return
        const ids = Array.isArray(rows) ? rows.map((l: any) => String(l.id)) : []
        setFavorites(new Set(ids))
      } catch {}
    }
    void loadSaved()
    return () => { cancelled = true }
  }, [isAuthenticated])

  const toggleFavorite = async (listingId: string) => {
    const isFav = favorites.has(listingId)
    
    if (isFav) {
      // Show confirmation modal for removal
      const listing = listings.find(l => l.id === listingId)
      if (listing) {
        setPropertyToRemove({ id: listingId, title: listing.title })
        setShowRemoveModal(true)
        return
      }
    }
    
    // Start animation for adding
    setAnimatingBookmarks(prev => new Set(prev).add(listingId))
    
    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev)
      if (isFav) next.delete(listingId); else next.add(listingId)
      return next
    })
    
    try {
      if (isFav) {
        await fetch(`/api/saved/${listingId}`, { method: 'DELETE' })
        setToast({ message: 'Removed from saved listings', type: 'success' })
      } else {
        await fetch('/api/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId })
        })
        setToast({ message: 'Added to saved listings', type: 'success' })
      }
    } catch {
      // Revert on failure
      setFavorites(prev => {
        const next = new Set(prev)
        if (isFav) next.add(listingId); else next.delete(listingId)
        return next
      })
      setToast({ message: 'Failed to update saved listings', type: 'error' })
    } finally {
      // End animation after a delay
      setTimeout(() => {
        setAnimatingBookmarks(prev => {
          const next = new Set(prev)
          next.delete(listingId)
          return next
        })
      }, 600)
      
      // Auto-hide toast after 3 seconds
      setTimeout(() => {
        setToast(null)
      }, 3000)
    }
  }

  const confirmRemove = async () => {
    if (!propertyToRemove) return
    
    // Start animation
    setAnimatingBookmarks(prev => new Set(prev).add(propertyToRemove.id))
    
    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev)
      next.delete(propertyToRemove.id)
      return next
    })
    
    try {
      await fetch(`/api/saved/${propertyToRemove.id}`, { method: 'DELETE' })
      setToast({ message: 'Removed from saved listings', type: 'success' })
    } catch {
      // Revert on failure
      setFavorites(prev => {
        const next = new Set(prev)
        next.add(propertyToRemove.id)
        return next
      })
      setToast({ message: 'Failed to remove from saved listings', type: 'error' })
    } finally {
      setShowRemoveModal(false)
      setPropertyToRemove(null)
      
      // End animation after a delay
      setTimeout(() => {
        setAnimatingBookmarks(prev => {
          const next = new Set(prev)
          next.delete(propertyToRemove.id)
          return next
        })
      }, 600)
      
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

  const getUniqueCities = () => {
    return Array.from(new Set(listings.map(l => l.city).filter(Boolean))).sort()
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => {
      if (Array.isArray(value)) return value.length > 0
      return value.trim() !== ''
    }).length
  }

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedListings.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedListings = filteredAndSortedListings.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  return (
    <div className="container space-y-12">
      <header className="pt-18 text-primary">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted">Marketplace</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl text-primary">Premium listings ready for 3D exploration</h1>
            <p className="mt-3 max-w-2xl text-sm text-secondary">
              Explore immersive-ready inventory processed through EstatePro. Every listing includes a GLB model, IFC export, and customizable material library.
            </p>
          </div>
          {isAuthenticated && user?.role === 'AGENT' && (
            <Link href="/agent/upload" className="btn btn-primary whitespace-nowrap">
              Publish your listing
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            </Link>
          )}
        </div>
      </header>

      <div className="glass relative space-y-6 border border-[color:var(--surface-border)] p-6">
        {/* Search and Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary">Search the marketplace</h2>
            <p className="text-sm text-secondary">Find the perfect property with advanced filters and sorting.</p>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="input input-with-icon"
                placeholder="Search by address, city, or keyword"
                value={filters.query}
                onChange={(event) => updateFilter('query', event.target.value)}
              />
            </div>
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'} flex items-center gap-2`}
            >
              <FunnelIcon className="h-4 w-4" />
              Filters
              {getActiveFiltersCount() > 0 && (
                <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-primary">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>
            
            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input pr-8 appearance-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="area-low">Area: Small to Large</option>
                <option value="area-high">Area: Large to Small</option>
                <option value="bedrooms-low">Bedrooms: Few to Many</option>
                <option value="bedrooms-high">Bedrooms: Many to Few</option>
              </select>
              <AdjustmentsHorizontalIcon className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary">Advanced Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-muted hover:text-primary"
              >
                Clear All
              </button>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Price Range (Dropdown) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Price</label>
                <div className="relative" ref={priceRef}>
                  <button
                    onClick={() => setShowPriceDropdown(!showPriceDropdown)}
                    className={`w-full input text-left flex items-center justify-between ${(filters.minPrice || filters.maxPrice) ? 'text-[color:var(--accent-500)]' : 'text-gray-500'}`}
                  >
                    {(() => {
                      const min = filters.minPrice?.trim()
                      const max = filters.maxPrice?.trim()
                      if (min && max) return `${min} - ${max}`
                      if (min) return `Min ${min}`
                      if (max) return `Max ${max}`
                      return 'Select Price'
                    })()}
                    <svg className={`h-4 w-4 transition-transform ${showPriceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showPriceDropdown && (
                    <div className="absolute top-full left-0 z-[9999] mt-2 w-72 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-lg">
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="Min"
                            value={filters.minPrice}
                            onChange={(e) => updateFilter('minPrice', e.target.value)}
                            className="input text-sm"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={filters.maxPrice}
                            onChange={(e) => updateFilter('maxPrice', e.target.value)}
                            className="input text-sm"
                          />
                        </div>

                        <div className="flex justify-between pt-2 border-t border-[color:var(--surface-border)]">
                          <button
                            onClick={() => {
                              updateFilter('minPrice', '')
                              updateFilter('maxPrice', '')
                              setShowPriceDropdown(false)
                            }}
                            className="px-4 py-2 text-sm font-medium text-[color:var(--accent-500)] border border-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/5"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => setShowPriceDropdown(false)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/90"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Property Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Property Type</label>
                <div className="relative" ref={propertyTypeRef}>
                  <button
                    onClick={() => setShowPropertyTypeDropdown(!showPropertyTypeDropdown)}
                    className={`w-full input text-left flex items-center justify-between ${filters.propertyType.length > 0 ? 'text-[color:var(--accent-500)]' : 'text-gray-500'}`}
                  >
                    {filters.propertyType.length > 0 
                      ? `${filters.propertyType.length} selected`
                      : 'Select Property Type'
                    }
                    <svg className={`h-4 w-4 transition-transform ${showPropertyTypeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showPropertyTypeDropdown && (
                    <div className="absolute top-full left-0 z-[9999] mt-2 w-80 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-lg">
                      <div className="p-4">
                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 mb-4">
                          <button
                            onClick={() => setPropertyCategory('Residential')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                              propertyCategory === 'Residential'
                                ? 'text-[color:var(--accent-500)] border-[color:var(--accent-500)]'
                                : 'text-gray-600 border-transparent hover:text-gray-900'
                            }`}
                          >
                            Residential
                          </button>
                          <button
                            onClick={() => setPropertyCategory('Commercial')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                              propertyCategory === 'Commercial'
                                ? 'text-[color:var(--accent-500)] border-[color:var(--accent-500)]'
                                : 'text-gray-600 border-transparent hover:text-gray-900'
                            }`}
                          >
                            Commercial
                          </button>
                        </div>
                        
                        {/* Property Types Grid */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {(propertyCategory === 'Residential' ? RESIDENTIAL_TYPES : COMMERCIAL_TYPES).map((type) => (
                            <label
                              key={type}
                              className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                                filters.propertyType.includes(type)
                                  ? 'border-gray-400 bg-gray-200'
                                  : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={filters.propertyType.includes(type)}
                                onChange={() => togglePropertyTypeFilter(type)}
                                className="mr-3 w-4 h-4 rounded border-2 border-[color:var(--accent-500)] bg-white checked:bg-[color:var(--accent-500)] checked:border-[color:var(--accent-500)] focus:ring-[color:var(--accent-500)] focus:ring-2"
                                style={{ 
                                  accentColor: 'var(--accent-500)',
                                  colorScheme: 'light'
                                }}
                              />
                              <span className="text-sm text-gray-700">{type}</span>
                            </label>
                          ))}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex justify-between pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              clearPropertyTypeFilters()
                              setShowPropertyTypeDropdown(false)
                            }}
                            className="px-4 py-2 text-sm font-medium text-[color:var(--accent-500)] border border-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/5"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => setShowPropertyTypeDropdown(false)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/90"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Beds & Baths Combined */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">Beds & Baths</label>
                <div className="relative" ref={bedBathRef}>
                  <button
                    onClick={() => setShowBedBathDropdown(!showBedBathDropdown)}
                    className={`w-full input text-left flex items-center justify-between ${(filters.bedrooms.length > 0 || filters.bathrooms.length > 0) ? 'text-[color:var(--accent-500)]' : 'text-gray-500'}`}
                  >
                    {(filters.bedrooms.length > 0 || filters.bathrooms.length > 0) 
                      ? `${filters.bedrooms.length + filters.bathrooms.length} selected`
                      : 'Select Beds & Baths'
                    }
                    <svg className={`h-4 w-4 transition-transform ${showBedBathDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showBedBathDropdown && (
                    <div className="absolute top-full left-0 z-[9999] mt-2 w-80 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-lg">
                      <div className="p-4">
                        {/* Beds Section */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Beds</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {BED_OPTIONS.map((bed) => (
                              <button
                                key={bed}
                                onClick={() => toggleBedroomFilter(bed)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                                  filters.bedrooms.includes(bed)
                                    ? 'bg-gray-300 text-gray-900 border border-gray-400'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {bed}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Baths Section */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Baths</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {BATH_OPTIONS.map((bath) => (
                              <button
                                key={bath}
                                onClick={() => toggleBathroomFilter(bath)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                                  filters.bathrooms.includes(bath)
                                    ? 'bg-gray-300 text-gray-900 border border-gray-400'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {bath}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex justify-between pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              clearBedBathFilters()
                              setShowBedBathDropdown(false)
                            }}
                            className="px-4 py-2 text-sm font-medium text-[color:var(--accent-500)] border border-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/5"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => setShowBedBathDropdown(false)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/90"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* City (Themed Dropdown) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">City</label>
                <div className="relative" ref={cityRef}>
                  <button
                    onClick={() => setShowCityDropdown(!showCityDropdown)}
                    className={`w-full input text-left flex items-center justify-between ${filters.city ? 'text-[color:var(--accent-500)]' : 'text-gray-500'}`}
                  >
                    {filters.city || 'All Cities'}
                    <svg className={`h-4 w-4 transition-transform ${showCityDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showCityDropdown && (
                    <div className="absolute top-full left-0 z-[9999] mt-2 w-64 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-lg">
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => { updateFilter('city', ''); setShowCityDropdown(false) }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                            !filters.city ? 'bg-[color:var(--surface-strong)] text-primary border border-[color:var(--surface-strong-border)]' : 'bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-hover)]'
                          }`}
                        >
                          All Cities
                        </button>
                        {getUniqueCities().map(city => (
                          <button
                            key={city}
                            onClick={() => { updateFilter('city', city || ''); setShowCityDropdown(false) }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                              filters.city === city ? 'bg-[color:var(--surface-strong)] text-primary border border-[color:var(--surface-strong-border)]' : 'bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-hover)]'
                            }`}
                          >
                            {city}
                          </button>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-[color:var(--surface-border)]">
                          <button
                            onClick={() => { updateFilter('city', ''); setShowCityDropdown(false) }}
                            className="px-4 py-2 text-sm font-medium text-[color:var(--accent-500)] border border-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/5"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => setShowCityDropdown(false)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/90"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3D Filter - Dropdown (in-grid) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary">3D Tour</label>
                <div className="relative" ref={has3DRef}>
                  <button
                    onClick={() => setShowHas3DDropdown(!showHas3DDropdown)}
                    className={`w-full input text-left flex items-center justify-between ${filters.has3D ? 'text-[color:var(--accent-500)]' : 'text-gray-500'}`}
                  >
                    {filters.has3D === 'yes' ? '3D Available' : filters.has3D === 'no' ? 'Standard Only' : 'Any'}
                    <svg className={`h-4 w-4 transition-transform ${showHas3DDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showHas3DDropdown && (
                    <div className="absolute top-full left-0 z-[9999] mt-2 w-64 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-lg">
                      <div className="p-4 space-y-2">
                      <button
                        onClick={() => updateFilter('has3D', '')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          filters.has3D === '' ? 'bg-[color:var(--surface-strong)] text-primary border border-[color:var(--surface-strong-border)]' : 'bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-hover)]'
                        }`}
                      >
                        Any
                      </button>
                      <button
                        onClick={() => updateFilter('has3D', 'yes')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          filters.has3D === 'yes' ? 'bg-[color:var(--surface-strong)] text-primary border border-[color:var(--surface-strong-border)]' : 'bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-hover)]'
                        }`}
                      >
                        3D Available
                      </button>
                      <button
                        onClick={() => updateFilter('has3D', 'no')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          filters.has3D === 'no' ? 'bg-[color:var(--surface-strong)] text-primary border border-[color:var(--surface-strong-border)]' : 'bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-hover)]'
                        }`}
                      >
                        Standard Only
                      </button>

                        {/* Actions */}
                        <div className="flex justify-between pt-3 border-t border-[color:var(--surface-border)]">
                          <button
                            onClick={() => {
                              updateFilter('has3D', '')
                              setShowHas3DDropdown(false)
                            }}
                            className="px-4 py-2 text-sm font-medium text-[color:var(--accent-500)] border border-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/5"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => setShowHas3DDropdown(false)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/90"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            
          </motion.div>
        )}

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            {isLoading ? (
              <span>Loading...</span>
            ) : status ? (
              <span>{status}</span>
            ) : (
              <span>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedListings.length)} of {filteredAndSortedListings.length} properties
                {getActiveFiltersCount() > 0 && ' match your filters'}
              </span>
            )}
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-[color:var(--accent-500)] text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-[color:var(--accent-500)] text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="divider" />
        
        {/* Listings Grid/List */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-64 bg-gray-200 rounded-2xl mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paginatedListings.map((listing, index) => {
              const imageSrc = listing.coverImage
                ? `/api/files/binary?path=${encodeURIComponent(listing.coverImage)}&listingId=${encodeURIComponent(listing.id)}`
                : null
              const isFavorite = favorites.has(listing.id)

              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: index * 0.05 }}
                  className="group relative overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {/* Quick Actions */}
                  <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
                    {isAuthenticated && !isAgent && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(listing.id)
                        }}
                        className={`rounded-full bg-white/90 p-2 shadow-sm hover:bg-white transition-all duration-300 ${
                          animatingBookmarks.has(listing.id) ? 'scale-110' : 'scale-100'
                        }`}
                      >
                        <motion.div
                          animate={animatingBookmarks.has(listing.id) ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 0.6, ease: "easeInOut" }}
                        >
                          {isFavorite ? (
                            <BookmarkSolidIcon className="h-5 w-5 text-[color:var(--brand-600)]" />
                          ) : (
                            <BookmarkIcon className="h-5 w-5 text-gray-600" />
                          )}
                        </motion.div>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        navigator.share?.({
                          title: listing.title,
                          text: listing.description || '',
                          url: window.location.origin + `/listings/${listing.id}`
                        })
                      }}
                      className="rounded-full bg-white/90 p-2 shadow-sm hover:bg-white transition-colors"
                    >
                      <ShareIcon className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>

                  <Link href={`/listings/${listing.id}`} className="flex h-full flex-col">
                    {/* Image Section */}
                    <div className="relative h-64 overflow-hidden">
                      {imageSrc ? (
                        <Image
                          alt={listing.title}
                          src={imageSrc}
                          width={640}
                          height={420}
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
                            <PhotoIcon className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">No Image Available</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Fallback for failed images */}
                      <div className="h-full w-full bg-gray-200 items-center justify-center hidden">
                        <div className="text-center text-gray-500">
                          <PhotoIcon className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-sm">Image failed to load</p>
                        </div>
                      </div>
                      
                      {/* Status Tags */}
                      <div className="absolute left-4 top-4 flex flex-col gap-2">
                        {listing.has3D && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-600)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                            <Square3Stack3DIcon className="h-3 w-3" />
                            Immersive Ready
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 p-6">
                      {/* Title and Location */}
                      <div className="mb-4">
                        <h3 className="text-xl font-semibold text-gray-900 group-hover:text-[color:var(--brand-600)] transition-colors mb-2">
                          {listing.title}
                        </h3>
                        <div className="space-y-1">
                          {listing.address && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPinIcon className="h-4 w-4" />
                              <span>{listing.address}</span>
                            </div>
                          )}
                          {(listing.subCity || listing.city) && (
                            <div className="text-sm text-gray-500">
                              {(() => {
                                const parts = []
                                if (listing.subCity) parts.push(listing.subCity)
                                if (listing.city && listing.city.toLowerCase() !== listing.subCity?.toLowerCase()) {
                                  parts.push(listing.city)
                                }
                                return parts.join(', ')
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="mb-4 space-y-3">
                        {/* Price */}
                        <div className="flex items-center gap-2">
                          <CurrencyDollarIcon className="h-5 w-5 text-[color:var(--brand-600)]" />
                          <span className="text-xl font-bold text-gray-900">
                            {formatPrice(listing.basePrice, listing.currency || 'ETB')}
                          </span>
                        </div>
                        
                        {/* Property Specs */}
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          {listing.bedrooms !== null && listing.bedrooms !== undefined && (
                            <div className="flex items-center gap-1">
                              <BedIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                              <span className="font-medium">{listing.bedrooms}</span>
                            </div>
                          )}
                          {listing.bathrooms !== null && listing.bathrooms !== undefined && (
                            <div className="flex items-center gap-1">
                              <BathIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                              <span className="font-medium">{listing.bathrooms}</span>
                            </div>
                          )}
                          {listing.areaSqm && listing.areaSqm > 0 && (
                            <div className="flex items-center gap-1">
                              <AreaIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                              <span className="font-medium">{listing.areaSqm}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {listing.description && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {listing.description}
                          </p>
                        </div>
                      )}

                      {/* Action Footer */}
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-500">
                          View Details
                        </div>
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400 group-hover:text-[color:var(--brand-600)] transition-colors" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {paginatedListings.map((listing, index) => {
              const imageSrc = listing.coverImage
                ? `/api/files/binary?path=${encodeURIComponent(listing.coverImage)}&listingId=${encodeURIComponent(listing.id)}`
                : null
              const isFavorite = favorites.has(listing.id)

              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: index * 0.05 }}
                  className="group overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href={`/listings/${listing.id}`} className="flex min-h-48">
                    {/* Image Section */}
                    <div className="relative w-80 flex-shrink-0 overflow-hidden">
                      {imageSrc ? (
                        <Image
                          alt={listing.title}
                          src={imageSrc}
                          width={320}
                          height={192}
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
                            <PhotoIcon className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">No Image</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Fallback for failed images */}
                      <div className="h-full w-full bg-gray-200 items-center justify-center hidden">
                        <div className="text-center text-gray-500">
                          <PhotoIcon className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-sm">Image failed to load</p>
                        </div>
                      </div>
                      
                      {/* Status Tags */}
                      <div className="absolute left-4 top-4 flex flex-col gap-2">
                        {listing.has3D && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-600)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                            <Square3Stack3DIcon className="h-3 w-3" />
                            Immersive Ready
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 p-6 flex flex-col">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 group-hover:text-[color:var(--brand-600)] transition-colors mb-2">
                            {listing.title}
                          </h3>
                          <div className="space-y-1">
                            {listing.address && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <MapPinIcon className="h-4 w-4" />
                                <span>{listing.address}</span>
                              </div>
                            )}
                            {(listing.subCity || listing.city) && (
                              <div className="text-sm text-gray-500">
                                {(() => {
                                  const parts = []
                                  if (listing.subCity) parts.push(listing.subCity)
                                  if (listing.city && listing.city.toLowerCase() !== listing.subCity?.toLowerCase()) {
                                    parts.push(listing.city)
                                  }
                                  return parts.join(', ')
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 ml-4">
                          {isAuthenticated && !isAgent && (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleFavorite(listing.id)
                              }}
                              className={`rounded-full bg-gray-100 p-2 hover:bg-gray-200 transition-all duration-300 ${
                                animatingBookmarks.has(listing.id) ? 'scale-110' : 'scale-100'
                              }`}
                            >
                              <motion.div
                                animate={animatingBookmarks.has(listing.id) ? { scale: [1, 1.2, 1] } : {}}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                              >
                                {isFavorite ? (
                                  <BookmarkSolidIcon className="h-5 w-5 text-[color:var(--brand-600)]" />
                                ) : (
                                  <BookmarkIcon className="h-5 w-5 text-gray-600" />
                                )}
                              </motion.div>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              navigator.share?.({
                                title: listing.title,
                                text: listing.description || '',
                                url: window.location.origin + `/listings/${listing.id}`
                              })
                            }}
                            className="rounded-full bg-gray-100 p-2 hover:bg-gray-200 transition-colors"
                          >
                            <ShareIcon className="h-5 w-5 text-gray-600" />
                          </button>
                        </div>
                      </div>

                      {/* Details Row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <CurrencyDollarIcon className="h-5 w-5 text-[color:var(--brand-600)]" />
                          <span className="text-xl font-bold text-gray-900">
                            {formatPrice(listing.basePrice, listing.currency || 'ETB')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          {listing.bedrooms !== null && listing.bedrooms !== undefined && (
                            <div className="flex items-center gap-1">
                              <BedIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                              <span className="font-medium">{listing.bedrooms}</span>
                            </div>
                          )}
                          {listing.bathrooms !== null && listing.bathrooms !== undefined && (
                            <div className="flex items-center gap-1">
                              <BathIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                              <span className="font-medium">{listing.bathrooms}</span>
                            </div>
                          )}
                          {listing.areaSqm && listing.areaSqm > 0 && (
                            <div className="flex items-center gap-1">
                              <AreaIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                              <span className="font-medium">{listing.areaSqm}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {listing.description && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {listing.description}
                          </p>
                        </div>
                      )}

                      {/* Action Footer */}
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-500">
                          View Details
                        </div>
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400 group-hover:text-[color:var(--brand-600)] transition-colors" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && filteredAndSortedListings.length > itemsPerPage && (
          <div className="flex items-center justify-center gap-2 pt-8">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-2 rounded ${
                      currentPage === pageNum
                        ? 'bg-[color:var(--accent-500)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {filteredAndSortedListings.length === 0 && !status && !isLoading && (
          <div className="rounded-3xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-12 text-center text-secondary">
            {getActiveFiltersCount() > 0 ? (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-primary">No properties match your filters</div>
                <p className="text-sm">Try adjusting your search criteria or clearing some filters to see more results.</p>
                <button
                  onClick={clearFilters}
                  className="btn btn-outline"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-primary">No listings available</div>
                <p className="text-sm">Check back soon for new property listings.</p>
              </div>
            )}
          </div>
        )}
      </div>
      
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
      
      {/* Remove Confirmation Modal */}
      <RemoveSavedModal
        isOpen={showRemoveModal}
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
        propertyTitle={propertyToRemove?.title}
      />
    </div>
  )
}
