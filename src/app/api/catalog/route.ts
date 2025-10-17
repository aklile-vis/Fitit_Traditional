import { readdir, readFile, stat } from 'fs/promises'
import { join, resolve } from 'path'

import { NextResponse } from 'next/server'

type MaterialManifest = {
  slug?: string
  name?: string
  description?: string
  textures?: Record<string, string>
  targets?: string[]
  properties?: Record<string, unknown>
  source?: Record<string, unknown>
}

type FixtureManifest = {
  slug?: string
  name?: string
  description?: string
  modelPath?: string
  thumbnail?: string
  metadata?: Record<string, unknown>
  source?: Record<string, unknown>
}

type StyleManifest = {
  slug?: string
  name?: string
  description?: string
  materials?: Array<Record<string, unknown>>
  fixtures?: Array<Record<string, unknown>>
  metadata?: Record<string, unknown>
}

const ASSETS_ROOT = resolve(process.cwd(), 'public', 'assets')

export async function GET() {
  try {
    const [materials, fixtures, styles] = await Promise.all([
      loadMaterials(),
      loadFixtures(),
      loadStyles(),
    ])
    return NextResponse.json({ materials, fixtures, styles })
  } catch (err) {
    console.error('Catalog route failed', err)
    return NextResponse.json({ error: (err as Error).message || 'Unable to load catalog' }, { status: 500 })
  }
}

async function loadMaterials() {
  const dir = join(ASSETS_ROOT, 'materials')
  if (!(await exists(dir))) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const results: MaterialManifest[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(dir, entry.name, 'material.json')
    if (!(await exists(manifestPath))) continue
    try {
      const data = JSON.parse(await readFile(manifestPath, 'utf8')) as MaterialManifest
      results.push({
        slug: data.slug || entry.name,
        name: data.name || entry.name,
        description: data.description,
        textures: data.textures || {},
        targets: data.targets || [],
        properties: data.properties || {},
        source: data.source || {},
      })
    } catch (err) {
      console.warn('Failed to parse material manifest', manifestPath, err)
    }
  }
  return results
}

async function loadFixtures() {
  const dir = join(ASSETS_ROOT, 'fixtures')
  if (!(await exists(dir))) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const results: FixtureManifest[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(dir, entry.name, 'metadata.json')
    if (!(await exists(manifestPath))) continue
    try {
      const data = JSON.parse(await readFile(manifestPath, 'utf8')) as FixtureManifest
      results.push({
        slug: data.slug || entry.name,
        name: data.name || entry.name,
        description: data.description,
        modelPath: data.modelPath,
        thumbnail: data.thumbnail,
        metadata: data.metadata || {},
        source: data.source || {},
      })
    } catch (err) {
      console.warn('Failed to parse fixture manifest', manifestPath, err)
    }
  }
  return results
}

async function loadStyles() {
  const dir = join(ASSETS_ROOT, 'styles')
  if (!(await exists(dir))) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const results: StyleManifest[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(dir, entry.name, 'manifest.json')
    if (!(await exists(manifestPath))) continue
    try {
      const data = JSON.parse(await readFile(manifestPath, 'utf8')) as StyleManifest
      results.push({
        slug: data.slug || entry.name,
        name: data.name || entry.name,
        description: data.description,
        materials: data.materials || [],
        fixtures: data.fixtures || [],
        metadata: data.metadata || {},
      })
    } catch (err) {
      console.warn('Failed to parse style manifest', manifestPath, err)
    }
  }
  return results
}

async function exists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
