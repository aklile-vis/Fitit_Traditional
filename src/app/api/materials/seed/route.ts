import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Ensures a preset "Default Library" exists with a basic set of options.
// - POST: creates if missing (idempotent) and returns the library and option count
export async function POST(_req: NextRequest) {
  try {
    let lib = await prisma.materialLibrary.findFirst({ where: { name: 'Default Library' } })
    if (!lib) {
      lib = await prisma.materialLibrary.create({ data: { name: 'Default Library' } })
    }
    const count = await prisma.materialOption.count({ where: { libraryId: lib.id } })
    if (count === 0) {
      const options = [
        { name: 'White Paint', category: 'wall', unit: 'm2', price: 12.5, baseColorHex: '#f5f5f5' },
        { name: 'Light Gray Paint', category: 'wall', unit: 'm2', price: 13.0, baseColorHex: '#d9d9d9' },
        { name: 'Oak Wood Floor', category: 'floor', unit: 'm2', price: 45.0, baseColorHex: '#b58a58', albedoUrl: '/textures/wood.jpg', tilingScale: 2.0 },
        { name: 'Ceramic Tile', category: 'floor', unit: 'm2', price: 32.0, baseColorHex: '#cccccc', albedoUrl: '/textures/marble.jpg', tilingScale: 3.0 },
        { name: 'Ceiling White', category: 'ceiling', unit: 'm2', price: 10.0, baseColorHex: '#ffffff' },
        { name: 'Glass Window', category: 'window', unit: 'unit', price: 120.0, baseColorHex: '#a9c8ff' },
        { name: 'Wood Door', category: 'door', unit: 'unit', price: 180.0, baseColorHex: '#6b4b2a', albedoUrl: '/textures/wood.jpg', tilingScale: 2.0 },
      ] as any[]
      // create individually to support optional fields
      for (const o of options) {
        await prisma.materialOption.create({ data: { ...o, libraryId: lib!.id } as any })
      }
    }
    const total = await prisma.materialOption.count({ where: { libraryId: lib.id } })
    return NextResponse.json({ message: 'Default library ready', libraryId: lib.id, totalOptions: total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to seed default library' }, { status: 500 })
  }
}
