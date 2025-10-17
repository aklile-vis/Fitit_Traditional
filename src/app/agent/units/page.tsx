"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { formatPrice } from '@/lib/utils'

type ListingSummary = {
  id: string
  title: string | null
  isPublished: boolean
  basePrice: number | null
  currency?: string | null
}

type UnitSummary = {
  id: string
  name: string
  file: { id: string; glbPath?: string | null; ifcPath?: string | null } | null
  listing: ListingSummary | null
}

type UnitStage = 'awaiting-processing' | 'ready-to-publish' | 'draft-listing' | 'published'

function stageOf(unit: UnitSummary): UnitStage {
  if (!unit.file?.glbPath) return 'awaiting-processing'
  if (unit.listing?.isPublished) return 'published'
  if (unit.listing) return 'draft-listing'
  return 'ready-to-publish'
}

const ORDER: UnitStage[] = ['awaiting-processing', 'ready-to-publish', 'draft-listing', 'published']

const STAGE_META: Record<UnitStage, { title: string; subtitle: string }> = {
  'awaiting-processing': {
    title: 'Processing queue',
    subtitle: 'Units that still need topology/GLB output before they can be listed.',
  },
  'ready-to-publish': {
    title: 'Ready to publish',
    subtitle: 'Models are processed. Capture buyer-facing details to publish.',
  },
  'draft-listing': {
    title: 'Draft listings',
    subtitle: 'Listings have saved details but are not yet published.',
  },
  published: {
    title: 'Published',
    subtitle: 'Live listings visible to buyers.',
  },
}

export default function AgentUnitsIndex() {
  const [units, setUnits] = useState<UnitSummary[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setStatus('Loading units…')
      const response = await fetch('/api/units', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        setStatus(payload?.error || 'Failed to load units')
        setLoading(false)
        return
      }
      setUnits(payload)
      setStatus('')
      setLoading(false)
    }
    load()
  }, [])

  const filteredUnits = useMemo(() => units.filter((unit) => Boolean(unit.file?.glbPath)), [units])

  const grouped = useMemo(() => {
    const buckets: Record<UnitStage, UnitSummary[]> = {
      'awaiting-processing': [],
      'ready-to-publish': [],
      'draft-listing': [],
      published: [],
    }
    filteredUnits.forEach((unit) => {
      buckets[stageOf(unit)].push(unit)
    })
    return buckets
  }, [filteredUnits])

  return (
    <div className="min-h-screen bg-[#f7f1e8] p-6 text-[#2f2013]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Units overview</h1>
            <p className="text-sm text-[#7b6652]">
              Track processing progress, finish draft listings, and publish when everything looks right.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/agent/upload" className="btn btn-primary">
              Upload design file
            </Link>
            <Link href="/agent/unified-upload" className="btn btn-secondary">
              Unified ingest
            </Link>
          </div>
        </div>

        {status && <div className="rounded-2xl border border-[#d9c6b5] bg-[#fefbf7] px-4 py-3 text-sm text-[#7b6652] shadow-[0_12px_30px_rgba(59,42,28,0.08)]">{status}</div>}

        {ORDER.map((stage) => {
          const items = grouped[stage]
          if (!items.length) return null
          const meta = STAGE_META[stage]
          return (
            <section key={stage} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{meta.title}</h2>
                  <p className="text-xs text-[#7b6652]">{meta.subtitle}</p>
                </div>
                <span className="rounded-full border border-[#d9c6b5] bg-[#fdf7f0] px-3 py-1 text-xs text-[#7b6652]">
                  {items.length} {items.length === 1 ? 'unit' : 'units'}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {items.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} stage={stage} />
                ))}
              </div>
            </section>
          )
        })}

        {!loading && !filteredUnits.length && !status && (
          <div className="rounded-3xl border border-[#d9c6b5] bg-[#fdf7f0] p-6 text-sm text-[#7b6652] shadow-[0_12px_30px_rgba(59,42,28,0.08)]">
            Upload a CAD/IFC file to begin processing your first unit.
          </div>
        )}
      </div>
    </div>
  )
}

function UnitCard({ unit, stage }: { unit: UnitSummary; stage: UnitStage }) {
  const hasGlb = Boolean(unit.file?.glbPath)
  const hasIfc = Boolean(unit.file?.ifcPath)
  const stageLabel = {
    'awaiting-processing': 'Processing',
    'ready-to-publish': 'Ready',
    'draft-listing': 'Draft',
    published: 'Published',
  }[stage]

  const stageTone = {
    'awaiting-processing': 'bg-[#f2e1cf] text-[#8a5a32] border-[#d9c6b5]',
    'ready-to-publish': 'bg-[#e6f0e6] text-[#3a7a3a] border-[#c0d6c0]',
    'draft-listing': 'bg-[#f7e9f0] text-[#8a5170] border-[#e5cfda]',
    published: 'bg-[#e6f3ef] text-[#2f6f54] border-[#c0d9cc]',
  }[stage]

  const listingLabel = unit.listing?.title || unit.name
  const basePriceEtb = typeof unit.listing?.basePrice === 'number' ? unit.listing.basePrice : 0
  const preferredCurrency = unit.listing?.currency?.toUpperCase?.() || 'ETB'
  const displayPrice = basePriceEtb > 0
    ? `${formatPrice(basePriceEtb, 'ETB')} · preferred: ${preferredCurrency}`
    : '—'

  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#d9c6b5] bg-[#fefbf7] p-4 shadow-[0_20px_45px_rgba(59,42,28,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-[#2f2013]">{unit.name}</div>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-[#a08a78]">
            <span>{hasGlb ? 'GLB ready' : 'GLB missing'}</span>
            <span>•</span>
            <span>{hasIfc ? 'IFC ready' : 'IFC missing'}</span>
            <span>•</span>
            <span>{unit.listing?.isPublished ? 'Live' : unit.listing ? 'Draft listing' : 'No listing'}</span>
          </div>
          {unit.listing && (
            <div className="text-xs text-[#7b6652]">
              {listingLabel} • {displayPrice}
            </div>
          )}
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${stageTone}`}>{stageLabel}</span>
      </div>

  <div className="flex flex-wrap gap-2">
    <Link href={`/agent/editor/${unit.id}`} className="btn btn-secondary text-xs">
      Editor
    </Link>
    <Link href={`/agent/units/${unit.id}/materials`} className="btn btn-secondary text-xs">
      Materials
    </Link>
    <Link href={`/agent/ifc-viewer?unitId=${encodeURIComponent(unit.id)}`} className="btn btn-secondary text-xs">
      IFC Viewer
    </Link>
    {hasGlb && (
      <Link href={`/agent/glb-viewer?unitId=${encodeURIComponent(unit.id)}`} className="btn btn-secondary text-xs">
            3D preview
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[#e9d9c8] pt-3 text-xs text-[#2f2013]">
        {stage !== 'published' && hasGlb && (
          <Link href={`/agent/units/${encodeURIComponent(unit.id)}/publish`} className="btn btn-primary text-xs">
            {unit.listing ? 'Review & publish' : 'Create listing'}
          </Link>
        )}
        {unit.listing?.isPublished && (
          <Link href={`/listings/${encodeURIComponent(unit.listing.id)}`} className="btn btn-secondary text-xs" target="_blank">
            View public listing
          </Link>
        )}
      </div>
    </div>
  )
}
