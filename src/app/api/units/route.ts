import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function GET(_req: NextRequest) {
  try {
    const auth = requireAgent(_req)
    if (!auth.ok) return auth.response

    const units = await prisma.propertyUnit.findMany({ include: { fileUpload: true, listing: true } })
    const payload = units.map(u => ({
      id: u.id,
      name: u.name,
      file: u.fileUpload ? { id: u.fileUpload.id, glbPath: u.fileUpload.glbFilePath, ifcPath: u.fileUpload.ifcFilePath } : null,
      listing: u.listing || null,
    }))
    return NextResponse.json(payload)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list units' }, { status: 500 })
  }
}
