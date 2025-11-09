'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  ArrowLeftIcon,
  PhotoIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ShareIcon,
  ArrowsPointingOutIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { formatPrice } from '@/lib/utils'

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

interface AgentProfile {
  id: string
  name: string | null
  email: string
  role: string
  profile: {
    phone: string | null
    jobTitle: string | null
    agencyName: string | null
    avatarUrl: string | null
  }
  listings?: Array<{
    id: string
    title: string
    description?: string | null
    coverImage: string | null
    basePrice: number
    currency: string
    address: string | null
    city: string | null
    subCity?: string | null
    bedrooms: number
    bathrooms: number
    areaSqm: number
  }>
}

export default function PublicAgentProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [agent, setAgent] = useState<AgentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)

  const copyToClipboard = async (text: string, type: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text)
      
      // Show checkmark temporarily
      if (type === 'email') {
        setCopiedEmail(true)
        setTimeout(() => setCopiedEmail(false), 2000)
      } else {
        setCopiedPhone(true)
        setTimeout(() => setCopiedPhone(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  useEffect(() => {
    if (!params.id) return

    const fetchAgentProfile = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/profile/${params.id}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Agent profile not found')
          } else {
            setError('Failed to load agent profile')
          }
          return
        }

        const data = await response.json()
        setAgent(data)
      } catch (err) {
        console.error('Error fetching agent profile:', err)
        setError('Failed to load agent profile')
      } finally {
        setLoading(false)
      }
    }

    fetchAgentProfile()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--app-background)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent-500)] mx-auto"></div>
          <p className="text-lg text-secondary">Loading agent profile...</p>
        </div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-[color:var(--app-background)] flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-2xl font-semibold text-primary mb-4">Profile Not Found</h1>
          <p className="text-secondary mb-6">{error || 'The agent profile you are looking for does not exist.'}</p>
          <Link href="/listings" className="btn btn-primary">
            Browse Listings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-background)]">
      <div className="container py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-secondary hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span>Back to Listing</span>
        </button>

        <div className="max-w-5xl mx-auto">
          {/* Profile Header Card */}
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8 shadow-lg mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Avatar */}
              <div className="h-24 w-24 rounded-full bg-[color:var(--surface-2)] overflow-hidden flex items-center justify-center flex-shrink-0">
                {agent.profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agent.profile.avatarUrl}
                    alt={agent.name || 'Agent'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-secondary">
                    {(agent.name || 'Agent').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Name and Title */}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-semibold text-primary mb-2">
                  {agent.name || 'Agent'}
                </h1>
                {agent.profile.jobTitle && (
                  <div className="flex items-center gap-2 text-secondary mb-1">
                    <BriefcaseIcon className="h-5 w-5" />
                    <span>{agent.profile.jobTitle}</span>
                  </div>
                )}
                {agent.profile.agencyName && (
                  <div className="flex items-center gap-2 text-secondary">
                    <BuildingOfficeIcon className="h-5 w-5" />
                    <span>{agent.profile.agencyName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information Card */}
          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8 shadow-lg mb-6">
            <h2 className="text-2xl font-semibold text-primary mb-6">Contact Information</h2>
            
            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[color:var(--surface-0)] border border-[color:var(--surface-border)]">
                <div className="flex-shrink-0">
                  <EnvelopeIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Email</div>
                  <a
                    href={`mailto:${agent.email}`}
                    className="text-primary font-medium hover:text-[color:var(--accent-500)] transition-colors break-all"
                  >
                    {agent.email}
                  </a>
                </div>
                <button
                  onClick={() => !copiedEmail && copyToClipboard(agent.email, 'email')}
                  disabled={copiedEmail}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    copiedEmail 
                      ? 'cursor-not-allowed opacity-60' 
                      : 'hover:bg-[color:var(--surface-1)] hover:shadow-md active:scale-95'
                  }`}
                  title="Copy email"
                >
                  <motion.div
                    whileHover={{ scale: copiedEmail ? 1 : 1.1 }}
                    whileTap={{ scale: copiedEmail ? 1 : 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    {copiedEmail ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <ClipboardIcon className="h-5 w-5 text-secondary group-hover:text-[color:var(--accent-500)] transition-colors duration-200" />
                    )}
                  </motion.div>
                  <span className={`text-sm transition-colors duration-200 font-medium ${
                    copiedEmail 
                      ? 'text-green-600' 
                      : 'text-secondary group-hover:text-[color:var(--accent-500)]'
                  }`}>
                    {copiedEmail ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              </div>

              {/* Phone */}
              {agent.profile.phone && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-[color:var(--surface-0)] border border-[color:var(--surface-border)]">
                  <div className="flex-shrink-0">
                    <PhoneIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Phone</div>
                    <a
                      href={`tel:${agent.profile.phone}`}
                      className="text-primary font-medium hover:text-[color:var(--accent-500)] transition-colors"
                    >
                      {agent.profile.phone}
                    </a>
                  </div>
                  <button
                    onClick={() => !copiedPhone && copyToClipboard(agent.profile.phone!, 'phone')}
                    disabled={copiedPhone}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      copiedPhone 
                        ? 'cursor-not-allowed opacity-60' 
                        : 'hover:bg-[color:var(--surface-1)] hover:shadow-md active:scale-95'
                    }`}
                    title="Copy phone number"
                  >
                    <motion.div
                      whileHover={{ scale: copiedPhone ? 1 : 1.1 }}
                      whileTap={{ scale: copiedPhone ? 1 : 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      {copiedPhone ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      ) : (
                        <ClipboardIcon className="h-5 w-5 text-secondary group-hover:text-[color:var(--accent-500)] transition-colors duration-200" />
                      )}
                    </motion.div>
                    <span className={`text-sm transition-colors duration-200 font-medium ${
                      copiedPhone 
                        ? 'text-green-600' 
                        : 'text-secondary group-hover:text-[color:var(--accent-500)]'
                    }`}>
                      {copiedPhone ? 'Copied!' : 'Copy'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Contact Buttons */}
            {agent.profile.phone && (
              <div className="mt-6 pt-6 border-t border-[color:var(--surface-border)]">
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`tel:${agent.profile.phone}`}
                    className="btn btn-primary flex-1 justify-center gap-2"
                  >
                    <PhoneIcon className="h-5 w-5" />
                    Call Agent
                  </a>
                  <a
                    href={`https://t.me/+${agent.profile.phone.replace(/^\+/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn flex-1 justify-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700"
                  >
                    <TelegramIcon className="h-5 w-5 text-blue-500" />
                    Telegram
                  </a>
                  <a
                    href={`https://wa.me/${agent.profile.phone.replace(/^\+/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn flex-1 justify-center gap-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700"
                  >
                    <WhatsAppIcon className="h-5 w-5 text-green-500" />
                    WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Agent's Listings */}
          {agent.listings && agent.listings.length > 0 && (
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8 shadow-lg">
              <h2 className="text-2xl font-semibold text-primary mb-6">
                Listings by {agent.name || 'Agent'} ({agent.listings.length})
              </h2>
              
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {agent.listings.map((listing, index) => {
                  const imageSrc = listing.coverImage
                    ? `/api/files/binary?path=${encodeURIComponent(listing.coverImage)}&listingId=${encodeURIComponent(listing.id)}`
                    : null

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
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 p-6">
                          {/* Title and Location */}
                          <div className="mb-4">
                            <h3 className="text-xl font-semibold text-gray-900 group-hover:text-[color:var(--brand-600)] transition-colors mb-2">
                              {listing.title}
                            </h3>
                            
                            {/* Agency Name - Prominent Display */}
                            {agent.profile.agencyName && (
                              <div className="mb-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[color:var(--brand-50)] border border-[color:var(--brand-200)]">
                                  <svg className="h-5 w-5 text-[color:var(--brand-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  <span className="text-base font-semibold text-[color:var(--brand-700)]">
                                    {agent.profile.agencyName}
                                  </span>
                                </div>
                              </div>
                            )}
                            
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
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

