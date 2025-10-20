'use client'

import {
  AdjustmentsHorizontalIcon,
  ArrowTopRightOnSquareIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  PhotoIcon,
  Square3Stack3DIcon,
  CurrencyDollarIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { formatPrice } from '@/lib/utils'

// Inline icons to match Listings page
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

// Match Listings page card data
type Listing = {
  id: string
  title: string
  address?: string | null
  city?: string | null
  basePrice: number
  coverImage?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  areaSqm?: number | null
  currency?: string | null
}

type Filters = {
  query: string
  minPrice: string
  maxPrice: string
  bedrooms: string[]
  bathrooms: string[]
  city: string
}

const BED_OPTIONS = ['Studio', '1', '2', '3', '4', '5', '6', '7', '8+'] as const
const BATH_OPTIONS = ['1', '2', '3', '4', '5', '6+'] as const

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [status, setStatus] = useState('')
  const [filters, setFilters] = useState<Filters>({
    query: '',
    minPrice: '',
    maxPrice: '',
    bedrooms: [],
    bathrooms: [],
    city: ''
  })

  const bedBathRef = useRef<HTMLDivElement>(null)
  const priceRef = useRef<HTMLDivElement>(null)
  const cityRef = useRef<HTMLDivElement>(null)
  const [showBedBathDropdown, setShowBedBathDropdown] = useState(false)
  const [showPriceDropdown, setShowPriceDropdown] = useState(false)
  const [showCityDropdown, setShowCityDropdown] = useState(false)

  useEffect(() => {
    const load = async () => {
      setStatus('Loading listings…')
      try {
        const response = await fetch('/api/listings?published=true', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) {
          setStatus(data?.error || 'Unable to load listings right now')
          return
        }
        setListings(Array.isArray(data) ? data : [])
        setStatus('')
      } catch (err) {
        console.error('Failed to load listings', err)
        setStatus('Unable to load listings right now')
      }
    }

    void load()
  }, [])

  const filteredListings = useMemo(() => {
    const { query, minPrice, maxPrice, bedrooms, bathrooms, city } = filters
    const min = minPrice ? Number(minPrice) : undefined
    const max = maxPrice ? Number(maxPrice) : undefined

    return listings.filter((listing) => {
      const location = [listing.address, listing.city].filter(Boolean).join(' ')
      const haystack = `${listing.title} ${location}`.toLowerCase()
      const matchesQuery = query ? haystack.includes(query.trim().toLowerCase()) : true
      const matchesMin = typeof min === 'number' ? listing.basePrice >= min : true
      const matchesMax = typeof max === 'number' ? listing.basePrice <= max : true
      // Bedrooms - if any selections, match exact counts from options
      const matchesBeds = bedrooms.length > 0
        ? (() => {
            const listingBeds = listing.bedrooms ?? 0
            return bedrooms.some((bed) => {
              if (bed === 'Studio') return listingBeds === 0
              if (bed === '8+') return listingBeds >= 8
              return listingBeds === Number(bed)
            })
          })()
        : true
      // Bathrooms
      const matchesBaths = bathrooms.length > 0
        ? (() => {
            const listingBaths = listing.bathrooms ?? 0
            return bathrooms.some((bath) => {
              if (bath === '6+') return listingBaths >= 6
              return listingBaths === Number(bath)
            })
          })()
        : true
      // 3D availability
      // City
      const matchesCity = city ? (listing.city || '').toLowerCase() === city.toLowerCase() : true

      return matchesQuery && matchesMin && matchesMax && matchesBeds && matchesBaths && matchesCity
    })
  }, [filters, listings])

  const handleFilterChange = (key: keyof Filters) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }))
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

  const clearBedBathFilters = () => setFilters(prev => ({ ...prev, bedrooms: [], bathrooms: [] }))

  const getUniqueCities = () => Array.from(new Set(listings.map(l => l.city).filter(Boolean))) as string[]

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bedBathRef.current && !bedBathRef.current.contains(event.target as Node)) setShowBedBathDropdown(false)
      if (priceRef.current && !priceRef.current.contains(event.target as Node)) setShowPriceDropdown(false)
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) setShowCityDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-16 pb-20 pt-10">
      <section className="container grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-muted">
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Immersive listings
          </span>
          <div className="space-y-4">
            <h1 className="text-[32px] font-semibold leading-snug text-primary md:text-[38px]">
              Discover premium residences with ready-to-share virtual walkthroughs
            </h1>
            <p className="max-w-xl text-sm text-muted">
              EstatePro transforms architectural drawings and 3D models into polished buyer experiences. Search the public marketplace, or sign in as an agent to publish your own portfolio.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-secondary">
            <span className="rounded-full border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-0)] px-3 py-1">GLB · IFC · USDZ exports</span>
            <span className="rounded-full border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-0)] px-3 py-1">Configurable finishes with live pricing</span>
            <span className="rounded-full border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-0)] px-3 py-1">Shareable buyer presentations</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href={{ pathname: '/listings', query: {
              ...(filters.query ? { query: filters.query } : {}),
              ...(filters.minPrice ? { minPrice: filters.minPrice } : {}),
              ...(filters.maxPrice ? { maxPrice: filters.maxPrice } : {}),
              ...(filters.bedrooms.length ? { minBedrooms: (() => {
                // derive a sensible min from selections
                const values = filters.bedrooms.map(b => b === 'Studio' ? 0 : b === '8+' ? 8 : Number(b)).filter(n => Number.isFinite(n)) as number[]
                return Math.min(...values)
              })() } : {}),
              ...(filters.bathrooms.length ? { minBathrooms: (() => {
                const values = filters.bathrooms.map(b => b === '6+' ? 6 : Number(b)).filter(n => Number.isFinite(n)) as number[]
                return Math.min(...values)
              })() } : {}),
              ...(filters.city ? { city: filters.city } : {}),
            }}} className="btn btn-primary px-5 py-2 text-xs">
              Browse all listings
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/agent/upload" className="btn btn-secondary px-5 py-2 text-xs">
              Upload drawings or 3D model
            </Link>
          </div>
          <p className="text-[11px] text-muted">
            Supported formats include IFC, GLB, USDZ, RVT, DXF/DWG, and structured point clouds. Upload once—EstatePro optimizes everything for web, mobile, and VR.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-[var(--shadow-soft)] backdrop-blur-xl"
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-primary">Search the marketplace</h2>
              <p className="mt-1 text-[11px] text-muted">Filter by budget, bedrooms, and keywords to find the right residence.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Keyword</label>
                <input
                  className="input text-sm"
                  placeholder="City, address, or listing title"
                  value={filters.query}
                  onChange={handleFilterChange('query')}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Price (Dropdown) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Price</label>
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
                              onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                              className="input text-sm"
                            />
                            <input
                              type="number"
                              placeholder="Max"
                              value={filters.maxPrice}
                              onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                              className="input text-sm"
                            />
                          </div>
                          <div className="flex justify-between pt-2 border-t border-[color:var(--surface-border)]">
                            <button
                              onClick={() => { setFilters(prev => ({ ...prev, minPrice: '', maxPrice: '' })); setShowPriceDropdown(false) }}
                              className="px-4 py-2 text-sm font-medium text-[color:var(--accent-500)] border border-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/5"
                            >Reset</button>
                            <button
                              onClick={() => setShowPriceDropdown(false)}
                              className="px-4 py-2 text-sm font-medium text-white bg-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/90"
                            >Done</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>


                {/* Beds & Baths (Dropdown) */}
                <div className="space-y-1.5" ref={bedBathRef}>
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Beds & Baths</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowBedBathDropdown(!showBedBathDropdown)}
                      className={`w-full input text-left flex items-center justify-between ${(filters.bedrooms.length > 0 || filters.bathrooms.length > 0) ? 'text-[color:var(--accent-500)]' : 'text-gray-500'}`}
                    >
                      {(filters.bedrooms.length > 0 || filters.bathrooms.length > 0)
                        ? `${filters.bedrooms.length + filters.bathrooms.length} selected`
                        : 'Select Beds & Baths'}
                      <svg className={`h-4 w-4 transition-transform ${showBedBathDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showBedBathDropdown && (
                      <div className="absolute top-full left-0 z-[9999] mt-2 w-80 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-lg">
                        <div className="p-4">
                          {/* Beds */}
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 mb-3">Beds</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {BED_OPTIONS.map((bed) => (
                                <button
                                  key={bed}
                                  onClick={() => toggleBedroomFilter(bed)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${filters.bedrooms.includes(bed) ? 'bg-gray-300 text-gray-900 border border-gray-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >{bed}</button>
                              ))}
                            </div>
                          </div>
                          {/* Baths */}
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 mb-3">Baths</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {BATH_OPTIONS.map((bath) => (
                                <button
                                  key={bath}
                                  onClick={() => toggleBathroomFilter(bath)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${filters.bathrooms.includes(bath) ? 'bg-gray-300 text-gray-900 border border-gray-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >{bath}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between pt-4 border-t border-gray-200">
                            <button onClick={() => { clearBedBathFilters(); setShowBedBathDropdown(false) }} className="px-4 py-2 text-sm font-medium text-[color:var(--accent-500)] border border-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/5">Reset</button>
                            <button onClick={() => setShowBedBathDropdown(false)} className="px-4 py-2 text-sm font-medium text-white bg-[color:var(--accent-500)] rounded-lg hover:bg-[color:var(--accent-500)]/90">Done</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* City (Dropdown) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted">City</label>
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
                          <button onClick={() => { setFilters(prev => ({ ...prev, city: '' })); setShowCityDropdown(false) }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${!filters.city ? 'bg-[color:var(--surface-strong)] text-primary border border-[color:var(--surface-strong-border)]' : 'bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-hover)]'}`}>All Cities</button>
                          {getUniqueCities().map(city => (
                            <button key={city} onClick={() => { setFilters(prev => ({ ...prev, city: city || '' })); setShowCityDropdown(false) }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${filters.city === city ? 'bg-[color:var(--surface-strong)] text-primary border border-[color:var(--surface-strong-border)]' : 'bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-hover)]'}`}>{city}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <p className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-4 py-3 text-[11px] text-muted">
              Viewing {filteredListings.length.toLocaleString()} of {listings.length.toLocaleString()} published residences.
            </p>
          </div>
        </motion.div>
      </section>

      <section className="container space-y-6 rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">Featured residences</h2>
            <p className="text-[12px] text-muted">
              Every listing includes interactive walkthroughs, configurable finishes, and export-ready construction packages.
            </p>
          </div>
          <Link href="/listings" className="btn btn-outline px-5 py-2 text-xs">
            Explore full marketplace
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {status && <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 text-[12px] text-secondary">{status}</div>}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredListings.slice(0, 9).map((listing, index) => {
            const imageSrc = listing.coverImage
              ? `/api/files/binary?path=${encodeURIComponent(listing.coverImage)}&listingId=${encodeURIComponent(listing.id)}`
              : null
            const location = [listing.address, listing.city].filter(Boolean).join(', ')

            return (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: index * 0.04 }}
                className="flex h-full flex-col overflow-hidden rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft-raised)]"
              >
                <Link href={`/listings/${listing.id}`} className="group flex h-full flex-col">
                  <div className="relative">
                    {imageSrc ? (
                      <Image
                        alt={listing.title}
                        src={imageSrc}
                        width={600}
                        height={420}
                        className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-48 w-full bg-gray-200 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <PhotoIcon className="h-8 w-8 mx-auto mb-1" />
                          <p className="text-xs">No Image</p>
                        </div>
                      </div>
                    )}
                    {/* Status Tags (match listings grid) */}
                    <div className="absolute left-4 top-4 flex flex-col gap-2">
                  </div>
                  {/* Close image container before details */}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 px-5 pb-6 pt-5 text-sm text-primary">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-primary transition-colors group-hover:text-secondary">{listing.title}</h3>
                      <div className="flex items-center gap-2 text-[12px] text-muted">
                        <MapPinIcon className="h-4 w-4" />
                        {location || 'Location to be announced'}
                      </div>
                    </div>
                    {/* Property Details (match listings grid) */}
                    <div className="mb-1 space-y-3">
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
                    {/* Action Footer */}
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="text-sm text-gray-500">View Details</div>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400 group-hover:text-[color:var(--brand-600)] transition-colors" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {filteredListings.length === 0 && !status && (
          <div className="rounded-3xl border border-dashed border-[color:var(--surface-border-strong)] bg-[color:var(--surface-1)] p-12 text-center text-[12px] text-muted">
            No listings match your criteria yet. Adjust your filters or check back soon.
          </div>
        )}
      </section>
    </div>
  )
}
