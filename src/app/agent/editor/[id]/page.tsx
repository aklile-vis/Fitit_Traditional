"use client"

import { OrbitControls, Environment, GizmoHelper, GizmoViewport, Html, Line, useCursor, useGLTF } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import Link from 'next/link'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

type MaterialCategory = 'wall' | 'floor' | 'ceiling'

type GuidMaterialInfo = {
  ifcType?: string
  color?: number[]
  texture?: string
  catalogSlug?: string
}

type CatalogMaterial = {
  slug: string
  name: string
  description?: string
  textures?: Record<string, string>
  targets?: string[]
  properties?: Record<string, unknown>
  source?: Record<string, unknown>
}

type CatalogFixture = {
  slug: string
  name: string
  description?: string
  modelPath?: string
  thumbnail?: string
  metadata?: Record<string, unknown>
  source?: Record<string, unknown>
}

type CatalogStyle = {
  slug: string
  name: string
  description?: string
  materials?: Array<{ target: string; material: string; priority?: number }>
  fixtures?: Array<{ asset: string; placement?: Record<string, unknown> }>
  metadata?: Record<string, unknown>
}

type CatalogResponse = {
  materials: CatalogMaterial[]
  fixtures: CatalogFixture[]
  styles: CatalogStyle[]
}

type CatalogRoomAssignment = {
  name: string
  roomType?: string
  materials?: Record<string, unknown>
  fixtures?: unknown
  elementIndex?: number
}

type UnitResp = {
  id: string
  name: string
  file: { glbPath?: string | null; processedFilePath?: string | null } | null
  listing?: Record<string, unknown> | null
  aiEnrichment?: Record<string, unknown> | null
  topologyCounts?: Record<string, unknown> | null
  topologyValidations?: Record<string, unknown> | null
  guidMaterials?: Record<string, GuidMaterialInfo> | null
  catalogAssignments?: { style?: string; rooms?: CatalogRoomAssignment[] } | null
  relationships?: RelationshipGraph | null
}
type Option = {
  id: string
  name: string
  category: string
  unit: string
  price: number
  description?: string | null
  baseColorHex?: string | null
  albedoUrl?: string | null
  normalUrl?: string | null
  roughnessMapUrl?: string | null
  metallicMapUrl?: string | null
  aoMapUrl?: string | null
  tilingScale?: number | null
}
type Whitelist = {
  id: string
  optionId: string
  overridePrice: number | null
  buyerReady?: boolean | null
  option: Option
}

type WhitelistSyncPayload = {
  optionId: string
  overridePrice: number | null
  buyerReady: boolean
}

type AIRoom = {
  id?: string
  type?: string
  default_materials?: Record<string, unknown>
  notes?: string
}

type AICamera = {
  name?: string
  position?: number[]
  look_at?: number[]
  lookAt?: number[]
}

type AIPayload = {
  rooms?: AIRoom[]
  cameras?: AICamera[]
  [key: string]: unknown
}

type GuidedView = {
  id: string
  name: string
  position: [number, number, number]
  target: [number, number, number]
}

type RelationshipAdjacencyWall = {
  element_index: number
  layer?: string
  length?: number
  length_raw?: number
}

type RelationshipSpace = {
  element_index: number
  name?: string
  type?: string
  layer?: string
  generated?: boolean
  area?: number
  area_raw?: number
  adjacent_walls?: RelationshipAdjacencyWall[]
  adjacent_spaces?: number[]
}

type RelationshipGraph = {
  spaces?: RelationshipSpace[]
  summary?: Record<string, unknown>
  scaleToM?: number
}

type RoomSummary = {
  id: number
  name: string
  area?: number
  areaRaw?: number
  wallCount: number
  neighborCount: number
  generated: boolean
}

type MeasurementTool = 'distance' | 'area' | 'volume' | 'clearance' | null

type MeasurementResult = {
  label: string
  value: string
  secondary?: string
}

type Point3 = [number, number, number]

type ControlMode = 'orbit' | 'pan' | 'zoom'

type MeshCatalog = {
  categories: Record<MaterialCategory, THREE.Mesh[]>
  guidEntries: Array<{ guid: string; mesh: THREE.Mesh; ifcType: string; category: MaterialCategory; catalogSlug?: string; textureRef?: string }>
  bounds: { center: Point3; size: Point3 }
}

type AiEnhancementState = {
  enabled: boolean
  status: 'idle' | 'processing' | 'complete' | 'error'
  message?: string | undefined
  lastRunAt?: string | undefined
}

type GuidSummaryEntry = {
  guid: string
  ifcType: string
  category: MaterialCategory
  catalogSlug?: string | undefined
}

const IFC_CATEGORY_OVERRIDES: Record<string, MaterialCategory> = {
  IFCWALL: 'wall',
  IFCWINDOW: 'wall',
  IFCDOOR: 'wall',
  IFCSLAB: 'floor',
  IFCCOVERING: 'ceiling',
  IFCPLATE: 'ceiling',
}

const MATERIAL_CATEGORIES: MaterialCategory[] = ['wall', 'floor', 'ceiling']
const DEFAULT_WALL_HEIGHT_M = 2.7
const PANEL_MIN_WIDTH = 280
const PANEL_MAX_WIDTH = 560
const PANEL_DEFAULT_WIDTH = 360

const MEASUREMENT_OPTIONS: Array<{ id: Exclude<MeasurementTool, null>; label: string; description: string }> = [
  { id: 'distance', label: 'Distance', description: 'Measure point-to-point spans such as door clearances or corridor lengths.' },
  { id: 'area', label: 'Area', description: 'Trace a polygon to estimate floor or ceiling coverage for pricing.' },
  { id: 'volume', label: 'Volume', description: 'Capture volumetric measurements for cabinetry or bulkheads.' },
  { id: 'clearance', label: 'Clearance', description: 'Drop quick clearance presets (eg. 36” walkway) to validate furniture layouts.' },
]

const MEASUREMENT_COLORS: Record<Exclude<MeasurementTool, null>, string> = {
  distance: '#c68a3f',
  area: '#34d399',
  volume: '#a855f7',
  clearance: '#fbbf24',
}

const clampPanelWidth = (value: number) => Math.min(Math.max(value, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH)

const formatPriceInput = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return value.toFixed(2)
}

const parsePriceInput = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const isBuyerReady = (entry?: { buyerReady?: boolean | null }) => entry?.buyerReady !== false

function distance3D(a: Point3 | null | undefined, b: Point3 | null | undefined): number {
  if (!a || !b) return 0
  const [ax, ay, az] = a
  const [bx, by, bz] = b
  const dx = ax - bx
  const dy = ay - by
  const dz = az - bz
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function polygonArea2D(points: Point3[]): number {
  if (!points || points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) * 0.5
}

function mapIfcTypeToCategory(ifcTypeRaw: string, mesh: THREE.Mesh): MaterialCategory {
  const key = (ifcTypeRaw || '').toUpperCase()
  if (IFC_CATEGORY_OVERRIDES[key]) return IFC_CATEGORY_OVERRIDES[key]
  mesh.geometry.computeBoundingBox()
  const bb = mesh.geometry.boundingBox
  if (bb) {
    const size = new THREE.Vector3()
    bb.getSize(size)
    if (size.z < 0.2) {
      const center = new THREE.Vector3()
      bb.getCenter(center)
      return center.z < 0.5 ? 'floor' : 'ceiling'
    }
  }
  return 'wall'
}

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function tokenizeIdentifier(value?: string | null): string[] {
  if (!value) return []
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
}

const AI_KEY_CATEGORY_MAP: Record<string, MaterialCategory> = {
  floor: 'floor',
  floors: 'floor',
  flooring: 'floor',
  wall: 'wall',
  walls: 'wall',
  wallpaint: 'wall',
  paint: 'wall',
  ceiling: 'ceiling',
  ceilings: 'ceiling',
}

function resolveAiCategory(key: string): MaterialCategory | null {
  const normalized = normalizeText(key)
  return AI_KEY_CATEGORY_MAP[normalized] || null
}

function computeCoverage(mesh: THREE.Mesh, category: MaterialCategory): number {
  const geometry = mesh.geometry
  if (!geometry) return 0
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  if (!bb) return 0
  const size = new THREE.Vector3()
  bb.getSize(size)
  if (category === 'floor' || category === 'ceiling') {
    return size.x * size.y
  }
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a)
  return dims[0] * dims[1]
}

function formatDefaultValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'name' in value) {
    const maybe = (value as { name?: unknown }).name
    if (typeof maybe === 'string') return maybe
  }
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function Model({
  url,
  onReady,
  onSelect,
  onMeasure,
  groupRef,
}: {
  url: string
  onReady: (catalog: MeshCatalog) => void
  onSelect: (mesh: THREE.Mesh | null) => void
  onMeasure?: (point: THREE.Vector3) => void
  groupRef: MutableRefObject<THREE.Group | null>
}) {
  const gltf = useGLTF(url)
  const scene = gltf.scene as THREE.Group
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useEffect(() => {
    const categories: Record<MaterialCategory, THREE.Mesh[]> = {
      wall: [],
      floor: [],
      ceiling: [],
    }
    const guidEntries: MeshCatalog['guidEntries'] = []

    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const userData = (mesh.userData || {}) as Record<string, unknown>
        const guidCandidate = typeof userData.ifcGuid === 'string' ? userData.ifcGuid : ''
        const guid = (guidCandidate || mesh.name || '').trim()
        if (guid && !mesh.name) mesh.name = guid
        const ifcType = typeof userData.ifcType === 'string' ? userData.ifcType : ''
        const catalogSlug = typeof userData.catalogSlug === 'string' ? userData.catalogSlug : undefined
        const textureRef = typeof userData.texture === 'string' ? userData.texture : undefined
        const category = mapIfcTypeToCategory(ifcType, mesh)
        mesh.castShadow = true
        mesh.receiveShadow = true
        categories[category].push(mesh)
        if (guid) {
          guidEntries.push({ guid, mesh, ifcType, category, catalogSlug, textureRef })
        }
      }
    })

    const bounds = new THREE.Box3().setFromObject(scene)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())

    onReady({
      categories,
      guidEntries,
      bounds: { center: [center.x, center.y, center.z], size: [size.x, size.y, size.z] },
    })
  }, [scene, onReady])

  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHovered(true)
  }, [])

  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHovered(false)
  }, [])

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const mesh = event.object as THREE.Mesh
    onSelect(mesh)
    onMeasure?.(event.point.clone())
  }, [onSelect, onMeasure])

  return (
    <group ref={groupRef}>
      <primitive
        object={scene}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
      />
    </group>
  )
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const returnTo = searchParams.get('returnTo')
  const [unit, setUnit] = useState<UnitResp | null>(null)
  const [whitelist, setWhitelist] = useState<Whitelist[]>([])
  const [status, setStatus] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [selected, setSelected] = useState<Partial<Record<MaterialCategory, string>>>({})
  const [aiData, setAiData] = useState<AIPayload | null>(null)
  const [guidSummary, setGuidSummary] = useState<GuidSummaryEntry[]>([])
  const [topologyCounts, setTopologyCounts] = useState<Record<string, unknown> | null>(null)
  const [topologyValidations, setTopologyValidations] = useState<Record<string, unknown> | null>(null)
  const [relationships, setRelationships] = useState<RelationshipGraph | null>(null)
  const [guidMaterialsState, setGuidMaterialsState] = useState<Record<string, GuidMaterialInfo>>({})
  const [whitelistLoaded, setWhitelistLoaded] = useState(false)
  const [materialFilter, setMaterialFilter] = useState('')
  const [fixtureFilter, setFixtureFilter] = useState('')
  const [furnitureFilter, setFurnitureFilter] = useState('')
  const meshesRef = useRef<Record<MaterialCategory, THREE.Mesh[]>>({ wall: [], floor: [], ceiling: [] })
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const guidMeshRef = useRef<Record<string, THREE.Mesh>>({})
  const textureLoaderRef = useRef(new THREE.TextureLoader())
  const modelGroupRef = useRef<THREE.Group | null>(null)
  const modelCenterRef = useRef(new THREE.Vector3(0, 0, 0))
  const modelRadiusRef = useRef(6)
  const [floorLockEnabled, setFloorLockEnabled] = useState<boolean>(false)
  const floorAlignedRef = useRef(false)
  const floorLockOptionsRef = useRef<{ preserveView?: boolean; targetOverride?: THREE.Vector3 | null } | null>(null)
  const [controlMode, setControlMode] = useState<ControlMode>('orbit')
  const [autoRotate, setAutoRotate] = useState(false)
  const [guidedViews, setGuidedViews] = useState<GuidedView[]>([])
  const [editorState, setEditorState] = useState<Record<string, unknown> | null>(null)
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [materialAssignments, setMaterialAssignments] = useState<Record<string, string>>({})
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null)
  const [selectedInfo, setSelectedInfo] = useState<{ guid: string; ifcType?: string } | null>(null)
  const [heroRenders, setHeroRenders] = useState<string[]>([])
  const [heroLoading, setHeroLoading] = useState(false)
  const [heroUploading, setHeroUploading] = useState(false)
  const [heroSaving, setHeroSaving] = useState<string | null>(null)
  const heroUploadInputRef = useRef<HTMLInputElement | null>(null)
  const fetchHeroRenders = useCallback(async () => {
    if (!id) return
    setHeroLoading(true)
    try {
      const res = await fetch(`/api/renders/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to load renders')
      }
      const list = Array.isArray((data as { renders?: unknown }).renders)
        ? ((data as { renders?: unknown }).renders as unknown[])
            .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : []
      setHeroRenders(Array.from(new Set(list)))
    } catch (err) {
      setStatus((err as Error)?.message || 'Unable to load renders')
    } finally {
      setHeroLoading(false)
    }
  }, [id, setStatus])
  const whitelistRows = useMemo(() => {
    const order = new Map(MATERIAL_CATEGORIES.map((cat, idx) => [cat, idx]))
    return whitelist
      .slice()
      .sort((a, b) => {
        const aCat = (a.option.category || '').toLowerCase() as MaterialCategory
        const bCat = (b.option.category || '').toLowerCase() as MaterialCategory
        const aIdx = order.get(aCat) ?? MATERIAL_CATEGORIES.length
        const bIdx = order.get(bCat) ?? MATERIAL_CATEGORIES.length
        if (aIdx !== bIdx) return aIdx - bIdx
        return a.option.name.localeCompare(b.option.name)
      })
  }, [whitelist])
  const filteredMaterials = useMemo(() => {
    const term = materialFilter.trim().toLowerCase()
    if (!term) return whitelistRows
    return whitelistRows.filter((entry) => {
      const haystack = `${entry.option.name} ${entry.option.category ?? ''} ${entry.option.description ?? ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [materialFilter, whitelistRows])
  const filteredFixtures = useMemo(() => {
    const fixtures = catalog?.fixtures ?? []
    const term = fixtureFilter.trim().toLowerCase()
    if (!term) return fixtures
    return fixtures.filter((fixture) => {
      const haystack = `${fixture.name} ${fixture.description ?? ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [catalog?.fixtures, fixtureFilter])
  const filteredFurniture = useMemo(() => {
    const materials = catalog?.materials ?? []
    const furnitureCandidates = materials.filter((mat) =>
      Array.isArray(mat.targets) ? mat.targets.some((target) => target.toLowerCase().includes('furniture')) : false,
    )
    const term = furnitureFilter.trim().toLowerCase()
    if (!term) return furnitureCandidates
    return furnitureCandidates.filter((mat) => {
      const haystack = `${mat.name} ${mat.description ?? ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [catalog?.materials, furnitureFilter])
  const [measurementTool, setMeasurementTool] = useState<MeasurementTool>(null)
  const [measurementHistory, setMeasurementHistory] = useState<Point3[][]>([[] as Point3[]])
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyIndexRef = useRef(0)
  const measurementPoints = useMemo(() => measurementHistory[historyIndex] || ([] as Point3[]), [measurementHistory, historyIndex])
  const [snapToAxis, setSnapToAxis] = useState(true)
  const canUndoMeasurement = historyIndex > 0
  const canRedoMeasurement = historyIndex < measurementHistory.length - 1
  const [panelWidth, setPanelWidth] = useState<number>(PANEL_DEFAULT_WIDTH)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const lastPanelWidthRef = useRef(PANEL_DEFAULT_WIDTH)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [priceSaving, setPriceSaving] = useState<Record<string, boolean>>({})
  const [aiEnhancementState, setAiEnhancementState] = useState<AiEnhancementState>({
    enabled: false,
    status: 'idle',
    message: 'Ready to run AI enhancement',
  })
  const [priceEditEnabled, setPriceEditEnabled] = useState(false)

  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  useEffect(() => {
    void fetchHeroRenders()
  }, [fetchHeroRenders])

  useEffect(() => {
    if (!isResizingPanel) return
    const previousSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    return () => {
      document.body.style.userSelect = previousSelect
      document.body.style.cursor = previousCursor
    }
  }, [isResizingPanel])

  useEffect(() => {
    if (whitelist.length === 0) {
      setPriceDrafts({})
      return
    }
    setPriceDrafts((prev) => {
      const next: Record<string, string> = {}
      whitelist.forEach((entry) => {
        const optionId = entry.optionId
        const baselineNumber = entry.overridePrice ?? entry.option.price ?? 0
        const baseline = formatPriceInput(baselineNumber)
        const previous = prev[optionId]
        if (previous === undefined) {
          next[optionId] = baseline
          return
        }
        const prevNumber = parsePriceInput(previous)
        if (prevNumber !== null && Math.abs(prevNumber - baselineNumber) > 0.009) {
          next[optionId] = previous
        } else {
          next[optionId] = baseline
        }
      })
      return next
    })
  }, [whitelist])

  const resetMeasurementHistory = useCallback(() => {
    setMeasurementHistory([[] as Point3[]])
    setHistoryIndex(0)
    historyIndexRef.current = 0
  }, [])

  const pushMeasurementState = useCallback((points: Point3[]) => {
    setMeasurementHistory((prev) => {
      const truncated = prev.slice(0, historyIndexRef.current + 1)
      const last = truncated[truncated.length - 1] || []
      if (JSON.stringify(last) === JSON.stringify(points)) {
        return truncated
      }
      const updated = [...truncated, points]
      historyIndexRef.current = updated.length - 1
      setHistoryIndex(historyIndexRef.current)
      return updated
    })
  }, [])
  const lastSyncedSelectionRef = useRef<string>('')

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setStatus('Loading unit…')
      setWhitelistLoaded(false)
      try {
        const unitRes = await fetch(`/api/units/${id}`)
        const unitJson = await unitRes.json()
        if (!unitRes.ok) {
          setStatus(unitJson?.error || 'Failed to load unit')
          return
        }
        setUnit(unitJson)
        setAiData((unitJson.aiEnrichment ?? null) as AIPayload | null)
        setTopologyCounts((unitJson.topologyCounts ?? null) as Record<string, unknown> | null)
        setTopologyValidations((unitJson.topologyValidations ?? null) as Record<string, unknown> | null)
        setGuidMaterialsState((unitJson.guidMaterials ?? {}) as Record<string, GuidMaterialInfo>)
        setRelationships((unitJson.relationships ?? null) as RelationshipGraph | null)

        try {
          const wl = await fetch(`/api/units/${id}/materials`)
          if (wl.ok) {
            const wlJson = await wl.json()
            setWhitelist(wlJson)
          }
        } catch (materialsErr) {
          console.warn('Material whitelist load failed', materialsErr)
        } finally {
          setWhitelistLoaded(true)
        }

        try {
          const editorRes = await fetch(`/api/units/${id}/editor-state`)
          if (editorRes.ok) {
            const editorJson = await editorRes.json()
            const state = (editorJson?.editorState ?? null) as Record<string, unknown> | null
            setEditorState(state)
            const savedAssignments = state?.materialAssignments
            if (savedAssignments && typeof savedAssignments === 'object') {
              setMaterialAssignments(savedAssignments as Record<string, string>)
            }
            const navigationState = state?.navigation
            if (navigationState && typeof navigationState === 'object') {
              const candidate = (navigationState as Record<string, unknown>).floorLock
              if (typeof candidate === 'boolean') {
                setFloorLockEnabled(candidate)
              }
              const savedViews = (navigationState as Record<string, unknown>).guidedViews
              if (Array.isArray(savedViews)) {
                const normalized = savedViews
                  .map((entry) => {
                    if (!entry || typeof entry !== 'object') return null
                    const { id, name, position, target } = entry as Record<string, unknown>
                    if (!Array.isArray(position) || position.length !== 3) return null
                    if (!Array.isArray(target) || target.length !== 3) return null
                    const viewId = typeof id === 'string' && id ? id : `view-${Date.now()}-${Math.random()}`
                    const label = typeof name === 'string' && name.trim() ? name.trim() : 'Saved view'
                    const posTuple = [Number(position[0]), Number(position[1]), Number(position[2])] as [number, number, number]
                    const targetTuple = [Number(target[0]), Number(target[1]), Number(target[2])] as [number, number, number]
                    if (posTuple.some((n) => Number.isNaN(n)) || targetTuple.some((n) => Number.isNaN(n))) return null
                    return { id: viewId, name: label, position: posTuple, target: targetTuple }
                  })
                  .filter((value): value is GuidedView => Boolean(value))
                setGuidedViews(normalized)
              }
            }
            const savedAiEnhancement = state?.aiEnhancement
            if (savedAiEnhancement && typeof savedAiEnhancement === 'object') {
              const raw = savedAiEnhancement as Partial<AiEnhancementState>
              const statusCandidate = raw.status
              const normalizedStatus: AiEnhancementState['status'] =
                statusCandidate === 'processing' || statusCandidate === 'complete' || statusCandidate === 'error'
                  ? statusCandidate
                  : 'idle'
              const restoredState: AiEnhancementState = {
                enabled: Boolean(raw.enabled),
                status: normalizedStatus,
              }
              if (typeof raw.message === 'string' && raw.message) {
                restoredState.message = raw.message
              }
              if (typeof raw.lastRunAt === 'string' && raw.lastRunAt) {
                restoredState.lastRunAt = raw.lastRunAt
              }
              setAiEnhancementState(restoredState)
            }
          }
        } catch (editorErr) {
          console.warn('Editor state load failed', editorErr)
        }

        setStatus('')
      } catch (err) {
        console.error(err)
        setStatus((err as Error)?.message || 'Failed to load unit')
        setWhitelistLoaded(true)
      }
    }
    load()
  }, [id])

  const requestCatalog = useCallback(async () => {
    const res = await fetch('/api/catalog', { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Catalog fetch failed: ${res.status}`)
    }
    return (await res.json()) as CatalogResponse
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setCatalogLoading(true)
        const data = await requestCatalog()
        if (!cancelled) {
          setCatalog(data)
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Catalog fetch error', err)
          setStatus((err as Error)?.message || 'Failed to load asset catalog')
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [requestCatalog])

  const handleDownloadLibrary = useCallback(async () => {
    try {
      setCatalogLoading(true)
      const results = await Promise.allSettled([
        fetch('/api/materials/seed', { method: 'POST' }),
        fetch('/api/materials/seed-free', { method: 'POST' }),
      ])
      const failure = results.find((entry) => {
        if (entry.status === 'rejected') return true
        return !entry.value.ok
      })
      if (failure) {
        throw new Error('Library seed request failed')
      }
      const data = await requestCatalog()
      setCatalog(data)
      setStatus('Material and fixture libraries downloaded')
    } catch (err) {
      setStatus((err as Error)?.message || 'Failed to download libraries')
    } finally {
      setCatalogLoading(false)
    }
  }, [requestCatalog])

  useEffect(() => {
    resetMeasurementHistory()
  }, [measurementTool, resetMeasurementHistory])

  useEffect(() => {
    if (!guidMaterialsState || Object.keys(guidMaterialsState).length === 0) {
      return
    }
    setMaterialAssignments((prev) => {
      if (Object.keys(prev).length > 0) {
        return prev
      }
      const initial: Record<string, string> = {}
      Object.entries(guidMaterialsState).forEach(([guid, info]) => {
        if (info?.catalogSlug) {
          initial[guid] = info.catalogSlug
        }
      })
      return Object.keys(initial).length > 0 ? initial : prev
    })
  }, [guidMaterialsState])

  const modelUrl = useMemo(() => {
    const glbPath = unit?.file?.glbPath
    if (!glbPath) return ''
    const params = new URLSearchParams({ path: glbPath })
    const listingId = typeof unit?.listing?.id === 'string' ? unit?.listing?.id : undefined
    if (listingId) params.set('listingId', listingId)
    return `/api/files/binary?${params.toString()}`
  }, [unit?.file?.glbPath, unit?.listing?.id])

  const listingInfo = useMemo(() => {
    return (unit?.listing ?? null) as { id?: string; isPublished?: boolean; title?: string | null } | null
  }, [unit?.listing])

  const canPublish = Boolean(unit?.id && unit?.file?.glbPath)
  const publishLabel = listingInfo?.isPublished ? 'Update listing' : 'Publish listing'
  const publishHref = unit?.id ? `/agent/units/${encodeURIComponent(unit.id)}/publish` : '#'

  // Handle return to wizard
  const handleReturnToWizard = useCallback(async () => {
    if (!id || !returnTo) return
    
    // Save current editor state
    const currentState = {
      materialAssignments,
      navigation: {
        floorLock: floorLockEnabled,
        guidedViews: guidedViews,
      },
      aiEnhancement: {
        enabled: aiEnhancementState.enabled,
        status: aiEnhancementState.status,
        message: aiEnhancementState.message,
      }
    }
    
    try {
      await fetch(`/api/units/${id}/editor-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentState),
      })
      
      // Store editor changes in sessionStorage for wizard
      const editorChanges = {
        unitId: id,
        materialAssignments,
        navigation: currentState.navigation,
        aiEnhancement: currentState.aiEnhancement,
        updatedAt: new Date().toISOString(),
      }
      
      sessionStorage.setItem('agent:editorChanges', JSON.stringify(editorChanges))
      
      // Return to wizard
      router.push('/agent/upload/3d')
    } catch (error) {
      setStatus('Failed to save changes. Please try again.')
    }
  }, [id, returnTo, materialAssignments, floorLockEnabled, guidedViews, aiEnhancementState, router])

  const recalcPrice = useCallback((current: Partial<Record<MaterialCategory, string>>) => {
    let total = 0
    const scaleToM = typeof relationships?.scaleToM === 'number' && relationships.scaleToM > 0 ? relationships.scaleToM : 1

    MATERIAL_CATEGORIES.forEach((category) => {
      const optionId = current[category]
      if (!optionId) return
      const candidate = whitelist.find((entry) => entry.optionId === optionId)
      if (!candidate) return
      const meshes = meshesRef.current[category] || []
      let coverage = meshes.reduce((acc, mesh) => acc + computeCoverage(mesh, category), 0)

      if (coverage === 0 && relationships?.spaces) {
        if (category === 'floor' || category === 'ceiling') {
          coverage = relationships.spaces.reduce((acc, space) => {
            if (!space) return acc
            if (typeof space.area_raw === 'number' && space.area_raw > 0) {
              return acc + space.area_raw
            }
            if (typeof space.area === 'number' && space.area > 0) {
              return acc + space.area / (scaleToM * scaleToM)
            }
            return acc
          }, 0)
        } else if (category === 'wall') {
          const defaultHeightUnits = DEFAULT_WALL_HEIGHT_M / scaleToM
          const seen = new Set<number>()
          coverage = 0
          relationships.spaces.forEach((space) => {
            space?.adjacent_walls?.forEach((wall) => {
              const idx = typeof wall?.element_index === 'number' ? wall.element_index : null
              if (idx === null || seen.has(idx)) return
              seen.add(idx)
              let lengthUnits = 0
              if (typeof wall.length_raw === 'number' && wall.length_raw > 0) {
                lengthUnits = wall.length_raw
              } else if (typeof wall.length === 'number' && wall.length > 0) {
                lengthUnits = wall.length / scaleToM
              }
              coverage += lengthUnits * defaultHeightUnits
            })
          })
        }
      }

      const unitPrice = (candidate.overridePrice ?? candidate.option.price) || 0
      total += coverage * unitPrice
    })
    setPrice(Number(total.toFixed(2)))
  }, [relationships, whitelist])

  const handleMeasurementSelect = useCallback((tool: Exclude<MeasurementTool, null>) => {
    setMeasurementTool(tool)
    resetMeasurementHistory()
    setStatus(`Measurement tool set to ${tool}`)
  }, [resetMeasurementHistory])

  const clearMeasurement = useCallback(() => {
    setMeasurementTool(null)
    resetMeasurementHistory()
    setStatus('Cleared active measurement tool')
  }, [resetMeasurementHistory])

  const undoMeasurementPoint = useCallback(() => {
    if (!canUndoMeasurement) return
    const next = historyIndex - 1
    historyIndexRef.current = next
    setHistoryIndex(next)
    setStatus('Removed last measurement point')
  }, [canUndoMeasurement, historyIndex])

  const redoMeasurementPoint = useCallback(() => {
    if (!canRedoMeasurement) return
    const next = historyIndex + 1
    historyIndexRef.current = next
    setHistoryIndex(next)
    setStatus('Restored measurement point')
  }, [canRedoMeasurement, historyIndex])

  const handleMeasurementPoint = useCallback((point: THREE.Vector3) => {
    if (!measurementTool || measurementTool === 'volume') return
    const raw: Point3 = [point.x, point.y, point.z]
    const lastPoint = measurementPoints.length > 0 ? measurementPoints[measurementPoints.length - 1] : null

    const applyAxisSnap = (candidate: Point3, base: Point3 | null): Point3 => {
      if (!snapToAxis || !base) return candidate
      const deltas: Point3 = [candidate[0] - base[0], candidate[1] - base[1], candidate[2] - base[2]]
      const dominantIdx = deltas.reduce<number>((maxIdx, value, idx, arr) => (Math.abs(value) > Math.abs(arr[maxIdx] ?? 0) ? idx : maxIdx), 0)
      const next: Point3 = [candidate[0], candidate[1], candidate[2]]
      next[0] = dominantIdx === 0 ? candidate[0] : base[0]
      next[1] = dominantIdx === 1 ? candidate[1] : base[1]
      next[2] = dominantIdx === 2 ? candidate[2] : base[2]
      return next
    }

    let nextPoints: Point3[] = []

    if (measurementTool === 'distance' || measurementTool === 'clearance') {
      const snapped = applyAxisSnap([raw[0], raw[1], raw[2]], lastPoint)
      if (!lastPoint) {
        nextPoints = [snapped]
      } else {
        nextPoints = [lastPoint, snapped]
      }
    } else if (measurementTool === 'area') {
      const snapped: Point3 = [raw[0], raw[1], lastPoint ? lastPoint[2] : 0]
      if (snapToAxis) {
        const grid = 0.05
        snapped[0] = Math.round(snapped[0] / grid) * grid
        snapped[1] = Math.round(snapped[1] / grid) * grid
      }
      nextPoints = [...measurementPoints, snapped].slice(-10).map((pt) => [pt[0], pt[1], pt[2]] as Point3)
    } else {
      return
    }

    pushMeasurementState(nextPoints.map((pt) => [pt[0], pt[1], pt[2]] as Point3))
    setStatus('Captured measurement point')
  }, [measurementTool, measurementPoints, snapToAxis, pushMeasurementState])

  const createMaterialFromOption = useCallback(
    (option: Option) => {
      const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(option.baseColorHex || '#cccccc') })
      material.name = option.name
      const loader = textureLoaderRef.current
      const tiling = typeof option.tilingScale === 'number' && option.tilingScale > 0 ? option.tilingScale : 1
      const applyTexture = (url: string | null | undefined, assign: (texture: THREE.Texture) => void) => {
        if (!url) return
        const texture = loader.load(url)
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(tiling, tiling)
        assign(texture)
      }

      applyTexture(option.albedoUrl, (texture) => {
        material.map = texture
      })
      applyTexture(option.normalUrl, (texture) => {
        material.normalMap = texture
      })
      applyTexture(option.roughnessMapUrl, (texture) => {
        material.roughnessMap = texture
      })
      applyTexture(option.metallicMapUrl, (texture) => {
        material.metalnessMap = texture
      })
      applyTexture(option.aoMapUrl, (texture) => {
        material.aoMap = texture
      })

      material.needsUpdate = true
      return material
    },
    [],
  )

  const applyMaterial = useCallback(
    (category: MaterialCategory, optionId: string) => {
      const wl = whitelist.find((w) => w.optionId === optionId)
      if (!wl) return
      const meshes = meshesRef.current[category] || []
      const newMaterial = createMaterialFromOption(wl.option)

      meshes.forEach((mesh) => {
        const previous = mesh.material
        if (Array.isArray(previous)) previous.forEach((mat) => mat.dispose())
        else if (previous) (previous as THREE.Material).dispose()
        mesh.material = newMaterial
      })

      setSelected((prev) => {
        const next = { ...prev, [category]: optionId }
        recalcPrice(next)
        return next
      })
    },
    [createMaterialFromOption, recalcPrice, whitelist],
  )

  const findWhitelistByName = useCallback((category: MaterialCategory, label: string) => {
    const normalized = normalizeText(label)
    if (!normalized) return null
    const pool = whitelist.filter((item) => item.option.category.toLowerCase() === category)
    const exact = pool.find((item) => normalizeText(item.option.name) === normalized)
    if (exact) return exact
    return pool.find((item) => normalizeText(item.option.name).includes(normalized) || normalized.includes(normalizeText(item.option.name))) || null
  }, [whitelist])

  const findWhitelistBySlug = useCallback((category: MaterialCategory, slug?: string | null) => {
    if (!slug) return null
    const slugTokens = tokenizeIdentifier(slug)
    if (slugTokens.length === 0) return null
    const slugJoined = slugTokens.join('')
    const slugUnderscore = slugTokens.join('_')
    const pool = whitelist.filter((item) => item.option.category.toLowerCase() === category)
    return (
      pool.find((item) => {
        const nameTokens = tokenizeIdentifier(item.option.name)
        if (slugTokens.every((token) => nameTokens.includes(token))) return true
        const nameJoined = nameTokens.join('')
        if (nameJoined && (nameJoined.includes(slugJoined) || slugJoined.includes(nameJoined))) return true
        const textureUrl = typeof item.option.albedoUrl === 'string' ? item.option.albedoUrl.toLowerCase() : ''
        if (textureUrl && slugUnderscore && textureUrl.includes(slugUnderscore)) return true
        return false
      }) || null
    )
  }, [whitelist])

  const assignMaterialToGuid = useCallback(
    (guid: string, optionId: string) => {
      const mesh = guidMeshRef.current[guid]
      if (!mesh) {
        setStatus('Unable to locate the selected element in the scene')
        return false
      }
      const entry = whitelist.find((item) => item.optionId === optionId)
      if (!entry) {
        setStatus('Material option not found in the library')
        return false
      }

      const material = createMaterialFromOption(entry.option)
      const previous = mesh.material
      if (Array.isArray(previous)) previous.forEach((mat) => mat.dispose())
      else if (previous) (previous as THREE.Material).dispose()
      mesh.material = material
      mesh.userData.catalogSlug = entry.optionId

      setMaterialAssignments((prev) => ({ ...prev, [guid]: entry.optionId }))
      setGuidMaterialsState((prev) => ({
        ...prev,
        [guid]: { ...(prev[guid] || {}), catalogSlug: entry.optionId },
      }))
      setStatus(`Assigned ${entry.option.name} to element ${guid}`)
      return true
    },
    [createMaterialFromOption, setStatus, whitelist],
  )

  const handleAssignMaterialToSelection = useCallback(
    (optionId: string) => {
      if (!selectedInfo) {
        setStatus('Select an element in the viewer before assigning a material')
        return
      }
      assignMaterialToGuid(selectedInfo.guid, optionId)
    },
    [assignMaterialToGuid, selectedInfo, setStatus],
  )
  const handleAssignCatalogItemToSelection = useCallback(
    (slug: string, label: string) => {
      if (!selectedInfo) {
        setStatus('Select an element in the viewer before assigning catalog items')
        return
      }
      const guid = selectedInfo.guid
      setMaterialAssignments((prev) => ({ ...prev, [guid]: slug }))
      setGuidMaterialsState((prev) => ({
        ...prev,
        [guid]: { ...(prev[guid] || {}), catalogSlug: slug },
      }))
      setStatus(`Assigned ${label} to element ${guid}`)
    },
    [selectedInfo, setStatus],
  )

  const applyAiDefaults = useCallback((room: AIRoom) => {
    const defaults = room?.default_materials
    if (!defaults) {
      setStatus('AI room has no default materials to apply')
      return
    }
    let applied = 0
    Object.entries(defaults).forEach(([key, value]) => {
      const category = resolveAiCategory(key)
      if (!category) return
      const label = formatDefaultValue(value)
      if (!label) return
      const match = findWhitelistByName(category, label)
      if (match) {
        applyMaterial(category, match.optionId)
        applied += 1
      }
    })
    if (applied === 0) {
      setStatus(`No material matches found for ${room.type || room.id || 'room'}`)
    } else {
      setStatus(`Applied ${applied} AI defaults for ${room.type || room.id || 'room'}`)
    }
  }, [applyMaterial, findWhitelistByName])

  const toggleHighlight = useCallback((mesh: THREE.Mesh | null, value: boolean) => {
    if (!mesh) return
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[]
    const store = mesh.userData as { __origEmissive?: (THREE.Color | null)[] }
    const standardMaterials = materials.filter((mat): mat is THREE.MeshStandardMaterial => 'emissive' in mat)
    if (value && !store.__origEmissive) {
      store.__origEmissive = standardMaterials.map((mat) => mat.emissive.clone())
    }
    if (!value && store.__origEmissive) {
      standardMaterials.forEach((mat, idx) => {
        const original = store.__origEmissive?.[idx]
        if (original) {
          mat.emissive.copy(original)
        }
      })
      delete store.__origEmissive
      return
    }
    standardMaterials.forEach((mat) => {
      mat.emissive = mat.emissive.clone()
      mat.emissive.setRGB(0.1, 0.25, 0.45)
    })
  }, [])

  const applyFloorLock = useCallback(
    (
      enable: boolean,
      options?: { preserveView?: boolean; targetOverride?: THREE.Vector3 | null },
    ) => {
      const controls = controlsRef.current
      const camera = cameraRef.current
      if (!controls || !camera) return

      const { preserveView = false, targetOverride = null } = options ?? {}
      const tilt = THREE.MathUtils.degToRad(20)
      const defaultTarget = new THREE.Vector3(modelCenterRef.current.x, modelCenterRef.current.y, 0)
      const desiredTarget = targetOverride ? targetOverride.clone() : defaultTarget

      if (enable) {
        controls.enablePan = false
        controls.screenSpacePanning = false
        controls.minPolarAngle = Math.PI / 2 - tilt
        controls.maxPolarAngle = Math.PI / 2 + tilt
        camera.up.set(0, 0, 1)

        if (preserveView) {
          const preserved = targetOverride
            ? desiredTarget
            : new THREE.Vector3(controls.target.x, controls.target.y, desiredTarget.z)
          controls.target.copy(preserved)
        } else {
          controls.target.copy(desiredTarget)
          const offset = camera.position.clone().sub(controls.target)
          const horizontalDistance = Math.sqrt(offset.x * offset.x + offset.y * offset.y) || modelRadiusRef.current
          const azimuth = Math.atan2(offset.y, offset.x)
          const safeDistance = Math.max(horizontalDistance, modelRadiusRef.current * 0.8, 3)
          const safeHeight = Math.max(camera.position.z - controls.target.z, 1.6)

          camera.position.set(
            controls.target.x + Math.cos(azimuth) * safeDistance,
            controls.target.y + Math.sin(azimuth) * safeDistance,
            controls.target.z + safeHeight,
          )
        }
      } else {
        controls.enablePan = true
        controls.screenSpacePanning = true
        controls.minPolarAngle = 0
        controls.maxPolarAngle = Math.PI
        controls.target.set(
          modelCenterRef.current.x,
          modelCenterRef.current.y,
          modelCenterRef.current.z,
        )
        camera.up.set(0, 1, 0)
      }

      controls.update()
    },
    [],
  )

  const configureControls = useCallback(
    (controls: OrbitControlsImpl | null) => {
      if (!controls) return

      const mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }
      const touchControls = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }

      if (controlMode === 'pan') {
        mouseButtons.LEFT = THREE.MOUSE.PAN
        touchControls.ONE = THREE.TOUCH.PAN
      } else if (controlMode === 'zoom') {
        mouseButtons.LEFT = THREE.MOUSE.DOLLY
        mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
        touchControls.ONE = THREE.TOUCH.DOLLY
      }

      controls.mouseButtons = mouseButtons
      controls.touches = touchControls
      controls.autoRotate = autoRotate
      if (autoRotate) {
        controls.autoRotateSpeed = 0.75
      }
      controls.update()
    },
    [autoRotate, controlMode],
  )

  useEffect(() => {
    if (controlsRef.current) {
      configureControls(controlsRef.current)
    }
  }, [configureControls])

  const handleControlModeChange = useCallback((mode: ControlMode) => {
    setControlMode(mode)
    setAutoRotate(false)
  }, [])

  const handleToggleAutoRotate = useCallback(() => {
    setAutoRotate((prev) => !prev)
  }, [])

  const handleZoomIn = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    setAutoRotate(false)
    controls.dollyIn(0.85)
    controls.update()
  }, [])

  const handleZoomOut = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    setAutoRotate(false)
    controls.dollyOut(0.85)
    controls.update()
  }, [])

  const handleModelReady = useCallback((catalog: MeshCatalog) => {
    meshesRef.current = catalog.categories
    floorAlignedRef.current = false
    const map: Record<string, THREE.Mesh> = {}
    catalog.guidEntries.forEach(({ guid, mesh }) => {
      if (guid) {
        map[guid] = mesh
      }
    })
    guidMeshRef.current = map

    const summary = catalog.guidEntries.map(({ guid, ifcType, category, catalogSlug }) => {
      const entry: GuidSummaryEntry = { guid, ifcType, category }
      if (catalogSlug) {
        entry.catalogSlug = catalogSlug
      }
      return entry
    })
    setGuidSummary(summary)
    const center = new THREE.Vector3(...catalog.bounds.center)
    const size = new THREE.Vector3(...catalog.bounds.size)
    const maxExtent = Math.max(size.x, size.y, size.z, 1)
    modelCenterRef.current.copy(center)
    modelRadiusRef.current = maxExtent
    if (cameraRef.current) {
      cameraRef.current.up.set(0, 0, 1)
      cameraRef.current.position.set(
        center.x + maxExtent * 1.5,
        center.y - maxExtent * 1.5,
        center.z + maxExtent * 1.2,
      )
      cameraRef.current.lookAt(center)
      cameraRef.current.updateProjectionMatrix()
    }
    if (controlsRef.current) {
      controlsRef.current.target.copy(center)
      controlsRef.current.update()
    }
    applyFloorLock(floorLockEnabled)
  }, [applyFloorLock, floorLockEnabled])

  const modelElements = useMemo(() => {
    if (guidSummary.length === 0) return []
    const materialsCatalog = catalog?.materials ?? []
    const elements = guidSummary.map((entry) => {
      const guid = entry.guid
      const info = guidMaterialsState[guid]
      const defaultName = info?.ifcType || entry.ifcType || guid
      const assignmentKey = materialAssignments[guid] ?? info?.catalogSlug ?? entry.catalogSlug ?? ''
      let detailLabel = assignmentKey || 'Unassigned'
      let secondaryLabel: string | null = null
      let unitPrice: number | null = null
      let resolvedOptionId: string | null = null

      if (assignmentKey) {
        const directMatch = whitelist.find((item) => item.optionId === assignmentKey)
        const slugMatch = !directMatch ? findWhitelistBySlug(entry.category, assignmentKey) : null
        const libraryMatch = directMatch || slugMatch
        if (libraryMatch) {
          detailLabel = libraryMatch.option.name
          resolvedOptionId = libraryMatch.optionId
          unitPrice = libraryMatch.overridePrice ?? libraryMatch.option.price ?? null
          if (libraryMatch.option.unit) {
            secondaryLabel = `Unit: ${libraryMatch.option.unit}`
          }
        } else {
          const catalogMatch = materialsCatalog.find((material) => material.slug === assignmentKey)
          if (catalogMatch) {
            detailLabel = catalogMatch.name
          }
          secondaryLabel = assignmentKey
        }
      }

      return {
        guid,
        name: defaultName,
        category: entry.category,
        detail: detailLabel,
        detailMeta: secondaryLabel,
        price: unitPrice,
        optionId: resolvedOptionId,
        rawAssignment: assignmentKey,
      }
    })

    const selectedGuid = selectedInfo?.guid
    if (!selectedGuid) return elements

    return elements
      .slice()
      .sort((a, b) => {
        if (a.guid === selectedGuid && b.guid !== selectedGuid) return -1
        if (b.guid === selectedGuid && a.guid !== selectedGuid) return 1
        return 0
      })
  }, [catalog, findWhitelistBySlug, guidMaterialsState, guidSummary, materialAssignments, selectedInfo?.guid, whitelist])

  const handleSelectMesh = useCallback(
    (mesh: THREE.Mesh | null) => {
      if (selectedMesh && selectedMesh !== mesh) {
        toggleHighlight(selectedMesh, false)
      }
      if (mesh) {
        toggleHighlight(mesh, true)
        const guidCandidate = typeof mesh.userData.ifcGuid === 'string' ? mesh.userData.ifcGuid : mesh.name
        const ifcTypeCandidate =
          typeof mesh.userData.ifcType === 'string'
            ? mesh.userData.ifcType
            : typeof mesh.userData.ifc_type === 'string'
            ? mesh.userData.ifc_type
            : undefined
        const info: { guid: string; ifcType?: string } = { guid: guidCandidate || 'unknown' }
        if (ifcTypeCandidate) {
          info.ifcType = ifcTypeCandidate
        }
        setSelectedInfo(info)
        setStatus(`Selected ${guidCandidate || 'mesh'}`)
      } else {
        setSelectedInfo(null)
      }
      setSelectedMesh(mesh)
    },
    [selectedMesh, toggleHighlight],
  )

  const handleInspectElement = useCallback(
    (guid: string) => {
      const mesh = guidMeshRef.current[guid]
      if (!mesh) {
        setStatus('Unable to find that element in the viewer')
        return
      }
      handleSelectMesh(mesh)
    },
    [handleSelectMesh, setStatus],
  )

  const resolveRenderPreview = useCallback(
    (path: string) => {
      if (/^https?:/i.test(path)) return path
      const listingId = unit?.listing?.id
      const query = listingId ? `&listingId=${encodeURIComponent(listingId)}` : ''
      return `/api/files/binary?path=${encodeURIComponent(path)}${query}`
    },
    [unit?.listing?.id],
  )

  const handleHeroUpload = useCallback(
    async (file: File) => {
      if (!id) return
      setHeroUploading(true)
      setStatus('Uploading hero image…')
      try {
        const formData = new FormData()
        formData.append('unitId', id)
        if (unit?.listing?.id) {
          formData.append('listingId', unit.listing.id)
        }
        formData.append('image', file)
        const res = await fetch('/api/renders', { method: 'POST', body: formData })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || 'Failed to upload hero image')
        }
        const path = (data as { path?: string }).path || ''
        if (path) {
          setHeroRenders((prev) => (prev.includes(path) ? prev : [path, ...prev]))
          setStatus('Hero image uploaded')
        }
      } catch (err) {
        setStatus((err as Error)?.message || 'Hero upload failed')
      } finally {
        setHeroUploading(false)
        void fetchHeroRenders()
      }
    },
    [fetchHeroRenders, id, unit?.listing?.id],
  )

  const captureHeroRender = useCallback(async () => {
    if (!id) {
      setStatus('Unit id missing; cannot capture render')
      return
    }
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!renderer || !scene || !camera) {
      setStatus('Renderer not ready yet')
      return
    }
    setHeroUploading(true)
    setStatus('Capturing hero render…')
    try {
      renderer.render(scene, camera)
      await new Promise((resolve) => setTimeout(resolve, 50))
      const blob: Blob | null = await new Promise((resolve) => {
        renderer.domElement.toBlob((value) => resolve(value), 'image/png')
      })
      if (!blob) {
        throw new Error('Render capture failed')
      }
      await handleHeroUpload(new File([blob], `hero-${Date.now()}.png`, { type: 'image/png' }))
    } catch (err) {
      setStatus((err as Error)?.message || 'Failed to capture render')
      setHeroUploading(false)
    }
  }, [handleHeroUpload, id])

  const handleApplyHeroToListing = useCallback(
    async (path: string) => {
      const listingId = unit?.listing?.id
      if (!listingId) {
        setStatus('Publish the unit first to assign a listing hero')
        return
      }
      setHeroSaving(path)
      setStatus('Updating listing hero…')
      try {
        const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverImage: path }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error || 'Failed to update listing hero')
        }
        setStatus('Listing hero updated')
      } catch (err) {
        setStatus((err as Error)?.message || 'Listing hero update failed')
      } finally {
        setHeroSaving(null)
      }
    },
    [unit?.listing?.id],
  )

  const clearSelection = useCallback(() => {
    handleSelectMesh(null)
  }, [handleSelectMesh])

  const handleTogglePanel = useCallback(() => {
    setPanelCollapsed((prev) => {
      if (prev) {
        const restored = clampPanelWidth(lastPanelWidthRef.current || panelWidth || PANEL_DEFAULT_WIDTH)
        setPanelWidth(restored)
        return false
      }
      lastPanelWidthRef.current = panelWidth
      return true
    })
  }, [panelWidth])

  const handlePanelResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const target = event.currentTarget
      const pointerId = event.pointerId
      target.setPointerCapture?.(pointerId)
      const baselineWidth = clampPanelWidth(panelCollapsed ? lastPanelWidthRef.current : panelWidth)
      if (panelCollapsed) {
        setPanelCollapsed(false)
        setPanelWidth(baselineWidth)
      }
      lastPanelWidthRef.current = baselineWidth
      const startX = event.clientX
      const startWidth = baselineWidth
      setIsResizingPanel(true)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = startX - moveEvent.clientX
        const nextWidth = clampPanelWidth(startWidth + delta)
        lastPanelWidthRef.current = nextWidth
        setPanelWidth(nextWidth)
      }

      const handlePointerUp = () => {
        setIsResizingPanel(false)
        target.releasePointerCapture?.(pointerId)
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    },
    [panelCollapsed, panelWidth],
  )

  const saveEditorState = useCallback(
    async (patch: Record<string, unknown>, successMessage: string) => {
      if (!id) return
      const payload = { ...(editorState || {}), ...patch }
      setStatus('Saving editor state…')
      try {
        const res = await fetch(`/api/units/${id}/editor-state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || `Failed with status ${res.status}`)
        }
        setEditorState(payload)
        setStatus(successMessage)
      } catch (err) {
        setStatus((err as Error)?.message || 'Failed to save editor state')
      }
    },
    [editorState, id],
  )

  useEffect(() => {
    const options = floorLockOptionsRef.current ?? undefined
    floorLockOptionsRef.current = null
    applyFloorLock(floorLockEnabled, options)
  }, [floorLockEnabled, applyFloorLock])

  const persistGuidedViews = useCallback(
    (views: GuidedView[], message: string) => {
      const navigationState =
        editorState && typeof editorState.navigation === 'object'
          ? (editorState.navigation as Record<string, unknown>)
          : {}
      void saveEditorState({ navigation: { ...navigationState, guidedViews: views } }, message)
    },
    [editorState, saveEditorState],
  )

  const alignModelToMesh = useCallback(
    (mesh: THREE.Mesh): boolean => {
      const group = modelGroupRef.current
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (!group || !camera || !controls) {
        setStatus('Viewer not ready to align floor')
        return false
      }

      const geometry = mesh.geometry as THREE.BufferGeometry
      const positionAttr = geometry.getAttribute('position')
      if (!positionAttr || positionAttr.count < 3) {
        setStatus('Selected surface has insufficient geometry to align')
        return false
      }

      if (!geometry.boundingBox) {
        geometry.computeBoundingBox()
      }
      const boundingBox = geometry.boundingBox
      if (!boundingBox) {
        setStatus('Could not compute bounds for the selected surface')
        return false
      }

      const centerLocal = boundingBox.getCenter(new THREE.Vector3())
      const centerWorld = mesh.localToWorld(centerLocal.clone())

      const normalLocal = new THREE.Vector3()
      const normalAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
      const tempNormal = new THREE.Vector3()
      if (normalAttr && normalAttr.count > 0) {
        for (let i = 0; i < normalAttr.count; i += 1) {
          tempNormal.fromBufferAttribute(normalAttr, i)
          if (tempNormal.lengthSq() > 0) {
            normalLocal.add(tempNormal)
          }
        }
      }

      const triangle = new THREE.Triangle()
      const vertexA = new THREE.Vector3()
      const vertexB = new THREE.Vector3()
      const vertexC = new THREE.Vector3()
      const indexAttr = geometry.getIndex()
      if (normalLocal.lengthSq() === 0) {
        if (indexAttr) {
          for (let i = 0; i < indexAttr.count; i += 3) {
            const a = indexAttr.getX(i)
            const b = indexAttr.getX(i + 1)
            const c = indexAttr.getX(i + 2)
            vertexA.fromBufferAttribute(positionAttr, a)
            vertexB.fromBufferAttribute(positionAttr, b)
            vertexC.fromBufferAttribute(positionAttr, c)
            triangle.set(vertexA, vertexB, vertexC)
            triangle.getNormal(tempNormal)
            if (tempNormal.lengthSq() > 0) {
              normalLocal.add(tempNormal)
            }
          }
        } else {
          for (let i = 0; i < positionAttr.count; i += 3) {
            vertexA.fromBufferAttribute(positionAttr, i)
            vertexB.fromBufferAttribute(positionAttr, i + 1)
            vertexC.fromBufferAttribute(positionAttr, i + 2)
            triangle.set(vertexA, vertexB, vertexC)
            triangle.getNormal(tempNormal)
            if (tempNormal.lengthSq() > 0) {
              normalLocal.add(tempNormal)
            }
          }
        }
      }

      if (normalLocal.lengthSq() === 0) {
        setStatus('Could not compute the normal for the selected surface')
        return false
      }

      normalLocal.normalize()
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
      const normalWorld = normalLocal.clone().applyMatrix3(normalMatrix).normalize()
      if (normalWorld.lengthSq() === 0) {
        setStatus('Could not determine world normal for the selected surface')
        return false
      }

      if (normalWorld.dot(new THREE.Vector3(0, 0, 1)) < 0) {
        normalWorld.multiplyScalar(-1)
      }

      const rotationQuat = new THREE.Quaternion().setFromUnitVectors(normalWorld, new THREE.Vector3(0, 0, 1))

      const cameraLocalPosition = group.worldToLocal(camera.position.clone())
      const targetLocalPosition = group.worldToLocal(controls.target.clone())
      const cameraUp = camera.up.clone()

      const currentMatrix = group.matrix.clone()
      const translateToPivot = new THREE.Matrix4().makeTranslation(-centerWorld.x, -centerWorld.y, -centerWorld.z)
      const translateBack = new THREE.Matrix4().makeTranslation(centerWorld.x, centerWorld.y, centerWorld.z)
      const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(rotationQuat)
      const alignmentMatrix = new THREE.Matrix4()
        .multiply(translateBack)
        .multiply(rotationMatrix)
        .multiply(translateToPivot)
      const rotatedCenter = centerWorld.clone().applyMatrix4(alignmentMatrix)
      const translationMatrix = new THREE.Matrix4().makeTranslation(0, 0, -rotatedCenter.z)
      const totalMatrix = translationMatrix.clone().multiply(alignmentMatrix)
      const finalMatrix = totalMatrix.clone().multiply(currentMatrix)

      group.matrix.copy(finalMatrix)
      group.matrix.decompose(group.position, group.quaternion, group.scale)
      group.updateMatrixWorld(true)

      const newCameraPosition = group.localToWorld(cameraLocalPosition.clone())
      camera.position.copy(newCameraPosition)
      const rotatedUp = cameraUp.applyQuaternion(rotationQuat).normalize()
      camera.up.copy(rotatedUp)
      camera.updateProjectionMatrix()

      const newTarget = group.localToWorld(targetLocalPosition.clone())
      controls.target.copy(newTarget)
      controls.update()

      const transformPoint = (point: Point3): Point3 => {
        const vector = new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(totalMatrix)
        return [vector.x, vector.y, vector.z]
      }

      setMeasurementHistory((prev) =>
        prev.map((sequence) => sequence.map((point) => transformPoint(point))),
      )

      let updatedGuidedViews: GuidedView[] | null = null
      setGuidedViews((prev) => {
        if (prev.length === 0) return prev
        updatedGuidedViews = prev.map((view) => ({
          ...view,
          position: transformPoint(view.position),
          target: transformPoint(view.target),
        }))
        return updatedGuidedViews
      })
      if (updatedGuidedViews) {
        persistGuidedViews(updatedGuidedViews, 'Guided views aligned to new floor')
      }

      const updatedBounds = new THREE.Box3().setFromObject(group)
      const updatedCenter = updatedBounds.getCenter(new THREE.Vector3())
      const updatedSize = updatedBounds.getSize(new THREE.Vector3())
      modelCenterRef.current.copy(updatedCenter)
      modelRadiusRef.current = Math.max(updatedSize.x, updatedSize.y, updatedSize.z, 1)

      floorAlignedRef.current = true
      setStatus('Selected surface aligned as floor')
      return true
    },
    [
      cameraRef,
      controlsRef,
      modelGroupRef,
      persistGuidedViews,
      setGuidedViews,
      setMeasurementHistory,
      setStatus,
    ],
  )

  const handleToggleFloorLock = useCallback(() => {
    const next = !floorLockEnabled

    if (next) {
      if (selectedMesh) {
        const success = alignModelToMesh(selectedMesh)
        if (!success) {
          return
        }
      } else if (!floorAlignedRef.current) {
        setStatus('Select a surface to lock as the floor')
        return
      }

      const controls = controlsRef.current
      const targetOverride = controls
        ? new THREE.Vector3(controls.target.x, controls.target.y, 0)
        : new THREE.Vector3(modelCenterRef.current.x, modelCenterRef.current.y, 0)
      floorLockOptionsRef.current = { preserveView: true, targetOverride }
    } else {
      floorLockOptionsRef.current = null
      setStatus('Floor lock disabled')
    }

    setFloorLockEnabled(next)
    setControlMode('orbit')
    setAutoRotate(false)

    const navigationState =
      editorState && typeof editorState.navigation === 'object'
        ? (editorState.navigation as Record<string, unknown>)
        : {}

    void saveEditorState(
      { navigation: { ...navigationState, floorLock: next } },
      next ? 'Floor lock enabled' : 'Floor lock disabled',
    )
  }, [
    alignModelToMesh,
    controlsRef,
    editorState,
    floorLockEnabled,
    saveEditorState,
    selectedMesh,
    setStatus,
  ])

  const handleTogglePriceEdit = useCallback(() => {
    setPriceEditEnabled((prev) => !prev)
  }, [])

  const resetView = useCallback(() => {
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!controls || !camera) return

    const target = floorLockEnabled
      ? new THREE.Vector3(modelCenterRef.current.x, modelCenterRef.current.y, 0)
      : modelCenterRef.current.clone()

    controls.target.copy(target)

    const radius = Math.max(modelRadiusRef.current * 1.5, 6)
    const height = Math.max(modelRadiusRef.current * 0.8, floorLockEnabled ? 2 : 3)

    camera.position.set(target.x + radius, target.y - radius, target.z + height)
    camera.lookAt(target)
    controls.update()
    setAutoRotate(false)
    applyFloorLock(floorLockEnabled)
    setStatus('View reset')
  }, [applyFloorLock, floorLockEnabled])

  const handleAddGuidedView = useCallback(() => {
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!controls || !camera) {
      setStatus('Camera controls not ready yet')
      return
    }

    const position = camera.position
    const target = controls.target
    const newView: GuidedView = {
      id: `view-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      name: `View ${guidedViews.length + 1}`,
      position: [Number(position.x), Number(position.y), Number(position.z)],
      target: [Number(target.x), Number(target.y), Number(target.z)],
    }

    const nextViews = [...guidedViews, newView]
    setGuidedViews(nextViews)
    persistGuidedViews(nextViews, 'Guided view saved')
    setStatus(`Saved ${newView.name}`)
  }, [guidedViews, persistGuidedViews])

  const handleApplyGuidedView = useCallback(
    (view: GuidedView) => {
      const controls = controlsRef.current
      const camera = cameraRef.current
      if (!controls || !camera) {
        setStatus('Camera controls not ready yet')
        return
      }
      camera.position.set(view.position[0], view.position[1], view.position[2])
      controls.target.set(view.target[0], view.target[1], view.target[2])
      controls.update()
      camera.lookAt(view.target[0], view.target[1], view.target[2])
      camera.updateProjectionMatrix()
      applyFloorLock(floorLockEnabled)
      setStatus(`Jumped to ${view.name}`)
    },
    [applyFloorLock, floorLockEnabled],
  )

  const handleRenameGuidedView = useCallback(
    (id: string) => {
      const targetView = guidedViews.find((view) => view.id === id)
      if (!targetView) return
      // TODO: Replace with proper input modal
      const trimmed = targetView.name + ' (Renamed)'
      const updated = guidedViews.map((view) => (view.id === id ? { ...view, name: trimmed } : view))
      setGuidedViews(updated)
      persistGuidedViews(updated, 'Guided views updated')
      setStatus(`Renamed view to ${trimmed}`)
    },
    [guidedViews, persistGuidedViews],
  )

  const handleDeleteGuidedView = useCallback(
    (id: string) => {
      const updated = guidedViews.filter((view) => view.id !== id)
      setGuidedViews(updated)
      persistGuidedViews(updated, 'Guided view removed')
      setStatus('Guided view removed')
    },
    [guidedViews, persistGuidedViews],
  )

  const aiRooms = useMemo<AIRoom[]>(() => aiData?.rooms ?? [], [aiData])

  const aiCameras = useMemo<AICamera[]>(() => aiData?.cameras ?? [], [aiData])

  const aiEnhancementLastRun = useMemo(() => {
    if (!aiEnhancementState.lastRunAt) return null
    const parsed = new Date(aiEnhancementState.lastRunAt)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleString()
  }, [aiEnhancementState.lastRunAt])

  useEffect(() => {
    if (guidSummary.length === 0) return
    setSelected((prev) => {
      let changed = false
      const next: Partial<Record<MaterialCategory, string>> = { ...prev }
      MATERIAL_CATEGORIES.forEach((category) => {
        if (next[category]) return
        const slugCandidate = guidSummary
          .filter((entry) => entry.category === category)
          .map((entry) => guidMaterialsState[entry.guid]?.catalogSlug || entry.catalogSlug)
          .find((value): value is string => Boolean(value))
        if (!slugCandidate) return
        const match = findWhitelistBySlug(category, slugCandidate)
        if (!match) return
        next[category] = match.optionId
        changed = true
      })
      if (!changed) return prev
      setMaterialAssignments((prevAssignments) => {
        if (Object.keys(prevAssignments).length > 0) return prevAssignments
        const seeded: Record<string, string> = {}
        guidSummary.forEach((entry) => {
          const slug = guidMaterialsState[entry.guid]?.catalogSlug || entry.catalogSlug
          if (slug) seeded[entry.guid] = slug
        })
        return Object.keys(seeded).length > 0 ? seeded : prevAssignments
      })
      recalcPrice(next)
      return next
    })
  }, [guidSummary, guidMaterialsState, findWhitelistBySlug, recalcPrice])

  useEffect(() => {
    if (!id || !whitelistLoaded) return
    const optionPayloads = MATERIAL_CATEGORIES.map((category) => {
      const optionId = selected[category]
      if (!optionId) return null
      const existing = whitelist.find((entry) => entry.optionId === optionId)
      return {
        optionId,
        overridePrice: existing?.overridePrice ?? null,
        buyerReady: isBuyerReady(existing),
      }
    }).filter((entry): entry is WhitelistSyncPayload => Boolean(entry))

    if (optionPayloads.length === 0) return

    const signature = optionPayloads.map((entry) => entry.optionId).join('|')
    if (signature === lastSyncedSelectionRef.current) return

    const controller = new AbortController()
    const sync = async () => {
      const updates: any[] = []
      for (const payload of optionPayloads) {
        try {
          const res = await fetch(`/api/units/${id}/materials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
          if (res.ok) {
            const record = await res.json()
            updates.push(record)
          } else {
            const error = await res.json().catch(() => null)
            if (!controller.signal.aborted) {
              setStatus(error?.error || 'Failed to sync material whitelist')
            }
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            setStatus((err as Error)?.message || 'Failed to sync material whitelist')
          }
        }
      }

      if (!controller.signal.aborted && updates.length) {
        setWhitelist((prev) => {
          const map = new Map(prev.map((entry) => [entry.optionId, entry]))
          updates.forEach((entry) => {
            if (entry?.optionId) {
              map.set(entry.optionId, entry)
            }
          })
          return Array.from(map.values())
        })
      }

      if (!controller.signal.aborted) {
        lastSyncedSelectionRef.current = signature
      }
    }

    void sync()
    return () => controller.abort()
  }, [selected, id, whitelist, whitelistLoaded])

  const applyCameraView = useCallback((camera: AICamera) => {
    const position = Array.isArray(camera.position) ? camera.position : []
    const target = Array.isArray(camera.look_at) ? camera.look_at : Array.isArray(camera.lookAt) ? camera.lookAt : []
    if (position.length !== 3 || target.length !== 3) {
      setStatus('Camera data incomplete')
      return
    }
    if (!controlsRef.current || !cameraRef.current) {
      setStatus('Camera controls not ready yet')
      return
    }
    cameraRef.current.position.set(position[0], position[1], position[2])
    controlsRef.current.target.set(target[0], target[1], target[2])
    controlsRef.current.update()
    cameraRef.current.lookAt(target[0], target[1], target[2])
    cameraRef.current.updateProjectionMatrix()
    setStatus(`Jumped to ${camera.name || 'AI camera'}`)
  }, [])

  const persistAiCameraState = useCallback(
    async (focus?: AICamera) => {
      if (!aiCameras.length) {
        setStatus('No AI cameras available to persist')
        return
      }
      const patch: Record<string, unknown> = {
        aiCameras,
        lastAICameraSync: new Date().toISOString(),
      }
      if (focus) {
        patch.lastAppliedCamera = focus.name || null
        patch.lastAppliedCameraPose = {
          position: focus.position ?? null,
          lookAt: focus.look_at ?? focus.lookAt ?? null,
        }
      }
      await saveEditorState(patch, 'AI cameras saved to editor state')
    },
    [aiCameras, saveEditorState],
  )

  const persistMaterialAssignments = useCallback(async () => {
    if (Object.keys(materialAssignments).length === 0) {
      setStatus('No material assignments to save')
      return
    }
    await saveEditorState(
      {
        materialAssignments,
        lastMaterialSync: new Date().toISOString(),
      },
      'Material assignments saved',
    )
  }, [materialAssignments, saveEditorState])

  const handlePriceDraftChange = useCallback((optionId: string, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [optionId]: value }))
  }, [])

  const handleSaveUnitPrice = useCallback(
    async (optionId: string) => {
      if (!id) return
      const draft = priceDrafts[optionId]
      const parsed = parsePriceInput(typeof draft === 'string' ? draft : '')
      if (parsed === null) {
        setStatus('Enter a valid unit cost before saving')
        return
      }
      setPriceSaving((prev) => ({ ...prev, [optionId]: true }))
      try {
        const response = await fetch(`/api/units/${id}/materials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            optionId,
            overridePrice: parsed,
            buyerReady: isBuyerReady(whitelist.find((entry) => entry.optionId === optionId)),
          }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          setStatus((data as { error?: string } | null)?.error || 'Failed to update unit cost')
          return
        }
        const record = data as Whitelist
        setWhitelist((prev) => {
          const idx = prev.findIndex((entry) => entry.optionId === optionId)
          if (idx === -1) return [...prev, record]
          const next = [...prev]
          next[idx] = record
          return next
        })
        setStatus(`Unit cost saved for ${record.option.name}`)
      } catch (err) {
        setStatus((err as Error)?.message || 'Failed to update unit cost')
      } finally {
        setPriceSaving((prev) => {
          const next = { ...prev }
          delete next[optionId]
          return next
        })
      }
    },
    [id, priceDrafts, whitelist],
 )

  const handleResetUnitPrice = useCallback(
    async (optionId: string) => {
      if (!id) return
      setPriceSaving((prev) => ({ ...prev, [optionId]: true }))
      try {
        const response = await fetch(`/api/units/${id}/materials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            optionId,
            overridePrice: null,
            buyerReady: isBuyerReady(whitelist.find((entry) => entry.optionId === optionId)),
          }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          setStatus((data as { error?: string } | null)?.error || 'Failed to reset unit cost')
          return
        }
        const record = data as Whitelist
        setWhitelist((prev) => {
          const idx = prev.findIndex((entry) => entry.optionId === optionId)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = record
          return next
        })
        setStatus(`Unit cost reset to base price for ${record.option.name}`)
      } catch (err) {
        setStatus((err as Error)?.message || 'Failed to reset unit cost')
      } finally {
        setPriceSaving((prev) => {
          const next = { ...prev }
          delete next[optionId]
          return next
        })
      }
    },
    [id, whitelist],
  )

  const toggleBuyerAvailability = useCallback(
    async (optionId: string, nextState: boolean) => {
      if (!id) return
      const entry = whitelist.find((item) => item.optionId === optionId)
      if (!entry) return
      const previousState = isBuyerReady(entry)
      if (previousState === nextState) return

      setWhitelist((prev) =>
        prev.map((item) => (item.optionId === optionId ? { ...item, buyerReady: nextState } : item)),
      )

      try {
        const response = await fetch(`/api/units/${id}/materials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            optionId,
            overridePrice: entry.overridePrice ?? null,
            buyerReady: nextState,
          }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error((data as { error?: string } | null)?.error || 'Failed to update availability')
        }
        const record = data as Whitelist
        setWhitelist((prev) =>
          prev.map((item) => (item.optionId === optionId ? record : item)),
        )
        setStatus(
          nextState
            ? `${entry.option.name} made available to buyers`
            : `${entry.option.name} hidden from buyers`,
        )
      } catch (err) {
        setWhitelist((prev) =>
          prev.map((item) =>
            item.optionId === optionId ? { ...item, buyerReady: previousState } : item,
          ),
        )
        setStatus((err as Error)?.message || 'Failed to update buyer availability')
      }
    },
    [id, whitelist],
  )

  const handleAiEnhancementToggle = useCallback(async () => {
    if (aiEnhancementState.enabled) {
      const idleState: AiEnhancementState = {
        enabled: false,
        status: 'idle',
        message: 'AI enhancement disabled',
      }
      setAiEnhancementState(idleState)
      await saveEditorState({ aiEnhancement: idleState }, 'AI enhancement disabled')
      return
    }

    if (aiRooms.length === 0) {
      const unavailableState: AiEnhancementState = {
        enabled: false,
        status: 'error',
        message: 'Cannot complete: no AI defaults available for this unit yet',
      }
      setAiEnhancementState(unavailableState)
      await saveEditorState({ aiEnhancement: unavailableState }, 'AI enhancement unavailable')
      return
    }

    setStatus('Applying AI defaults…')
    setAiEnhancementState({ enabled: true, status: 'processing', message: 'Applying AI defaults…' })
    try {
      aiRooms.forEach((room) => applyAiDefaults(room))
      const completeState: AiEnhancementState = {
        enabled: true,
        status: 'complete',
        message: `AI defaults applied to ${aiRooms.length} room${aiRooms.length === 1 ? '' : 's'}`,
        lastRunAt: new Date().toISOString(),
      }
      setAiEnhancementState(completeState)
      await saveEditorState({ aiEnhancement: completeState }, 'AI enhancement complete')
    } catch (err) {
      const errorState: AiEnhancementState = {
        enabled: false,
        status: 'error',
        message: `Cannot complete: ${(err as Error)?.message || 'Failed to apply AI defaults'}`,
      }
      setAiEnhancementState(errorState)
      await saveEditorState({ aiEnhancement: errorState }, 'AI enhancement cannot complete')
    }
  }, [aiEnhancementState.enabled, aiRooms, applyAiDefaults, saveEditorState])

  const countsSummary = useMemo(() => {
    const entries: Array<{ key: string; value: number }> = []
    if (topologyCounts) {
      Object.entries(topologyCounts)
        .filter(([_key, value]) => typeof value === 'number')
        .forEach(([key, value]) => entries.push({ key, value: value as number }))
    }
    if (relationships?.summary) {
      Object.entries(relationships.summary)
        .filter(([_key, value]) => typeof value === 'number')
        .forEach(([key, value]) => entries.push({ key: `relationships.${key}`, value: value as number }))
    }
    return entries
  }, [topologyCounts, relationships?.summary])

  const roomSummaries = useMemo<RoomSummary[]>(() => {
    if (!relationships?.spaces) return []
    const spaces = relationships.spaces.map((space) => {
      const area = typeof space.area === 'number' ? space.area : undefined
      const areaRaw = typeof space.area_raw === 'number' ? space.area_raw : undefined
      const wallCount = space.adjacent_walls?.length ?? 0
      const neighborCount = space.adjacent_spaces?.length ?? 0
      const isGenerated = Boolean(space.generated || space.layer === '__generated_space__')
      return {
        id: space.element_index,
        name: space.name || `Space ${space.element_index}`,
        area,
        areaRaw,
        wallCount,
        neighborCount,
        generated: isGenerated,
      }
    })
    return spaces.sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
  }, [relationships?.spaces])

  const allRoomsGenerated = useMemo(() => {
    if (typeof topologyValidations?.hasOnlyGeneratedRooms === 'boolean') {
      return topologyValidations.hasOnlyGeneratedRooms as boolean
    }
    if (!relationships?.summary) return false
    const spaces = relationships.summary['spaces']
    const generated = relationships.summary['generatedSpaces']
    return typeof spaces === 'number' && spaces > 0 && typeof generated === 'number' && generated === spaces
  }, [relationships?.summary, topologyValidations?.hasOnlyGeneratedRooms])

  const validationEntries = useMemo(() => {
    if (!topologyValidations) return []
    return Object.entries(topologyValidations).map(([key, value]) => {
      if (typeof value === 'boolean') {
        return { key, value: value ? 'Yes' : 'No' }
      }
      if (typeof value === 'number') {
        return { key, value: value }
      }
      return { key, value }
    })
  }, [topologyValidations])

  const activeMeasurementDescription = useMemo(() => {
    if (!measurementTool) return 'Select a tool to start measuring distances, areas, or clearances.'
    const match = MEASUREMENT_OPTIONS.find((option) => option.id === measurementTool)
    return match?.description || ''
  }, [measurementTool])

  const measurementResult = useMemo<MeasurementResult | null>(() => {
    if (!measurementTool) return null
    const scale = typeof relationships?.scaleToM === 'number' && relationships.scaleToM > 0 ? relationships.scaleToM : 1
    if (measurementTool === 'distance' && measurementPoints.length >= 2) {
      const [start, end] = measurementPoints.slice(-2)
      const raw = distance3D(start, end)
      const meters = raw * scale
      return {
        label: 'Distance',
        value: `${meters.toFixed(2)} m`,
        secondary: scale !== 1 ? `${raw.toFixed(2)} units` : undefined,
      }
    }
    if (measurementTool === 'area' && measurementPoints.length >= 3) {
      const rawArea = polygonArea2D(measurementPoints)
      const metersSquared = rawArea * scale * scale
      return {
        label: 'Area',
        value: `${metersSquared.toFixed(2)} m²`,
        secondary: scale !== 1 ? `${rawArea.toFixed(2)} units²` : undefined,
      }
    }
    if (measurementTool === 'clearance' && measurementPoints.length >= 2) {
      const [start, end] = measurementPoints.slice(-2)
      const raw = distance3D(start, end)
      const meters = raw * scale
      return {
        label: 'Clearance width',
        value: `${meters.toFixed(2)} m`,
        secondary: scale !== 1 ? `${raw.toFixed(2)} units` : undefined,
      }
    }
    return null
  }, [measurementPoints, measurementTool, relationships?.scaleToM])

  const exportMeasurements = useCallback(() => {
    if (!measurementTool || measurementPoints.length === 0) {
      setStatus('No measurement to export')
      return
    }
    const payload = {
      unitId: unit?.id ?? null,
      tool: measurementTool,
      points: measurementPoints,
      result: measurementResult,
      snapToAxis,
      generatedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `measurement-${unit?.id ?? 'export'}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setStatus('Measurement exported')
  }, [measurementTool, measurementPoints, measurementResult, unit?.id, snapToAxis])

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[color:var(--surface-0)] text-primary">
      <header className="flex h-16 items-center justify-between border-b border-[color:var(--surface-border)] px-6">
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase tracking-[0.35em] text-disabled">Agent Editor</span>
          <h1 className="text-lg font-semibold text-primary">{unit?.name || id}</h1>
        </div>
        <div className="max-w-sm text-right text-xs text-muted">{status ? status : 'Ready'}</div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[color:var(--surface-0)]">
          {modelUrl ? (
            <>
            <Canvas
              className="h-full w-full"
              style={{ width: '100%', height: '100%' }}
              shadows
              camera={{ position: [6, 4, 8], fov: 50 }}
              onCreated={({ camera, gl, scene }) => {
                cameraRef.current = camera as THREE.PerspectiveCamera
                rendererRef.current = gl
                sceneRef.current = scene
                gl.toneMapping = THREE.ACESFilmicToneMapping
                gl.toneMappingExposure = 1.1
              }}
            >
              <color attach="background" args={[0xfefbf6]} />
              <ambientLight intensity={0.55} />
              <directionalLight position={[5, 8, 5]} intensity={0.85} castShadow />
              <directionalLight position={[-6, 10, -4]} intensity={0.35} />
              <Environment preset="sunset" background={false} />
              <MeasurementOverlay
                tool={measurementTool}
                points={measurementPoints}
                scale={typeof relationships?.scaleToM === 'number' && relationships.scaleToM > 0 ? relationships.scaleToM : 1}
              />
              <Model
                url={modelUrl}
                onReady={handleModelReady}
                onSelect={handleSelectMesh}
                onMeasure={measurementTool && measurementTool !== 'volume' ? handleMeasurementPoint : undefined}
                groupRef={modelGroupRef}
              />
              <GizmoHelper alignment="top-right" margin={[80, 80]}>
                <GizmoViewport axisColors={['#ef4444', '#10b981', '#3b82f6']} labelColor="#0f172a" />
              </GizmoHelper>
              <OrbitControls
                ref={(value) => {
                  controlsRef.current = value as OrbitControlsImpl | null
                  if (value) {
                    applyFloorLock(floorLockEnabled)
                    configureControls(value as OrbitControlsImpl)
                  }
                }}
                enableDamping
                dampingFactor={0.05}
                enablePan
                enableRotate
                rotateSpeed={0.85}
                maxDistance={modelRadiusRef.current * 4}
                minDistance={modelRadiusRef.current * 0.25}
              />
            </Canvas>
            <div className="pointer-events-auto absolute bottom-4 right-4 z-10 flex flex-col gap-3 text-xs text-secondary">
              <div className="w-56 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-3 shadow-[var(--shadow-soft)]">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-disabled">
                  <span>3D Navigation</span>
                  <span>{floorLockEnabled ? 'Floor locked' : 'Free'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    className={`rounded px-2 py-2 font-medium transition ${
                      controlMode === 'orbit'
                        ? 'bg-[color:var(--brand-600)] text-white hover:bg-[color:var(--brand-500)]'
                        : 'bg-[color:var(--surface-3)] text-secondary hover:bg-[color:var(--surface-2)]'
                    }`}
                    onClick={() => handleControlModeChange('orbit')}
                  >
                    Orbit
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-2 font-medium transition ${
                      controlMode === 'pan'
                        ? 'bg-[color:var(--brand-600)] text-white hover:bg-[color:var(--brand-500)]'
                        : 'bg-[color:var(--surface-3)] text-secondary hover:bg-[color:var(--surface-2)]'
                    } ${floorLockEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    onClick={() => handleControlModeChange('pan')}
                    disabled={floorLockEnabled}
                  >
                    Pan
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-2 font-medium transition ${
                      controlMode === 'zoom'
                        ? 'bg-[color:var(--brand-600)] text-white hover:bg-[color:var(--brand-500)]'
                        : 'bg-[color:var(--surface-3)] text-secondary hover:bg-[color:var(--surface-2)]'
                    }`}
                    onClick={() => handleControlModeChange('zoom')}
                  >
                    Zoom
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded px-2 py-2 font-medium transition ${
                      autoRotate
                        ? 'bg-[color:var(--brand-600)] text-white hover:bg-[color:var(--brand-500)]'
                        : 'bg-[color:var(--surface-3)] text-secondary hover:bg-[color:var(--surface-2)]'
                    }`}
                    onClick={handleToggleAutoRotate}
                  >
                    {autoRotate ? 'Stop rotate' : 'Auto rotate'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded bg-[color:var(--surface-3)] px-2 py-2 font-medium text-secondary transition hover:bg-[color:var(--surface-2)]"
                      onClick={handleZoomIn}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded bg-[color:var(--surface-3)] px-2 py-2 font-medium text-secondary transition hover:bg-[color:var(--surface-2)]"
                      onClick={handleZoomOut}
                    >
                      -
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-4 left-4 z-10 space-y-2 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-3 text-xs text-secondary shadow-[var(--shadow-soft)]">
              <p className="font-semibold text-sm text-primary">Move around</p>
              <ul className="space-y-1">
                <li>• Click and drag to look around</li>
                <li>• Right-click and drag to slide across the floor</li>
                <li>• Scroll to zoom in or out</li>
                <li>• Use W / A / S / D to walk through the home</li>
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded bg-[color:var(--brand-600)] px-3 py-1 text-[11px] uppercase tracking-wide text-white transition hover:bg-[color:var(--brand-500)]"
                  onClick={resetView}
                >
                  Reset view
                </button>
                <button
                  type="button"
                  className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                    floorLockEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-[color:var(--surface-3)] text-secondary hover:bg-[color:var(--surface-2)]'
                  }`}
                  onClick={handleToggleFloorLock}
                >
                  {floorLockEnabled ? 'Unlock floor' : 'Lock to floor'}
                </button>
              </div>
            </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted">No GLB asset linked to this unit.</div>
          )}
          {panelCollapsed && (
            <button
              className="absolute right-4 top-4 rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted backdrop-blur transition hover:bg-[color:var(--surface-3)]"
              onClick={handleTogglePanel}
            >
              Open details
            </button>
          )}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize details panel"
          onPointerDown={handlePanelResizeStart}
          className={`h-full shrink-0 cursor-col-resize transition-opacity duration-150 ${panelCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'} ${
            isResizingPanel ? 'bg-[color:var(--brand-500-45)]' : 'bg-[color:var(--surface-2)] hover:bg-[color:var(--surface-3)]'
          }`}
          style={{ width: panelCollapsed ? 0 : 6 }}
        />

        <aside
          className="relative shrink-0 transition-[width] duration-200 ease-out"
          style={{ width: panelCollapsed ? 0 : panelWidth }}
          aria-hidden={panelCollapsed}
        >
          <div
            className={`absolute inset-0 flex h-full min-h-0 flex-col border-l border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-3 transition-opacity duration-150 ${
              panelCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.25em] text-disabled">Details</div>
              <div className="flex flex-wrap items-center gap-2">
                {unit?.id && (
                  returnTo === 'wizard' ? (
                    <button
                      onClick={handleReturnToWizard}
                      className="btn btn-primary text-xs"
                    >
                      Return to Wizard
                    </button>
                  ) : (
                    <Link
                      href={publishHref}
                      className={`btn btn-primary text-xs ${!canPublish ? 'pointer-events-none opacity-40' : ''}`}
                      aria-disabled={!canPublish}
                      prefetch={false}
                    >
                      {publishLabel}
                    </Link>
                  )
                )}
                <button
                  className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)]"
                  onClick={handleTogglePanel}
                >
                  Collapse
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
            <DetailsPanel title="Selection" defaultOpen>
              <div className="text-sm font-semibold uppercase tracking-wide text-muted">Selection</div>
              {selectedInfo ? (
                (() => {
                  const material = guidMaterialsState[selectedInfo.guid]
                  const appliedSlug = materialAssignments[selectedInfo.guid] ?? material?.catalogSlug ?? '—'
                  return (
                    <div className="space-y-1 text-xs text-muted">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">GUID</span>
                        <code className="rounded bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] text-primary">{selectedInfo.guid}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Type</span>
                        <span>{selectedInfo.ifcType || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Catalog</span>
                        <span>{appliedSlug}</span>
                      </div>
                      {material?.texture && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Texture</span>
                          <span className="truncate text-muted" title={material.texture}>
                            {material.texture}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button
                          className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)]"
                          onClick={clearSelection}
                        >
                          Clear
                        </button>
                        <button
                          className="rounded bg-emerald-600/80 px-3 py-1 text-[11px] uppercase tracking-wide text-primary transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={persistMaterialAssignments}
                          disabled={Object.keys(materialAssignments).length === 0}
                        >
                          Save materials
                        </button>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <p className="text-muted">Click any mesh in the scene to inspect and sync its catalog entry.</p>
              )}
              {unit?.catalogAssignments?.style && (
                <p className="pt-1 text-[11px] text-disabled">Preset: {unit.catalogAssignments.style}</p>
              )}
            </DetailsPanel>

            <DetailsPanel title="Hero renders" defaultOpen>
              <div className="space-y-3 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                      heroUploading
                        ? 'bg-[color:var(--surface-2)] text-disabled'
                        : 'bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-3)]'
                    }`}
                    onClick={captureHeroRender}
                    disabled={heroUploading}
                  >
                    {heroUploading ? 'Saving…' : 'Capture view'}
                  </button>
                  <button
                    type="button"
                    className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                      heroUploading
                        ? 'bg-[color:var(--surface-2)] text-disabled'
                        : 'bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-3)]'
                    }`}
                    onClick={() => heroUploadInputRef.current?.click()}
                    disabled={heroUploading}
                  >
                    Upload image
                  </button>
                  <input
                    ref={heroUploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void handleHeroUpload(file)
                      }
                      if (event.target) {
                        event.target.value = ''
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)]"
                    onClick={() => void fetchHeroRenders()}
                  >
                    Refresh
                  </button>
                </div>

                {heroLoading ? (
                  <p className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-center text-xs text-muted">
                    Loading renders…
                  </p>
                ) : heroRenders.length === 0 ? (
                  <p className="rounded border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-6 text-center text-xs text-muted">
                    Capture the current viewport or upload a marketing image to create hero renders.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {heroRenders.map((path) => {
                      const src = resolveRenderPreview(path)
                      const saving = heroSaving === path
                      return (
                        <figure
                          key={path}
                          className="overflow-hidden rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] shadow-[var(--shadow-soft)]"
                        >
                          <a href={src} target="_blank" rel="noreferrer" className="block">
                            <img src={src} alt="Hero render" className="h-28 w-full object-cover transition hover:opacity-90" />
                          </a>
                          <figcaption className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] text-muted">
                            <span className="truncate" title={path}>
                              {path.split('/').pop()}
                            </span>
                            <div className="flex gap-1">
                              <a
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded bg-[color:var(--surface-2)] px-2 py-1 text-[10px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)]"
                              >
                                Open
                              </a>
                              <button
                                type="button"
                                className="rounded bg-[color:var(--surface-2)] px-2 py-1 text-[10px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => handleApplyHeroToListing(path)}
                                disabled={saving || !unit?.listing?.id}
                              >
                                {saving ? 'Saving…' : 'Use as hero'}
                              </button>
                            </div>
                          </figcaption>
                        </figure>
                      )
                    })}
                  </div>
                )}
              </div>
            </DetailsPanel>

            <DetailsPanel title="Model elements" defaultOpen>
              <div className="space-y-3 text-xs text-muted">
                <p className="text-[11px] text-disabled">
                  Review every IFC element, its current catalog assignment, and associated unit pricing.
                </p>
                {modelElements.length === 0 ? (
                  <p className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-muted">
                    Load a model to populate element details.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
                    <div className="overflow-y-auto" style={{ maxHeight: '240px' }}>
                      <table className="min-w-full divide-y divide-[color:var(--surface-border)] text-xs text-muted">
                        <thead className="bg-[color:var(--surface-1)] text-[11px] uppercase tracking-wide text-disabled">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left">Name</th>
                            <th scope="col" className="px-3 py-2 text-left">Unit detail</th>
                            <th scope="col" className="px-3 py-2 text-right">Unit price</th>
                            <th scope="col" className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--surface-border)]">
                          {modelElements.map((element) => {
                            const isSelectedElement = selectedInfo?.guid === element.guid
                            return (
                              <tr
                                key={element.guid}
                                className={`cursor-pointer transition hover:bg-[color:var(--surface-2)] ${
                                  isSelectedElement ? 'bg-[color:var(--brand-500-15)] text-primary' : 'odd:bg-[color:var(--surface-1)]'
                                }`}
                                aria-selected={isSelectedElement}
                                onClick={() => handleInspectElement(element.guid)}
                              >
                              <td className="px-3 py-2 align-top">
                                <div className="font-medium text-primary">{element.name}</div>
                                <div className="text-[11px] uppercase tracking-wide text-disabled">
                                  {element.category} · {element.guid}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="text-primary">{element.detail}</div>
                                {element.detailMeta && (
                                  <div className="text-[11px] text-disabled">{element.detailMeta}</div>
                                )}
                                {!element.detailMeta && element.rawAssignment && element.detail !== element.rawAssignment && (
                                  <div className="text-[11px] text-disabled">{element.rawAssignment}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right align-top">
                                {typeof element.price === 'number' ? `$${element.price.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-right align-top">
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)]"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleInspectElement(element.guid)
                                    }}
                                  >
                                    Inspect
                                  </button>
                                </div>
                              </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </DetailsPanel>

            <DetailsPanel title="Material library" defaultOpen>
              <div className="space-y-3 text-xs text-muted">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="search"
                    value={materialFilter}
                    onChange={(event) => setMaterialFilter(event.target.value)}
                    className="w-full flex-1 min-w-[220px] rounded border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-primary placeholder:text-disabled focus:border-[color:var(--brand-500)] focus:outline-none"
                    placeholder="Search materials"
                    aria-label="Search materials"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                        catalogLoading
                          ? 'bg-[color:var(--surface-2)] text-disabled'
                          : 'bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-3)]'
                      }`}
                      type="button"
                      onClick={handleDownloadLibrary}
                      disabled={catalogLoading}
                    >
                      {catalogLoading ? 'Syncing…' : 'Download library'}
                    </button>
                    <button
                      className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                        priceEditEnabled ? 'bg-emerald-600 text-primary hover:bg-emerald-500' : 'bg-[color:var(--surface-2)] text-secondary hover:bg-[color:var(--surface-3)]'
                      }`}
                      type="button"
                      onClick={handleTogglePriceEdit}
                    >
                      {priceEditEnabled ? 'Done editing prices' : 'Edit prices'}
                    </button>
                    <button
                      className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-secondary transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                      type="button"
                      onClick={persistMaterialAssignments}
                      disabled={Object.keys(materialAssignments).length === 0}
                    >
                      Save buyer defaults
                    </button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
                  <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-[color:var(--surface-border)] text-xs text-muted">
                      <thead className="bg-[color:var(--surface-1)] text-[11px] uppercase tracking-wide text-disabled">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">Material</th>
                          <th scope="col" className="px-3 py-2 text-left">Details</th>
                          <th scope="col" className="px-3 py-2 text-right">Unit price</th>
                          <th scope="col" className="px-3 py-2 text-center">Buyer-ready</th>
                          <th scope="col" className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--surface-border)]">
                        {filteredMaterials.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-disabled">
                              {whitelistRows.length === 0
                                ? 'No materials configured yet. Add whitelist entries to curate buyer options.'
                                : 'No materials match your search.'}
                            </td>
                          </tr>
                        ) : (
                          filteredMaterials.map((entry) => {
                            const optionId = entry.optionId
                            const name = entry.option.name
                            const category = (entry.option.category || '').toLowerCase()
                            const categoryKey = category as MaterialCategory
                            const description = entry.option.description ?? ''
                            const unitLabel = entry.option.unit || 'unit'
                            const draft = priceDrafts[optionId] ?? ''
                            const parsedDraft = parsePriceInput(draft)
                            const baseline = entry.overridePrice ?? entry.option.price ?? 0
                            const hasOverride = typeof entry.overridePrice === 'number'
                            const dirty = parsedDraft !== null && Math.abs(parsedDraft - baseline) > 0.009
                            const saving = Boolean(priceSaving[optionId])
                            const isActive = MATERIAL_CATEGORIES.includes(categoryKey) && selected[categoryKey] === optionId
                            const inputInvalid = draft.trim().length > 0 && parsedDraft === null
                            const basePrice = typeof entry.option.price === 'number' ? formatPriceInput(entry.option.price) : null
                            return (
                              <tr key={optionId} className="odd:bg-[color:var(--surface-1)]">
                                <td className="px-3 py-2 align-top">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-primary">{name}</span>
                                    {hasOverride && (
                                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                                        Override
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] uppercase tracking-wide text-disabled">{category || 'uncategorized'}</div>
                                </td>
                                <td className="px-3 py-2 align-top text-muted">
                                  {description ? description : 'No description provided.'}
                                  <div className="mt-1 text-disabled">Unit: {unitLabel}</div>
                                </td>
                                <td className="px-3 py-2 text-right align-top">
                                  {priceEditEnabled ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-disabled">$</span>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        className={`w-24 rounded border bg-[color:var(--overlay-900)] px-2 py-1 text-right text-primary placeholder:text-disabled focus:outline-none ${
                                          inputInvalid ? 'border-red-500/60 focus:border-red-400' : 'border-[color:var(--surface-border-strong)] focus:border-[color:var(--brand-500)]'
                                        }`}
                                        value={draft}
                                        onChange={(event) => handlePriceDraftChange(optionId, event.target.value)}
                                        disabled={saving}
                                      />
                                    </div>
                                  ) : (
                                    <span>{`$${Number(baseline).toFixed(2)}`}</span>
                                  )}
                                  {!priceEditEnabled && basePrice && (
                                    <div className="text-[11px] text-disabled">Base ${basePrice}</div>
                                  )}
                                  {priceEditEnabled && inputInvalid && (
                                    <div className="pt-1 text-[10px] text-red-400">Enter a valid amount</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center align-top">
                                  {(() => {
                                    const buyerReady = isBuyerReady(entry)
                                    const availabilityClasses = buyerReady
                                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25'
                                      : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] text-muted hover:border-[color:var(--brand-500)] hover:text-brand-strong'
                                    return (
                                      <button
                                        type="button"
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-semibold transition ${availabilityClasses}`}
                                        aria-pressed={buyerReady}
                                        aria-label={buyerReady ? 'Mark unavailable to buyers' : 'Mark available to buyers'}
                                        onClick={() => toggleBuyerAvailability(optionId, !buyerReady)}
                                      >
                                        {buyerReady ? '✓' : '–'}
                                      </button>
                                    )
                                  })()}
                                </td>
                                <td className="px-3 py-2 text-right align-top">
                                  <div className="flex flex-col items-end gap-2">
                                    {selectedInfo && (
                                      <button
                                        className="w-full rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={() => handleAssignMaterialToSelection(optionId)}
                                        disabled={saving}
                                      >
                                        Assign to selection
                                      </button>
                                    )}
                                    <button
                                      className={`w-full rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                                        isActive ? 'bg-emerald-600 text-primary' : 'bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-3)]'
                                      } ${!MATERIAL_CATEGORIES.includes(categoryKey) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                      onClick={() => MATERIAL_CATEGORIES.includes(categoryKey) && applyMaterial(categoryKey as MaterialCategory, optionId)}
                                      disabled={!MATERIAL_CATEGORIES.includes(categoryKey) || saving}
                                    >
                                      {isActive ? 'Active' : 'Use'}
                                    </button>
                                    {priceEditEnabled && (
                                      <div className="flex flex-wrap justify-end gap-2">
                                        <button
                                          className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                                          onClick={() => handleSaveUnitPrice(optionId)}
                                          disabled={saving || parsedDraft === null || !dirty}
                                        >
                                          {saving ? 'Saving…' : 'Save price'}
                                        </button>
                                        <button
                                          className="rounded bg-[color:var(--surface-2)] px-3 py-1 text+[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                                          onClick={() => handleResetUnitPrice(optionId)}
                                          disabled={saving || !hasOverride}
                                        >
                                          Reset
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-[11px] text-disabled">Rows with a check are visible to buyers. Toggle availability and use “Save buyer defaults” to sync the latest assignments.</p>
              </div>
            </DetailsPanel>

            <DetailsPanel title="Fixtures" defaultOpen>
              <div className="space-y-3 text-xs text-muted">
                <input
                  type="search"
                  value={fixtureFilter}
                  onChange={(event) => setFixtureFilter(event.target.value)}
                  className="w-full rounded border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-primary placeholder:text-disabled focus:border-[color:var(--brand-500)] focus:outline-none"
                  placeholder="Search fixtures"
                  aria-label="Search fixtures"
                />
                {catalogLoading ? (
                  <p className="text-muted">Loading fixtures…</p>
                ) : filteredFixtures.length === 0 ? (
                  <p className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-muted">{(catalog?.fixtures?.length ?? 0) === 0 ? 'Add fixture manifests to populate this table.' : 'No fixtures match your search.'}</p>
                ) : (
                <div className="overflow-hidden rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
                    <table className="min-w-full divide-y divide-[color:var(--surface-border)] text-xs text-muted">
                      <thead className="bg-[color:var(--surface-1)] text-[11px] uppercase tracking-wide text-disabled">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">Fixture</th>
                          <th scope="col" className="px-3 py-2 text-left">Details</th>
                          <th scope="col" className="px-3 py-2 text-center">Buyer-ready</th>
                          <th scope="col" className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--surface-border)]">
                        {filteredFixtures.map((fixture) => (
                          <tr key={fixture.slug} className="odd:bg-[color:var(--surface-1)]">
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-primary">{fixture.name}</div>
                              {fixture.metadata?.brand && <div className="text-[11px] text-disabled">Brand: {String(fixture.metadata.brand)}</div>}
                            </td>
                            <td className="px-3 py-2 align-top text-muted">
                              {fixture.description ? fixture.description : 'No additional details provided.'}
                            </td>
                            <td className="px-3 py-2 text-center align-top">
                              <span aria-label="Available for buyers" title="Available for buyers">✓</span>
                            </td>
                            <td className="px-3 py-2 text-right align-top">
                              <button
                                type="button"
                                className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => handleAssignCatalogItemToSelection(fixture.slug, fixture.name)}
                                disabled={!selectedInfo}
                              >
                                Assign to selection
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DetailsPanel>

            <DetailsPanel title="Furniture" defaultOpen>
              <div className="space-y-3 text-xs text-muted">
                <input
                  type="search"
                  value={furnitureFilter}
                  onChange={(event) => setFurnitureFilter(event.target.value)}
                  className="w-full rounded border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-primary placeholder:text-disabled focus:border-[color:var(--brand-500)] focus:outline-none"
                  placeholder="Search furniture finishes"
                  aria-label="Search furniture"
                />
                {filteredFurniture.length === 0 ? (
                  <p className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-muted">{(catalog?.materials?.length ?? 0) === 0 ? 'Add catalog materials tagged for furniture to populate this table.' : 'No furniture entries match your search.'}</p>
                ) : (
                <div className="overflow-hidden rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
                    <table className="min-w-full divide-y divide-[color:var(--surface-border)] text-xs text-muted">
                      <thead className="bg-[color:var(--surface-1)] text-[11px] uppercase tracking-wide text-disabled">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left">Item</th>
                          <th scope="col" className="px-3 py-2 text-left">Details</th>
                          <th scope="col" className="px-3 py-2 text-center">Buyer-ready</th>
                          <th scope="col" className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--surface-border)]">
                        {filteredFurniture.map((item) => (
                          <tr key={item.slug} className="odd:bg-[color:var(--surface-1)]">
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-primary">{item.name}</div>
                              {item.targets && <div className="text-[11px] text-disabled">Tags: {item.targets.join(', ')}</div>}
                            </td>
                            <td className="px-3 py-2 align-top text-muted">
                              {item.description ? item.description : 'No additional details provided.'}
                            </td>
                            <td className="px-3 py-2 text-center align-top">
                              <span aria-label="Available for buyers" title="Available for buyers">✓</span>
                            </td>
                            <td className="px-3 py-2 text-right align-top">
                              <button
                                type="button"
                                className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => handleAssignCatalogItemToSelection(item.slug, item.name)}
                                disabled={!selectedInfo}
                              >
                                Assign to selection
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DetailsPanel>



            

            <DetailsPanel title="Measurement tools">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-disabled">
                  Active tool: <span className="text-secondary">{measurementTool ? measurementTool : 'None'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MEASUREMENT_OPTIONS.map((option) => {
                    const isActive = measurementTool === option.id
                    return (
                      <button
                        key={option.id}
                        className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                          isActive ? 'bg-[color:var(--brand-600)] text-white' : 'bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-3)]'
                        }`}
                        onClick={() => handleMeasurementSelect(option.id)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                  <button
                    className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                      snapToAxis ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-[color:var(--surface-2)] text-muted hover:bg-[color:var(--surface-3)]'
                    }`}
                    onClick={() => setSnapToAxis((prev) => !prev)}
                  >
                    Snap: {snapToAxis ? 'On' : 'Off'}
                  </button>
                  <button
                    className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={undoMeasurementPoint}
                    disabled={!canUndoMeasurement}
                  >
                    Undo point
                  </button>
                  <button
                    className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={redoMeasurementPoint}
                    disabled={!canRedoMeasurement}
                  >
                    Redo
                  </button>
                  <button
                    className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={exportMeasurements}
                    disabled={measurementPoints.length === 0}
                  >
                    Export JSON
                  </button>
                  <button
                    className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)]"
                    onClick={clearMeasurement}
                  >
                    Clear
                  </button>
                </div>
                <p className="text-[11px] text-disabled">Points placed: {measurementPoints.length}</p>
                {measurementResult && (
                  <div className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-xs text-secondary">
                    <div className="font-semibold uppercase tracking-wide text-muted">{measurementResult.label}</div>
                    <div className="text-sm text-primary">{measurementResult.value}</div>
                    {measurementResult.secondary && (
                      <div className="text-[11px] text-disabled">{measurementResult.secondary}</div>
                    )}
                  </div>
                )}
                <p className="text-muted">{activeMeasurementDescription}</p>
                <p className="text-[11px] text-disabled">
                  Snapping keeps distance/clearance captures aligned to the dominant axis. Area points flatten to the ground plane and respect the snap grid.
                </p>
              </div>
            </DetailsPanel>

              <DetailsPanel title="AI enhancement" defaultOpen>
                <div className="space-y-3 text-xs text-muted">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-wide text-muted">AI enhancement</div>
                      <p className="text-[11px] text-disabled">Run AI enrichment to auto-apply suggested materials across this unit.</p>
                    </div>
                    <button
                      className={`rounded px-3 py-1 text-[11px] uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        aiEnhancementState.status === 'processing'
                          ? 'bg-[color:var(--brand-600)] text-white'
                          : aiEnhancementState.enabled
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                      onClick={handleAiEnhancementToggle}
                      disabled={aiEnhancementState.status === 'processing'}
                    >
                      {aiEnhancementState.status === 'processing' ? 'Running…' : aiEnhancementState.enabled ? 'Disable' : 'Run AI'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-disabled">
                    <span>Status</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        aiEnhancementState.status === 'complete'
                          ? 'bg-emerald-100 text-emerald-700'
                          : aiEnhancementState.status === 'processing'
                          ? 'bg-brand-soft text-brand-strong'
                          : aiEnhancementState.status === 'error'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-[color:var(--surface-2)] text-muted'
                      }`}
                    >
                      {aiEnhancementState.status}
                    </span>
                    {aiEnhancementLastRun && <span className="text-disabled normal-case">Last run {aiEnhancementLastRun}</span>}
                  </div>
                  {aiEnhancementState.message && <p className="text-muted">{aiEnhancementState.message}</p>}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-disabled">Room defaults</div>
                    {aiRooms.length === 0 ? (
                      <p className="text-muted">Run the pipeline with AI enrichment enabled to populate suggested materials.</p>
                    ) : (
                      aiRooms.map((room) => (
                        <div key={room.id || room.type} className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] p-3">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="font-semibold text-secondary">{room.type || room.id || 'Room'}</span>
                            <button
                              className="rounded bg-[color:var(--brand-600)] px-2 py-1 text-[10px] uppercase tracking-wide text-white transition hover:bg-[color:var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => applyAiDefaults(room)}
                              disabled={aiEnhancementState.status === 'processing'}
                            >
                              Apply defaults
                            </button>
                          </div>
                          {room.notes && <p className="mb-2 text-muted">{room.notes}</p>}
                          <div className="space-y-1 text-xs text-muted">
                            {Object.entries(room.default_materials || {}).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-2">
                                <span className="uppercase tracking-wide text-disabled">{key}</span>
                                <span className="truncate text-secondary">{formatDefaultValue(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DetailsPanel>

            <DetailsPanel title="Guided views" defaultOpen>
              <div className="space-y-2 text-xs text-muted">
                <p>Save easy camera angles that buyers can load with one click.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded bg-[color:var(--brand-600)] px-3 py-1 text-[11px] uppercase tracking-wide text-white transition hover:bg-[color:var(--brand-500)]"
                    onClick={handleAddGuidedView}
                  >
                    Save current view
                  </button>
                  <button
                    className="rounded bg-[color:var(--surface-2)] px-3 py-1 text-[11px] uppercase tracking-wide text-secondary transition hover:bg-[color:var(--surface-3)]"
                    onClick={resetView}
                  >
                    Reset camera
                  </button>
                </div>
                {guidedViews.length === 0 ? (
                  <p className="rounded border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-muted">No guided views yet. Move the camera to a helpful angle and press “Save current view”.</p>
                ) : (
                  <ul className="space-y-2">
                    {guidedViews.map((view) => (
                      <li key={view.id} className="space-y-1 rounded bg-[color:var(--surface-1)] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-primary font-medium">{view.name}</div>
                          <div className="flex gap-1">
                            <button
                              className="rounded bg-[color:var(--brand-600)] px-2 py-1 text-[10px] uppercase tracking-wide text-white transition hover:bg-[color:var(--brand-500)]"
                              onClick={() => handleApplyGuidedView(view)}
                            >
                              Show
                            </button>
                            <button
                              className="rounded bg-[color:var(--surface-2)] px-2 py-1 text-[10px] uppercase tracking-wide text-secondary transition hover:bg-[color:var(--surface-3)]"
                              onClick={() => handleRenameGuidedView(view.id)}
                            >
                              Rename
                            </button>
                            <button
                              className="rounded bg-red-500/80 px-2 py-1 text-[10px] uppercase tracking-wide text-primary transition hover:bg-red-500"
                              onClick={() => handleDeleteGuidedView(view.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] text-disabled">Position: {view.position.map((n) => n.toFixed(2)).join(', ')}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DetailsPanel>

            {aiCameras.length > 0 && (
              <DetailsPanel title="AI camera viewpoints">
                <div className="text-sm font-semibold uppercase tracking-wide text-muted">AI camera viewpoints</div>
                <ul className="space-y-1">
                  {aiCameras.slice(0, 6).map((cam, idx) => (
                    <li key={cam.name || idx} className="space-y-1 rounded bg-[color:var(--surface-1)] px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-secondary">{cam.name || `Camera ${idx + 1}`}</div>
                        <div className="flex gap-1">
                          <button
                            className="rounded bg-[color:var(--brand-600)] px-2 py-1 text-[10px] uppercase tracking-wide text-white transition hover:bg-[color:var(--brand-500)]"
                            onClick={() => applyCameraView(cam)}
                          >
                            Jump
                          </button>
                          <button
                            className="rounded bg-emerald-600 px-2 py-1 text-[10px] uppercase tracking-wide text-white transition hover:bg-emerald-500"
                            onClick={() => {
                              applyCameraView(cam)
                              void persistAiCameraState(cam)
                            }}
                          >
                            Jump + Save
                          </button>
                        </div>
                      </div>
                      <div>Pos: {JSON.stringify(cam.position)}</div>
                      <div>Look: {JSON.stringify(cam.look_at || cam.lookAt)}</div>
                    </li>
                  ))}
                </ul>
                <button
                  className="w-full rounded bg-[color:var(--surface-2)] px-3 py-2 text-center text-[11px] uppercase tracking-wide text-muted transition hover:bg-[color:var(--surface-3)]"
                  onClick={() => void persistAiCameraState()}
                >
                  Save all AI cameras
                </button>
              </DetailsPanel>
            )}

            <DetailsPanel title="IFC mesh map" defaultOpen={false}>
              {guidSummary.length === 0 ? (
                <p className="text-muted">No GUID annotations were found in this GLB.</p>
              ) : (
                <div className="space-y-2">
                  {guidSummary.slice(0, 12).map(({ guid, ifcType, category, catalogSlug }) => {
                    const material = guidMaterialsState[guid]
                    const colorArray = Array.isArray(material?.color) ? (material?.color as number[]) : null
                    return (
                      <div key={guid} className="space-y-1 rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] p-2">
                        <div className="font-medium text-secondary">{guid}</div>
                        <div className="flex items-center justify-between">
                          <span>{ifcType || 'IfcProduct'}</span>
                          <span className="uppercase tracking-wide text-disabled">{category}</span>
                        </div>
                        {(catalogSlug || material?.catalogSlug) && (
                          <div className="text-muted">Catalog: {catalogSlug || material?.catalogSlug}</div>
                        )}
                        {material?.texture && <div className="text-muted">Texture: {material.texture}</div>}
                        {colorArray && colorArray.length >= 3 && (
                          <div className="flex items-center gap-2">
                            <span>Color</span>
                            <span
                              className="h-4 w-4 rounded-sm border border-[color:var(--surface-border-strong)]"
                              style={{ backgroundColor: `rgba(${colorArray[0]}, ${colorArray[1]}, ${colorArray[2]}, ${(colorArray[3] ?? 255) / 255})` }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </DetailsPanel>

            {roomSummaries.length > 0 && (
              <DetailsPanel title="Rooms & adjacency" defaultOpen>
                <ul className="space-y-2">
                  {roomSummaries.slice(0, 8).map((room) => {
                    const areaLabel = typeof room.area === 'number'
                      ? `${room.area.toFixed(room.area >= 50 ? 0 : 1)} m²`
                      : room.areaRaw
                        ? `${Number(room.areaRaw).toLocaleString()} units²`
                        : '—'
                    return (
                      <li key={room.id} className="rounded-sm border border-[color:var(--surface-border)] bg-[color:var(--surface-0)] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-secondary">{room.name}</div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-sm bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">{areaLabel}</span>
                            {room.generated && (
                              <span className="rounded-sm bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">Generated</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-muted">
                          <span>Walls: {room.wallCount}</span>
                          <span>Adjacent rooms: {room.neighborCount}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </DetailsPanel>
            )}

            {allRoomsGenerated && (
              <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                <div className="text-sm font-semibold uppercase tracking-wide">Generated rooms only</div>
                <p>
                  All detected rooms were synthesized from wall geometry. Please review and confirm space names and
                  materials before publishing.
                </p>
              </div>
            )}

            {validationEntries.length > 0 && (
              <DetailsPanel title="Topology validations" defaultOpen>
                <ul className="space-y-1 text-xs text-muted">
                  {validationEntries.map(({ key, value }) => (
                    <li key={key} className="flex items-center justify-between gap-2">
                      <span className="uppercase tracking-wide text-disabled">{key}</span>
                      <span className="text-secondary">{String(value)}</span>
                    </li>
                  ))}
                </ul>
              </DetailsPanel>
            )}

              {countsSummary.length > 0 && (
                <DetailsPanel title="Topology counts" defaultOpen>
                  <ul className="space-y-1">
                    {countsSummary.map(({ key, value }) => (
                      <li key={key} className="flex justify-between text-xs text-muted">
                        <span className="uppercase tracking-wide text-disabled">{key}</span>
                        <span>{value}</span>
                      </li>
                    ))}
                  </ul>
                </DetailsPanel>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

useGLTF.preload('/placeholder.glb')

type DetailsPanelProps = {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  collapsible?: boolean
}

function DetailsPanel({ title, defaultOpen = false, collapsible = true, children }: DetailsPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = collapsible ? open : true
  const headerClasses =
    'flex w-full items-center justify-between border-b border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted'
  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft)]">
      {collapsible ? (
        <button
          type="button"
          className={`${headerClasses} transition hover:bg-[color:var(--surface-2)]`}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          <span>{title}</span>
          <span className="text-[10px] uppercase tracking-wide text-disabled">{isOpen ? 'Hide' : 'Show'}</span>
        </button>
      ) : (
        <div className={headerClasses}>
          <span>{title}</span>
          <span className="text-[10px] uppercase tracking-wide text-disabled">Pinned</span>
        </div>
      )}
      {isOpen && <div className="space-y-2 px-3 py-3 text-xs text-muted">{children}</div>}
    </div>
  )
}

type MeasurementOverlayProps = {
  tool: MeasurementTool
  points: Point3[]
  scale: number
}

function MeasurementOverlay({ tool, points, scale }: MeasurementOverlayProps) {
  if (!tool) return null
  const color = MEASUREMENT_COLORS[tool]

  if (tool === 'distance' || tool === 'clearance') {
    if (points.length < 2) return null
    const [start, end] = points.slice(-2)
    const startVec = new THREE.Vector3(...start)
    const endVec = new THREE.Vector3(...end)
    const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5)
    const lengthUnits = startVec.distanceTo(endVec)
    const lengthMeters = lengthUnits * scale
    const label = `${lengthMeters.toFixed(2)} m`
    return (
      <>
        <Line points={[startVec, endVec]} color={color} lineWidth={2} dashed dashSize={0.1} gapSize={0.1} />
        <mesh position={startVec}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
        </mesh>
        <mesh position={endVec}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
        </mesh>
        <Html position={midPoint} center className="rounded bg-[color:var(--overlay-900)] px-2 py-1 text-xs text-primary">
          {label}
        </Html>
      </>
    )
  }

  if (tool === 'area') {
    if (points.length < 3) return null
    const vectors = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    const closed = [...vectors, vectors[0]]
    const centroid = vectors.reduce((acc, vec) => acc.add(vec), new THREE.Vector3()).multiplyScalar(1 / vectors.length)
    const areaUnits = polygonArea2D(points)
    const areaMeters = areaUnits * scale * scale
    const label = `${areaMeters.toFixed(2)} m²`
    return (
      <>
        <Line points={closed} color={color} lineWidth={1.5} />
        {vectors.map((vec, idx) => (
          <mesh key={idx} position={vec}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
          </mesh>
        ))}
        <Html position={centroid} center className="rounded bg-[color:var(--overlay-900)] px-2 py-1 text-xs text-primary">
          {label}
        </Html>
      </>
    )
  }

  return null
}
