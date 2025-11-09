import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'

async function ensureCreatedByColumn() {
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE unit_listings ADD COLUMN createdById TEXT")
  } catch {
    // ignore if exists
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch user with profile - only for agents/admins
    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only return profile for agents and admins
    if (user.role !== 'AGENT' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Profile not available' }, { status: 404 })
    }

    // Fetch agent's published listings
    await ensureCreatedByColumn()
    let listings: any[] = []
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT ul.*
         FROM unit_listings ul
         LEFT JOIN property_units pu ON pu.id = ul.unitId
         LEFT JOIN file_uploads fu ON fu.id = pu.fileUploadId
         WHERE ul.isPublished = 1 
           AND (ul.createdById = ? OR (ul.createdById IS NULL AND fu.userId = ?))
         ORDER BY ul.updatedAt DESC
         LIMIT 12`,
        id,
        id
      )
      listings = rows || []
    } catch (error) {
      console.error('Error fetching agent listings:', error)
      // Continue without listings if there's an error
    }

    // Return public profile information with listings
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: {
        phone: user.profile?.phone ?? null,
        jobTitle: user.profile?.jobTitle ?? null,
        agencyName: user.profile?.agencyName ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
      },
      listings: listings.map((l: any) => ({
        id: l.id,
        title: l.title || 'Untitled',
        description: l.description ?? null,
        coverImage: l.coverImage ?? null,
        basePrice: l.basePrice ?? 0,
        currency: l.currency || 'ETB',
        address: l.address ?? null,
        city: l.city ?? null,
        subCity: l.subCity ?? null,
        bedrooms: l.bedrooms ?? 0,
        bathrooms: l.bathrooms ?? 0,
        areaSqm: l.areaSqm ?? 0,
      })),
    })
  } catch (error) {
    console.error('Error fetching agent profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

