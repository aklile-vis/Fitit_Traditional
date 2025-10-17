import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { randomUUID } from 'crypto'
import { requireUser } from '@/lib/serverAuth'

// Ensure the saved_listings table exists (for SQLite when migrations aren't applied)
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

export async function GET(request: NextRequest) {
  const auth = requireUser(request)
  if (!auth.ok) return auth.response
  await ensureTable()

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ul.*,
             sl.createdAt as savedAt
      FROM saved_listings sl
      JOIN unit_listings ul ON ul.id = sl.listingId
      WHERE sl.userId = ?
      ORDER BY sl.createdAt DESC
    `, auth.user.id)

    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch saved listings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireUser(request)
  if (!auth.ok) return auth.response
  await ensureTable()

  try {
    const body = await request.json().catch(() => ({} as any))
    const listingId = String(body?.listingId || '')
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 })

    // Validate listing exists
    const exists = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id FROM unit_listings WHERE id = ? LIMIT 1',
      listingId
    )
    if (!exists?.length) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Insert or ignore on conflict
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO saved_listings (id, userId, listingId, createdAt)
       VALUES (?, ?, ?, datetime('now'))`,
      randomUUID(),
      auth.user.id,
      listingId
    )

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save listing' }, { status: 500 })
  }
}
