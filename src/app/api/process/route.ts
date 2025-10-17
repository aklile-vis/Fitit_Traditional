import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { processCadFile, getProcessingStatus } from '@/lib/cadProcessor'
import { requireAgent } from '@/lib/serverAuth'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { filePath } = await request.json()

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const extension = path.extname(filePath).toLowerCase()
    const allowedExtensions = new Set([
      '.ifc',
      '.ifczip',
      '.glb',
      '.gltf',
      '.usd',
      '.usdz',
      '.obj',
      '.fbx',
      '.skp',
      '.blend',
    ])

    if (!allowedExtensions.has(extension)) {
      return NextResponse.json(
        { error: `Unsupported file type for processing: ${extension || 'unknown'}` },
        { status: 400 }
      )
    }

    // Process the CAD file using our Python backend
    const result = await processCadFile(filePath, auth.user.id)

    return NextResponse.json({
      message: 'File processed successfully',
      result
    })
  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    const status = await getProcessingStatus(fileId)

    return NextResponse.json({
      status
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
