"use client"

import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

interface ArtifactResolution {
  url: string
  label: string
}

function normalizeAssetUrl(raw: string, opts?: { listingId?: string | null }) {
  const decoded = decodeURIComponent(raw)
  if (decoded.startsWith('/api/')) return decoded
  if (/^https?:/i.test(decoded)) return decoded
  const params = new URLSearchParams({ path: decoded })
  if (opts?.listingId) params.set('listingId', opts.listingId)
  return `/api/files/binary?${params.toString()}`
}

type ViewerModule = { IFCViewerAPI: new (...args: unknown[]) => ViewerApi }

type ViewerApi = {
  IFC: {
    setWasmPath: (path: string) => Promise<void>
    loadIfcUrl: (url: string) => Promise<void>
  }
  context: {
    renderer: {
      postProduction: {
        active: boolean
        customEffects: { ssao: { enabled: boolean } }
      }
    }
  }
  axes: { setAxes: () => void }
  grid: { setGrid: (size: number, divisions: number) => void }
  dispose: () => void
}

declare global {
  interface Window {
    __ifcViewer?: ViewerApi | null
  }
}

async function resolveIfc({
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
  if (src) return { url: normalizeAssetUrl(src, { listingId }), label: 'Direct IFC asset' }
  if (fileId) return { url: `/api/files/${encodeURIComponent(fileId)}?type=ifc`, label: `FileUpload ${fileId}` }
  if (unitId) {
    const res = await fetch(`/api/units/${encodeURIComponent(unitId)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const path: string | null = data?.file?.ifcPath || null
    if (!path) return null
    return {
      url: normalizeAssetUrl(path),
      label: data?.name ? `Unit • ${data.name}` : 'Property unit',
    }
  }
  if (listingId) {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const path: string | null = data?.unit?.file?.ifcPath || null
    if (!path) return null
    return {
      url: normalizeAssetUrl(path, { listingId }),
      label: data?.listing?.title ? `Listing • ${data.listing.title}` : 'Listing asset',
    }
  }
  return null
}

async function loadViewerModule(): Promise<ViewerModule> {
  const sources = [
    '/libs/web-ifc-viewer/ifc-viewer-api.js',
    '/libs/web-ifc-viewer/index.js',
    'https://cdn.jsdelivr.net/npm/web-ifc-viewer@1/dist/ifc-viewer-api.js',
  ]
  let lastError: unknown
  for (const src of sources) {
    try {
      const mod = await import(/* webpackIgnore: true */ src)
      if (mod && 'IFCViewerAPI' in mod) {
        return mod as ViewerModule
      }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Unable to load IFC viewer module')
}

export default function IFCViewerPage() {
  const router = useRouter()
  const params = useSearchParams()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [resolution, setResolution] = useState<ArtifactResolution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const query = useMemo(
    () => ({
      src: params.get('src'),
      fileId: params.get('fileId'),
      unitId: params.get('unitId'),
      listingId: params.get('listingId'),
    }),
    [params],
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    resolveIfc(query)
      .then((res) => {
        if (!active) return
        if (!res) {
          setError('No IFC asset could be resolved from the provided parameters.')
        }
        setResolution(res || null)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError((e as Error)?.message || 'Unable to resolve IFC asset')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query])

  useEffect(() => {
    let disposed = false
    const mountViewer = async () => {
      if (!resolution?.url || !containerRef.current) return
      const container = containerRef.current
      container.innerHTML = ''

      try {
        const THREE = (await import('three')) as typeof import('three')
        const { IFCViewerAPI } = await loadViewerModule()

        if (disposed) return

        const viewer = new IFCViewerAPI({
          container,
          backgroundColor: new THREE.Color(0x050816),
        }) as ViewerApi
        viewer.context.renderer.postProduction.active = true

        const wasmCandidates = ['/wasm/', 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.44/']
        let loaded = false
        let lastError: unknown
        for (const base of wasmCandidates) {
          try {
            await viewer.IFC.setWasmPath(base)
            await viewer.IFC.loadIfcUrl(resolution.url)
            loaded = true
            break
          } catch (err) {
            lastError = err
          }
        }

        if (!loaded) {
          throw lastError || new Error('Failed to load IFC using available wasm paths')
        }

        if (disposed) {
          viewer.dispose()
          return
        }

        viewer.axes.setAxes()
        viewer.grid.setGrid(50, 50)
        viewer.context.renderer.postProduction.customEffects.ssao.enabled = true
        window.__ifcViewer = viewer
      } catch (err) {
        console.error('IFC viewer failed', err)
        if (!disposed) {
          setError('Failed to initialise IFC viewer. Copy `web-ifc-viewer` dist files into `/public/libs/web-ifc-viewer/` and `web-ifc.wasm` into `/public/wasm/`, or allow access to the CDN fallback.')
        }
      }
    }

    mountViewer()
    return () => {
      disposed = true
      const current = window.__ifcViewer
      if (current && typeof current.dispose === 'function') {
        try {
          current.dispose()
        } catch {}
        window.__ifcViewer = null
      }
    }
  }, [resolution?.url])

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
                <DocumentTextIcon className="h-4 w-4" /> IFC Viewer
              </div>
              <div className="text-sm font-semibold text-primary">
                {resolution?.label || 'Provide src= / fileId= / unitId='}
              </div>
            </div>
          </div>
          <Link href="/agent/units" className="btn btn-secondary">
            Back to units
          </Link>
        </div>
      </header>

      <main className="container py-6">
        <div className="relative min-h-[70vh] overflow-hidden rounded-3xl border border-surface bg-surface-1 shadow-[var(--shadow-soft-raised)]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-full border border-overlay bg-[color:var(--overlay-900)] px-6 py-3 text-sm text-overlay">
                Resolving IFC asset…
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
          <div id="ifc-container" ref={containerRef} className="h-full w-full" />
        </div>
      </main>
    </div>
  )
}
