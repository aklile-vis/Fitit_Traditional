import { NextRequest, NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { resolve, join } from 'path'

import { requireAgent } from '@/lib/serverAuth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { unitId } = await params
    if (!unitId) {
      return NextResponse.json({ error: 'unitId required' }, { status: 400 })
    }

    const rendersDir = resolve(process.cwd(), 'file_storage', 'processed', 'renders')
    let entries: string[] = []
    try {
      entries = await readdir(rendersDir)
    } catch {
      return NextResponse.json({ renders: [] })
    }

    const prefix = `${unitId}_`
    const paths = entries
      .filter((filename) => filename.startsWith(prefix))
      .map((filename) => join(rendersDir, filename))

    return NextResponse.json({ renders: paths })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list renders'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
