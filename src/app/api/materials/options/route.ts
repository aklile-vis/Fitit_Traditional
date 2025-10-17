import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireAgent } from '@/lib/serverAuth'

export async function GET(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const libraryId = searchParams.get('libraryId') || undefined
    const where = libraryId ? { libraryId } : {}
    const options = await prisma.materialOption.findMany({ where, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(options)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list options' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAgent(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const required = ['name','category','unit','price','libraryId']
    for (const k of required) if (body[k] === undefined) return NextResponse.json({ error: `${k} required` }, { status: 400 })
    const opt = await prisma.materialOption.create({ data: {
      name: body.name,
      category: body.category,
      unit: body.unit,
      price: parseFloat(body.price),
      description: body.description || null,
      baseColorHex: body.baseColorHex || null,
      roughness: body.roughness != null ? parseFloat(body.roughness) : 0.8,
      metallic: body.metallic != null ? parseFloat(body.metallic) : 0,
      albedoUrl: body.albedoUrl || null,
      normalUrl: body.normalUrl || null,
      roughnessMapUrl: body.roughnessMapUrl || null,
      metallicMapUrl: body.metallicMapUrl || null,
      aoMapUrl: body.aoMapUrl || null,
      tilingScale: body.tilingScale != null ? parseFloat(body.tilingScale) : 1.0,
      libraryId: body.libraryId,
    } })
    return NextResponse.json(opt)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create option' }, { status: 500 })
  }
}
