import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const list = await prisma.unitMaterialWhitelist.findMany({
      where: { unitId: id },
      include: { option: true }
    })
    return NextResponse.json(list)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch whitelist' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { id } = await context.params
    const body = await request.json()
    if (!body.optionId) return NextResponse.json({ error: 'optionId required' }, { status: 400 })
    const buyerReady = typeof body.buyerReady === 'boolean' ? body.buyerReady : undefined
    const w = await prisma.unitMaterialWhitelist.upsert({
      where: { unitId_optionId: { unitId: id, optionId: body.optionId } },
      update: {
        overridePrice: body.overridePrice ?? null,
        ...(buyerReady === undefined ? {} : { buyerReady })
      },
      create: {
        unitId: id,
        optionId: body.optionId,
        overridePrice: body.overridePrice ?? null,
        buyerReady: buyerReady ?? true,
      },
      include: { option: true },
    })
    return NextResponse.json(w)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update whitelist' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const optionId = searchParams.get('optionId')
    if (!optionId) return NextResponse.json({ error: 'optionId required' }, { status: 400 })
    await prisma.unitMaterialWhitelist.delete({ where: { unitId_optionId: { unitId: id, optionId } } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete whitelist entry' }, { status: 500 })
  }
}
