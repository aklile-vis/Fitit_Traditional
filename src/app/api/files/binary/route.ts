import { NextRequest, NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { resolve, extname, sep } from 'path'

import { getOptionalUser } from '@/lib/serverAuth'

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.glb':
      return 'model/gltf-binary'
    case '.gltf':
      return 'model/gltf+json'
    case '.ifc':
      return 'application/octet-stream' // IFC has no standard mime
    case '.usd':
    case '.usda':
      return 'application/octet-stream'
    case '.pdf':
      return 'application/pdf'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.avi':
      return 'video/avi'
    case '.txt':
      return 'text/plain; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

const cwd = process.cwd()
const allowedRoots = [
  [ 'file_storage', 'status' ],
  [ 'file_storage', 'processed' ],
  [ 'file_storage', 'models' ],
  [ 'file_storage', 'media' ],
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

async function ensureListingAllowsAccess(listingId: string, targetPath: string) {
  const { prisma } = await import('@/lib/database')
  const listing = await prisma.unitListing.findUnique({
    where: { id: listingId },
    include: { 
      unit: { 
        include: { 
          fileUpload: true,
          media: true // Include media files
        } 
      } 
    },
  })
  if (!listing || !listing.isPublished) {
    return false
  }
  
  // Check 3D model assets
  const assetPaths = [
    listing.unit?.fileUpload?.glbFilePath,
    listing.unit?.fileUpload?.ifcFilePath,
    listing.unit?.fileUpload?.processedFilePath,
  ]
  
  // Check media files
  const mediaPaths = listing.unit?.media?.map(media => media.url) || []
  
  const allPaths = [...assetPaths, ...mediaPaths].filter(Boolean)
  
  // Check if the target path matches any of the allowed paths
  return allPaths.some((assetPath) => {
    if (!assetPath) return false
    const resolvedAssetPath = resolve(String(assetPath))
    return resolvedAssetPath === targetPath
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePathParam = searchParams.get('path')
    if (!filePathParam) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 })
    }

    const targetPath = resolve(filePathParam)
    if (!isWithinAllowed(targetPath)) {
      return NextResponse.json({ error: 'Access to this path is not allowed' }, { status: 403 })
    }

    const listingId = searchParams.get('listingId')
    const user = getOptionalUser(request, true)
    const privilegedUser = user && (user.role === 'AGENT' || user.role === 'ADMIN')

    if (!privilegedUser) {
      if (!listingId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      const allowed = await ensureListingAllowsAccess(listingId, targetPath)
      if (!allowed) {
        return NextResponse.json({ error: 'Asset not available for this listing' }, { status: 403 })
      }
    }

    const { size: fileSize } = await stat(targetPath)
    const ext = extname(targetPath)
    const ct = contentTypeFromExt(ext)

    const range = request.headers.get('range') || request.headers.get('Range')

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/)
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        })
      }

      let start: number
      let end: number

      const startStr = match[1]
      const endStr = match[2]
      if (startStr === '' && endStr) {
        // Suffix byte range: bytes=-N
        const suffixLength = parseInt(endStr, 10)
        if (isNaN(suffixLength)) {
          return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } })
        }
        start = Math.max(0, fileSize - suffixLength)
        end = fileSize - 1
      } else {
        start = parseInt(startStr, 10)
        end = endStr ? parseInt(endStr, 10) : fileSize - 1
      }

      // Validate range
      if (isNaN(start) || isNaN(end) || start < 0 || end < start || start >= fileSize) {
        return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } })
      }

      const chunkSize = end - start + 1
      const nodeStream = createReadStream(targetPath, { start, end })
      const webStream = Readable.toWeb(nodeStream as any) as unknown as ReadableStream

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': ct,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `inline; filename="file${ext || ''}"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          ...(ct === 'application/pdf' && {
            'Content-Security-Policy': "frame-ancestors 'self'",
            'X-Download-Options': 'noopen',
          }),
        },
      })
    }

    // No range header: stream full file
    const nodeStream = createReadStream(targetPath)
    const webStream = Readable.toWeb(nodeStream as any) as unknown as ReadableStream

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="file${ext || ''}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        ...(ct === 'application/pdf' && {
          'Content-Security-Policy': "frame-ancestors 'self'",
          'X-Download-Options': 'noopen',
        }),
      },
    })
  } catch (error) {
    console.error('Binary file stream error:', error)
    return NextResponse.json({ error: 'Failed to stream file' }, { status: 500 })
  }
}

// Provide HEAD for lightweight checks (content-type/length)
export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePathParam = searchParams.get('path')
    if (!filePathParam) return new NextResponse(null, { status: 400 })
    const targetPath = resolve(filePathParam)
    if (!isWithinAllowed(targetPath)) return new NextResponse(null, { status: 403 })

    const listingId = searchParams.get('listingId')
    const user = getOptionalUser(request, true)
    const privilegedUser = user && (user.role === 'AGENT' || user.role === 'ADMIN')

    if (!privilegedUser) {
      if (!listingId) return new NextResponse(null, { status: 401 })
      const allowed = await ensureListingAllowsAccess(listingId, targetPath)
      if (!allowed) return new NextResponse(null, { status: 403 })
    }

    const st = await stat(targetPath)
    const ext = extname(targetPath)
    const ct = contentTypeFromExt(ext)
    return new NextResponse(null, { 
      status: 200, 
      headers: { 
        'content-type': ct, 
        'content-length': String(st.size),
        'accept-ranges': 'bytes',
      } 
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}
