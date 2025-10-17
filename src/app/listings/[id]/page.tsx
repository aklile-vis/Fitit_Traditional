"use client"

import { Environment, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { createXRStore, VRButton, XR } from '@react-three/xr'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { useAuth } from '@/contexts/AuthContext'
import { SUPPORTED_CURRENCIES, convertAmount, formatPrice } from '@/lib/utils'
import TraditionalViewer from "./TraditionalViewer"

type MaterialCategory = 'wall' | 'floor' | 'ceiling'
type Option = { id: string; name: string; category: MaterialCategory | string; unit: string; price: number; baseColorHex?: string | null; albedoUrl?: string|null; normalUrl?: string|null; roughnessMapUrl?: string|null; metallicMapUrl?: string|null; aoMapUrl?: string|null; tilingScale?: number|null }
type Whitelist = { id: string; optionId: string; overridePrice: number | null; option: Option }
type CategorizedDefaults = Record<MaterialCategory, string[]>
type CatalogRoomAssignment = {
  name?: string
  roomType?: string
  materials?: Record<string, { material?: string }>
}
type CatalogAssignments = {
  style?: string
  surfaceDefaults?: Record<string, string>
  rooms?: CatalogRoomAssignment[]
}
type PriceLineItem = {
  category: MaterialCategory
  optionId: string
  optionName: string
  unitPrice: number
  quantity: number
  subtotal: number
}
type PriceBreakdown = {
  basePrice: number
  addonTotal: number
  priceTotal: number
  lineItems: PriceLineItem[]
  savedAt?: string | null
  clientPrice?: number | null
  priceDifference?: number | null
  selections?: Partial<Record<MaterialCategory, string>>
}

interface ListingUnitPayload {
  listing: any
  unit: any
  agent?: {
    id: string
    name: string | null
    email: string
    phone?: string | null
    jobTitle?: string | null
    agencyName?: string | null
    avatarUrl?: string | null
  } | null
}

const mergeBreakdown = (
  partial: Partial<PriceBreakdown> | null | undefined,
  fallback: PriceBreakdown,
  selections: Partial<Record<MaterialCategory, string>>,
): PriceBreakdown => ({
  basePrice: typeof partial?.basePrice === 'number' ? partial.basePrice : fallback.basePrice,
  addonTotal: typeof partial?.addonTotal === 'number' ? partial.addonTotal : fallback.addonTotal,
  priceTotal: typeof partial?.priceTotal === 'number' ? partial.priceTotal : fallback.priceTotal,
  lineItems:
    Array.isArray(partial?.lineItems) && partial.lineItems.length > 0
      ? (partial.lineItems as PriceLineItem[])
      : fallback.lineItems,
  savedAt: typeof partial?.savedAt === 'string' ? partial.savedAt : fallback.savedAt ?? null,
  clientPrice: typeof partial?.clientPrice === 'number' ? partial.clientPrice : fallback.clientPrice ?? null,
  priceDifference:
    typeof partial?.priceDifference === 'number'
      ? partial.priceDifference
      : fallback.priceDifference ?? null,
  selections,
})

type GuidedView = {
  id: string
  name: string
  position: [number, number, number]
  target: [number, number, number]
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 56.5,
  EUR: 60.2,
  GBP: 69.4,
  AED: 15.4,
  SAR: 15.1,
  CAD: 41.2,
  CNY: 8.2,
}

const MATERIAL_CATEGORIES: MaterialCategory[] = ['wall', 'floor', 'ceiling']

function tokenizeIdentifier(value?: string | null): string[] {
  if (!value) return []
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
}

function optionMatchesSlug(option: Option, slug: string): boolean {
  if (!slug) return false
  const slugTokens = tokenizeIdentifier(slug)
  if (!slugTokens.length) return false
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

function Model({
  url,
  onCategorized,
}: {
  url: string
  onCategorized: (cats: Record<MaterialCategory, THREE.Mesh[]>, defaults: CategorizedDefaults) => void
}) {
  if (!url) {
    return null
  }
  
  const gltf = useGLTF(url)
  const scene = gltf.scene as THREE.Group
  
  useEffect(() => {
    const cats: Record<MaterialCategory, THREE.Mesh[]> = { wall: [], floor: [], ceiling: [] }
    const defaults: Record<MaterialCategory, Set<string>> = {
      wall: new Set<string>(),
      floor: new Set<string>(),
      ceiling: new Set<string>(),
    }
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox()
        }
        const boundingBox = mesh.geometry.boundingBox
        if (!boundingBox) return

        const size = new THREE.Vector3()
        boundingBox.getSize(size)

        let category: MaterialCategory = 'wall'
        if (size.z < 0.2) {
          const center = new THREE.Vector3()
          boundingBox.getCenter(center)
          category = center.z < 0.5 ? 'floor' : 'ceiling'
        }

        cats[category].push(mesh)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const userData = mesh.userData as { catalogSlug?: unknown }
        const slug = typeof userData?.catalogSlug === 'string' ? userData.catalogSlug : undefined
        if (slug) {
          defaults[category].add(slug)
        }
      }
    })
    onCategorized(cats, {
      wall: Array.from(defaults.wall),
      floor: Array.from(defaults.floor),
      ceiling: Array.from(defaults.ceiling),
    })
  }, [scene, onCategorized])
  return <primitive object={scene} />
}

export default function PublicListingPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ListingUnitPayload | null>(null)
  const [wl, setWl] = useState<Whitelist[]>([])
  const [status, setStatus] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [selected, setSelected] = useState<{ wall?: string; floor?: string; ceiling?: string }>({})
  const meshesRef = useRef<Record<MaterialCategory, THREE.Mesh[]>>({ wall: [], floor: [], ceiling: [] })
  const [catalogDefaults, setCatalogDefaults] = useState<CategorizedDefaults>({ wall: [], floor: [], ceiling: [] })
  const [allowedMaterials, setAllowedMaterials] = useState<Record<MaterialCategory, string[]>>({ wall: [], floor: [], ceiling: [] })
  const { isAuthenticated, token } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [priceDetails, setPriceDetails] = useState<PriceBreakdown | null>(null)
  const [isPriceStale, setIsPriceStale] = useState(false)
  const [isXrMode, setIsXrMode] = useState(false)
  const [history, setHistory] = useState<PriceBreakdown[]>([])
  const [currency, setCurrency] = useState<string>('ETB')
  const [preferredCurrency, setPreferredCurrency] = useState<string>('ETB')
  const [rates, setRates] = useState<Record<string, number>>({ ETB: 1 })
  const [ratesReady, setRatesReady] = useState(false)
  const [guidedViews, setGuidedViews] = useState<GuidedView[]>([])
  const xrStore = useMemo(() => createXRStore(), [])
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)

  type ViewerTab = "immersive" | "traditional"
  const [activeTab, setActiveTab] = useState<ViewerTab>("traditional")
  const [has3DSupport, setHas3DSupport] = useState<boolean>(false)

  const tabOrder: ViewerTab[] = ["immersive", "traditional"]
  const tabRefs = useRef<Record<ViewerTab, HTMLButtonElement | null>>({
    immersive: null,
    traditional: null,
  })

  const onTabsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    e.preventDefault()
    const i = tabOrder.indexOf(activeTab)
    const next =
      e.key === "ArrowRight"
        ? tabOrder[(i + 1) % tabOrder.length]
        : tabOrder[(i - 1 + tabOrder.length) % tabOrder.length]
    
    // Skip immersive tab if 3D is not supported
    if (next === "immersive" && !has3DSupport) {
      const skipNext = e.key === "ArrowRight" 
        ? tabOrder[(i + 2) % tabOrder.length]
        : tabOrder[(i - 2 + tabOrder.length) % tabOrder.length]
      setActiveTab(skipNext)
      tabRefs.current[skipNext]?.focus()
    } else {
      setActiveTab(next)
      tabRefs.current[next]?.focus()
    }
  }


  useEffect(() => {
    let active = true
    fetch('/api/exchange-rates', { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then((payload) => {
        if (!active || !payload?.rates) return
        setRates({ ETB: 1, ...payload.rates })
        setRatesReady(true)
      })
      .catch(() => {
        if (!active) return
        setRates({ ETB: 1, ...FALLBACK_RATES })
        setRatesReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  const handleCategorized = useCallback((cats: Record<MaterialCategory, THREE.Mesh[]>, defaults: CategorizedDefaults) => {
    meshesRef.current = cats
    setCatalogDefaults((prev) => ({
      wall: Array.from(new Set([...(prev.wall || []), ...(defaults.wall || [])])),
      floor: Array.from(new Set([...(prev.floor || []), ...(defaults.floor || [])])),
      ceiling: Array.from(new Set([...(prev.ceiling || []), ...(defaults.ceiling || [])])),
    }))
  }, [])

  const convertToCurrency = useCallback(
    (amount: number, target: string = currency) => convertAmount(amount, 'ETB', target, rates),
    [currency, rates],
  )

  const renderPrice = useCallback(
    (amount: number, target: string = currency) => formatPrice(convertToCurrency(amount, target), target),
    [convertToCurrency, currency],
  )

  const basePriceEtb = data?.listing?.basePrice ?? 0
  const totalPriceEtb = price ?? basePriceEtb

  const calculateBreakdown = useCallback(
    (selection: Partial<Record<MaterialCategory, string>>) => {
      const basePrice = data?.listing?.basePrice ?? 0
      const lineItems: PriceLineItem[] = []
      let addonTotal = 0

      MATERIAL_CATEGORIES.forEach((cat) => {
        const optionId = selection[cat]
        if (!optionId) return
        const entry = wl.find((x) => x.optionId === optionId)
        if (!entry) return
        const unitPrice = (entry.overridePrice ?? entry.option.price) || 0
        const meshes = meshesRef.current[cat] || []
        let quantity = meshes.reduce((acc, mesh) => {
          if (!mesh.geometry.boundingBox) {
            mesh.geometry.computeBoundingBox()
          }
          const boundingBox = mesh.geometry.boundingBox
          if (!boundingBox) {
            return acc
          }
          const size = new THREE.Vector3()
          boundingBox.getSize(size)
          if (cat === 'floor' || cat === 'ceiling') {
            return acc + size.x * size.y
          }
          const dims = [size.x, size.y, size.z].sort((a, b) => b - a)
          return acc + dims[0] * dims[1]
        }, 0)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          quantity = 1
        }
        const roundedQuantity = Number(quantity.toFixed(2))
        const subtotal = Number((unitPrice * roundedQuantity).toFixed(2))
        addonTotal += subtotal
        lineItems.push({
          category: cat,
          optionId,
          optionName: entry.option.name,
          unitPrice,
          quantity: roundedQuantity,
          subtotal,
        })
      })

      const roundedAddon = Number(addonTotal.toFixed(2))
      const priceTotal = Number((basePrice + roundedAddon).toFixed(2))
      const breakdown: PriceBreakdown = {
        basePrice,
        addonTotal: roundedAddon,
        priceTotal,
        lineItems,
        selections: selection,
        savedAt: null,
        clientPrice: null,
        priceDifference: null,
      }
      return breakdown
    },
    [data?.listing?.basePrice, wl],
  )

  useEffect(() => {
    const load = async () => {
      setStatus('Loadingâ€¦')
      const r = await fetch(`/api/listings/${id}`)
      const js = await r.json()
      if (!r.ok) { setStatus(js.error || 'Listing not found'); return }
      setData(js)
      setHas3DSupport(js.listing?.has3D || false)
      
      // Force traditional tab if 3D is not supported
      if (!js.listing?.has3D) {
        setActiveTab("traditional")
      }
      
      if (Array.isArray(js.guidedViews)) {
        const normalized = js.guidedViews
          .map((entry: unknown) => {
            if (!entry || typeof entry !== 'object') return null
            const { id: rawId, name, position, target } = entry as Record<string, unknown>
            if (!Array.isArray(position) || position.length !== 3) return null
            if (!Array.isArray(target) || target.length !== 3) return null
            const pos = position.map(Number)
            const tgt = target.map(Number)
            if (pos.some((n) => Number.isNaN(n)) || tgt.some((n) => Number.isNaN(n))) return null
            return {
              id: typeof rawId === 'string' && rawId ? rawId : `view-${Math.random().toString(36).slice(2)}`,
              name: typeof name === 'string' && name.trim() ? name.trim() : 'Saved view',
              position: pos as [number, number, number],
              target: tgt as [number, number, number],
            } satisfies GuidedView
          })
          .filter((entry: any): entry is GuidedView => Boolean(entry))
        setGuidedViews(normalized)
      } else {
        setGuidedViews([])
      }
      setPrice(js.listing?.basePrice || 0)
      const listingCurrency = typeof js?.listing?.currency === 'string' ? js.listing.currency.toUpperCase() : 'ETB'
      setPreferredCurrency(listingCurrency)
      setCurrency('ETB')
      setPriceDetails(null)
      setIsPriceStale(false)
      const wlr = await fetch(`/api/units/${js.unit.id}/materials`)
      const wlj = await wlr.json()
      if (wlr.ok) setWl(wlj)
      setStatus('')
    }
    load()
  }, [id])

  useEffect(() => {
    const assignments = (data?.unit?.catalogAssignments ?? null) as CatalogAssignments | null
    if (!assignments) return

    const buckets: Record<MaterialCategory, Set<string>> = {
      wall: new Set<string>(),
      floor: new Set<string>(),
      ceiling: new Set<string>(),
    }

    const push = (surface: string | null | undefined, slug?: string | null) => {
      if (!slug) return
      const key = (surface || '').toLowerCase()
      if (key.includes('floor')) buckets.floor.add(slug)
      else if (key.includes('ceiling')) buckets.ceiling.add(slug)
      else if (key.includes('wall')) buckets.wall.add(slug)
    }

    Object.entries(assignments.surfaceDefaults || {}).forEach(([surface, slug]) => push(surface, slug))
    assignments.rooms?.forEach((room) => {
      Object.entries(room.materials || {}).forEach(([surface, details]) => push(surface, details?.material))
    })

    const nextAllowed: Record<MaterialCategory, string[]> = {
      wall: Array.from(buckets.wall),
      floor: Array.from(buckets.floor),
      ceiling: Array.from(buckets.ceiling),
    }
    setAllowedMaterials(nextAllowed)
    setCatalogDefaults((prev) => ({
      wall: Array.from(new Set([...(prev.wall || []), ...nextAllowed.wall])),
      floor: Array.from(new Set([...(prev.floor || []), ...nextAllowed.floor])),
      ceiling: Array.from(new Set([...(prev.ceiling || []), ...nextAllowed.ceiling])),
    }))
  }, [data?.unit?.catalogAssignments])

  useEffect(() => {
    if (!isAuthenticated || !data?.unit?.id) return
    const controller = new AbortController()
    const loadSelection = async () => {
      try {
        setSelectionLoading(true)
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await fetch(`/api/selections?unitId=${encodeURIComponent(data.unit.id)}`, {
          headers,
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = await response.json().catch(() => null)
        if (!payload?.selections) return
        const normalized: Partial<Record<MaterialCategory, string>> = {}
        MATERIAL_CATEGORIES.forEach((category) => {
          const value = payload.selections?.[category]
          if (typeof value === 'string') {
            normalized[category] = value
          }
        })
        if (Object.keys(normalized).length > 0) {
          setSelected(normalized)
          const preview = { ...calculateBreakdown(normalized), selections: normalized }
          const basePrice = typeof payload.basePrice === 'number' ? payload.basePrice : preview.basePrice
          const addonTotal = typeof payload.addonTotal === 'number' ? payload.addonTotal : preview.addonTotal
          const priceTotal = typeof payload.priceTotal === 'number' ? payload.priceTotal : preview.priceTotal
          const lineItems =
            Array.isArray(payload.lineItems) && payload.lineItems.length > 0
              ? (payload.lineItems as PriceLineItem[])
              : preview.lineItems

          setPrice(priceTotal)
          setPriceDetails({
            basePrice,
            addonTotal,
            priceTotal,
            lineItems,
            savedAt: typeof payload.savedAt === 'string' ? payload.savedAt : undefined,
            clientPrice: typeof payload.clientPrice === 'number' ? payload.clientPrice : null,
            priceDifference: typeof payload.priceDifference === 'number' ? payload.priceDifference : null,
            selections: normalized,
          })
          setHistory(
            Array.isArray(payload.history)
              ? payload.history.map((entry: Partial<PriceBreakdown> & { selections?: Partial<Record<MaterialCategory, string>> }) => {
                  const partial = entry as Partial<PriceBreakdown> & {
                    selections?: Partial<Record<MaterialCategory, string>>
                  }
                  const selections = partial.selections ?? {}
                  return mergeBreakdown(partial, preview, selections)
                })
              : [],
          )
          setIsPriceStale(false)
          setStatus('Loaded saved design')
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn('Failed to load saved selection', err)
        }
      } finally {
        if (!controller.signal.aborted) {
          setSelectionLoading(false)
        }
      }
    }

    void loadSelection()
    return () => controller.abort()
  }, [isAuthenticated, token, data?.unit?.id, calculateBreakdown])

  const modelUrl = useMemo(() => {
    const glbPath = data?.unit?.file?.glbFilePath || data?.unit?.file?.glbPath
    return glbPath ? `/api/files/binary?path=${encodeURIComponent(glbPath)}&listingId=${encodeURIComponent(String(id))}` : ''
  }, [data?.unit?.file?.glbFilePath, data?.unit?.file?.glbPath, id])

  const computePrice = useCallback(
    (overrideSelection?: typeof selected) => {
      const activeSelection = overrideSelection ?? selected
      const breakdown = calculateBreakdown(activeSelection)
      setPrice(breakdown.priceTotal)
      setPriceDetails((prev) => ({
        ...breakdown,
        savedAt: prev?.savedAt,
        clientPrice: prev?.clientPrice ?? null,
        priceDifference: prev?.priceDifference ?? null,
        selections: activeSelection,
      }))
      return breakdown
    },
    [calculateBreakdown, selected],
  )

  const applyGuidedView = useCallback((view: GuidedView) => {
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!controls || !camera) {
      setStatus('Viewer controls are not ready yet')
      return
    }
    camera.position.set(view.position[0], view.position[1], view.position[2])
    controls.target.set(view.target[0], view.target[1], view.target[2])
    controls.update()
    camera.lookAt(view.target[0], view.target[1], view.target[2])
    camera.updateProjectionMatrix()
    setStatus(`Switched to ${view.name}`)
  }, [])

  const resetView = useCallback(() => {
    if (guidedViews.length > 0) {
      applyGuidedView(guidedViews[0])
      return
    }
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!controls || !camera) return
    camera.position.set(6, 4, 8)
    controls.target.set(0, 0, 0)
    controls.update()
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    setStatus('View reset')
  }, [guidedViews, applyGuidedView])

  const applyMaterial = useCallback((category: MaterialCategory, optionId: string) => {
    const entry = wl.find(w => w.optionId === optionId)
    if (!entry) return
    const allowed = allowedMaterials[category]
    if (allowed.length > 0 && !allowed.some((slug) => optionMatchesSlug(entry.option, slug))) {
      setStatus('Selected material is not permitted for this surface')
      return
    }
    const meshes = meshesRef.current[category] || []
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(entry.option.baseColorHex || '#cccccc') })
    const loader = new THREE.TextureLoader()
    const tiling = (entry.option.tilingScale || 1) as number
    const setRepeat = (tex?: THREE.Texture | null) => { if (tex) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(tiling, tiling) } }
    if (entry.option.albedoUrl) { const t = loader.load(entry.option.albedoUrl); setRepeat(t); mat.map = t }
    if (entry.option.normalUrl) { const t = loader.load(entry.option.normalUrl); setRepeat(t); mat.normalMap = t }
    if (entry.option.roughnessMapUrl) { const t = loader.load(entry.option.roughnessMapUrl); setRepeat(t); mat.roughnessMap = t }
    if (entry.option.metallicMapUrl) { const t = loader.load(entry.option.metallicMapUrl); setRepeat(t); mat.metalnessMap = t }
    if (entry.option.aoMapUrl) { const t = loader.load(entry.option.aoMapUrl); setRepeat(t); mat.aoMap = t }
    meshes.forEach(m => { m.material = mat })
    setSelected(prev => {
      const next = { ...prev, [category]: optionId }
      computePrice(next)
      return next
    })
    setIsPriceStale(true)
  }, [wl, computePrice, allowedMaterials])

  const save = useCallback(async () => {
    if (!data?.unit?.id) {
      setStatus('Unit not ready yet')
      return
    }
    if (!isAuthenticated) {
      setStatus('Sign in to save your design')
      return
    }
    try {
      setIsSaving(true)
      setStatus('Saving designâ€¦')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const breakdown = calculateBreakdown(selected)
      const payload = {
        unitId: data.unit.id,
        selections: selected,
        priceTotal: breakdown.priceTotal,
        lineItems: breakdown.lineItems,
        basePrice: breakdown.basePrice,
        addonTotal: breakdown.addonTotal,
        clientPrice: price,
      }
      const response = await fetch('/api/selections', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setStatus(body?.error || 'Failed to save design')
        return
      }
      if (body && typeof body === 'object') {
        if (typeof body.priceTotal === 'number') {
          setPrice(body.priceTotal)
        }
        if (typeof body.basePrice === 'number' || Array.isArray(body.lineItems)) {
          setPriceDetails({
            basePrice: typeof body.basePrice === 'number' ? body.basePrice : breakdown.basePrice,
            addonTotal: typeof body.addonTotal === 'number' ? body.addonTotal : breakdown.addonTotal,
            priceTotal: typeof body.priceTotal === 'number' ? body.priceTotal : breakdown.priceTotal,
            lineItems: Array.isArray(body.lineItems)
              ? (body.lineItems as PriceLineItem[])
              : breakdown.lineItems,
            savedAt: typeof body.savedAt === 'string' ? body.savedAt : new Date().toISOString(),
            clientPrice: typeof body.clientPrice === 'number' ? body.clientPrice : null,
            priceDifference: typeof body.priceDifference === 'number' ? body.priceDifference : null,
          })
        }
        const fallback = { ...breakdown, selections: selected }
        if (Array.isArray(body.history)) {
          setHistory(
            body.history.map((entry: Partial<PriceBreakdown> & { selections?: Partial<Record<MaterialCategory, string>> }) => {
              const partial = entry as Partial<PriceBreakdown> & {
                selections?: Partial<Record<MaterialCategory, string>>
              }
              const selections = partial.selections ?? selected
              return mergeBreakdown(partial, fallback, selections)
            }),
          )
        } else {
          setHistory((prev) => [
            mergeBreakdown(
              {
                basePrice: typeof body.basePrice === 'number' ? body.basePrice : undefined,
                addonTotal: typeof body.addonTotal === 'number' ? body.addonTotal : undefined,
                priceTotal: typeof body.priceTotal === 'number' ? body.priceTotal : undefined,
                lineItems: Array.isArray(body.lineItems) ? (body.lineItems as PriceLineItem[]) : undefined,
                savedAt: typeof body.savedAt === 'string' ? body.savedAt : undefined,
                clientPrice: typeof body.clientPrice === 'number' ? body.clientPrice : undefined,
                priceDifference: typeof body.priceDifference === 'number' ? body.priceDifference : undefined,
              },
              fallback,
              selected,
            ),
            ...prev,
          ].slice(0, 5))
        }
      }
      setIsPriceStale(false)
      setStatus('Design saved')
    } catch (err) {
      setStatus((err as Error)?.message || 'Failed to save design')
    } finally {
      setIsSaving(false)
    }
  }, [data?.unit?.id, isAuthenticated, calculateBreakdown, selected, price, token])

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--surface-0)] text-primary">
        Loading listingâ€¦
      </div>
    )
  }

  const location = (() => {
    const parts = []
    if (data.listing?.address) parts.push(data.listing.address)
    if (data.listing?.subCity) parts.push(data.listing.subCity)
    if (data.listing?.city && data.listing.city.toLowerCase() !== data.listing.subCity?.toLowerCase()) {
      parts.push(data.listing.city)
    }
    return parts.join(', ')
  })()
  const breakdown = priceDetails

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[color:var(--surface-0)] text-primary">
      <header className="flex h-20 items-center justify-between border-b border-[color:var(--surface-border)] px-6">
        <div className="flex flex-col gap-1 leading-tight">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-disabled">
            <span>Buyer Viewer</span>
            <span className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-2 py-0.5 text-[10px] tracking-wide text-muted">
              Interactive listing
            </span>
          </div>
          <h1 className="text-xl font-semibold text-primary">{data.listing.title}</h1>
          <div className="text-xs text-secondary">{location || 'Location to be announced'}</div>
        </div>
        <div className="flex items-center gap-6 text-right text-xs text-muted">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Currency</span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-2 py-1 text-xs text-secondary shadow-inner"
              disabled={!ratesReady}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            {preferredCurrency !== 'ETB' && (
              <span className="text-[10px] text-disabled">Agent preference: {preferredCurrency}</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Base</span>
            <span className="text-lg font-semibold text-primary">{renderPrice(basePriceEtb)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Total</span>
            <span className="text-lg font-semibold text-primary">{renderPrice(totalPriceEtb)}</span>
          </div>
        </div>
      </header>
      {status && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-6 py-2 text-xs text-yellow-100">{status}</div>
      )}

      {/* Browser-style tabs */}
      <div className="bg-[color:var(--surface-1)] border-b border-[color:var(--surface-border)]">
        <div className="px-6 pt-3">
          <div
            role="tablist"
            aria-label="Viewer mode"
            className="flex justify-center gap-2"
            onKeyDown={onTabsKeyDown}
          >
            <button
              id="tab-traditional"
              ref={(el) => { tabRefs.current.traditional = el }}
              role="tab"
              type="button"
              aria-controls="panel-traditional"
              aria-selected={activeTab === "traditional"}
              tabIndex={activeTab === "traditional" ? 0 : -1}
              onClick={() => setActiveTab("traditional")}
              className={`group relative min-w-[200px] rounded-t-xl border border-b-0 px-6 py-3 text-sm font-semibold transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-600)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-1)]
                ${
                  activeTab === "traditional"
                    ? "border-[color:var(--surface-border)] bg-[color:var(--surface-0)] text-primary shadow-[0_-2px_8px_rgba(0,0,0,0.04)] scale-[1.02] z-10"
                    : "border-[color:var(--surface-border)]/60 bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-0)]/60 hover:text-secondary hover:border-[color:var(--surface-border)]"
                }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Gallery View
              </span>
              {activeTab === "traditional" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[color:var(--brand-600)]"></div>
              )}
            </button>
            
            <button
              id="tab-immersive"
              ref={(el) => { tabRefs.current.immersive = el }}
              role="tab"
              type="button"
              aria-controls="panel-immersive"
              aria-selected={activeTab === "immersive"}
              tabIndex={activeTab === "immersive" ? 0 : -1}
              onClick={() => has3DSupport && setActiveTab("immersive")}
              disabled={!has3DSupport}
              className={`group relative min-w-[200px] rounded-t-xl border border-b-0 px-6 py-3 text-sm font-semibold transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-600)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-1)]
                ${
                  !has3DSupport
                    ? "border-[color:var(--surface-border)]/30 bg-[color:var(--surface-3)] text-disabled cursor-not-allowed opacity-50"
                    : activeTab === "immersive"
                    ? "border-[color:var(--surface-border)] bg-[color:var(--surface-0)] text-primary shadow-[0_-2px_8px_rgba(0,0,0,0.04)] scale-[1.02] z-10"
                    : "border-[color:var(--surface-border)]/60 bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-0)]/60 hover:text-secondary hover:border-[color:var(--surface-border)]"
                }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                </svg>
                3D Immersive
                {!has3DSupport && (
                  <span className="text-xs text-disabled">(Not Available)</span>
                )}
              </span>
              {activeTab === "immersive" && has3DSupport && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[color:var(--brand-600)]"></div>
              )}
            </button>
            
          </div>
        </div>
      </div>



      {activeTab === "immersive" ? (
      <div
        role="tabpanel"
        id="panel-immersive"
        aria-labelledby="tab-immersive"
        className="flex flex-1 min-h-0"
      >
        {!has3DSupport ? (
          <div className="flex h-full w-full items-center justify-center bg-[color:var(--surface-0)]">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--surface-2)]">
                <svg className="h-8 w-8 text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-primary mb-2">3D Viewer Not Available</h3>
              <p className="text-sm text-muted mb-4">This listing doesn't support interactive 3D viewing.</p>
              <button
                onClick={() => setActiveTab("traditional")}
                className="btn btn-primary"
              >
                Switch to Gallery View
              </button>
            </div>
          </div>
        ) : (
        <div className="flex flex-1 min-h-0">
          <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[color:var(--surface-0)]">
            <div className="absolute right-6 top-6 z-10 flex gap-2">
              <button
                className={`rounded-sm border px-3 py-1 text-[10px] uppercase tracking-wide transition ${
                  isXrMode
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-white'
                    : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] text-secondary hover:bg-[color:var(--surface-2)]'
                }`}
                onClick={() => setIsXrMode((prev) => !prev)}
              >
                {isXrMode ? 'Exit WebXR' : 'Enter WebXR (beta)'}
              </button>
            </div>
            {modelUrl ? (
              <>
                {isXrMode && <VRButton store={xrStore} />}
                <Canvas
                  className="h-full w-full"
                  style={{ width: '100%', height: '100%' }}
                  shadows
                  camera={{ position: [6, 4, 8], fov: 50 }}
                  onCreated={({ camera }) => {
                    cameraRef.current = camera as THREE.PerspectiveCamera
                  }}
                >
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow />
                  <Environment preset="city" />
                  {modelUrl ? (
                    isXrMode ? (
                      <XR store={xrStore}>
                        <Model url={modelUrl} onCategorized={handleCategorized} />
                      </XR>
                    ) : (
                      <Model url={modelUrl} onCategorized={handleCategorized} />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--surface-2)]">
                          <svg className="h-8 w-8 text-disabled animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-primary mb-2">Preparing 3D viewer…</h3>
                        <p className="text-sm text-muted">Loading 3D model and materials</p>
                      </div>
                    </div>
                  )}
                  {!isXrMode && (
                    <OrbitControls
                      ref={(value) => {
                        controlsRef.current = value as OrbitControlsImpl | null
                      }}
                      enableDamping
                      dampingFactor={0.05}
                    />
                  )}
                </Canvas>
                {!isXrMode && (
                  <div className="absolute top-4 left-4 z-10 space-y-3 rounded-lg bg-white/95 p-3 text-xs text-gray-700 shadow-lg max-w-xs">
                    <div>
                      <p className="font-semibold text-sm">Move around</p>
                      <ul className="mt-2 space-y-1">
                        <li>â€¢ Click and drag to look around</li>
                        <li>â€¢ Right-click and drag to slide sideways</li>
                        <li>â€¢ Scroll to zoom in or out</li>
                        <li>â€¢ Tap once, then drag on touch screens</li>
                      </ul>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded bg-[color:var(--brand-600)] px-3 py-1 text-[11px] uppercase tracking-wide text-white transition hover:bg-[color:var(--brand-500)]"
                        onClick={resetView}
                      >
                        Reset view
                      </button>
                    </div>
                    {guidedViews.length > 0 && (
                      <div>
                        <p className="font-semibold text-sm">Quick looks</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {guidedViews.slice(0, 6).map((view) => (
                            <button
                              key={view.id}
                              className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-secondary transition hover:bg-[color:var(--surface-3)]"
                              onClick={() => applyGuidedView(view)}
                            >
                              {view.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-secondary">Preparing 3D viewerâ€¦</div>
            )}
          </div>
          <aside className="flex h-full min-h-0 w-[360px] flex-col gap-3 overflow-y-auto border-l border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-3">
            <PanelSection title="Customize finishes" defaultOpen>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-secondary">Choose approved materials per surface type.</p>
                <span className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">Interactive</span>
              </div>
              {selectionLoading && (
                <div className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] p-3 text-xs text-secondary">
                  Loading saved designâ€¦
                </div>
              )}
              {MATERIAL_CATEGORIES.some((cat) => catalogDefaults[cat].length > 0) && (
                <div className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] p-3 text-xs text-secondary">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Catalog defaults</div>
                  {MATERIAL_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="uppercase tracking-wide text-muted">{cat}</span>
                      <span className="text-secondary">
                        {catalogDefaults[cat].length ? catalogDefaults[cat].join(', ') : 'â€”'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {MATERIAL_CATEGORIES.map((cat) => {
                const allowedSlugs = allowedMaterials[cat] || []
                const options = wl.filter((w) => {
                  const categoryMatches = String(w.option.category).toLowerCase() === cat
                  if (!categoryMatches) return false
                  if (!allowedSlugs.length) return true
                  return allowedSlugs.some((slug) => optionMatchesSlug(w.option, slug))
                })
                const totalForCategory = wl.filter((w) => String(w.option.category).toLowerCase() === cat).length
                const restricted = allowedSlugs.length > 0 ? totalForCategory - options.length : 0
                const active = selected[cat]
                return (
                  <div key={cat} className="space-y-3 rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] p-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
                      <span>{cat}</span>
                      <span>{options.length} options</span>
                    </div>
                    {allowedSlugs.length > 0 && (
                      <div className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-[11px] text-secondary">
                        Catalog limited to: {allowedSlugs.join(', ')}
                        {restricted > 0 && ` (${restricted} hidden)`}
                      </div>
                    )}
                    <div className="space-y-2">
                      {options.map((w) => {
                        const unitPrice = w.overridePrice ?? w.option.price
                        const isActive = active === w.optionId
                        return (
                          <button
                            key={w.id}
                            onClick={() => applyMaterial(cat, w.optionId)}
                            className={`flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left transition ${
                              isActive
                                ? 'border-brand-strong bg-brand-soft shadow-[0_10px_30px_rgba(0,0,0,0.08)]'
                                : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] hover:border-brand hover:bg-brand-soft'
                            }`}
                          >
                            <div>
                              <div className="text-sm font-semibold text-primary">{w.option.name}</div>
                              <div className="text-[11px] text-muted">{w.option.unit}</div>
                            </div>
                            <div className="text-sm font-semibold text-primary">{renderPrice(unitPrice)}</div>
                          </button>
                        )
                      })}
                      {options.length === 0 && (
                        <div className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-3 text-xs text-muted">
                          No materials approved for this surface yet.
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </PanelSection>

            <PanelSection title="Investment preview" defaultOpen>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-muted">Total with selections</span>
                <span className="text-2xl font-semibold text-primary">{renderPrice(totalPriceEtb)}</span>
              </div>
              <div className="text-[11px] text-secondary">
                Includes base price {renderPrice(basePriceEtb)} and selected finish upgrades.
              </div>
              <div className="text-[10px] text-disabled">
                Rates sourced from Commercial Bank of Ethiopia. Default view shows ETB conversion.
              </div>
              {isPriceStale && (
                <div className="rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-100">
                  Adjustments not saved yet â€” totals reflect approximate preview.
                </div>
              )}
            </PanelSection>

            {breakdown && (
              <PanelSection title="Pricing breakdown" defaultOpen>
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted">
                  <span>Base price</span>
                  <span>{renderPrice(breakdown.basePrice)}</span>
                </div>
                {breakdown.lineItems.length > 0 ? (
                  <div className="space-y-2 text-secondary">
                    {breakdown.lineItems.map((item) => (
                      <div key={`${item.category}-${item.optionId}`} className="flex items-center justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-wide text-muted">{item.category}</span>
                        <div className="flex flex-col items-end text-right">
                          <span className="text-sm text-primary">{item.optionName}</span>
                          <span className="text-[11px] text-disabled">
                            {renderPrice(item.unitPrice)} Ã— {item.quantity}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-primary">{renderPrice(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted">No upgrades selected.</div>
                )}
                <div className="border-t border-[color:var(--surface-border)] pt-2 text-primary">
                  <div className="flex items-center justify-between text-sm text-secondary">
                    <span>Upgrades total</span>
                    <span>{renderPrice(breakdown.addonTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold text-primary">
                    <span>Total with upgrades</span>
                    <span>{renderPrice(breakdown.priceTotal)}</span>
                  </div>
                  {breakdown.savedAt && (
                    <div className="pt-1 text-[11px] text-disabled">
                      Saved {new Date(breakdown.savedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </PanelSection>
            )}

            {history.length > 0 && (
              <PanelSection title="Saved history" defaultOpen={false}>
                <div className="space-y-2">
                  {history.map((entry, index) => {
                    const timestamp = entry.savedAt ? new Date(entry.savedAt) : null
                    const canPreview = entry.selections && Object.keys(entry.selections).length > 0
                    const handlePreview = () => {
                      if (!canPreview) return
                      const nextSelections = entry.selections ?? {}
                      setSelected(nextSelections)
                      setPrice(entry.priceTotal)
                      setPriceDetails({ ...entry, selections: nextSelections })
                      setIsPriceStale(true)
                      setStatus('Preview loaded from history â€” save to commit changes')
                    }
                    return (
                      <div key={entry.savedAt ?? index} className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-3 text-secondary">
                        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
                          <span>{timestamp ? timestamp.toLocaleString() : 'Unknown timestamp'}</span>
                          <span>{renderPrice(entry.priceTotal)}</span>
                        </div>
                        {typeof entry.priceDifference === 'number' && entry.priceDifference !== 0 && (
                          <div className={`text-[11px] ${entry.priceDifference > 0 ? 'text-yellow-500' : 'text-emerald-600'}`}>
                            Pricing adjustment vs recorded total: {renderPrice(entry.priceDifference)}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
                          {entry.lineItems.map((item) => (
                            <span key={`${item.category}-${item.optionId}`} className="rounded bg-[color:var(--surface-2)] px-2 py-1 text-secondary">
                              {item.category}: {item.optionName}
                            </span>
                          ))}
                          {entry.lineItems.length === 0 && <span>No upgrades selected</span>}
                        </div>
                        <div className="mt-3 text-right">
                          <button
                            onClick={handlePreview}
                            disabled={!canPreview}
                            className="rounded border border-[color:var(--surface-border)] px-3 py-1 text-xs font-semibold text-primary transition hover:border-brand disabled:opacity-40"
                          >
                            Preview selection
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </PanelSection>
            )}

            <button
              className="rounded-md border border-[color:var(--brand-600-70)] bg-[color:var(--brand-600)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={save}
              disabled={isSaving}
            >
              {isSaving ? 'Savingâ€¦' : isAuthenticated ? 'Save design' : 'Login to save'}
            </button>
          </aside>
        </div>
  
        )}
      </div>
        
      ): (
      <div
        role="tabpanel"
        id="panel-traditional"
        aria-labelledby="tab-traditional"
        className="flex flex-1 min-h-0"
      >
        
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-auto bg-[color:var(--surface-0)]">
            <TraditionalViewer listing={data} />
          </div>
        </div>
      </div>
        
      )}
      
    </div>
  )
}

type PanelSectionProps = {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

function PanelSection({ title, defaultOpen = true, children }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft)]">
      <button
        className="flex w-full items-center justify-between border-b border-[color:var(--surface-border)] bg-[color:var(--surface-0)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-secondary transition hover:bg-[color:var(--surface-2)]"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span>{title}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="space-y-3 px-3 py-3 text-xs text-secondary">{children}</div>}
    </div>
  )
}

// Removed placeholder.glb preload as it doesn't exist
