import { readFile } from 'fs/promises'
import { resolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const id = params.id
    const unit = await prisma.propertyUnit.findUnique({
      where: { id },
      include: { fileUpload: true, listing: true }
    })
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    const f = unit.fileUpload
    let aiEnrichment: unknown = null
    let topologyCounts: Record<string, unknown> | null = null
    let topologyValidations: Record<string, unknown> | null = null
    let relationships: Record<string, unknown> | null = null
    let guidMaterials: Record<string, unknown> | null = null
    let catalogAssignments: Record<string, unknown> | null = null

    if (f?.processedFilePath) {
      try {
        const topo = JSON.parse(await readFile(f.processedFilePath, 'utf8'))
        aiEnrichment = topo?.ai ?? null
        topologyCounts = topo?.counts ?? null
        guidMaterials = topo?.guidMaterials ?? null
        catalogAssignments = topo?.catalog ?? null
        relationships = topo?.relationships ?? null
        topologyValidations = topo?.validations ?? null
      } catch (err) {
        console.warn('Failed to read topology for unit', id, err)
      }
    }

    if (!catalogAssignments) {
      const assignments = loadCatalogAssignmentsFromAssets(f)
      if (assignments) {
        catalogAssignments = assignments
      }
    }

    return NextResponse.json({
      id: unit.id,
      name: unit.name,
      listing: unit.listing || null,
      file: f ? {
        id: f.id,
        glbPath: f.glbFilePath,
        ifcPath: f.ifcFilePath,
        processedFilePath: f.processedFilePath,
      } : null,
      aiEnrichment,
      topologyCounts,
      topologyValidations,
      guidMaterials,
      catalogAssignments,
      relationships,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch unit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function loadCatalogAssignmentsFromAssets(fileUpload: any): Record<string, unknown> | null {
  if (!fileUpload) return null
  try {
    const processedRoot = resolve(process.cwd(), 'file_storage', 'processed')
    const candidateStems = new Set<string>()

    const consider = (value?: string | null) => {
      if (!value) return
      try {
        let stem = value.replace(/\\/g, '/').split('/').pop() || value
        stem = stem.replace(/\.\w+$/, '')
        if (stem.endsWith('_topology')) {
          stem = stem.slice(0, -'_topology'.length)
        }
        if (stem) candidateStems.add(stem)
      } catch {
        /* ignore */
      }
    }

    consider(fileUpload.glbFilePath)
    consider(fileUpload.ifcFilePath)
    consider(fileUpload.processedFilePath)
    consider(fileUpload.originalName)

    for (const stem of candidateStems) {
      const manifestPath = join(processedRoot, `${stem}_assets.json`)
      if (!existsSync(manifestPath)) continue
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
        if (manifest?.catalogAssignments) {
          return manifest.catalogAssignments as Record<string, unknown>
        }
      } catch (err) {
        console.warn('Failed to parse catalog assets manifest', manifestPath, err)
      }
    }
  } catch (err) {
    console.warn('Catalog assignment lookup failed', err)
  }
  return null
}
