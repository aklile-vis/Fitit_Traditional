import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const libs = await prisma.materialLibrary.findMany({
      orderBy: { createdAt: 'desc' },
      include: { options: true }
    })
    return NextResponse.json(libs)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list libraries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const lib = await prisma.materialLibrary.create({ data: { name: body.name, ownerId: body.ownerId || null } })
    return NextResponse.json(lib)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create library' }, { status: 500 })
  }
}
