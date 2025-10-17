/**
 * Backend client for the immersive processing pipeline.
 * Uses NEXT_PUBLIC_BACKEND_URL for cloud/local setups.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export interface UploadResult {
  file_id: string
  file_path: string
  status: string
}

export interface ProcessResult {
  success: boolean
  ifcPath?: string
  glbPath?: string
  usdPath?: string | null
  elementsCount?: number
  report?: unknown
  summaryPath?: string
  error?: string
  ai_enrichment?: unknown
  glbMaterials?: unknown
  lod_report?: unknown
  usd_error?: string
}

export async function backendHealth(): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/health`)
  if (!res.ok) throw new Error(`Backend health failed: ${res.status}`)
  const data: unknown = await res.json()
  return data
}

export async function uploadDesignFile(file: File, userId = 'web', token?: string): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  // Use Next proxy to avoid CORS issues in browsers
  const res = await fetch(`/api/backend/upload?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json()
  return data as UploadResult
}

// Backwards compatibility alias (remove after refactoring callers)
export const uploadDXF = uploadDesignFile

export async function processCAD(filePath: string, userId = 'web', token?: string): Promise<ProcessResult> {
  // Use Next proxy to avoid CORS issues
  const res = await fetch(`/api/backend/process-cad`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ filePath, userId })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Process failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data as ProcessResult
}

export function buildFileUrlById(id: string, type: 'glb'|'ifc'|'processed'|'original' = 'glb', token?: string) {
  const t = token ? `&token=${encodeURIComponent(token)}` : ''
  return `/api/files/${encodeURIComponent(id)}?type=${type}${t}`
}
