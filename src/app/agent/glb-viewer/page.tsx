'use client'

import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CubeIcon,
  DocumentIcon,
  RocketLaunchIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { GLBViewerCanvas, GLBViewerHandle } from '@/components/agent/GLBViewer'

interface ArtifactResolution {
  url: string
  label: string
  meta?: Record<string, unknown>
}

function normalizeAssetUrl(raw: string, opts?: { listingId?: string | null }) {
  const decoded = decodeURIComponent(raw)
  if (decoded.startsWith('/api/')) return decoded
  if (/^https?:/i.test(decoded)) return decoded
  const params = new URLSearchParams({ path: decoded })
  if (opts?.listingId) params.set('listingId', opts.listingId)
  return `/api/files/binary?${params.toString()}`
}

async function resolveGlb({
  src,
  fileId,
  unitId,
  listingId,
}: {
  src: string | null
  fileId: string | null
  unitId: string | null
  listingId: string | null
}): Promise<ArtifactResolution | null> {
  if (src) {
    return { url: normalizeAssetUrl(src, { listingId }), label: 'Direct asset' }
  }

  if (fileId) {
    return { url: `/api/files/${encodeURIComponent(fileId)}?type=glb`, label: `FileUpload ${fileId}` }
  }

  if (unitId) {
    const res = await fetch(`/api/units/${encodeURIComponent(unitId)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const glbPath: string | null = data?.file?.glbPath || null
    if (!glbPath) return null
    return {
      url: normalizeAssetUrl(glbPath),
      label: data?.name ? `Unit • ${data.name}` : 'Property unit',
      meta: { listing: data?.listing, counts: data?.counts },
    }
  }

  if (listingId) {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const glbPath: string | null = data?.unit?.file?.glbPath || null
    if (!glbPath) return null
    return {
      url: normalizeAssetUrl(glbPath, { listingId }),
      label: data?.listing?.title ? `Listing • ${data.listing.title}` : 'Listing asset',
      meta: { listing: data?.listing, unit: data?.unit },
    }
  }

  return null
}

export default function AgentGLBViewerPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [resolution, setResolution] = useState<ArtifactResolution | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const viewerRef = useRef<GLBViewerHandle>(null)

  const query = useMemo(
    () => ({
      src: params.get('src'),
      fileId: params.get('fileId'),
      unitId: params.get('unitId'),
      listingId: params.get('listingId'),
    }),
    [params],
  )

  const handleResetView = () => {
    viewerRef.current?.resetView()
  }

  const handlePublishClick = () => {
    if (query.unitId) {
      router.push(`/agent/units/${encodeURIComponent(query.unitId)}/publish`)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    resolveGlb(query)
      .then((res) => {
        if (!active) return
        if (!res) {
          setError('No GLB asset could be resolved from the provided parameters.')
        }
        setResolution(res)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError((e as Error)?.message || 'Unable to resolve GLB asset')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query])

  const glbUrl = resolution?.url

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary">
      <header className="surface-header border-b border-surface">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-full border border-surface bg-surface-1 p-2 text-secondary transition hover:border-surface-strong hover:bg-surface-hover hover:text-primary"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
                <CubeIcon className="h-4 w-4" /> 3D Model Viewer
              </div>
              <div className="text-sm font-semibold text-primary">
                {resolution?.label || 'Select a processed unit' }
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {glbUrl && (
              <>
                <Link
                  href={glbUrl}
                  target="_blank"
                  className="btn btn-secondary hidden sm:inline-flex"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  Open raw GLB
                </Link>
                <button
                  type="button"
                  onClick={handleResetView}
                  className="btn btn-secondary hidden sm:inline-flex"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Return to default view
                </button>
              </>
            )}
            {query.unitId && (
              <button
                type="button"
                onClick={handlePublishClick}
                className="btn btn-primary hidden sm:inline-flex"
              >
                <RocketLaunchIcon className="h-4 w-4" />
                Publish listing
              </button>
            )}
            <Link href="/agent/units" className="btn btn-secondary">
              Back to units
            </Link>
          </div>
        </div>
      </header>

      <main className="container grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative min-h-[60vh] overflow-hidden rounded-3xl border border-surface bg-surface-1 shadow-[var(--shadow-soft-raised)]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-full border border-overlay bg-[color:var(--overlay-900)] px-6 py-3 text-sm text-overlay">
                Resolving asset…
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="max-w-md rounded-2xl border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 px-6 py-4 text-center text-sm text-secondary">
                {error}
              </div>
            </div>
          )}
          {glbUrl && !loading && !error && <GLBViewerCanvas ref={viewerRef} url={glbUrl} />}
        </section>

        <aside className="space-y-4">
          <div className="surface-soft space-y-4 p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-secondary">Model metadata</div>
            {resolution?.meta ? (
              <pre className="max-h-60 overflow-auto rounded-2xl border border-surface bg-surface-1 p-3 text-xs text-secondary">
                {JSON.stringify(resolution.meta, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted">
                Provide `unitId`, `listingId`, or `fileId` in the URL to load the processed GLB. Metadata will appear here
                when available.
              </p>
            )}
          </div>

          <div className="surface-soft space-y-3 p-5 text-sm text-muted">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-secondary">
              <DocumentIcon className="h-4 w-4" /> Quick links
            </div>
            <p>
              Need the IFC counterpart? Open the same artifact in the IFC viewer by passing the identical query parameters to
              <code className="mx-1 rounded bg-surface-2 px-1 text-primary">/agent/ifc-viewer</code>.
            </p>
            {query.unitId && (
              <p className="rounded-lg border border-surface bg-surface-1 p-3 text-xs text-secondary">
                Ready for buyers? Use the <strong>Publish listing</strong> action to capture pricing, bedrooms, and other
                essentials before the unit goes live.
              </p>
            )}
            {glbUrl && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <ShareIcon className="h-4 w-4" /> Copy or bookmark this page to revisit the asset.
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
