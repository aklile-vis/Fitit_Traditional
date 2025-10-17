import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const body = await request.json()

    const file = await prisma.fileUpload.create({
      data: {
        filename: body.fileName || 'upload.cad',
        originalName: body.fileName || 'upload.cad',
        filePath: body.filePath || '',
        fileSize: body.fileSize || 0,
        mimeType: body.mimeType || 'application/octet-stream',
        status: body.status === 'completed' ? 'COMPLETED' : body.status === 'failed' ? 'FAILED' : 'PROCESSING',
        processedFilePath: body.summaryPath,
        ifcFilePath: body.ifcPath,
        glbFilePath: body.glbPath,
        errorMessage: body.error,
        userId: auth.user.id,
      }
    })
    // Create or upsert a PropertyUnit linked to this file upload for whitelisting
    const unit = await prisma.propertyUnit.create({
      data: {
        name: body.unitName || body.fileName || 'Unit',
        fileUploadId: file.id,
      }
    })

    return NextResponse.json({ id: file.id, unitId: unit.id })
  } catch (e) {
    console.error('ingest error:', e)
    return NextResponse.json({ error: 'Failed to ingest model' }, { status: 500 })
  }
}
