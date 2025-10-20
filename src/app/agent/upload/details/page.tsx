'use client'

import {
  DocumentTextIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { SUPPORTED_CURRENCIES } from '@/lib/utils'
import { useWizardDataProtection } from '@/hooks/useWizardDataProtection'
import WizardWarningModal from '@/components/WizardWarningModal'
import LocationInput from '@/components/LocationInput'

// ================================
// Types & Constants
// ================================

type ListingFormState = {
  title: string
  basePrice: string
  description: string
  address: string
  city: string
  subCity: string
  latitude?: number | null
  longitude?: number | null
  bedrooms: string
  bathrooms: string
  areaSqm: string
  currency: string
  amenities: string[]
  features: string[]
}

const DEFAULT_FORM: ListingFormState = {
  title: '',
  basePrice: '',
  description: '',
  address: '',
  city: '',
  subCity: '',
  latitude: null,
  longitude: null,
  bedrooms: '',
  bathrooms: '',
  areaSqm: '',
  currency: 'ETB',
  amenities: [],
  features: [],
}

const BED_OPTIONS = ['Studio', '1', '2', '3', '4', '5', '6', '7', '8'] as const
const BATH_OPTIONS = ['1', '2', '3', '4', '5', '6'] as const

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

// Concise, realistic amenities list (no Internet option)
const AMENITIES = [
  'Parking',
  'Elevator',
  'Security',
  'Gym',
  'Swimming Pool',
  'Balcony / Terrace',
  'Air Conditioning',
] as const

// Requested features (wording polished)
const FEATURES = [
  '24/7 Power Generator',
  'Underground Water Supply',
  'Sustainable Water Reserve',
] as const

type PropertyCategory = 'Residential' | 'Commercial'

// ================================
// Component
// ================================
export default function AgentUploadDetailsPage() {
  const [form, setForm] = useState<ListingFormState>(DEFAULT_FORM)
  const [propTypeOpen, setPropTypeOpen] = useState(false)
  const [propTab, setPropTab] = useState<PropertyCategory>('Residential')
  const [propertyType, setPropertyType] = useState<string>('')
  const propRef = useRef<HTMLDivElement | null>(null)
  const [bedsOpen, setBedsOpen] = useState(false)
  const bedsRef = useRef<HTMLDivElement | null>(null)

  const [bathsOpen, setBathsOpen] = useState(false)
  const bathsRef = useRef<HTMLDivElement | null>(null)

  const [customBeds, setCustomBeds] = useState<string>('')   // for 9+
  const [customBaths, setCustomBaths] = useState<string>('') // for 7+
  const [pickerErrors, setPickerErrors] = useState<{beds?: string; baths?: string}>({})




  // Form validation state
  const [errors, setErrors] = useState<Record<string, string>>({})

  const router = useRouter()

  // Check if there's unsaved data (meaningful data, not just default values)
  const hasUnsavedData = Boolean(
    form.title ||
    form.basePrice ||
    form.description ||
    form.address ||
    form.city ||
    form.subCity ||
    form.bedrooms ||
    form.bathrooms ||
    form.areaSqm ||
    form.amenities.length > 0 ||
    form.features.length > 0 ||
    propertyType
  )

  // Data protection
  const { 
    showWarningModal, 
    protectedRouterPush, 
    handleConfirmLeave, 
    handleCancelLeave 
  } = useWizardDataProtection({
    hasUnsavedData,
    onConfirmLeave: () => {
      // Clear all wizard data when leaving
      sessionStorage.removeItem('agent:uploadStep1')
      sessionStorage.removeItem('agent:uploadStep2')
      sessionStorage.removeItem('agent:uploadStep3')
      sessionStorage.removeItem('agent:reviewDraft')
      sessionStorage.removeItem('agent:editorChanges')
    },
    onCancelLeave: () => {
      // Stay on the page
    }
  })

  // ----------------
  // Handlers
  // ----------------
  const handleChange = (field: keyof ListingFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleCurrencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value.toUpperCase()
    setForm((prev) => ({ ...prev, currency: value }))
  }

  const toggleInArray = (key: 'amenities' | 'features', value: string) => {
    setForm(prev => {
      const exists = prev[key].includes(value)
      const next = exists ? prev[key].filter(v => v !== value) : [...prev[key], value]
      return { ...prev, [key]: next }
    })
  }

  // ----------------
  // Validation
  // ----------------
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'title':
        return !value ? 'Title is required' : value.length < 5 ? 'Title must be at least 5 characters' : ''
      case 'basePrice':
        return !value ? 'Price is required' : isNaN(Number(value)) ? 'Must be a valid number' : ''
      case 'description':
        return !value ? 'Description is required' : value.length < 10 ? 'Description must be at least 10 characters' : ''
      case 'address':
        return !value ? 'Address is required' : ''
      case 'city':
        return !value ? 'City is required' : ''
      case 'subCity':
        return !value ? 'Sub City is required' : ''
      case 'bedrooms':
        return !value ? 'Number of bedrooms is required' : ''
      case 'bathrooms':
        return !value ? 'Number of bathrooms is required' : ''
      case 'areaSqm':
        return !value ? 'Area is required' : isNaN(Number(value)) ? 'Must be a valid number' : Number(value) <= 0 ? 'Area must be greater than 0' : ''
      default:
        return ''
    }
  }

  const handleBlur = (field: keyof ListingFormState) => {
    // Fix: Ensure we only pass string to validateField
    const value = typeof form[field] === 'string' ? form[field] : ''
    const error = validateField(field, value)
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }))
    } else {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const isFormValid = useMemo(() => {
    // propertyType must be selected; amenities/features are optional
    const fieldsValid = (Object.keys(DEFAULT_FORM) as (keyof ListingFormState)[])
      .filter(k => !['amenities', 'features'].includes(k as string))
      .every(field => {
        const value = typeof form[field] === 'string' ? form[field] : '';
        return !validateField(field, value);
      });
    return fieldsValid && !!propertyType;
  }, [form, propertyType])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    let isValid = true

    ;(Object.keys(DEFAULT_FORM) as (keyof ListingFormState)[])
      .filter(k => !['amenities', 'features'].includes(k as string))
      .forEach(field => {
        // Ensure we only pass string to validateField
        const value = typeof form[field] === 'string' ? form[field] : '';
        const error = validateField(field, value)
        if (error) {
          newErrors[field] = error
          isValid = false
        }
      })

    if (!propertyType) {
      newErrors.propertyType = 'Property type is required'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  // ----------------
  // Navigation & Storage
  // ----------------
  const goToMediaStep = useCallback(() => {
    if (!validateForm()) return

    const STORAGE_KEY = 'agent:uploadStep1'
    const step1Data = {
      form,
      propertyType,
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(step1Data))
    } catch {
      /* ignore storage errors */
    }
    router.push('/agent/upload/media')
  }, [form, propertyType, router])

  const clearAllData = useCallback(() => {
    // Reset form to default state
    setForm(DEFAULT_FORM)
    setPropertyType('')
    setPropTab('Residential')
    setErrors({})
    
    // Clear session storage
    try {
      sessionStorage.removeItem('agent:uploadStep1')
      sessionStorage.removeItem('agent:uploadStep2')
      sessionStorage.removeItem('agent:uploadStep3')
      sessionStorage.removeItem('agent:reviewDraft')
      sessionStorage.removeItem('agent:editorChanges')
    } catch {
      /* ignore storage errors */
    }
  }, [])

  useEffect(() => {
    try {
      // Check if a listing was recently published
      const wasPublished = sessionStorage.getItem('agent:published')
      if (wasPublished) {
        // Clear all data and start fresh
        sessionStorage.removeItem('agent:uploadStep1')
        sessionStorage.removeItem('agent:uploadStep2')
        sessionStorage.removeItem('agent:uploadStep3')
        sessionStorage.removeItem('agent:reviewDraft')
        sessionStorage.removeItem('agent:editorChanges')
        sessionStorage.removeItem('agent:published')
        return
      }
      
      // Otherwise, restore from sessionStorage
      const raw = sessionStorage.getItem('agent:uploadStep1')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed.form) setForm((prev) => ({ ...prev, ...parsed.form }))
      if (parsed.propertyType) setPropertyType(parsed.propertyType)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!propRef.current) return
      if (!propRef.current.contains(e.target as Node)) setPropTypeOpen(false)
    }
    if (propTypeOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [propTypeOpen])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!bedsRef.current) return
      if (!bedsRef.current.contains(e.target as Node)) setBedsOpen(false)
    }
    if (bedsOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [bedsOpen])
  
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!bathsRef.current) return
      if (!bathsRef.current.contains(e.target as Node)) setBathsOpen(false)
    }
    if (bathsOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [bathsOpen])

  const onDoneBeds = () => {
    const raw = customBeds.trim()
    if (raw) {
      const n = Number(raw)
      // validate and show errors if invalid
      if (!Number.isInteger(n)) {
        setPickerErrors(p => ({ ...p, beds: 'Must be a whole number' }))
        return
      }
      if (n < 9) {
        setPickerErrors(p => ({ ...p, beds: 'Must be 9 or higher' }))
        return
      }
      // if valid, apply the value
      setForm(prev => ({ ...prev, bedrooms: String(n) }))
      setPickerErrors(p => ({ ...p, beds: undefined }))
      setCustomBeds('')
      setBedsOpen(false)
    } else {
      // if empty, just close
      setPickerErrors(p => ({ ...p, beds: undefined }))
      setCustomBeds('')
      setBedsOpen(false)
    }
  }
  
  const onDoneBaths = () => {
    const raw = customBaths.trim()
    if (raw) {
      const n = Number(raw)
      // validate and show errors if invalid
      if (!Number.isInteger(n)) {
        setPickerErrors(p => ({ ...p, baths: 'Must be a whole number' }))
        return
      }
      if (n < 7) {
        setPickerErrors(p => ({ ...p, baths: 'Must be 7 or higher' }))
        return
      }
      // if valid, apply the value
      setForm(prev => ({ ...prev, bathrooms: String(n) }))
      setPickerErrors(p => ({ ...p, baths: undefined }))
      setCustomBaths('')
      setBathsOpen(false)
    } else {
      // if empty, just close
      setPickerErrors(p => ({ ...p, baths: undefined }))
      setCustomBaths('')
      setBathsOpen(false)
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
                    step === 1
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)] text-white'
                      : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] text-muted'
                  }`}
                >
                  {step}
                </div>
                <div className="ml-3 text-sm">
                  <p className={`font-medium ${step === 1 ? 'text-primary' : 'text-muted'}`}>
                    {step === 1 ? 'Property Details' : step === 2 ? 'Media Upload' : 'Review'}
                  </p>
                </div>
                {step < 3 && (
                  <div className={`ml-8 h-px w-16 ${step < 1 ? 'bg-[color:var(--accent-500)]' : 'bg-[color:var(--surface-border)]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1: Traditional Details */}
      <div className="container space-y-8 py-8">
        <header className="space-y-3 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-4 py-2 text-xs uppercase tracking[0.4em] text-muted">
            <DocumentTextIcon className="h-4 w-4" /> Step 1: Property Details
          </div>
          <h2 className="headline text-3xl">Enter property information</h2>
          <p className="mx-auto max-w-2xl text-sm text-muted">
            Provide the essential details such as title, price, address and rooms. Then select applicable amenities & features.
          </p>
        </header>

        {/* Basic Info Section*/}
        <section className="surface-soft space-y-6 p-8 rounded-2xl border border-[color:var(--surface-border)]">
          <h3 className="text-base font-semibold uppercase">Basic Info</h3>

          {/* Title + Price/Currency */}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted">Listing title</span>
              <div className="relative">
                <input
                  required
                  name="title"
                  value={form.title}
                  onChange={handleChange('title')}
                  onBlur={() => handleBlur('title')}
                  className="input h-11 w-full"
                  placeholder="Luxury smart condo"
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-500">{errors.title}</p>
                )}
              </div>
            </label>

            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted">Base price</span>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <div className="relative">
                  <input
                    required
                    type="number"
                    name="basePrice"
                    min="0"
                    step="0.01"
                    value={form.basePrice}
                    onChange={handleChange('basePrice')}
                    onBlur={() => handleBlur('basePrice')}
                    className="input h-11 w-full"
                    placeholder="850000"
                  />
                  {errors.basePrice && (
                    <p className="mt-1 text-xs text-red-500">{errors.basePrice}</p>
                  )}
                </div>
                <select
                  value={form.currency}
                  onChange={handleCurrencyChange}
                  className="input h-11"
                >
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Description */}
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted">Headline description</span>
            <div className="relative">
              <textarea
                rows={3}
                name="description"
                value={form.description}
                onChange={handleChange('description')}
                onBlur={() => handleBlur('description')}
                className="input min-h-[96px] w-full"
                placeholder="Describe the property briefly."
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-500">{errors.description}</p>
              )}
            </div>
          </label>
        </section>

        {/* Address & Location Section*/}
        <section className="surface-soft space-y-6 p-8 rounded-2xl border border-[color:var(--surface-border)]">
          <h3 className="text-base font-semibold uppercase">Address & Location</h3>
          <LocationInput
            address={form.address}
            city={form.city}
            subCity={form.subCity}
            latitude={form.latitude}
            longitude={form.longitude}
            onLocationChange={(coordinates) => {
              if (coordinates) {
                setForm(prev => ({
                  ...prev,
                  latitude: coordinates.latitude,
                  longitude: coordinates.longitude
                }))
              } else {
                setForm(prev => ({
                  ...prev,
                  latitude: null,
                  longitude: null
                }))
              }
            }}
            onAddressChange={(addressData) => {
              setForm(prev => ({
                ...prev,
                address: addressData.address,
                city: addressData.city,
                subCity: addressData.subCity,
                // Clear coordinates so fresh geocode updates them
                latitude: null,
                longitude: null,
              }))
            }}
          />
        </section>

        {/* Property Details Section*/}
        <section className="surface-soft space-y-6 p-8 rounded-2xl border border-[color:var(--surface-border)]">
          <h3 className="text-base font-semibold uppercase">Property Details</h3>

          {/* Property Type (dropdown with Residential/Commercial tabs) */}
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted">Property type</span>

            <div className="relative" ref={propRef}>
              {/* Field button */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setPropTypeOpen((o) => !o)}
                  className={`input h-11 w-full flex items-center justify-between ${
                    errors.propertyType ? 'border-red-500' : ''
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={propTypeOpen}
                >
                  <span className={propertyType ? 'text-primary' : 'text-disabled'}>
                    {propertyType || 'Select property type'}
                  </span>
                  <ChevronDownIcon className="h-5 w-5 text-muted" />
                </button>
                {errors.propertyType && (
                  <p className="mt-1 text-xs text-red-500">{errors.propertyType}</p>
                )}
              </div>

              {/* Dropdown */}
              {propTypeOpen && (
                <div
                  className="absolute z-50 mt-2 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[0_18px_40px_rgba(0,0,0,0.15)]"
                  role="dialog"
                >
                  {/* Tabs header */}
                  <div className="flex items-center justify-between px-4 pt-3">
                    <div className="flex w-full gap-8">
                      <button
                        type="button"
                        onClick={() => setPropTab('Residential')}
                        className={`pb-2 text-sm font-semibold ${
                          propTab === 'Residential' ? 'text-[color:var(--accent-500)]' : 'text-secondary'
                        }`}
                      >
                        Residential
                        <div
                          className={`mt-2 h-[2px] ${
                            propTab === 'Residential' ? 'bg-[color:var(--accent-500)]' : 'bg-transparent'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPropTab('Commercial')}
                        className={`pb-2 text-sm font-semibold ${
                          propTab === 'Commercial' ? 'text-[color:var(--accent-500)]' : 'text-secondary'
                        }`}
                      >
                        Commercial
                        <div
                          className={`mt-2 h-[2px] ${
                            propTab === 'Commercial' ? 'bg-[color:var(--accent-500)]' : 'bg-transparent'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="mx-4 mt-2 h-px bg-[color:var(--surface-border)]/80" />

                  {/* Options grid */}
                  <div className="max-h-[360px] overflow-auto p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(propTab === 'Residential' ? RESIDENTIAL_TYPES : COMMERCIAL_TYPES).map((label) => {
                        const selected = propertyType === label
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              const handlePropertyTypeSelect = (type: string) => {
                                setPropertyType(type)
                                setPropTypeOpen(false)
                                // Clear property type error when a type is selected
                                if (errors.propertyType) {
                                  setErrors(prev => {
                                    const newErrors = { ...prev }
                                    delete newErrors.propertyType
                                    return newErrors
                                  })
                                }
                              }
                              handlePropertyTypeSelect(label)
                            }}
                            className={`flex w-full items-center justify-between rounded-full border px-4 py-3 text-sm transition ${
                              selected
                                ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 text-primary'
                                : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-2)]'
                            }`}
                          >
                            <span className="truncate">{label}</span>
                            <span
                              className={`ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]'
                                  : 'border-[color:var(--surface-border)] bg-transparent'
                              }`}
                            >
                              <span className={`h-2.5 w-2.5 rounded-full ${selected ? 'bg-white' : 'bg-transparent'}`} />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Footer actions (optional: Reset / Done) */}
                  <div className="flex items-center justify-between gap-3 border-t border-[color:var(--surface-border)] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setPropertyType('')}
                      className="btn btn-ghost"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setPropTypeOpen(false)}
                      className="btn btn-primary"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bedrooms / Bathrooms / Area */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Bedrooms */}
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted">Bedrooms</span>

              <div className="relative" ref={bedsRef}>
                {/* Field button */}
                <button
                  type="button"
                  onClick={() => setBedsOpen(o => !o)}
                  className={`input h-11 w-full flex items-center justify-between ${errors.bedrooms ? 'border-red-500' : ''}`}
                  aria-haspopup="listbox"
                  aria-expanded={bedsOpen}
                >
                  <span className={form.bedrooms ? 'text-primary' : 'text-disabled'}>
                    {form.bedrooms || 'Select bedrooms'}
                  </span>
                  <ChevronDownIcon className="h-5 w-5 text-muted" />
                </button>
                {errors.bedrooms && <p className="mt-1 text-xs text-red-500">{errors.bedrooms}</p>}

                {/* Dropdown */}
                {bedsOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[0_18px_40px_rgba(0,0,0,0.15)] p-4">
                    <div className="flex flex-wrap gap-2">
                      {BED_OPTIONS.map(label => {
                        const selected = form.bedrooms === label
                        return (
                           <button
                             key={label}
                             type="button"
                             onClick={(e) => {
                               e.preventDefault()
                               e.stopPropagation()
                               setForm(prev => ({ ...prev, bedrooms: label }))
                               setBedsOpen(false)
                               if (errors.bedrooms) {
                                 setErrors(prev => { const n = { ...prev }; delete n.bedrooms; return n })
                               }
                             }}
                            className={`rounded-full px-4 py-2 text-sm border transition ${
                              selected
                                ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 text-primary'
                                : 'border-[color:var(--surface-border)] text-secondary hover:bg-[color:var(--surface-2)]'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Divider */}
                    <div className="my-3 h-px bg-[color:var(--surface-border)]/80" />

                    {/* Custom 9+ row */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">Custom (9+)</span>
                       <input
                         type="number"
                         min={9}
                         inputMode="numeric"
                         value={customBeds}
                         onChange={(e) => setCustomBeds(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                             e.preventDefault()
                             e.stopPropagation()
                             onDoneBeds()
                           }
                         }}
                         className="input h-9 w-24"
                         placeholder="9"
                       />
                      {pickerErrors.beds && <span className="ml-2 text-xs text-red-500">{pickerErrors.beds}</span>}
                    </div>

                     <div className="mt-3 flex justify-end">
                       <button 
                         type="button" 
                         className="btn btn-primary" 
                         onClick={(e) => {
                           e.preventDefault()
                           e.stopPropagation()
                           onDoneBeds()
                         }}
                         onKeyDown={(e) => { 
                           if (e.key === 'Enter') {
                             e.preventDefault()
                             e.stopPropagation()
                             onDoneBeds()
                           }
                         }}>
                         Done
                       </button>
                     </div>

                  </div>
                )}
              </div>
            </label>
            
            {/* Bathrooms */}
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted">Bathrooms</span>

              <div className="relative" ref={bathsRef}>
                {/* Field button */}
                <button
                  type="button"
                  onClick={() => setBathsOpen(o => !o)}
                  className={`input h-11 w-full flex items-center justify-between ${errors.bathrooms ? 'border-red-500' : ''}`}
                  aria-haspopup="listbox"
                  aria-expanded={bathsOpen}
                >
                  <span className={form.bathrooms ? 'text-primary' : 'text-disabled'}>
                    {form.bathrooms || 'Select bathrooms'}
                  </span>
                  <ChevronDownIcon className="h-5 w-5 text-muted" />
                </button>
                {errors.bathrooms && <p className="mt-1 text-xs text-red-500">{errors.bathrooms}</p>}

                {/* Dropdown */}
                {bathsOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[0_18px_40px_rgba(0,0,0,0.15)] p-4">
                    <div className="flex flex-wrap gap-2">
                      {BATH_OPTIONS.map(label => {
                        const selected = form.bathrooms === label
                        return (
                           <button
                             key={label}
                             type="button"
                             onClick={(e) => {
                               e.preventDefault()
                               e.stopPropagation()
                               setForm(prev => ({ ...prev, bathrooms: label }))
                               setBathsOpen(false)
                               if (errors.bathrooms) {
                                 setErrors(prev => { const n = { ...prev }; delete n.bathrooms; return n })
                               }
                             }}
                            className={`rounded-full px-4 py-2 text-sm border transition ${
                              selected
                                ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10 text-primary'
                                : 'border-[color:var(--surface-border)] text-secondary hover:bg-[color:var(--surface-2)]'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Divider */}
                    <div className="my-3 h-px bg-[color:var(--surface-border)]/80" />

                    {/* Custom 7+ row */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">Custom (7+)</span>
                       <input
                         type="number"
                         min={7}
                         inputMode="numeric"
                         value={customBaths}
                         onChange={(e) => setCustomBaths(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                             e.preventDefault()
                             e.stopPropagation()
                             onDoneBaths()
                           }
                         }}
                         className="input h-9 w-24"
                         placeholder="7"
                       />
                      {pickerErrors.baths && <span className="ml-2 text-xs text-red-500">{pickerErrors.baths}</span>}
                    </div>

                     <div className="mt-3 flex justify-end">
                       <button 
                         type="button" 
                         className="btn btn-primary" 
                         onClick={(e) => {
                           e.preventDefault()
                           e.stopPropagation()
                           onDoneBaths()
                         }}
                         onKeyDown={(e) => { 
                           if (e.key === 'Enter') {
                             e.preventDefault()
                             e.stopPropagation()
                             onDoneBaths()
                           }
                         }}>
                         Done
                       </button>
                     </div>
                  </div>
                )}
              </div>
            </label>

            {/* Area */}
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted">Area (sqm)</span>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  name="areaSqm"
                  value={form.areaSqm}
                  onChange={handleChange('areaSqm')}
                  onBlur={() => handleBlur('areaSqm')}
                  className="input h-11 w-full"
                  placeholder="120"
                />
                {errors.areaSqm && (
                  <p className="mt-1 text-xs text-red-500">{errors.areaSqm}</p>
                )}
              </div>
            </label>
          </div>
        </section>

        {/* Amenities & Features Section*/}
        <section className="surface-soft space-y-6 p-8 rounded-2xl border border-[color:var(--surface-border)]">
          <h3 className="text-base font-semibold uppercase">Amenities & Features</h3>

          {/* Amenities */}
          <div className="space-y-3">
            <p className="text-sm text-muted">Select available amenities</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {AMENITIES.map((a) => {
                const checked = form.amenities.includes(a)
                return (
                  <label 
                    key={a} 
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-all duration-200 ${checked ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10' : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] hover:border-[color:var(--accent-400)] hover:bg-[color:var(--accent-500)]/5'}`}
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="amenities"
                        value={a}
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleInArray('amenities', a)}
                        style={{ 
                          accentColor: 'transparent',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none'
                        }}
                      />
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-200 ${
                        checked 
                          ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]' 
                          : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)]'
                      }`}>
                        {checked && (
                          <span className="h-2.5 w-2.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm">{a}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <p className="text-sm text-muted">Select applicable features</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {FEATURES.map((f) => {
                const checked = form.features.includes(f)
                return (
                  <label 
                    key={f} 
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-all duration-200 ${checked ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/10' : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] hover:border-[color:var(--accent-400)] hover:bg-[color:var(--accent-500)]/5'}`}
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="features"
                        value={f}
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleInArray('features', f)}
                        style={{ 
                          accentColor: 'transparent',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none'
                        }}
                      />
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-200 ${
                        checked 
                          ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]' 
                          : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)]'
                      }`}>
                        {checked && (
                          <span className="h-2.5 w-2.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm">{f}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </section>

        {/* Hidden inputs for header detection of unsaved data */}
        <input type="hidden" name="bedrooms" value={form.bedrooms || ''} readOnly aria-hidden="true" />
        <input type="hidden" name="bathrooms" value={form.bathrooms || ''} readOnly aria-hidden="true" />
        <input type="hidden" name="propertyType" value={propertyType || ''} readOnly aria-hidden="true" />

        {/* Step 1 Navigation */}
        <div className="flex justify-between">
          <button
            type="button"
            className="btn btn-secondary text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={clearAllData}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (isFormValid) {
                goToMediaStep()
              } else {
                // Trigger validation to show errors
                validateForm()
              }
            }}
          >
            Continue
          </button>
        </div>
      </div>

      {/* Warning Modal */}
      <WizardWarningModal
        isOpen={showWarningModal}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
    </div>
  )
}
