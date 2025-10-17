"use client"

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'

type UploadRes = { file_id: string; file_path: string; status: string }
type ProcessRes = {
  success: boolean
  ifcPath?: string
  glbPath?: string
  usdPath?: string
  elementsCount?: number
  summaryPath?: string
  report?: any
  elements?: any[]
  statistics?: any
  error?: string
  lod_report?: any
  usd_error?: string
}

type UploadCategory = 'ifc' | 'cad' | 'mesh' | 'bundle'

function inferCategoryFromName(filename: string): UploadCategory | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.ifc') || lower.endsWith('.ifcxml') || lower.endsWith('.ifczip')) return 'ifc'
  if (lower.endsWith('.dxf') || lower.endsWith('.dwg')) return 'cad'
  if (['.glb', '.gltf', '.obj', '.fbx', '.skp', '.blend'].some((ext) => lower.endsWith(ext))) return 'mesh'
  if (lower.endsWith('.zip') || lower.endsWith('.rvt') || lower.endsWith('.rfa')) return 'bundle'
  return null
}

export default function UnifiedUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProcessRes | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)

  const addLog = useCallback((msg: string) => setLogs(prev => [...prev, msg]), [])

  const reset = () => {
    setBusy(false)
    setLogs([])
    setError(null)
    setResult(null)
    setModelId(null)
    setFileInfo(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const category = inferCategoryFromName(f.name)
    if (!category) {
      setError('Unsupported file type. Choose IFC, RVT, DXF/DWG, GLB/GLTF, OBJ/FBX/BLEND, SKP, or ZIP bundles.')
      return
    }
    reset()
    setFileInfo({ name: f.name, size: f.size })
    setBusy(true)
    try {
      addLog(`Uploading (${category.toUpperCase()}): ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`) 
      const form = new FormData()
      form.append('file', f)
      const up = await fetch(`/api/backend/upload?user_id=unified`, { method: 'POST', body: form })
      if (!up.ok) {
        const t = await up.text().catch(() => '')
        throw new Error(`Upload failed: ${up.status} ${t}`)
      }
      const upJson = (await up.json()) as UploadRes
      addLog(`Uploaded → file_id=${upJson.file_id}`)

      addLog('Processing on backend…')
      const proc = await fetch('/api/backend/process-cad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: upJson.file_path, userId: upJson.file_id })
      })
      const txt = await proc.text()
      const payload: ProcessRes = proc.headers.get('content-type')?.includes('application/json') ? JSON.parse(txt) : { success: false, error: txt }
      if (!proc.ok || !payload.success) {
        throw new Error(payload.error || `Process failed: ${proc.status}`)
      }
      setResult(payload)
      addLog(`Processed: elements=${payload.elementsCount ?? payload.elements?.length ?? 0}`)
      if (payload.lod_report) {
        addLog(`LOD: ${payload.lod_report.lod ?? 'unknown'} (detail=${payload.lod_report.detailScore ?? 'n/a'})`)
      }

      // Persist in Prisma (optional but recommended)
      try {
        const res = await fetch('/api/models/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: f.name,
            filePath: upJson.file_path,
            fileSize: f.size,
            mimeType:
              f.type
              || (category === 'ifc'
                ? 'application/ifc'
                : category === 'cad'
                ? 'application/vnd.autocad.dxf'
                : category === 'mesh'
                ? 'model/gltf-binary'
                : 'application/octet-stream'),
            status: 'completed',
            ifcPath: payload.ifcPath,
            glbPath: payload.glbPath,
            summaryPath: payload.summaryPath,
            pipeline: category
          })
        })
        if (res.ok) {
          const { id } = await res.json()
          setModelId(id)
          addLog(`Saved to DB: id=${id}`)
        } else {
          addLog(`DB save skipped: ${await res.text()}`)
        }
      } catch (e: any) {
        addLog(`DB save error: ${e?.message || e}`)
      }
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Upload/processing failed')
      addLog(`Error: ${e?.message || e}`)
    } finally {
      setBusy(false)
    }
  }

  const glbByIdUrl = useMemo(() => (modelId ? `/agent/glb-viewer?fileId=${encodeURIComponent(modelId)}&type=glb` : ''), [modelId])
  const glbByPathUrl = useMemo(() => (result?.glbPath ? `/agent/glb-viewer?src=${encodeURIComponent(result.glbPath)}` : ''), [result?.glbPath])

  const InlineModel = ({ url }: { url: string }) => {
    const gltf = useGLTF(url)
    return <primitive object={gltf.scene} />
  }

  const [renderable, setRenderable] = useState<boolean>(false)
  const [renderableMsg, setRenderableMsg] = useState<string>('')
  const checkRenderable = useCallback(async (path?: string) => {
    setRenderable(false)
    setRenderableMsg('')
    if (!path) return
    const url = `/api/files/binary?path=${encodeURIComponent(path)}`
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      if (!res.ok) {
        setRenderableMsg(`Not renderable: ${res.status}`)
        return
      }
      const len = parseInt(res.headers.get('content-length') || '0', 10)
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('model/gltf') && len > 512) {
        setRenderable(true)
      } else {
        setRenderableMsg(`Not renderable (ct=${ct || 'unknown'}, size=${len}B)`) 
      }
    } catch (e: any) {
      setRenderableMsg(`Check failed: ${e?.message || e}`)
    }
  }, [])

  // Re-check when new result is available
  const glbPath = result?.glbPath
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { checkRenderable(glbPath) }, [glbPath])

  return (
    <div className="min-h-screen bg-[color:var(--app-background)]">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-2xl font-bold text-primary">Unified design processing</h1>
        <p className="mb-6 text-secondary">Proxy IFC, CAD drawings, 3D meshes, or bundled ZIP packages to the robust backend pipeline.</p>

        <div className="mb-4 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4">
          <input
            ref={inputRef}
            type="file"
            accept=".ifc,.ifcxml,.rvt,.dxf,.dwg,.glb,.gltf,.obj,.fbx,.skp,.blend,.zip"
            onChange={handleSelect}
            className="text-secondary"
          />
          {fileInfo && (
            <div className="mt-2 text-sm text-muted">Selected: {fileInfo.name} ({(fileInfo.size / 1024 / 1024).toFixed(2)} MB)</div>
          )}
        </div>

        {busy && (
          <div className="mb-3 rounded-xl border border-[color:var(--accent-500)]/40 bg-[color:var(--accent-500)]/12 p-3 text-secondary">
            Working… please wait.
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-xl border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 p-3 text-secondary">
            {error}
          </div>
        )}

        <div className="h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-3 text-xs text-muted font-mono">
          {logs.length ? logs.join('\n') : 'Logs will appear here…'}
        </div>

        {result && (
          <div className="mt-4 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 text-primary">
            <div className="mb-2 font-semibold">Result</div>
            <div className="space-y-1 text-sm text-secondary">
              <div>IFC: {result.ifcPath || 'N/A'}</div>
              <div>GLB: {result.glbPath || 'N/A'}</div>
              <div>USD: {result.usdPath || 'N/A'}</div>
              <div>Elements: {result.elementsCount ?? result.elements?.length ?? 0}</div>
              {result.summaryPath && <div>Summary: {result.summaryPath}</div>}
              {result.lod_report && <div>LOD: {result.lod_report.lod ?? 'unknown'}</div>}
              {result.usd_error && (
                <div className="text-[color:var(--warning-500)]">USD warning: {result.usd_error}</div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {glbByIdUrl && (
                <a className="btn btn-primary" href={glbByIdUrl} target="_blank">
                  Open (R3F)
                </a>
              )}
              {!glbByIdUrl && glbByPathUrl && (
                <a className="btn btn-primary" href={glbByPathUrl} target="_blank">
                  Open (R3F)
                </a>
              )}
              {result?.glbPath && (
                <a className="btn btn-secondary" href={`/agent/glb-simple?src=${encodeURIComponent(result.glbPath)}`} target="_blank">
                  Open (Simple)
                </a>
              )}
              <button className="btn btn-ghost" onClick={reset} type="button">
                Reset
              </button>
            </div>

            {result.glbPath && (
              <div className="mt-4 h-[420px] rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
                {renderable ? (
                  <Canvas camera={{ position: [6, 4, 8], fov: 55 }} shadows>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                    <Environment preset="apartment" />
                    <InlineModel url={`/api/files/binary?path=${encodeURIComponent(result.glbPath)}`} />
                    <OrbitControls enableDamping dampingFactor={0.05} />
                  </Canvas>
                ) : (
                  <div className="p-4 text-sm text-secondary">
                    GLB inline preview unavailable. {renderableMsg || 'The generated GLB is a minimal stub or missing headers.'} Use the buttons above to open by id/path or download from Files Explorer.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
