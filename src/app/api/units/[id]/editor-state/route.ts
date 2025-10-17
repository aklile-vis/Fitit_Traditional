import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { resolve, join } from 'path'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const unit = await prisma.propertyUnit.findUnique({ where: { id: params.id } })
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    let fileJson: any = null
    if (unit.editorStatePath) {
      try { fileJson = JSON.parse(await readFile(unit.editorStatePath, 'utf8')) } catch {}
    }
    return NextResponse.json({ editorState: unit.editorState || fileJson || null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load editor state' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const unit = await prisma.propertyUnit.findUnique({ where: { id: params.id } })
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

    // Persist to disk as well
    const dir = resolve(process.cwd(), 'file_storage', 'processed', 'editor_state')
    await mkdir(dir, { recursive: true })
    const path = join(dir, `${params.id}.json`)
    await writeFile(path, JSON.stringify(body, null, 2), 'utf8')

    await prisma.propertyUnit.update({ where: { id: params.id }, data: { editorState: body, editorStatePath: path } })
    return NextResponse.json({ success: true, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save editor state' }, { status: 500 })
  }
}
