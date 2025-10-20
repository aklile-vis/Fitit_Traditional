import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

// Create listing or list listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const onlyPublished = searchParams.get('published') === 'true'
    if (!onlyPublished) {
      const auth = requireAgent(request)
      if (!auth.ok) return auth.response
    }
    const listings = await prisma.unitListing.findMany({
      where: onlyPublished ? { isPublished: true } : undefined,
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(listings)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list listings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const required = ['title', 'basePrice'] // unitId is now optional
    for (const k of required) {
      if (body[k] == null || body[k] === '') {
        return NextResponse.json({ error: `${k} is required` }, { status: 400 })
      }
    }

    const currency = typeof body.currency === 'string' && body.currency.trim().length === 3
      ? body.currency.trim().toUpperCase()
      : 'ETB'
    const basePrice = parseFloat(body.basePrice)
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return NextResponse.json({ error: 'basePrice must be a positive number' }, { status: 400 })
    }

    // Parse bedrooms and bathrooms from string values
    const parseBedrooms = (value: string | number): number => {
      if (typeof value === 'number') return value
      if (value === 'Studio') return 0
      const num = parseInt(value, 10)
      return isNaN(num) ? 0 : num
    }

    const parseBathrooms = (value: string | number): number => {
      if (typeof value === 'number') return value
      const num = parseInt(value, 10)
      return isNaN(num) ? 1 : num
    }
    
    const listingData = {
      title: body.title,
      description: body.description ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      subCity: body.subCity ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      bedrooms: parseBedrooms(body.bedrooms ?? 0),
      bathrooms: parseBathrooms(body.bathrooms ?? 1),
      areaSqm: body.areaSqm ?? 0,
      basePrice,
      currency,
      coverImage: body.coverImage ?? null,
      has3D: body.immersive?.has3D ?? false,
      // Default to not published, agent can publish explicitly
      isPublished: body.isPublished ?? false,
      // Store amenities and features as JSON strings
      amenities: body.amenities && Array.isArray(body.amenities) ? JSON.stringify(body.amenities) : null,
      features: body.features && Array.isArray(body.features) ? JSON.stringify(body.features) : null,
      // Store floor plans as JSON string
      floorPlans: body.floorPlans && Array.isArray(body.floorPlans) ? JSON.stringify(body.floorPlans) : null,
      // Add property type field
      propertyType: body.propertyType ?? null,
    }

    let targetUnitId = body.unitId

    // If unitId is provided, validate it and its GLB path
    if (targetUnitId) {
      const unit = await prisma.propertyUnit.findUnique({ where: { id: targetUnitId }, include: { fileUpload: true } })
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      const glbPath = unit.fileUpload?.glbFilePath
      if (!glbPath) {
        return NextResponse.json({ error: 'Model is not processed yet. Generate GLB before publishing.' }, { status: 400 })
      }
      
      // Update editorState with immersive data if provided
      if (body.immersive) {
        const editorState = {
          ...(unit.editorState as any || {}),
          immersive: {
            has3D: body.immersive.has3D || false,
          }
        }
        await prisma.propertyUnit.update({
          where: { id: targetUnitId },
          data: { editorState }
        })
      }
    } else {
      // If no unitId, create a new PropertyUnit for this listing
      const editorState = body.immersive ? {
        immersive: {
          has3D: body.immersive.has3D || false,
          glbPath: body.immersive.glbPath || null,
          ifcPath: body.immersive.ifcPath || null,
          usdPath: body.immersive.usdPath || null,
          filePath: body.immersive.filePath || null,
          fileName: body.immersive.fileName || null,
          elementsCount: body.immersive.elementsCount || 0,
          aiEnrichment: body.immersive.aiEnrichment || null,
          topologyPath: body.immersive.topologyPath || null,
          processedAt: body.immersive.processedAt || null,
          editorChanges: body.immersive.editorChanges || null,
        }
      } : null

      // Create a FileUpload record for the 3D assets if we have GLB data
      let fileUploadId = null
      if (body.immersive?.glbPath) {
        // Check if file exists
        const fs = require('fs')
        const glbPath = body.immersive.glbPath
        const fileExists = fs.existsSync(glbPath)
        
        const fileUpload = await prisma.fileUpload.create({
          data: {
            filename: body.immersive.fileName || '3d-model.glb',
            originalName: body.immersive.fileName || '3d-model.glb',
            filePath: body.immersive.filePath || '',
            fileSize: fileExists ? fs.statSync(glbPath).size : 0,
            mimeType: 'model/gltf-binary',
            status: 'COMPLETED',
            glbFilePath: body.immersive.glbPath,
            ifcFilePath: body.immersive.ifcPath || null,
            processedFilePath: body.immersive.topologyPath || null,
            userId: auth.user.id,
          }
        })
        fileUploadId = fileUpload.id
      }

      const newUnit = await prisma.propertyUnit.create({
        data: {
          name: listingData.title, // Use title as the name for PropertyUnit
          editorState: editorState,
          fileUploadId: fileUploadId,
        },
      })
      targetUnitId = newUnit.id
    }
    
    // Ensure that a unitId is always present at this point
    if (!targetUnitId) {
      return NextResponse.json({ error: 'Failed to create or find a property unit.' }, { status: 500 })
    }

    const listing = await prisma.unitListing.upsert({
      where: { unitId: targetUnitId },
      update: {
        ...(listingData as any),
      },
      create: {
        unitId: targetUnitId,
        ...(listingData as any),
      }
    })

    // Best-effort: mark creator using raw SQL for SQLite without migrations
    try {
      await prisma.$executeRawUnsafe("ALTER TABLE unit_listings ADD COLUMN createdById TEXT")
    } catch {}
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE unit_listings SET createdById = ? WHERE id = ? AND (createdById IS NULL OR createdById = \"\")',
        auth.user.id,
        (listing as any).id
      )
    } catch {}

    // Create Media entries for images and videos
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      const imageMedia = body.images.map((url: string, index: number) => ({
        type: 'IMAGE' as const,
        role: url === body.coverImage ? 'COVER' as const : 'GALLERY' as const,
        url: url,
        sortOrder: index,
        unitId: targetUnitId,
        uploadedById: auth.user?.id,
      }))
      
      await prisma.media.createMany({
        data: imageMedia
      })
    }

    if (body.videos && Array.isArray(body.videos) && body.videos.length > 0) {
      const videoMedia = body.videos.map((url: string, index: number) => ({
        type: 'VIDEO' as const,
        role: 'GALLERY' as const,
        url: url,
        sortOrder: index,
        unitId: targetUnitId,
        uploadedById: auth.user?.id,
      }))
      
      await prisma.media.createMany({
        data: videoMedia
      })
    }

    if (body.floorPlans && Array.isArray(body.floorPlans) && body.floorPlans.length > 0) {
      const floorPlanMedia = body.floorPlans.map((url: string, index: number) => ({
        type: 'DOCUMENT' as const,
        role: 'FLOORPLAN' as const,
        url: url,
        sortOrder: index,
        unitId: targetUnitId,
        uploadedById: auth.user?.id,
      }))
      
      await prisma.media.createMany({
        data: floorPlanMedia
      })
    }

    return NextResponse.json(listing)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create/update listing' }, { status: 500 })
  }
}
