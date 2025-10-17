'use client'

import {
  ArrowUpOnSquareIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  CubeIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { processCAD, uploadDesignFile } from '@/lib/backendClient'
import { useWizardDataProtection } from '@/hooks/useWizardDataProtection'
import WizardWarningModal from '@/components/WizardWarningModal'

interface UploadSummary {
  fileId: string
  filePath: string
  size: number
  name: string
}

interface ProcessSummary {
  glbPath?: string | null
  ifcPath?: string | null
  usdPath?: string | null
  elementsCount?: number
  report?: unknown
  aiEnrichment?: unknown
  glbMaterials?: unknown
  lodReport?: unknown
  usdError?: string | null
}

type AIRoom = {
  id?: string
  type?: string
  default_materials?: Record<string, unknown>
  notes?: string
}

type AICamera = {
  name?: string
  position?: number[]
  look_at?: number[]
  lookAt?: number[]
}

type UploadCategory = 'ifc' | 'cad' | 'mesh' | 'bundle'

const MAX_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

function formatBytes(size: number) {
  if (!size) return '0 B'
  const i = Math.floor(Math.log(size) / Math.log(1024))
  const value = size / Math.pow(1024, i)
  const unit = ['B', 'KB', 'MB', 'GB', 'TB'][i] || 'B'
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${unit}`
}

function inferCategory(file: File): UploadCategory | null {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (['ifc', 'ifczip', 'ifcxml'].includes(extension)) return 'ifc'
  if (['dxf', 'dwg'].includes(extension)) return 'cad'
  if (['glb', 'gltf', 'obj', 'fbx', 'skp', 'blend'].includes(extension)) return 'mesh'
  if (['zip', 'rvt', 'rfa'].includes(extension)) return 'bundle'
  return null
}

export default function AgentUpload3DPage() {
  const [stage, setStage] = useState<'idle' | 'upload' | 'process' | 'topology' | 'persist' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('Drop a design file to get started')
  const [error, setError] = useState<string>('')
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [result, setResult] = useState<ProcessSummary | null>(null)
  const [topologyPath, setTopologyPath] = useState<string | null>(null)
  const [savedModelId, setSavedModelId] = useState<string | null>(null)
  const [savedUnitId, setSavedUnitId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [editorChanges, setEditorChanges] = useState<any>(null)
  const [aiInsights, setAiInsights] = useState<Record<string, unknown> | null>(null)
  const [fileKind, setFileKind] = useState<UploadCategory | null>(null)
  const { token, user, isAuthenticated } = useAuth()
  const router = useRouter()
  const isAgent = user?.role === 'AGENT' || user?.role === 'ADMIN'

  // Check if there's unsaved data
  const hasUnsavedData = Boolean(result?.glbPath || upload?.filePath || editorChanges)

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

  const aiRooms = useMemo<AIRoom[]>(() => {
    if (!Array.isArray(aiInsights?.rooms)) return []
    return (aiInsights?.rooms as AIRoom[]).slice(0, 4)
  }, [aiInsights])

  const aiCameras = useMemo<AICamera[]>(() => {
    if (!Array.isArray(aiInsights?.cameras)) return []
    return (aiInsights?.cameras as AICamera[]).slice(0, 3)
  }, [aiInsights])

  const busyLabel = useMemo(() => {
    const label = fileKind
      ? {
          ifc: 'IFC model',
          cad: 'CAD drawing',
          mesh: '3D asset',
          bundle: 'design package',
        }[fileKind]
      : 'design file'

    switch (stage) {
      case 'upload':
        return `Uploading ${label} to processing cluster…`
      case 'process':
        return fileKind === 'ifc'
          ? 'Validating IFC geometry and preparing GLB / USD…'
          : fileKind === 'cad'
          ? 'Extracting topology and generating IFC / GLB…'
          : 'Optimising meshes and generating viewer assets…'
      case 'topology':
        return 'Persisting topology, AI insights, and material defaults…'
      case 'persist':
        return 'Registering processed artifacts for listings…'
      default:
        return ''
    }
  }, [fileKind, stage])

  const reset = useCallback(() => {
    setStage('idle')
    setMessage('Drop a design file to get started')
    setError('')
    setUpload(null)
    setResult(null)
    setTopologyPath(null)
    setSavedModelId(null)
    setSavedUnitId(null)
    setAiInsights(null)
    setFileKind(null)
    setEditorChanges(null)
  }, [])

  // Load editor changes and restore 3D processing state when returning from editor
  useEffect(() => {
    try {
      // Check if wizard is still in progress (not published)
      const isPublished = sessionStorage.getItem('agent:published') === 'true'
      if (isPublished) {
        // Wizard is complete, clear all data and start fresh
        sessionStorage.removeItem('agent:uploadStep1')
        sessionStorage.removeItem('agent:uploadStep2')
        sessionStorage.removeItem('agent:uploadStep3')
        sessionStorage.removeItem('agent:reviewDraft')
        sessionStorage.removeItem('agent:editorChanges')
        sessionStorage.removeItem('agent:published')
        return
      }
      
      const changesRaw = sessionStorage.getItem('agent:editorChanges')
      if (changesRaw) {
        const changes = JSON.parse(changesRaw)
        setEditorChanges(changes)
        // Clear the changes from storage after loading
        sessionStorage.removeItem('agent:editorChanges')
      }
      
      // Restore 3D processing state from sessionStorage
      const step3Raw = sessionStorage.getItem('agent:uploadStep3')
      if (step3Raw) {
        const step3Data = JSON.parse(step3Raw)
        
        // Restore processing state
        setStage('done')
        setMessage('3D processing complete — ready to continue to review')
        
        // Restore upload and result data
        if (step3Data.filePath) {
          setUpload({
            fileId: 'restored',
            filePath: step3Data.filePath,
            size: 0,
            name: step3Data.fileName || '3D Model',
          })
        }
        
        if (step3Data.glbPath) {
          setResult({
            glbPath: step3Data.glbPath,
            ifcPath: step3Data.ifcPath,
            usdPath: step3Data.usdPath,
            elementsCount: step3Data.elementsCount,
            report: null,
            aiEnrichment: step3Data.aiEnrichment,
            glbMaterials: null,
            lodReport: null,
            usdError: null,
          })
        }
        
        // Restore other state
        if (step3Data.topologyPath) {
          setTopologyPath(step3Data.topologyPath)
        }
        if (step3Data.aiEnrichment) {
          setAiInsights(step3Data.aiEnrichment)
        }
        
        // Restore saved IDs if available
        if (step3Data.unitId) {
          setSavedUnitId(step3Data.unitId)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  const handleSelect = useCallback(async (file: File) => {
    const category = inferCategory(file)
    if (!category) {
      setError('Unsupported file. Upload IFC, CAD, or common 3D formats to continue.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError(`File too large. Limit: ${formatBytes(MAX_SIZE)}`)
      return
    }

    if (!isAuthenticated || !isAgent) {
      setError('Agent authentication required. Please sign in again.')
      return
    }

    const actorId = user?.id || 'agent'

    setError('')
    setIsBusy(true)
    setStage('upload')
    setFileKind(category)
    setMessage(`Uploading ${file.name}…`)

    try {
      const uploadRes = await uploadDesignFile(file, actorId, token || undefined)
      const summary: UploadSummary = {
        fileId: uploadRes.file_id,
        filePath: uploadRes.file_path,
        size: file.size,
        name: file.name,
      }
      setUpload(summary)

      setStage('process')
      setMessage(
        category === 'ifc'
          ? 'Validating IFC data and preparing viewer assets…'
          : category === 'cad'
          ? 'Processing drawing, generating spaces and IFC/GLB…'
          : 'Optimising geometry and compiling viewer assets…',
      )
      const processRes = await processCAD(uploadRes.file_path, uploadRes.file_id, token || undefined)
      const processSummary: ProcessSummary = {
        glbPath: processRes.glbPath,
        ifcPath: processRes.ifcPath,
        usdPath: processRes.usdPath,
        elementsCount: processRes.elementsCount,
        report: processRes.report,
        aiEnrichment: (processRes as any).ai_enrichment ?? null,
        glbMaterials: (processRes as any).glbMaterials ?? null,
        lodReport: (processRes as any).lod_report ?? null,
        usdError: (processRes as any).usd_error ?? null,
      }
      setResult(processSummary)
      if ((processRes as { ai_enrichment?: unknown }).ai_enrichment) {
        setAiInsights((processRes as { ai_enrichment?: Record<string, unknown> }).ai_enrichment ?? null)
      }

      setStage('topology')
      setMessage('Recording topology, catalog matches, and AI defaults…')
      const topoHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) topoHeaders.Authorization = `Bearer ${token}`
      const topoRes = await fetch('/api/process/topology', {
        method: 'POST',
        headers: topoHeaders,
        body: JSON.stringify({ uploadId: uploadRes.file_id, userId: actorId, filePath: uploadRes.file_path })
      })
      if (topoRes.ok) {
        const topoJson = await topoRes.json()
        if (topoJson?.topologyPath) setTopologyPath(topoJson.topologyPath)
        if (topoJson?.aiEnrichment) setAiInsights(topoJson.aiEnrichment as Record<string, unknown>)
      }

      // Create temporary PropertyUnit for editor access
      setStage('persist')
      setMessage('Preparing 3D editor…')
      try {
        const ingestHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) ingestHeaders.Authorization = `Bearer ${token}`
        const derivedMime = file.type
          || (category === 'ifc'
            ? 'application/ifc'
            : category === 'cad'
            ? 'application/vnd.autocad.dxf'
            : category === 'mesh'
            ? 'model/gltf-binary'
            : 'application/octet-stream')

        const ingest = await fetch('/api/models/ingest', {
          method: 'POST',
          headers: ingestHeaders,
          body: JSON.stringify({
            fileName: file.name,
            filePath: uploadRes.file_path,
            fileSize: file.size,
            mimeType: derivedMime,
            status: 'completed',
            ifcPath: processRes.ifcPath,
            glbPath: processRes.glbPath,
            summaryPath: topologyPath || null,
            pipeline: category,
          })
        })
        if (ingest.ok) {
          const { id, unitId } = await ingest.json()
          setSavedModelId(id)
          if (unitId) setSavedUnitId(unitId)
        }
      } catch (persistError) {
        console.warn('Model ingest failed', persistError)
      }

      setStage('done')
      setMessage('Processing complete — ready to continue to review')
    } catch (err) {
      console.error(err)
      setStage('error')
      setError((err as Error)?.message || 'Processing failed')
    } finally {
      setIsBusy(false)
    }
  }, [isAgent, isAuthenticated, token, topologyPath, user?.id])

  // Combine all step data and go to review
  const goToReview = useCallback((skip3D: boolean = false) => {
    // Get data from all steps
    let step1Data = null
    let step2Data = null
    
    try {
      const step1Raw = sessionStorage.getItem('agent:uploadStep1')
      if (step1Raw) step1Data = JSON.parse(step1Raw)
      
      const step2Raw = sessionStorage.getItem('agent:uploadStep2')
      if (step2Raw) step2Data = JSON.parse(step2Raw)
    } catch {
      // ignore
    }

    if (!step1Data) {
      return
    }

    // Store 3D step data in sessionStorage
    const step3Data = {
      has3D: !skip3D && (result?.glbPath || upload?.filePath),
      glbPath: result?.glbPath || null,
      ifcPath: result?.ifcPath || null,
      usdPath: result?.usdPath || null,
      filePath: upload?.filePath || null,
      fileName: upload?.name || null,
      elementsCount: result?.elementsCount || 0,
      aiEnrichment: aiInsights || null,
      topologyPath: topologyPath || null,
      processedAt: new Date().toISOString(),
      unitId: savedUnitId || null,
    }
    
    
    try {
      sessionStorage.setItem('agent:uploadStep3', JSON.stringify(step3Data))
    } catch {
      /* ignore storage errors */
    }

    const STORAGE_KEY = 'agent:reviewDraft'
    const draft = {
      title: (step1Data.form.title || '').trim(),
      subtitle: '',
      status: 'Draft',
      pricing: {
        basePrice: (step1Data.form.basePrice || '').trim(),
        currency: (step1Data.form.currency || 'ETB').trim().toUpperCase(),
      },
      propertyType: step1Data.propertyType || '',
      address: (step1Data.form.address || '').trim(),
      city: (step1Data.form.city || '').trim(),
      subCity: (step1Data.form.subCity || '').trim(),
      location: [step1Data.form.address?.trim(), step1Data.form.subCity?.trim(), step1Data.form.city?.trim()].filter(Boolean).join(', '),
      specs: {
        bedrooms: step1Data.form.bedrooms || '0',
        bathrooms: step1Data.form.bathrooms || '1',
        areaSqm: step1Data.form.areaSqm ? Number(step1Data.form.areaSqm) : 0,
      },
      description: (step1Data.form.description || '').trim(),
      amenities: step1Data.form.amenities || [],
      features: step1Data.form.features || [],
      media: {
        images: step2Data?.images?.map((m: any) => m.url) || [],
        videos: step2Data?.videos?.map((v: any) => ({ url: v.url, label: v.file?.name || 'Video clip' })) || [],
        floorPlans: step2Data?.floorPlans?.map((fp: any) => ({ url: fp.url, name: fp.name })) || [],
        coverImage: (() => {
          // Find the cover image first
          const coverImg = step2Data?.images?.find((img: any) => img.isCover)
          if (coverImg) {
            return coverImg.url
          }
          // If no cover image is selected, use the first image
          const firstImg = step2Data?.images?.[0]
          if (firstImg) {
            return firstImg.url
          }
          return null
        })(),
      },
      immersive: { 
        has3D: step3Data.has3D,
        glbPath: step3Data.glbPath,
        ifcPath: step3Data.ifcPath,
        usdPath: step3Data.usdPath,
        filePath: step3Data.filePath,
        fileName: step3Data.fileName,
        elementsCount: step3Data.elementsCount,
        aiEnrichment: step3Data.aiEnrichment,
        topologyPath: step3Data.topologyPath,
        processedAt: step3Data.processedAt,
        editorChanges: editorChanges,
        unitId: savedUnitId,
      },
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch {
      /* ignore storage errors */
    }
    router.push('/agent/review')
  }, [result, upload, aiInsights, topologyPath, editorChanges, savedUnitId, router])

  // Go back to media step
  const goBackToMedia = useCallback(() => {
    router.push('/agent/upload/media')
  }, [router])

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
                    step <= 3
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)] text-white'
                      : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] text-muted'
                  }`}
                >
                  {step}
                </div>
                <div className="ml-3 text-sm">
                  <p className={`font-medium ${step <= 3 ? 'text-primary' : 'text-muted'}`}>
                    {step === 1 ? 'Property Details' : step === 2 ? 'Media Upload' : '3D Pipeline'}
                  </p>
                </div>
                {step < 3 && (
                  <div className={`ml-8 h-px w-16 ${step < 3 ? 'bg-[color:var(--accent-500)]' : 'bg-[color:var(--surface-border)]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Step 3: 3D Pipeline */}
      <div className="container space-y-10 py-12">
        {/* Step 3 Navigation */}
        <div className="flex justify-end mb-1">
            <button 
              type="button" 
              className="btn btn-secondary"  
              onClick={() => goToReview(true)}
            >
              Skip 3D Pipeline
            </button>
        </div>
        <header className="space-y-3 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-4 py-2 text-xs uppercase tracking-[0.4em] text-muted">
            <CloudArrowUpIcon className="h-4 w-4" /> Step 3: 3D Pipeline
          </div>
          <h1 className="headline text-4xl">Upload CAD, generate immersive assets</h1>
          <p className="mx-auto max-w-2xl text-base text-muted">
            The agent pipeline ingests architectural drawings or authored BIM, generates IFC/GLB/USD outputs, and
            persists topology, AI insights, and material metadata so listings are ready for interactive customization.
          </p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="surface-soft space-y-6 p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">Upload design or 3D source</p>
                <p className="text-secondary">Drag & drop IFC, RVT, DXF/DWG, GLB/GLTF, OBJ/FBX/BLEND, SKP, or packaged ZIP files up to {formatBytes(MAX_SIZE)}.</p>
              </div>
              <label
                className="btn btn-primary cursor-pointer"
              >
                <ArrowUpOnSquareIcon className="h-4 w-4" />
                <span>Select CAD / 3D file</span>
                <input
                  type="file"
                  accept=".ifc,.ifcxml,.dxf,.dwg,.glb,.gltf,.obj,.fbx,.skp,.blend,.zip,.rvt"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) handleSelect(file)
                  }}
                />
              </label>
            </div>

            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 text-sm">
              <div className="flex items-center gap-3 text-muted">
                {stage === 'done' ? (
                  <CheckCircleIcon className="h-5 w-5 text-[color:var(--success-500)]" />
                ) : stage === 'error' ? (
                  <ExclamationTriangleIcon className="h-5 w-5 text-[color:var(--warning-500)]" />
                ) : (
                  <PlayCircleIcon className="h-5 w-5 animate-pulse text-[color:var(--accent-500)]" />
                )}
                <div>
                  <div className="font-medium text-primary">
                    {busyLabel || message}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-disabled">
                    {stage.toUpperCase()}
                  </div>
                </div>
              </div>
              {error && (
                <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100">{error}</p>
              )}
            </div>

            {upload && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">Source file</p>
                  <p className="mt-1 text-sm font-medium text-primary">{upload.name}</p>
                  <p className="text-xs text-disabled">{formatBytes(upload.size)} • id {upload.fileId}</p>
                </div>
                {result && (
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4">
                    <p className="text-xs uppercase tracking-widest text-muted">Elements detected</p>
                    <p className="mt-1 text-3xl font-semibold text-primary">{result.elementsCount ?? 0}</p>
                    <p className="text-xs text-disabled">Floors, walls, spaces & more surfaced during processing</p>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-3 text-sm text-muted">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
                  <LinkIcon className="h-4 w-4" /> Next steps
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedUnitId && (
                    <Link href={`/agent/editor/${encodeURIComponent(savedUnitId)}?returnTo=wizard`} className="btn btn-primary">
                      <CubeIcon className="h-4 w-4" /> Edit in 3D Editor
                    </Link>
                  )}
                  {topologyPath && (
                    <Link
                      href={`/api/files/binary?path=${encodeURIComponent(topologyPath)}`}
                      className="btn btn-secondary"
                      target="_blank"
                    >
                      Topology JSON
                    </Link>
                  )}
                  {result?.usdPath && (
                    <Link
                      href={`/api/files/binary?path=${encodeURIComponent(result.usdPath)}`}
                      className="btn btn-secondary"
                    >
                      USD Asset
                    </Link>
                  )}
                </div>
                {!savedUnitId && (
                  <p className="text-xs text-muted">
                    Complete the 3D processing to enable the editor link.
                  </p>
                )}
                {result.usdError && (
                  <p className="text-xs text-amber-200">
                    USD export warning: {result.usdError}
                  </p>
                )}

                {result?.lodReport
                  ? (() => {
                      const lod = (result.lodReport as Record<string, any>) || {}
                      const lodCategory = typeof lod.lod === 'string' ? lod.lod : 'unknown'
                      const coverage =
                        typeof lod.materialCoverage === 'number'
                          ? `${(lod.materialCoverage * 100).toFixed(0)}%`
                          : '—'
                      return (
                        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 text-xs text-muted">
                          <p className="text-xs uppercase tracking-wide text-muted">LOD inspection</p>
                          <p className="mt-1 text-sm font-semibold text-primary">{lodCategory.toUpperCase()}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-disabled">Detail score</div>
                              <div className="text-sm text-secondary">{lod.detailScore ?? '—'}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-disabled">Material coverage</div>
                              <div className="text-sm text-secondary">{coverage}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-disabled">Elements</div>
                              <div className="text-sm text-secondary">{lod.elementCount ?? '—'}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-disabled">With geometry</div>
                              <div className="text-sm text-secondary">{lod.elementsWithGeometry ?? '—'}</div>
                            </div>
                          </div>
                          {lod.needs_enrichment && (
                            <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                              Autofilled catalog materials were applied to lift photorealism for this IFC.
                            </p>
                          )}
                        </div>
                      )
                    })()
                  : null}
              </div>
            )}

            {aiInsights
              ? (() => {
                  return (
                    <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-5 text-sm text-muted space-y-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
                        <DocumentTextIcon className="h-4 w-4" /> AI layout briefing
                      </div>
                      {aiRooms.length > 0 && (
                        <div>
                          <p className="text-xs text-muted mb-1">Rooms</p>
                          <ul className="space-y-1 text-xs">
                            {aiRooms.map((room, idx) => (
                              <li key={room?.id || idx} className="rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2">
                                <div className="font-semibold text-secondary">{room?.type || room?.id || 'room'}</div>
                                {room?.default_materials && (
                                  <div className="mt-1 grid grid-cols-2 gap-1 text-muted">
                                    {Object.entries(room.default_materials).map(([slot, value]) => (
                                      <span key={slot}>{slot}: {String(value)}</span>
                                    ))}
                                  </div>
                                )}
                                {room?.notes && <p className="mt-1 text-muted">{room.notes}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiCameras.length > 0 && (
                        <div>
                          <p className="text-xs text-muted mb-1">Suggested cameras</p>
                          <ul className="space-y-1 text-xs">
                            {aiCameras.map((cam, idx) => (
                              <li key={cam?.name || idx} className="rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2">
                                <div className="font-semibold text-secondary">{cam?.name || `camera_${idx}`}</div>
                                <div className="mt-1 text-muted">pos: {JSON.stringify(cam?.position)}</div>
                                <div className="text-muted">look_at: {JSON.stringify(cam?.look_at || cam?.lookAt)}</div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })()
              : null}

            {stage === 'done' && (
              <div className="rounded-2xl border border-[color:var(--success-500)]/40 bg-[color:var(--success-500)]/12 p-5 text-sm text-primary">
                <p className="font-semibold text-[color:var(--success-500)]">Pipeline complete.</p>
                <p className="mt-1 text-secondary">
                  Geometry checks, AI enrichment, and catalog defaults are complete. Assets are registered and ready for
                  the editor, pricing tools, and public listings.
                </p>
                {result?.glbPath && (
                  <p className="mt-2 text-xs text-secondary">
                    GLB Model:
                    <code className="ml-1 rounded bg-[color:var(--success-500)]/20 px-1 text-[color:var(--success-500)]">
                      {result.glbPath.split('/').pop()}
                    </code>
                  </p>
                )}
                {result?.elementsCount && (
                  <p className="text-xs text-secondary">
                    Elements processed:
                    <code className="ml-1 rounded bg-[color:var(--success-500)]/20 px-1 text-[color:var(--success-500)]">
                      {result.elementsCount}
                    </code>
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={reset}
              disabled={isBusy}
            >
              Reset session
            </button>
          </div>

          <aside className="space-y-4">
            <div className="surface-soft space-y-3 p-5 text-sm text-muted">
              <p className="text-xs uppercase tracking-wide text-muted">Pipeline steps</p>
              <ol className="space-y-2 text-xs text-muted">
                <li>1. Upload design intent (IFC, CAD, mesh, or bundled package).</li>
                <li>2. Normalise geometry, infer spaces, and validate structure.</li>
                <li>3. Generate or refine IFC with openings, relationships, and materials.</li>
                <li>4. Emit photorealistic GLB/USD assets with catalog-ready materials.</li>
                <li>5. Persist topology, AI insights, and manifest metadata.</li>
              </ol>
            </div>

            <div className="surface-soft space-y-3 p-5 text-sm text-muted">
              <p className="text-xs uppercase tracking-wide text-muted">Need to manage existing uploads?</p>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => protectedRouterPush('/agent/unified-upload')} 
                  className="btn btn-secondary"
                >
                  Power tools workspace
                </button>
                <button 
                  onClick={() => protectedRouterPush('/agent/units')} 
                  className="btn btn-secondary"
                >
                  Go to units
                </button>
              </div>
            </div>
          </aside>
        </section>

        {/* Step 3 Navigation */}
        <div className="flex justify-between">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={goBackToMedia}
          >
            Back to Media
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => goToReview(false)}
            disabled={stage !== 'done' && !result?.glbPath}
          >
            Continue to Review
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
