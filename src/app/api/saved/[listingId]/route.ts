import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireUser } from '@/lib/serverAuth'

async function ensureTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS saved_listings (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        listingId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT saved_user_listing UNIQUE (userId, listingId)
      );
    `)
  } catch {}
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  const auth = requireUser(request)
  if (!auth.ok) return auth.response
  await ensureTable()

  try {
    const { listingId } = await params
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 })

    await prisma.$executeRawUnsafe(
      `DELETE FROM saved_listings WHERE userId = ? AND listingId = ?`,
      auth.user.id,
      listingId
    )

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to remove saved listing' }, { status: 500 })
  }
}

