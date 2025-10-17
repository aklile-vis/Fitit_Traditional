import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { extname, resolve, sep } from 'path'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.glb':
      return 'model/gltf-binary'
    case '.gltf':
      return 'model/gltf+json'
    case '.ifc':
      return 'application/octet-stream'
    case '.usd':
    case '.usda':
      return 'application/octet-stream'
    default:
      return 'application/octet-stream'
  }
}

const cwd = process.cwd()
const allowedRoots = [
  [ 'file_storage', 'status' ],
  [ 'file_storage', 'processed' ],
  [ 'file_storage', 'models' ],
  [ 'processed' ],
  [ 'models' ],
  [ 'uploads' ],
  [ 'output' ],
  [ 'backend', 'file_storage', 'status' ],
  [ 'backend', 'file_storage', 'processed' ],
  [ 'backend', 'file_storage', 'models' ],
  [ 'backend', 'uploads' ],
  [ 'backend', 'output' ],
].map(parts => resolve(cwd, ...parts))

function isWithinAllowed(pathname: string) {
  const targetPath = resolve(pathname)
  return allowedRoots.some(root => targetPath === root || targetPath.startsWith(root + sep))
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const auth = requireAgent(request, { allowQueryToken: true })
    if (!auth.ok) {
      return auth.response
    }

    const { id } = context.params
    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'glb').toLowerCase()

    const file = await prisma.fileUpload.findUnique({ where: { id } })
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let path: string | null = null
    if (type === 'original') path = file.filePath
    else if (type === 'processed') path = file.processedFilePath || null
    else if (type === 'glb') path = file.glbFilePath || null
    else if (type === 'ifc') path = file.ifcFilePath || null
    else if (type === 'usd') path = null // not stored yet

    if (!path) return NextResponse.json({ error: 'Requested file not available' }, { status: 404 })

    if (!isWithinAllowed(path)) {
      return NextResponse.json({ error: 'Access to this path is not allowed' }, { status: 403 })
    }

    await stat(path)
    const data = await readFile(path)
    const ct = contentTypeFromExt(extname(path))
    const bufferArray = new Uint8Array(data)
    const arrayBuffer = bufferArray.buffer.slice(bufferArray.byteOffset, bufferArray.byteOffset + bufferArray.byteLength)
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': ct,
        'Content-Disposition': `inline; filename="${type}${extname(path)}"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (e) {
    console.error('files/[id] error:', e)
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
  }
}
