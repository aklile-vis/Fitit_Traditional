import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'

import { requireAgent } from '@/lib/serverAuth'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type for images, videos, and documents
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/avi',
      'application/pdf'
    ]

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.avi', '.pdf']
    const extension = extname(file.name || '').toLowerCase()
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: images (jpg, png, gif, webp), videos (mp4, webm, mov, avi), and documents (pdf)` },
        { status: 400 }
      )
    }

    // Create media directory
    const mediaDir = join(process.cwd(), 'file_storage', 'media')
    await mkdir(mediaDir, { recursive: true })

    // Generate unique filename
    const fileId = uuidv4()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `${timestamp}_${fileId}_${file.name}`
    const filePath = join(mediaDir, fileName)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Return just the relative path, not a full URL
    const relativePath = `file_storage/media/${fileName}`

    return NextResponse.json({
      success: true,
      url: relativePath, // Just the path, not a full URL
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type
    })

  } catch (error) {
    console.error('Media upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload media file' },
      { status: 500 }
    )
  }
}
