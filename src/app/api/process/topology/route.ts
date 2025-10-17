import { mkdir, writeFile, access } from 'fs/promises'
import { join, resolve } from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

type BackendResult = {
  success: boolean
  elements?: Array<Record<string, unknown>>
  statistics?: Record<string, unknown>
  ifcPath?: string | null
  glbPath?: string | null
  summaryPath?: string | null
  usdPath?: string | null
  error?: string
  ai_enrichment?: unknown
  glbMaterials?: Record<string, unknown>
  catalog_assignments?: Record<string, unknown>
}

type BackendElement = {
  type?: string | null
  [key: string]: unknown
}

function buildIfcGraphFromText(content: string, maxNodes = 2000, maxEdges = 4000) {
  const nodes: Array<{ id: string; type: string } > = []
  const edges: Array<{ from: string; to: string } > = []
  const nodeMap = new Map<string, string>()
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length && nodes.length < maxNodes; i++) {
    const line = lines[i]
    const m = line.match(/^\s*(#\d+)\s*=\s*([A-Z0-9_]+)\s*\(/)
    if (!m) continue
    const id = m[1]
    const type = m[2]
    nodeMap.set(id, type)
    nodes.push({ id, type })
  }
  for (let i = 0; i < lines.length && edges.length < maxEdges; i++) {
    const line = lines[i]
    const left = line.match(/^\s*(#\d+)\s*=/)
    if (!left) continue
    const from = left[1]
    if (!nodeMap.has(from)) continue
    const refs = line.match(/#\d+/g)
    if (!refs) continue
    for (const ref of refs) {
      if (ref !== from && nodeMap.has(ref)) {
        edges.push({ from, to: ref })
        if (edges.length >= maxEdges) break
      }
    }
  }
  const typeCounts = nodes.reduce((acc: Record<string, number>, n) => { acc[n.type] = (acc[n.type]||0)+1; return acc }, {})
  return { nodes, edges, counts: { nodes: nodes.length, edges: edges.length }, typeCounts }
}

async function callBackendProcess(filePath: string, userId: string | undefined): Promise<BackendResult> {
  // Calls local FastAPI robust backend at port 8000
  const res = await fetch('http://127.0.0.1:8000/process-cad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, userId: userId || 'default' })
  })
  try {
    const js = await res.json()
    if (!res.ok) return { success: false, error: js?.detail || js?.error || `Backend status ${res.status}` }
    return js as BackendResult
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to parse backend response' }
  }
}

async function ensureUsdVariant(glbPath?: string | null): Promise<string | null> {
  if (!glbPath) return null
  try {
    await access(glbPath)
  } catch {
    return null
  }
  const usdPath = glbPath.replace(/\.glb$/i, '.usd')
  const note = [
    'USD placeholder generated during export bundle creation.',
    `Source GLB: ${glbPath}`,
    'Replace this file with true USD geometry once the USD pipeline is integrated.',
  ].join('\n')
  await writeFile(usdPath, note, 'utf8')
  return usdPath
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    let filePath: string | undefined = body.filePath
    const userId: string | undefined = body.userId || auth.user.id
    const uploadId: string | undefined = body.uploadId

    if (!filePath && uploadId) {
      const file = await prisma.fileUpload.findUnique({ where: { id: uploadId } })
      if (!file) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
      filePath = file.filePath
    }

    if (!filePath) {
      return NextResponse.json({ error: 'filePath or uploadId required' }, { status: 400 })
    }

    // Call backend robust processor to ensure elements and derivative files exist
    const backend = await callBackendProcess(filePath, userId)
    if (!backend.success) {
      return NextResponse.json({ error: backend.error || 'Processing failed' }, { status: 502 })
    }

    const elements: BackendElement[] = Array.isArray(backend.elements)
      ? backend.elements as BackendElement[]
      : []
    const statistics = backend.statistics || {}
    const ai = (backend as any).ai_enrichment ?? null
    const relationships = (backend as any).relationships ?? null
    const materials = (backend as any).glbMaterials ?? null
    const catalogAssignments = (backend as any).catalog_assignments ?? null
    const usdPath = backend.usdPath || await ensureUsdVariant(backend.glbPath)

    // Basic validations
    const counts = {
      total: elements.length,
      walls: elements.filter(e => (e.type||'').toLowerCase()==='wall').length,
      floors: elements.filter(e => (e.type||'').toLowerCase()==='floor').length,
      ceilings: elements.filter(e => (e.type||'').toLowerCase()==='ceiling').length,
      spaces: elements.filter(e => ['space','room'].includes((e.type||'').toLowerCase())).length,
    }
    const generatedRoomsCount = Array.isArray(relationships?.spaces)
      ? relationships!.spaces!.filter((space: any) => space && typeof space === 'object' && (space.generated || space.layer === '__generated_space__')).length
      : 0
    const validations = {
      hasWalls: counts.walls > 0,
      hasAtLeastOneRoomOrSpace: counts.spaces > 0,
      hasFloorOrCeiling: (counts.floors + counts.ceilings) > 0,
      roomsGenerated: generatedRoomsCount,
      hasOnlyGeneratedRooms: counts.spaces > 0 && generatedRoomsCount === counts.spaces,
    }

    // Save topology.json alongside processed files
    const storageRoot = resolve(process.cwd(), 'file_storage', 'processed')
    await mkdir(storageRoot, { recursive: true })
    const stem = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'model'
    const topologyPath = join(storageRoot, `${stem}_topology.json`)
    await writeFile(topologyPath, JSON.stringify({ elements, statistics, counts, validations, ai, relationships, guidMaterials: materials, catalog: catalogAssignments, usdPath }, null, 2), 'utf8')

    // If IFC exists, also emit a richer ifc_graph.json for inspection
    let ifcGraphPath: string | undefined
    const ifcFlags: { hasSpaceBoundaries?: boolean; hasVoidsRelations?: boolean; metrics?: Record<string, unknown> } = {}
    if (backend.ifcPath) {
      try {
        const fs = await import('fs/promises')
        const ifcText = await fs.readFile(backend.ifcPath, 'utf8')
        const graph = buildIfcGraphFromText(ifcText)
        ifcGraphPath = join(storageRoot, `${stem}_ifc_graph.json`)
        await writeFile(ifcGraphPath, JSON.stringify(graph, null, 2), 'utf8')
        const typeCounts = (graph as { typeCounts?: Record<string, number> }).typeCounts ?? {}
        ifcFlags.hasVoidsRelations = (typeCounts['IFCRELVOIDSELEMENT'] || typeCounts['IfcRelVoidsElement'] || 0) > 0
        ifcFlags.hasSpaceBoundaries = (typeCounts['IFCRELSPACEBOUNDARY'] || typeCounts['IfcRelSpaceBoundary'] || 0) > 0
        // Metrics
        const doors = (typeCounts['IFCDOOR'] || typeCounts['IfcDoor'] || 0)
        const wins = (typeCounts['IFCWINDOW'] || typeCounts['IfcWindow'] || 0)
        const fills = (typeCounts['IFCRELFILLSELEMENT'] || typeCounts['IfcRelFillsElement'] || 0)
        const spaces = (typeCounts['IFCSPACE'] || typeCounts['IfcSpace'] || 0)
        const sb = (typeCounts['IFCRELSPACEBOUNDARY'] || typeCounts['IfcRelSpaceBoundary'] || 0)
        const totalOpenings = Math.max(1, doors + wins)
        const hostMatchRate = Math.min(1, fills / totalOpenings)
        const sbPerSpace = spaces > 0 ? (sb / spaces) : 0
        ifcFlags.metrics = { hostMatchRate, sbPerSpace, counts: { doors, wins, fills, spaces, sb } }
      } catch {
        // non-fatal
      }
    }

    // Optionally link to Prisma upload (best-effort)
    if (uploadId) {
      try {
        const existing = await prisma.fileUpload.findUnique({ where: { id: uploadId } })
        if (existing) {
          await prisma.fileUpload.update({ where: { id: uploadId }, data: { processedFilePath: topologyPath, ifcFilePath: backend.ifcPath || undefined, glbFilePath: backend.glbPath || undefined, usdFilePath: usdPath || undefined, status: 'COMPLETED' } })
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      topologyPath,
      elementsCount: counts.total,
      counts,
      validations: {
        ...validations,
        ifcSpaceBoundaries: !!ifcFlags.hasSpaceBoundaries,
        ifcVoidsRelations: !!ifcFlags.hasVoidsRelations,
        metrics: ifcFlags.metrics || {},
      },
      ifcPath: backend.ifcPath,
      glbPath: backend.glbPath,
      usdPath,
      ifcGraphPath,
      aiEnrichment: ai,
      glbMaterials: materials,
      relationships,
      catalogAssignments,
    })
  } catch (e: any) {
    const msg = e?.message || 'Failed to build topology'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
