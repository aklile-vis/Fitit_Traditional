import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { saveUploadedFile } from '@/lib/fileStorage'
import { requireAgent } from '@/lib/serverAuth'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/ifc',
      'application/vnd.ifc',
      'model/gltf-binary',
      'model/gltf+json',
      'model/vnd.usd',
      'model/vnd.usdz+zip',
      'model/obj',
      'model/fbx',
      'application/vnd.sketchup.skp',
      'application/octet-stream',
      'application/zip',
    ]

    const lower = file.name.toLowerCase()
    const hasAllowedExtension = [
      '.ifc',
      '.ifcxml',
      '.ifczip',
      '.glb',
      '.gltf',
      '.usd',
      '.usdz',
      '.obj',
      '.fbx',
      '.skp',
      '.blend',
      '.zip',
    ].some((ext) => lower.endsWith(ext))

    if (!allowedTypes.includes(file.type) && !hasAllowedExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed formats: IFC, GLB/GLTF, USD/USDZ, OBJ/FBX, SKP, BLEND, ZIP.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save file
    const fileUpload = await saveUploadedFile(
      buffer,
      file.name,
      file.type,
      auth.user.id,
      projectId || undefined
    )

    // Create or update project
    let project
    if (projectId) {
      project = await prisma.project.findUnique({
        where: { id: projectId }
      })
    }

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: `Project ${file.name}`,
          description: `CAD file processing project for ${file.name}`,
          userId: auth.user.id
        }
      })
    }

    // Update file with project ID
    await prisma.fileUpload.update({
      where: { id: fileUpload.id },
      data: { projectId: project.id }
    })

    return NextResponse.json({
      message: 'File uploaded successfully',
      file: {
        id: fileUpload.id,
        filename: fileUpload.filename,
        originalName: fileUpload.originalName,
        fileSize: fileUpload.fileSize,
        mimeType: fileUpload.mimeType,
        status: fileUpload.status,
        createdAt: fileUpload.createdAt
      },
      project: {
        id: project.id,
        name: project.name,
        status: project.status
      }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
