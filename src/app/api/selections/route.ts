import { readFile } from 'fs/promises'

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/database'
import { requireUser } from '@/lib/serverAuth'

const MATERIAL_CATEGORIES = ['wall', 'floor', 'ceiling'] as const
type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number]

type CatalogAssignments = {
  surfaceDefaults?: Record<string, string>
  rooms?: Array<{
    materials?: Record<string, { material?: string | null } | null> | null
  }> | null
} | null

function tokenizeIdentifier(value?: string | null): string[] {
  if (!value) return []
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
}

function optionMatchesSlug(option: { name: string; albedoUrl?: string | null }, slug: string): boolean {
  if (!slug) return false
  const slugTokens = tokenizeIdentifier(slug)
  if (slugTokens.length === 0) return false
  const nameTokens = tokenizeIdentifier(option.name)
  if (slugTokens.every((token) => nameTokens.includes(token))) return true
  const nameJoined = nameTokens.join('')
  const slugJoined = slugTokens.join('')
  if (nameJoined && (nameJoined.includes(slugJoined) || slugJoined.includes(nameJoined))) return true
  const slugUnderscore = slugTokens.join('_')
  const albedo = option.albedoUrl ? option.albedoUrl.toLowerCase() : ''
  if (albedo && slugUnderscore && albedo.includes(slugUnderscore)) return true
  return false
}

function deriveAllowedSlugs(catalog: CatalogAssignments | undefined | null): Record<MaterialCategory, string[]> {
  const buckets: Record<MaterialCategory, Set<string>> = {
    wall: new Set<string>(),
    floor: new Set<string>(),
    ceiling: new Set<string>(),
  }
  if (!catalog) return { wall: [], floor: [], ceiling: [] }

  const push = (surface: string | null | undefined, slug?: string | null) => {
    if (!slug) return
    const key = (surface || '').toLowerCase()
    if (key.includes('floor')) buckets.floor.add(slug)
    else if (key.includes('ceiling')) buckets.ceiling.add(slug)
    else if (key.includes('wall')) buckets.wall.add(slug)
  }

  Object.entries(catalog.surfaceDefaults || {}).forEach(([surface, slug]) => push(surface, slug))
  catalog.rooms?.forEach((room) => {
    Object.entries(room?.materials || {}).forEach(([surface, details]) => push(surface, details?.material || undefined))
  })

  return {
    wall: Array.from(buckets.wall),
    floor: Array.from(buckets.floor),
    ceiling: Array.from(buckets.ceiling),
  }
}

async function loadCatalogAssignments(processedPath?: string | null): Promise<CatalogAssignments> {
  if (!processedPath) return null
  try {
    const raw = await readFile(processedPath, 'utf8')
    const parsed = JSON.parse(raw)
    return (parsed?.catalogAssignments || parsed?.catalog || null) as CatalogAssignments
  } catch (err) {
    console.warn('[selections] Failed to read catalog assignments', err)
    return null
  }
}

function normalizeSelections(input: unknown): Partial<Record<MaterialCategory, string>> {
  if (!input || typeof input !== 'object') return {}
  const out: Partial<Record<MaterialCategory, string>> = {}
  MATERIAL_CATEGORIES.forEach((category) => {
    const value = (input as Record<string, unknown>)[category]
    if (typeof value === 'string' && value.trim().length > 0) {
      out[category] = value
    }
  })
  return out
}

function extractQuantityOverrides(input: unknown): Partial<Record<MaterialCategory, number>> {
  const overrides: Partial<Record<MaterialCategory, number>> = {}
  if (!Array.isArray(input)) return overrides
  input.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const category = (item as Record<string, unknown>).category
    const quantity = (item as Record<string, unknown>).quantity
    if (typeof category !== 'string' || typeof quantity !== 'number') return
    if (!MATERIAL_CATEGORIES.includes(category as MaterialCategory)) return
    if (!Number.isFinite(quantity) || quantity <= 0) return
    overrides[category as MaterialCategory] = Number(quantity)
  })
  return overrides
}

async function loadUnitContext(unitId: string) {
  return prisma.propertyUnit.findUnique({
    where: { id: unitId },
    include: {
      whitelists: { include: { option: true } },
      listing: true,
      fileUpload: true,
    },
  })
}

type UnitContext = NonNullable<Awaited<ReturnType<typeof loadUnitContext>>>

type LineItem = {
  category: MaterialCategory
  optionId: string
  optionName: string
  unitPrice: number
  quantity: number
  subtotal: number
}

function sanitizeLineItems(input: unknown): LineItem[] {
  if (!Array.isArray(input)) return []
  const items: LineItem[] = []
  input.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return
    const record = raw as Record<string, unknown>
    const category = record.category
    const optionId = record.optionId
    const optionName = record.optionName
    const unitPrice = record.unitPrice
    const quantity = record.quantity
    const subtotal = record.subtotal
    if (typeof category !== 'string' || !MATERIAL_CATEGORIES.includes(category as MaterialCategory)) return
    if (typeof optionId !== 'string' || typeof optionName !== 'string') return
    const parsedUnitPrice = typeof unitPrice === 'number' && Number.isFinite(unitPrice) ? unitPrice : 0
    const parsedQuantity = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 0
    const parsedSubtotal = typeof subtotal === 'number' && Number.isFinite(subtotal) ? subtotal : Number((parsedUnitPrice * parsedQuantity).toFixed(2))
    items.push({
      category: category as MaterialCategory,
      optionId,
      optionName,
      unitPrice: Number(parsedUnitPrice.toFixed(2)),
      quantity: Number(parsedQuantity.toFixed(2)),
      subtotal: Number(parsedSubtotal.toFixed(2)),
    })
  })
  return items
}

function buildSelectionPayload(
  selection: {
    id: string
    selections: unknown
    priceTotal: number
    basePrice: number | null
    addonTotal: number | null
    lineItems: unknown
    clientPrice: number | null
    priceDifference: number | null
    updatedAt: Date
  },
  unit: UnitContext | null,
) {
  const normalized = normalizeSelections(selection.selections)
  let lineItems = sanitizeLineItems(selection.lineItems)
  let basePrice = typeof selection.basePrice === 'number' ? selection.basePrice : undefined
  let addonTotal = typeof selection.addonTotal === 'number' ? selection.addonTotal : undefined

  if ((!lineItems.length || basePrice == null || addonTotal == null) && unit) {
    const fallback = computeBreakdown(unit, normalized)
    if (!lineItems.length) lineItems = fallback.lineItems
    if (basePrice == null) basePrice = fallback.basePrice
    if (addonTotal == null) addonTotal = fallback.addonTotal
  }

  const derivedAddon = addonTotal ?? lineItems.reduce((sum, item) => sum + item.subtotal, 0)
  const derivedBase = basePrice ?? (typeof unit?.listing?.basePrice === 'number' ? unit!.listing!.basePrice : 0)
  const priceTotal = selection.priceTotal ?? Number((derivedBase + derivedAddon).toFixed(2))

  return {
    id: selection.id,
    selections: normalized,
    basePrice: Number(derivedBase.toFixed(2)),
    addonTotal: Number(derivedAddon.toFixed(2)),
    priceTotal: Number(priceTotal.toFixed(2)),
    lineItems,
    clientPrice: selection.clientPrice,
    priceDifference: selection.priceDifference,
    savedAt: selection.updatedAt,
  }
}

function computeBreakdown(
  unit: UnitContext,
  normalizedSelections: Partial<Record<MaterialCategory, string>>,
  quantityOverrides?: Partial<Record<MaterialCategory, number>>,
) {
  const basePrice = typeof unit.listing?.basePrice === 'number' ? unit.listing.basePrice : 0
  const whitelistMap = new Map<string, (typeof unit.whitelists)[number]>()
  unit.whitelists.forEach((entry) => whitelistMap.set(entry.optionId, entry))

  const lineItems: LineItem[] = []
  let addonTotal = 0

  MATERIAL_CATEGORIES.forEach((category) => {
    const optionId = normalizedSelections[category]
    if (!optionId) return
    const entry = whitelistMap.get(optionId)
    if (!entry) return
    const unitPrice = (entry.overridePrice ?? entry.option.price) || 0
    const quantityOverride = quantityOverrides?.[category]
    const quantity = typeof quantityOverride === 'number' && Number.isFinite(quantityOverride) && quantityOverride > 0
      ? Number(quantityOverride)
      : 1
    const subtotal = Number((unitPrice * quantity).toFixed(2))
    addonTotal += subtotal
    lineItems.push({
      category,
      optionId,
      optionName: entry.option.name,
      unitPrice,
      quantity: Number(quantity.toFixed(2)),
      subtotal,
    })
  })

  const priceTotal = Number((basePrice + addonTotal).toFixed(2))

  return {
    basePrice,
    addonTotal: Number(addonTotal.toFixed(2)),
    priceTotal,
    lineItems,
  }
}

// Save a buyer selection (requires auth)
export async function POST(request: NextRequest) {
  try {
    const auth = requireUser(request)
    if (!auth.ok) return auth.response
    const { user } = auth

    const body = await request.json()
    const { unitId, selections, priceTotal } = body || {}
    if (!unitId || selections == null) {
      return NextResponse.json({ error: 'unitId and selections required' }, { status: 400 })
    }

    // Ensure unit exists and load whitelist + listing context
    const unit = await loadUnitContext(unitId)
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

    const whitelistMap = new Map(
      unit.whitelists.map((entry) => [entry.optionId, entry])
    )

    const catalogAssignments = await loadCatalogAssignments(unit.fileUpload?.processedFilePath)
    const allowedSlugs = deriveAllowedSlugs(catalogAssignments)

    const normalizedSelections = normalizeSelections(selections)

    const invalidCategories: string[] = []
    const disallowedOptions: Array<{ category: MaterialCategory; optionId: string }> = []

    MATERIAL_CATEGORIES.forEach((category) => {
      const optionId = normalizedSelections[category]
      if (!optionId) return
      const entry = whitelistMap.get(optionId)
      if (!entry) {
        disallowedOptions.push({ category, optionId })
        delete normalizedSelections[category]
        return
      }
      const slugs = allowedSlugs[category] || []
      if (slugs.length > 0 && !slugs.some((slug) => optionMatchesSlug(entry.option, slug))) {
        invalidCategories.push(category)
        delete normalizedSelections[category]
      }
    })

    if (disallowedOptions.length > 0) {
      return NextResponse.json({
        error: 'Selected materials are not in the approved whitelist',
        details: disallowedOptions,
      }, { status: 400 })
    }

    if (invalidCategories.length > 0) {
      return NextResponse.json({
        error: 'Selected materials violate catalog constraints',
        details: invalidCategories,
      }, { status: 400 })
    }

    const quantityOverrides = extractQuantityOverrides(body?.lineItems)
    const breakdown = computeBreakdown(unit, normalizedSelections, quantityOverrides)
    const computedTotal = breakdown.priceTotal
    const clientTotal = typeof priceTotal === 'number' ? priceTotal : null
    const priceDifference = clientTotal != null ? parseFloat((computedTotal - clientTotal).toFixed(2)) : null

    const sel = await prisma.buyerSelection.create({
      data: {
        unitId,
        userId: user.id,
        selections: normalizedSelections,
        priceTotal: computedTotal,
        basePrice: breakdown.basePrice,
        addonTotal: breakdown.addonTotal,
        lineItems: breakdown.lineItems,
        clientPrice: clientTotal,
        priceDifference,
      }
    })
    const historyRows = await prisma.buyerSelection.findMany({
      where: { unitId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      id: sel.id,
      unitId,
      userId: sel.userId,
      selections: normalizedSelections,
      priceTotal: computedTotal,
      basePrice: breakdown.basePrice,
      addonTotal: breakdown.addonTotal,
      lineItems: breakdown.lineItems,
      clientPrice: clientTotal,
      priceDifference,
      savedAt: sel.updatedAt,
      history: historyRows.map((row) =>
        buildSelectionPayload(row, unit)
      ),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save selection' }, { status: 500 })
  }
}

// Get latest selection for current user and unit
export async function GET(request: NextRequest) {
  try {
    const auth = requireUser(request)
    if (!auth.ok) return auth.response
    const { user } = auth

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get('unitId')
    if (!unitId) return NextResponse.json({ error: 'unitId required' }, { status: 400 })

    const latest = await prisma.buyerSelection.findFirst({
      where: { unitId, userId: user.id },
      orderBy: { createdAt: 'desc' }
    })
    if (!latest) return NextResponse.json(null)

    const unit = await loadUnitContext(unitId)
    if (!unit) return NextResponse.json(null)

    const allowedSlugs = deriveAllowedSlugs(await loadCatalogAssignments(unit.fileUpload?.processedFilePath))
    const normalizedLatest = normalizeSelections(latest.selections)

    MATERIAL_CATEGORIES.forEach((category) => {
      const optId = normalizedLatest[category]
      if (!optId) return
      const entry = unit.whitelists.find((w) => w.optionId === optId)
      if (!entry) {
        delete normalizedLatest[category]
        return
      }
      const slugs = allowedSlugs[category] || []
      if (slugs.length > 0 && !slugs.some((slug) => optionMatchesSlug(entry.option, slug))) {
        delete normalizedLatest[category]
      }
    })

    const latestPayload = buildSelectionPayload(
      {
        ...latest,
        selections: normalizedLatest,
      },
      unit,
    )

    const historyLimitRaw = searchParams.get('history')
    const historyLimit = historyLimitRaw ? Math.min(Math.max(parseInt(historyLimitRaw, 10) || 0, 0), 20) : 0
    let history: ReturnType<typeof buildSelectionPayload>[] = []
    if (historyLimit > 0) {
      const rows = await prisma.buyerSelection.findMany({
        where: { unitId, userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: historyLimit,
      })
      history = rows
        .map((row) => buildSelectionPayload(row, unit))
        .filter((entry) => entry.id !== latestPayload.id)
    }

    return NextResponse.json({
      ...latestPayload,
      history,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch selection' }, { status: 500 })
  }
}
