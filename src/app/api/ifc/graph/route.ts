import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { resolve, extname, sep } from 'path'

import { prisma } from '@/lib/database'
import { getOptionalUser } from '@/lib/serverAuth'

// Parse a subset of IFC to build a light graph: nodes (#id:type) and edges (#id -> #ref)
function buildIfcGraph(content: string, maxNodes = 800, maxEdges = 2000) {
  const nodes: Array<{ id: string; type: string }> = []
  const edges: Array<{ from: string; to: string }> = []

  const nodeMap = new Map<string, string>() // #id -> type
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length && nodes.length < maxNodes; i++) {
    const line = lines[i]
    const match = line.match(/^\s*(#\d+)\s*=\s*([A-Z0-9_]+)\s*\(/)
    if (!match) {
      continue
    }
    const id = match[1]
    const type = match[2]
    nodeMap.set(id, type)
    nodes.push({ id, type })
  }

  for (let i = 0; i < lines.length && edges.length < maxEdges; i++) {
    const line = lines[i]
    const left = line.match(/^\s*(#\d+)\s*=/)
    if (!left) {
      continue
    }
    const from = left[1]
    if (!nodeMap.has(from)) {
      continue
    }
    const refs = line.match(/#\d+/g)
    if (!refs) {
      continue
    }
    for (const ref of refs) {
      if (ref !== from && nodeMap.has(ref)) {
        edges.push({ from, to: ref })
        if (edges.length >= maxEdges) break
      }
    }
  }

  return { nodes, edges, counts: { nodes: nodes.length, edges: edges.length } }
}

const cwd = process.cwd()
const allowedRoots = [
  ['file_storage', 'processed'],
  ['backend', 'file_storage', 'processed'],
  ['backend', 'file_storage'],
  ['output'],
  ['backend', 'output'],
].map((parts) => resolve(cwd, ...parts))

function isWithinAllowed(pathname: string) {
  const targetPath = resolve(pathname)
  return allowedRoots.some((root) => targetPath === root || targetPath.startsWith(root + sep))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get('unitId')
    const listingId = searchParams.get('listingId')

    if (!unitId && !listingId) {
      return NextResponse.json({ error: 'unitId or listingId required' }, { status: 400 })
    }

    const user = getOptionalUser(request, true)
    const privilegedUser = Boolean(user && (user.role === 'AGENT' || user.role === 'ADMIN'))

    let targetUnitId = unitId
    if (listingId && !unitId) {
      const listing = await prisma.unitListing.findUnique({ where: { id: listingId } })
      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      }
      if (!listing.isPublished && !privilegedUser) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      targetUnitId = listing.unitId
    }

    if (!privilegedUser && !listingId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const unit = await prisma.propertyUnit.findUnique({
      where: { id: String(targetUnitId) },
      include: { fileUpload: true },
    })
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const ifcPath = unit.fileUpload?.ifcFilePath
    if (!ifcPath) {
      return NextResponse.json({ error: 'No IFC file for this unit' }, { status: 404 })
    }

    const targetPath = resolve(ifcPath)
    if (!isWithinAllowed(targetPath)) {
      return NextResponse.json({ error: 'Access to this path is not allowed' }, { status: 403 })
    }

    await stat(targetPath)
    const data = await readFile(targetPath, 'utf8')
    const ext = extname(targetPath).toLowerCase()
    const text = (ext === '.ifc' || ext === '.ifcstep' || ext === '.ifc2x3' || ext === '.ifc4') ? data : data

    const graph = buildIfcGraph(text)
    return NextResponse.json(graph)
  } catch (error: any) {
    console.error('IFC graph error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to build IFC graph' }, { status: 500 })
  }
}
