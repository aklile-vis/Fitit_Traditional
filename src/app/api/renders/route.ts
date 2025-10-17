import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, resolve } from 'path'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const form = await request.formData()
    const unitId = String(form.get('unitId') || '')
    const listingId = String(form.get('listingId') || '')
    const file = form.get('image') as File | null
    if (!unitId || !file) return NextResponse.json({ error: 'unitId and image required' }, { status: 400 })

    const bytes = Buffer.from(await file.arrayBuffer())
    const dir = resolve(process.cwd(), 'file_storage', 'processed', 'renders')
    await mkdir(dir, { recursive: true })
    const ts = Date.now()
    const filename = `${unitId}_${ts}.png`
    const path = join(dir, filename)
    await writeFile(path, bytes)

    // Optionally set listing cover image
    if (listingId) {
      await prisma.unitListing.update({ where: { id: listingId }, data: { coverImage: path } })
    }

    return NextResponse.json({ success: true, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save render' }, { status: 500 })
  }
}
