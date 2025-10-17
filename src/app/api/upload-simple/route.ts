import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

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
    const buffer = new Uint8Array(bytes)

    // Save file to local storage
    const fileName = `${Date.now()}-${file.name}`
    const filePath = resolve(process.cwd(), 'uploads', fileName)

    // Ensure uploads directory exists and persist file
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, buffer)

    return NextResponse.json({
      message: 'File uploaded successfully',
      filePath: filePath,
      fileName: file.name,
      fileSize: file.size
    })
  } catch (error: unknown) {
    console.error('Upload error:', error)
    const details = error instanceof Error ? error.message : undefined
    return NextResponse.json(
      { error: 'Internal server error', details },
      { status: 500 }
    )
  }
}
