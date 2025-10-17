import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

async function ensureCreatedByColumn() {
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE unit_listings ADD COLUMN createdById TEXT")
  } catch {
    // ignore if exists
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAgent(request)
  if (!auth.ok) return auth.response
  await ensureCreatedByColumn()

  try {
    const userId = auth.user.id
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ul.*
       FROM unit_listings ul
       LEFT JOIN property_units pu ON pu.id = ul.unitId
       LEFT JOIN file_uploads fu ON fu.id = pu.fileUploadId
       WHERE ul.createdById = ? OR (ul.createdById IS NULL AND fu.userId = ?)
       ORDER BY ul.updatedAt DESC`,
      userId,
      userId
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch agent listings' }, { status: 500 })
  }
}

