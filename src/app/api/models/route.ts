import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/database';
import { requireAgent } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
  try {
    const auth = requireAgent(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [files, total] = await Promise.all([
      prisma.fileUpload.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.fileUpload.count(),
    ])

    const stats = {
      totalProcessed: total,
      completed: await prisma.fileUpload.count({ where: { status: 'COMPLETED' } }),
      failed: await prisma.fileUpload.count({ where: { status: 'FAILED' } }),
      currentlyProcessing: await prisma.fileUpload.count({ where: { status: { in: ['UPLOADED', 'PROCESSING'] } } }),
    }

    // Adapt to the previous models shape roughly
    const models = files.map(f => ({
      id: f.id,
      fileName: f.originalName,
      originalPath: f.filePath,
      status: f.status === 'COMPLETED' ? 'completed' : (f.status === 'FAILED' ? 'failed' : 'processing'),
      elements: [],
      rooms: [],
      agentParams: {},
      ifcPath: f.ifcFilePath || undefined,
      glbPath: f.glbFilePath || undefined,
      usdPath: undefined,
      summaryPath: f.processedFilePath || undefined,
      elementsCount: 0,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      error: f.errorMessage || undefined,
    }))

    return NextResponse.json({
      models,
      stats,
      pagination: { limit, offset, total }
    })
  } catch (error) {
    console.error('Error fetching models:', error)
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request);
    if (!auth.ok) return auth.response;

    const data = await request.json()
    const file = await prisma.fileUpload.create({
      data: {
        filename: data.fileName || data.filename || 'upload.cad',
        originalName: data.fileName || data.filename || 'upload.cad',
        filePath: data.originalPath || '',
        fileSize: data.fileSize || 0,
        mimeType: data.mimeType || 'application/octet-stream',
        status: data.status === 'completed' ? 'COMPLETED' : data.status === 'failed' ? 'FAILED' : 'PROCESSING',
        ifcFilePath: data.ifcPath,
        glbFilePath: data.glbPath,
        processedFilePath: data.summaryPath,
        errorMessage: data.error,
        user: data.userId ? { connect: { id: data.userId } } : undefined as any,
      }
    })
    return NextResponse.json(file)
  } catch (error) {
    console.error('Error creating model:', error)
    return NextResponse.json({ error: 'Failed to create model' }, { status: 500 })
  }
}
