import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const file = await prisma.fileUpload.findUnique({ where: { id } })
    if (!file) return NextResponse.json({ error: 'Model not found' }, { status: 404 })

    const model = {
      id: file.id,
      fileName: file.originalName,
      originalPath: file.filePath,
      status: file.status === 'COMPLETED' ? 'completed' : (file.status === 'FAILED' ? 'failed' : 'processing'),
      elements: [],
      rooms: [],
      agentParams: {},
      ifcPath: file.ifcFilePath || undefined,
      glbPath: file.glbFilePath || undefined,
      usdPath: undefined,
      summaryPath: file.processedFilePath || undefined,
      elementsCount: 0,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      error: file.errorMessage || undefined,
    }
    return NextResponse.json(model)
  } catch (error) {
    console.error('Error fetching model:', error)
    return NextResponse.json({ error: 'Failed to fetch model' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const updates = await request.json()
    const file = await prisma.fileUpload.update({
      where: { id },
      data: {
        status: updates.status === 'completed' ? 'COMPLETED' : (updates.status === 'failed' ? 'FAILED' : undefined),
        ifcFilePath: updates.ifcPath,
        glbFilePath: updates.glbPath,
        processedFilePath: updates.summaryPath,
        errorMessage: updates.error,
      }
    })
    return NextResponse.json(file)
  } catch (error) {
    console.error('Error updating model:', error)
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    await prisma.fileUpload.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting model:', error)
    return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 })
  }
}
