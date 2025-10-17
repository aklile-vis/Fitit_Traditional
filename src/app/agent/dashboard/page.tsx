'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  PlusIcon,
  BuildingOfficeIcon,
  DocumentArrowUpIcon,
  EyeIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
  CheckBadgeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

import { useAuth } from '@/contexts/AuthContext'

type UploadRecord = {
  id: string
  projectName: string
  client: string
  uploadedAt: string
  fileFormat: string
  status: 'processing' | 'qa' | 'ready'
  progress: number
}

type PublishedListing = {
  id: string
  title: string
  address: string
  updatedAt: string
  price: string
  currency: string
  badge: 'Live' | 'Featured' | 'Demo'
}

type ActivityItem = {
  id: string
  timestamp: string
  message: string
  category: 'upload' | 'listing' | 'ai' | 'team'
}

export default function AgentDashboard() {
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [listings, setListings] = useState<PublishedListing[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()

  const isAgent = useMemo(() => user?.role === 'AGENT' || user?.role === 'ADMIN', [user?.role])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated || !isAgent) {
      router.replace('/agent/login')
      return
    }

    // TODO: replace with real API integrations
    setUploads([
      {
        id: 'upl-90431',
        projectName: 'Marina Gate Penthouses',
        client: 'Harbour Capital Developments',
        uploadedAt: 'Mar 04, 2025',
        fileFormat: 'RVT 2024',
        status: 'processing',
        progress: 72,
      },
      {
        id: 'upl-90398',
        projectName: 'Palm Collection Villas',
        client: 'Aurora Estates',
        uploadedAt: 'Mar 01, 2025',
        fileFormat: 'IFC (2x3)',
        status: 'qa',
        progress: 38,
      },
      {
        id: 'upl-90312',
        projectName: 'Skyline Residences Tower B',
        client: 'Meridian Properties',
        uploadedAt: 'Feb 26, 2025',
        fileFormat: 'DWG Package',
        status: 'ready',
        progress: 100,
      },
      {
        id: 'upl-90244',
        projectName: 'Beachfront Lofts – Phase 2',
        client: 'Latitude Studio',
        uploadedAt: 'Feb 23, 2025',
        fileFormat: 'GLB (4K bake)',
        status: 'ready',
        progress: 100,
      },
    ])

    setListings([
      {
        id: 'lst-7712',
        title: 'Azure Residences — Sky Suite 1803',
        address: 'Palm West Crescent, Dubai',
        updatedAt: 'Published 2 days ago',
        price: '4.85M',
        currency: 'AED',
        badge: 'Live',
      },
      {
        id: 'lst-7701',
        title: 'Orchid Creek Villas — Plot 11',
        address: 'Creekside, Doha',
        updatedAt: 'Updated 5 days ago',
        price: '2.15M',
        currency: 'QAR',
        badge: 'Featured',
      },
      {
        id: 'lst-7688',
        title: 'The Observatory — Duplex 27C',
        address: 'Financial District, Riyadh',
        updatedAt: 'Demo shared last week',
        price: '3.40M',
        currency: 'SAR',
        badge: 'Demo',
      },
    ])

    setActivity([
      {
        id: 'act-1',
        timestamp: 'Mar 04 • 10:12 AM',
        message: 'AI finishes suggested for “Marina Gate Penthouses” — 18 surfaces auto-mapped.',
        category: 'ai',
      },
      {
        id: 'act-2',
        timestamp: 'Mar 03 • 04:46 PM',
        message: 'Sarah Malik approved the buyer-ready catalog for “Palm Collection Villas”.',
        category: 'team',
      },
      {
        id: 'act-3',
        timestamp: 'Mar 01 • 09:30 AM',
        message: 'Published “Azure Residences — Sky Suite 1803” to the live marketplace.',
        category: 'listing',
      },
      {
        id: 'act-4',
        timestamp: 'Feb 28 • 02:05 PM',
        message: 'Uploaded GLB bundle for “Beachfront Lofts – Phase 2”. Assets optimised for 4K renders.',
        category: 'upload',
      },
    ])

    setIsLoading(false)
  }, [authLoading, isAuthenticated, isAgent, router])

  const handleLogout = () => {
    logout()
    router.push('/agent/login')
  }

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[color:var(--accent-500)]" />
      </div>
    )
  }

  if (!isAuthenticated || !isAgent) {
    return null
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-background)]">
      <header className="surface-header border-b border-surface">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-full bg-gradient-to-br from-[color:var(--sand-400)] to-[color:var(--sand-600)] p-2 text-overlay shadow-[var(--shadow-soft)]">
                <BuildingOfficeIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">Agent Portal</h1>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">EstatePro Studio</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button className="rounded-full border border-surface bg-surface-1 p-2 text-secondary transition-colors hover:border-surface-strong hover:bg-surface-hover hover:text-primary">
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="rounded-full border border-surface bg-surface-1 p-2 text-secondary transition-colors hover:border-surface-strong hover:bg-surface-hover hover:text-primary"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="surface-soft p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Active uploads</p>
                <p className="text-2xl font-bold text-primary">{uploads.length}</p>
              </div>
              <BuildingOfficeIcon className="h-8 w-8 text-[color:var(--accent-500)]" />
            </div>
            <p className="mt-3 text-xs text-muted">{uploads.filter((u) => u.status === 'ready').length} ready for publishing this week</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="surface-soft p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Published listings</p>
                <p className="text-2xl font-bold text-primary">{listings.length}</p>
              </div>
              <EyeIcon className="h-8 w-8 text-[color:var(--success-500)]" />
            </div>
            <p className="mt-3 text-xs text-muted">Live experiences visible to buyers</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="surface-soft p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Processing queue</p>
                <p className="text-2xl font-bold text-primary">{uploads.filter((u) => u.status === 'processing').length}</p>
              </div>
              <ClockIcon className="h-8 w-8 text-[color:var(--warning-500)]" />
            </div>
            <p className="mt-3 text-xs text-muted">AI enrichment & optimisation running</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="surface-soft p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">AI assist sessions</p>
                <p className="text-2xl font-bold text-primary">7</p>
              </div>
              <SparklesIcon className="h-8 w-8 text-[color:var(--accent-500)]" />
            </div>
            <p className="mt-3 text-xs text-muted">Material proposals delivered this month</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8 flex"
        >
          <button
            onClick={() => router.push('/agent/upload')}
            className="btn btn-primary flex w-full items-center justify-center gap-2 md:w-auto"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Upload new model</span>
          </button>
        </motion.div>

        <section className="mb-8 rounded-3xl border border-surface bg-surface-0 p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Active production queue</h2>
              <p className="text-sm text-muted">Track optimisation status and next steps for each model.</p>
            </div>
            <button className="btn btn-primary text-sm" onClick={() => router.push('/agent/upload')}>
              <PlusIcon className="h-4 w-4" />
              Upload new model
            </button>
          </div>
          <div className="space-y-3">
            {uploads.map((record) => (
              <div key={record.id} className="flex flex-col gap-4 rounded-2xl border border-surface bg-surface-0 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-2)] px-2 py-1 text-[11px] uppercase tracking-wide text-muted">{record.fileFormat}</span>
                    <span className="text-xs text-muted">{record.uploadedAt}</span>
                  </div>
                  <div className="text-base font-semibold text-primary">{record.projectName}</div>
                  <div className="text-xs text-muted">Client: {record.client}</div>
                </div>
                <div className="flex items-center gap-4 sm:min-w-[240px]">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      record.status === 'ready'
                        ? 'border-[color:var(--success-500)]/40 bg-[color:var(--success-500)]/12 text-[color:var(--success-500)]'
                        : record.status === 'processing'
                        ? 'border-[color:var(--warning-500)]/40 bg-[color:var(--warning-500)]/12 text-[color:var(--warning-500)]'
                        : 'border-[color:var(--accent-500)]/35 bg-[color:var(--accent-500)]/12 text-[color:var(--accent-500)]'
                    }`}
                  >
                    {record.status === 'ready' ? 'QA complete' : record.status === 'processing' ? 'Enriching' : 'QA review'}
                  </span>
                  <div className="min-w-[140px]">
                    <div className="text-right text-xs text-muted">{record.progress}%</div>
                    <div className="mt-1 h-2 rounded-full bg-surface">
                      <div className="h-full rounded-full bg-[color:var(--accent-500)]" style={{ width: `${record.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-surface bg-surface-0 p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Live marketplace inventory</h2>
              <p className="text-sm text-muted">Recently published listings and demo experiences.</p>
            </div>
            <button className="btn btn-secondary text-sm" onClick={() => router.push('/agent/units')}>
              Manage units
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {listings.map((listing) => (
              <div key={listing.id} className="rounded-2xl border border-surface bg-surface-0 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      listing.badge === 'Live'
                        ? 'border-[color:var(--success-500)]/40 bg-[color:var(--success-500)]/12 text-[color:var(--success-500)]'
                        : listing.badge === 'Featured'
                        ? 'border-[color:var(--accent-500)]/40 bg-[color:var(--accent-500)]/12 text-[color:var(--accent-500)]'
                        : 'border-surface bg-surface-2 text-muted'
                    }`}
                  >
                    <CheckBadgeIcon className="h-4 w-4" />
                    {listing.badge}
                  </span>
                  <span className="text-xs text-muted">{listing.updatedAt}</span>
                </div>
                <div className="mt-3 text-base font-semibold text-primary">{listing.title}</div>
                <div className="text-sm text-muted">{listing.address}</div>
                <div className="mt-4 flex items-baseline gap-1 text-primary">
                  <span className="text-2xl font-bold">{listing.price}</span>
                  <span className="text-sm text-muted">{listing.currency}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="btn btn-secondary flex-1 text-xs" onClick={() => router.push('/agent/units')}>
                    View unit
                  </button>
                  <button className="btn btn-secondary flex-1 text-xs" onClick={() => router.push(`/listings/${listing.id}`)}>
                    Launch tour
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-surface bg-surface-0 p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Studio activity</h2>
              <p className="text-sm text-muted">Latest uploads, approvals, and AI assist events.</p>
            </div>
            <button className="btn btn-secondary text-sm" onClick={() => router.push('/agent/units')}>
              View all updates
            </button>
          </div>
          <div className="space-y-3">
            {activity.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-surface bg-surface-0 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 h-2 w-2 rounded-full ${
                      item.category === 'upload'
                        ? 'bg-[color:var(--accent-500)]'
                        : item.category === 'listing'
                        ? 'bg-[color:var(--success-500)]'
                        : item.category === 'ai'
                        ? 'bg-[color:var(--warning-500)]'
                        : 'bg-[color:var(--sand-500)]'
                    }`}
                  />
                  <div>
                    <div className="text-sm text-primary">{item.message}</div>
                    <div className="text-[11px] text-muted">{item.timestamp}</div>
                  </div>
                </div>
                <button className="btn btn-secondary text-xs">View details</button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-surface bg-surface-0 p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Quick actions</h2>
            <DocumentArrowUpIcon className="h-6 w-6 text-[color:var(--accent-500)]" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <button className="surface-soft flex flex-col gap-2 rounded-2xl p-5 text-left transition hover:translate-y-[-2px]">
              <span className="text-sm font-semibold text-primary">Invite designer</span>
              <p className="text-xs text-muted">Share workspace access so collaborators can upload and review materials.</p>
            </button>
            <button className="surface-soft flex flex-col gap-2 rounded-2xl p-5 text-left transition hover:translate-y-[-2px]">
              <span className="text-sm font-semibold text-primary">Schedule buyer demo</span>
              <p className="text-xs text-muted">Generate a branded walkthrough link for prospective buyers.</p>
            </button>
            <button className="surface-soft flex flex-col gap-2 rounded-2xl p-5 text-left transition hover:translate-y-[-2px]">
              <span className="text-sm font-semibold text-primary">Launch AI finishes</span>
              <p className="text-xs text-muted">Run material proposals across the active queue to accelerate QA.</p>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
