'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import ListingSuccessModal from '@/components/ListingSuccessModal'
import { SUPPORTED_CURRENCIES, convertAmount, formatPrice } from '@/lib/utils'

type ListingFormState = {
  title: string
  basePrice: string
  description: string
  address: string
  city: string
  bedrooms: string
  bathrooms: string
  areaSqm: string
  coverImage: string
  currency: string
}

const DEFAULT_FORM: ListingFormState = {
  title: '',
  basePrice: '',
  description: '',
  address: '',
  city: '',
  bedrooms: '',
  bathrooms: '',
  areaSqm: '',
  coverImage: '',
  currency: 'ETB',
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 56.5,
  EUR: 60.2,
  GBP: 69.4,
  AED: 15.4,
  SAR: 15.1,
  CAD: 41.2,
  CNY: 8.2,
}

export default function PublishUnitPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const unitId = params?.id || ''
  const { user, isAuthenticated, isLoading } = useAuth()

  const [form, setForm] = useState<ListingFormState>(DEFAULT_FORM)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unitPayload, setUnitPayload] = useState<any>(null)
  const [rates, setRates] = useState<Record<string, number>>({ ETB: 1 })
  const [ratesReady, setRatesReady] = useState(false)
  const [heroOptions, setHeroOptions] = useState<string[]>([])
  const [heroLoading, setHeroLoading] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const heroUploadRef = useRef<HTMLInputElement | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [publishedListingTitle, setPublishedListingTitle] = useState('')

  const isAgent = useMemo(() => user?.role === 'AGENT' || user?.role === 'ADMIN', [user?.role])
  const basePriceEtb = useMemo(() => {
    const amount = parseFloat(form.basePrice || '0')
    if (!Number.isFinite(amount) || amount <= 0) return 0
    return convertAmount(amount, form.currency || 'ETB', 'ETB', rates)
  }, [form.basePrice, form.currency, rates])

useEffect(() => {
  if (!unitId) return
  let active = true
  setLoading(true)
  fetch(`/api/units/${encodeURIComponent(unitId)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return
        if (!res.ok) {
          throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to load unit')
        }
        return res.json()
      })
      .then((data) => {
        if (!active || !data) return
        setUnitPayload(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError((err as Error)?.message || 'Unable to load unit metadata')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

  return () => {
    active = false
  }
}, [unitId])

useEffect(() => {
  let active = true
  fetch('/api/exchange-rates', { cache: 'no-store' })
    .then(async (res) => {
      if (!active) return
      if (!res.ok) throw new Error('Failed to load exchange rates')
      return res.json()
    })
    .then((data) => {
      if (!active || !data?.rates) return
      setRates({ ETB: 1, ...data.rates })
      setRatesReady(true)
    })
    .catch(() => {
      setRates({ ETB: 1, ...FALLBACK_RATES })
      setRatesReady(true)
    })

  return () => {
    active = false
  }
}, [])

useEffect(() => {
  if (!unitId) return
  let active = true
  setHeroLoading(true)
  fetch(`/api/renders/${encodeURIComponent(unitId)}`, { cache: 'no-store' })
    .then(async (res) => {
      if (!active) return null
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error((data as { error?: string } | null)?.error || `Failed to load renders (${res.status})`)
      }
      return res.json()
    })
    .then((data) => {
      if (!active || !data) return
      const candidates = Array.isArray(data.renders)
        ? (data.renders as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : []
      const unique = Array.from(new Set(candidates))
      setHeroOptions(unique)
      if (unique.length > 0) {
        setForm((prev) => {
          if (prev.coverImage) return prev
          return { ...prev, coverImage: unique[0] }
        })
      }
    })
    .catch((err) => {
      if (!active) return
      console.warn('Hero render fetch failed', err)
      setHeroOptions([])
    })
    .finally(() => {
      if (active) setHeroLoading(false)
    })

  return () => {
    active = false
  }
}, [unitId])

useEffect(() => {
  if (!form.coverImage) return
  setHeroOptions((prev) => (prev.includes(form.coverImage) ? prev : [form.coverImage, ...prev]))
}, [form.coverImage])

useEffect(() => {
  if (!isLoading && (!isAuthenticated || !isAgent)) {
    router.push('/login')
  }
}, [isAuthenticated, isAgent, isLoading, router])

useEffect(() => {
  if (!unitPayload || !ratesReady) return
  const listing = unitPayload.listing || {}
  const currency = typeof listing.currency === 'string' && listing.currency.trim().length === 3
    ? listing.currency.trim().toUpperCase()
    : 'ETB'
  const basePriceEtb = typeof listing.basePrice === 'number' ? listing.basePrice : 0
  const displayPrice = basePriceEtb > 0 ? convertAmount(basePriceEtb, 'ETB', currency, rates) : 0

  setForm({
    title: listing.title || unitPayload.name || '',
    basePrice: displayPrice ? String(Number(displayPrice.toFixed(2))) : '',
    description: listing.description || '',
    address: listing.address || '',
    city: listing.city || '',
    bedrooms: listing.bedrooms ? String(listing.bedrooms) : '',
    bathrooms: listing.bathrooms ? String(listing.bathrooms) : '',
    areaSqm: listing.areaSqm ? String(listing.areaSqm) : '',
    coverImage: listing.coverImage || '',
    currency,
  })
}, [unitPayload, ratesReady, rates])

  const handleChange = (field: keyof ListingFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleCurrencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value.toUpperCase()
    setForm((prev) => ({ ...prev, currency: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!unitId) return
    setError('')
    setStatus('')
    if (!ratesReady) {
      setError('Exchange rates are still loading. Please try again in a moment.')
      return
    }
    setSaving(true)

    const trimmedCover = form.coverImage.trim()
    const payload = {
      unitId,
      title: form.title.trim(),
      basePrice: Number(basePriceEtb.toFixed(2)),
      currency: form.currency,
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : 0,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : 0,
      areaSqm: form.areaSqm ? Number(form.areaSqm) : 0,
      coverImage: trimmedCover ? trimmedCover : null,
    }

    if (!payload.coverImage && heroOptions.length > 0) {
      setError('Select one of the captured renders or upload a hero image before publishing.')
      setSaving(false)
      return
    }

    if (!payload.title || Number.isNaN(basePriceEtb) || basePriceEtb <= 0) {
      setError('Title and base price are required and must be valid.')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to publish listing')
      }
      const listingId: string | undefined = typeof data?.id === 'string' ? data.id : undefined

      let publishSucceeded = true
      if (listingId) {
        const publishResponse = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublished: true }),
        }).catch(() => null)
        if (!publishResponse || !publishResponse.ok) {
          publishSucceeded = false
        }
      }

      setStatus(
        publishSucceeded
          ? 'Listing published successfully!'
          : 'Listing saved as draft. Finalize from the units dashboard when you are ready.'
      )
      
      if (publishSucceeded) {
        // Show success modal instead of redirecting
        setPublishedListingTitle(form.title || 'Your listing')
        setShowSuccessModal(true)
      } else {
        // Only redirect for draft saves
        setTimeout(() => {
          router.replace('/agent/units')
        }, 800)
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Unable to publish listing')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#7b6652]">
        Preparing publish flow…
      </div>
    )
  }

  return (
    <div className="container max-w-3xl space-y-6 py-10 text-[#2f2013]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Publish unit to marketplace</h1>
          <p className="text-sm text-[#7b6652]">
            Provide buyer-facing information to create a polished listing. You can refine these details later from the unit
            dashboard.
          </p>
        </div>
        <Link href={`/agent/units/${encodeURIComponent(unitId)}`} className="btn btn-secondary">
          Back to unit
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-[#d9c6b5] bg-[#fefbf7] p-8 shadow-[0_18px_40px_rgba(59,42,28,0.1)]">
        {error && (
          <div className="rounded-2xl border border-[#f4c7b5] bg-[#fde7dd] px-4 py-3 text-sm text-[#a94b3c]">{error}</div>
        )}
        {status && (
          <div className="rounded-2xl border border-[#c0d9cc] bg-[#e6f3ef] px-4 py-3 text-sm text-[#2f6f54]">
            {status}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Listing title</span>
            <input
              required
              value={form.title}
              onChange={handleChange('title')}
              className="input text-base md:text-lg"
              placeholder="Luxury smart condo"
            />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Base price</span>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.basePrice}
                onChange={handleChange('basePrice')}
                className="input w-full text-lg md:text-2xl"
                placeholder="850000"
              />
              <select
                value={form.currency}
                onChange={handleCurrencyChange}
                className="input w-full text-sm sm:text-base"
                disabled={!ratesReady}
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[11px] text-[#a08a78]">
              {ratesReady
                ? `≈ ${formatPrice(basePriceEtb, 'ETB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'Fetching exchange rates…'}
            </div>
          </div>
        </div>

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Headline description</span>
          <textarea
            value={form.description}
            onChange={handleChange('description')}
            className="input min-h-[120px]"
            placeholder="Highlight the unique selling points, finishes, neighbourhood, and amenities"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Street address</span>
            <input value={form.address} onChange={handleChange('address')} className="input" placeholder="123 Palm Avenue" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">City / region</span>
            <input value={form.city} onChange={handleChange('city')} className="input" placeholder="Dubai Marina" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Bedrooms</span>
            <input
              type="number"
              min="0"
              value={form.bedrooms}
              onChange={handleChange('bedrooms')}
              className="input"
              placeholder="3"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Bathrooms</span>
            <input
              type="number"
              min="0"
              value={form.bathrooms}
              onChange={handleChange('bathrooms')}
              className="input"
              placeholder="4"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Area (sqm)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.areaSqm}
              onChange={handleChange('areaSqm')}
              className="input"
              placeholder="238"
            />
          </label>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-[#7b6652]">Hero image</span>
              <p className="text-xs text-[#a08a78]">Select a captured render or upload a marketing image for the listing.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                  uploadingHero
                    ? 'bg-[color:var(--surface-2)] text-disabled'
                    : 'bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-3)]'
                }`}
                onClick={() => heroUploadRef.current?.click()}
                disabled={uploadingHero}
              >
                {uploadingHero ? 'Uploading…' : 'Upload image'}
              </button>
            </div>
          </div>

          <input
            ref={heroUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setUploadingHero(true)
              setError('')
              setStatus('')
              try {
                const formData = new FormData()
                formData.append('unitId', unitId)
                if (unitPayload?.listing?.id) {
                  formData.append('listingId', unitPayload.listing.id)
                }
                formData.append('image', file)
                const res = await fetch('/api/renders', { method: 'POST', body: formData })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                  throw new Error((data as { error?: string }).error || 'Failed to upload hero image')
                }
                const path = (data as { path?: string }).path || ''
                if (path) {
                  setHeroOptions((prev) => (prev.includes(path) ? prev : [path, ...prev]))
                  setForm((prev) => ({ ...prev, coverImage: path }))
                  setStatus('Hero image uploaded successfully.')
                }
              } catch (uploadErr) {
                setError((uploadErr as Error)?.message || 'Hero image upload failed')
              } finally {
                setUploadingHero(false)
                if (event.target) {
                  event.target.value = ''
                }
              }
            }}
          />

          {heroLoading ? (
            <p className="rounded-2xl border border-[#e7d8c7] bg-[#fff9f2] px-4 py-3 text-xs text-[#a08a78]">
              Loading captured renders…
            </p>
          ) : heroOptions.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {heroOptions.map((path) => {
                const selected = form.coverImage === path
                const imageSrc = /^https?:/i.test(path)
                  ? path
                  : `/api/files/binary?path=${encodeURIComponent(path)}${
                      unitPayload?.listing?.id ? `&listingId=${encodeURIComponent(unitPayload.listing.id)}` : ''
                    }`
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, coverImage: path }))}
                    className={`group relative overflow-hidden rounded-2xl border text-left shadow-sm transition ${
                      selected
                        ? 'border-[#be8a43] ring-2 ring-[#be8a43]/25'
                        : 'border-[#e7d8c7] hover:border-[#c49b60]'
                    }`}
                  >
                    <img src={imageSrc} alt="Hero option" className="h-40 w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 py-2 text-[11px] text-white">
                      {selected ? 'Selected hero image' : 'Choose this capture'}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#d9c6b5] bg-[#fff9f2] px-4 py-6 text-center text-xs text-[#a08a78]">
              No renders found yet. Upload a marketing image above or capture views from the 3D editor to continue.
            </p>
          )}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary w-full justify-center text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Publishing…' : 'Publish & continue'}
        </button>
      </form>

      {/* Success Modal */}
      <ListingSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        listingTitle={publishedListingTitle}
      />
    </div>
  )
}
