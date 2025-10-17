import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Seeds a free PBR material library using Poly Haven CDN links (CC0).
// Note: Requires network access in the runtime for textures to load.
export async function POST(_req: NextRequest) {
  try {
    const libName = 'Free PBR Library (Poly Haven 1K)'
    let lib = await prisma.materialLibrary.findFirst({ where: { name: libName } })
    if (!lib) lib = await prisma.materialLibrary.create({ data: { name: libName } })

    const existing = await prisma.materialOption.count({ where: { libraryId: lib.id } })
    if (existing === 0) {
      const base = 'https://dl.polyhaven.org/file/ph-assets/Textures/JPG/1k'
      const pack = [
        {
          name: 'Oak Wood Floor (PH)', category: 'floor', unit: 'm2', price: 45.0, tilingScale: 2.0,
          albedoUrl: `${base}/WoodFloor044/WoodFloor044_1K_Color.jpg`,
          normalUrl: `${base}/WoodFloor044/WoodFloor044_1K_NormalDX.jpg`,
          roughnessMapUrl: `${base}/WoodFloor044/WoodFloor044_1K_Roughness.jpg`,
          metallicMapUrl: null,
          aoMapUrl: `${base}/WoodFloor044/WoodFloor044_1K_AO.jpg`,
          baseColorHex: '#b58a58'
        },
        {
          name: 'Ceramic Tile (PH)', category: 'floor', unit: 'm2', price: 32.0, tilingScale: 3.0,
          albedoUrl: `${base}/Tiles081/Tiles081_1K_Color.jpg`,
          normalUrl: `${base}/Tiles081/Tiles081_1K_NormalDX.jpg`,
          roughnessMapUrl: `${base}/Tiles081/Tiles081_1K_Roughness.jpg`,
          metallicMapUrl: null,
          aoMapUrl: `${base}/Tiles081/Tiles081_1K_AO.jpg`,
          baseColorHex: '#cccccc'
        },
        {
          name: 'Paint White (PH)', category: 'wall', unit: 'm2', price: 12.5, tilingScale: 1.0,
          albedoUrl: `${base}/PaintedPlaster001/PaintedPlaster001_1K_Color.jpg`,
          normalUrl: `${base}/PaintedPlaster001/PaintedPlaster001_1K_NormalDX.jpg`,
          roughnessMapUrl: `${base}/PaintedPlaster001/PaintedPlaster001_1K_Roughness.jpg`,
          metallicMapUrl: null,
          aoMapUrl: `${base}/PaintedPlaster001/PaintedPlaster001_1K_AO.jpg`,
          baseColorHex: '#f5f5f5'
        },
        {
          name: 'Ceiling White (PH)', category: 'ceiling', unit: 'm2', price: 10.0, tilingScale: 1.0,
          albedoUrl: `${base}/Plaster002/Plaster002_1K_Color.jpg`,
          normalUrl: `${base}/Plaster002/Plaster002_1K_NormalDX.jpg`,
          roughnessMapUrl: `${base}/Plaster002/Plaster002_1K_Roughness.jpg`,
          metallicMapUrl: null,
          aoMapUrl: `${base}/Plaster002/Plaster002_1K_AO.jpg`,
          baseColorHex: '#ffffff'
        }
      ]
      for (const o of pack) {
        await prisma.materialOption.create({ data: { ...o, libraryId: lib.id } as any })
      }
    }
    const total = await prisma.materialOption.count({ where: { libraryId: lib.id } })
    return NextResponse.json({ message: 'Seeded free PBR library', libraryId: lib.id, totalOptions: total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to seed free library' }, { status: 500 })
  }
}

