import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { getOptionalUser, requireAgent } from '@/lib/serverAuth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listing = await prisma.unitListing.findUnique({ where: { id } })
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    const viewer = getOptionalUser(request)
    const isAgent = viewer?.role === 'AGENT' || viewer?.role === 'ADMIN'
    if (!listing.isPublished && !isAgent) {
      return NextResponse.json({ error: 'Listing not available' }, { status: 404 })
    }
    const unit = await prisma.propertyUnit.findUnique({ 
      where: { id: listing.unitId }, 
      include: { 
        fileUpload: true,
        media: true
      } 
    })
    

    // Determine agent user id from creator or file uploader
    let agentUserId: string | null = null
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>("SELECT createdById FROM unit_listings WHERE id = ? LIMIT 1", id)
      const createdById = rows && rows[0] ? (rows[0].createdById as string | null) : null
      agentUserId = createdById || (unit as any)?.fileUpload?.userId || null
    } catch {
      agentUserId = (unit as any)?.fileUpload?.userId || null
    }

    // Fetch agent profile details
    let agent: any = null
    if (agentUserId) {
      try {
        const user = await prisma.user.findUnique({ where: { id: agentUserId }, include: { profile: true } })
        if (user) {
          agent = {
            id: user.id,
            name: user.name ?? null,
            email: user.email,
            phone: user.profile?.phone ?? null,
            jobTitle: user.profile?.jobTitle ?? null,
            agencyName: user.profile?.agencyName ?? null,
            avatarUrl: user.profile?.avatarUrl ?? null,
          }
        }
      } catch {}
    }


    let guidedViews: Array<{ id: string; name: string; position: number[]; target: number[] }> = []
    const editorState = unit?.editorState
    if (editorState && typeof editorState === 'object') {
      const navigation = (editorState as Record<string, unknown>).navigation
      const views = navigation && typeof navigation === 'object' ? (navigation as Record<string, unknown>).guidedViews : null
      if (Array.isArray(views)) {
        guidedViews = views
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null
            const { id, name, position, target } = entry as Record<string, unknown>
            if (!Array.isArray(position) || position.length !== 3) return null
            if (!Array.isArray(target) || target.length !== 3) return null
            const pos = position.map(Number)
            const tgt = target.map(Number)
            if (pos.some((n) => Number.isNaN(n)) || tgt.some((n) => Number.isNaN(n))) return null
            return {
              id: typeof id === 'string' && id ? id : `view-${Math.random().toString(36).slice(2)}`,
              name: typeof name === 'string' && name.trim() ? name.trim() : 'View',
              position: pos as number[],
              target: tgt as number[],
            }
          })
          .filter((value): value is { id: string; name: string; position: number[]; target: number[] } => Boolean(value))
      }
    }

    // Transform the response to match frontend expectations
    const response = {
      listing,
      unit: unit ? {
        ...unit,
        file: unit.fileUpload // Map fileUpload to file for frontend compatibility
      } : null,
      guidedViews,
      agent
    }
    
    return NextResponse.json(response)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch listing' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await request.json()

    // Normalize types for numeric/int fields
    const parseBedrooms = (value: unknown): number | undefined => {
      if (value == null) return undefined
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        if (value.trim().toLowerCase() === 'studio') return 0
        const n = parseInt(value, 10)
        return Number.isNaN(n) ? 0 : n
      }
      return undefined
    }
    const parseBathrooms = (value: unknown): number | undefined => {
      if (value == null) return undefined
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const n = parseInt(value, 10)
        return Number.isNaN(n) ? 1 : n
      }
      return undefined
    }

    const updated = await prisma.unitListing.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        address: body.address ?? undefined,
        city: body.city ?? undefined,
        subCity: body.subCity ?? undefined,
        bedrooms: parseBedrooms(body.bedrooms),
        bathrooms: parseBathrooms(body.bathrooms),
        areaSqm: body.areaSqm ?? undefined,
        basePrice: body.basePrice != null ? parseFloat(body.basePrice) : undefined,
        coverImage: body.coverImage ?? undefined,
        isPublished: body.isPublished ?? undefined,
        propertyType: body.propertyType ?? undefined,
        // Optional fields commonly edited via the upload wizard
        currency: typeof body.currency === 'string' ? body.currency.toUpperCase() : undefined,
        amenities:
          Array.isArray(body.amenities) ? (JSON.stringify(body.amenities) as any) : undefined,
        features:
          Array.isArray(body.features) ? (JSON.stringify(body.features) as any) : undefined,
        floorPlans:
          Array.isArray(body.floorPlans) ? (JSON.stringify(body.floorPlans) as any) : undefined,
      }
    })

    // If media arrays are provided, replace unit media of those types
    const unitId = (updated as any).unitId as string | undefined
    if (unitId) {
      // Images
      if (Array.isArray(body.images)) {
        try {
          await prisma.media.deleteMany({ where: { unitId, type: 'IMAGE' as any } })
          const cover = (updated as any).coverImage ?? body.coverImage
          const images: Array<{ url: string }> = body.images.filter((u: unknown): u is string => typeof u === 'string' && u)
          if (images.length > 0) {
            await prisma.media.createMany({
              data: images.map((it, idx) => ({
                type: 'IMAGE' as any,
                role: it === cover ? ('COVER' as any) : ('GALLERY' as any),
                url: it,
                sortOrder: idx,
                unitId,
                uploadedById: auth.user.id,
              })),
            })
          }
        } catch {}
      }

      // Videos
      if (Array.isArray(body.videos)) {
        try {
          await prisma.media.deleteMany({ where: { unitId, type: 'VIDEO' as any } })
          const videos: Array<string> = body.videos.filter((u: unknown): u is string => typeof u === 'string' && u)
          if (videos.length > 0) {
            await prisma.media.createMany({
              data: videos.map((u, idx) => ({
                type: 'VIDEO' as any,
                role: 'GALLERY' as any,
                url: u,
                sortOrder: idx,
                unitId,
                uploadedById: auth.user.id,
              })),
            })
          }
        } catch {}
      }

      // Floor Plans
      if (Array.isArray(body.floorPlans)) {
        try {
          await prisma.media.deleteMany({ where: { unitId, type: 'DOCUMENT' as any, role: 'FLOORPLAN' as any } })
          const floorPlans: Array<string> = body.floorPlans.filter((u: unknown): u is string => typeof u === 'string' && u)
          if (floorPlans.length > 0) {
            await prisma.media.createMany({
              data: floorPlans.map((u, idx) => ({
                type: 'DOCUMENT' as any,
                role: 'FLOORPLAN' as any,
                url: u,
                sortOrder: idx,
                unitId,
                uploadedById: auth.user.id,
              })),
            })
          }
        } catch {}
      }
    }
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update listing' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await request.json()
    if (typeof body.isPublished !== 'boolean') {
      return NextResponse.json({ error: 'isPublished boolean required' }, { status: 400 })
    }
    const updated = await prisma.unitListing.update({ where: { id }, data: { isPublished: body.isPublished } })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to publish/unpublish' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { id: listingId } = await params

    // Verify the listing exists and belongs to the agent (best-effort)
    // Supports legacy rows without createdById by falling back to file owner
    try {
      await prisma.$executeRawUnsafe("ALTER TABLE unit_listings ADD COLUMN createdById TEXT")
    } catch {
      // ignore if exists
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ul.id
       FROM unit_listings ul
       LEFT JOIN property_units pu ON pu.id = ul.unitId
       LEFT JOIN file_uploads fu ON fu.id = pu.fileUploadId
       WHERE ul.id = ? AND (ul.createdById = ? OR (ul.createdById IS NULL AND fu.userId = ?))
       LIMIT 1`,
      listingId,
      auth.user.id,
      auth.user.id,
    )

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Listing not found or not owned by you' }, { status: 404 })
    }

    // Clean up dependent rows first to satisfy FKs
    await prisma.savedListing.deleteMany({ where: { listingId } })

    // Delete the listing itself (unit remains)
    await prisma.unitListing.delete({ where: { id: listingId } })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete listing' }, { status: 500 })
  }
}
