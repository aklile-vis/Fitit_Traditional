// @ts-nocheck

'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import clsx from 'clsx'
import {
  EyeIcon,
  CubeIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import * as THREE from 'three'

import { FloorPlanElement, RoomDefinition, AgentParameters } from '@/services/floorPlanAnalyzer'

interface DualViewSystemProps {
  elements: FloorPlanElement[]
  rooms: RoomDefinition[]
  agentParams: AgentParameters
  onElementSelect?: (element: FloorPlanElement) => void
  onMaterialChange?: (elementId: string, materialId: string) => void
  onParameterChange?: (params: Partial<AgentParameters>) => void
}

// 3D Scene Component
function Scene3D({ elements, rooms, agentParams, onElementSelect }: {
  elements: FloorPlanElement[]
  rooms: RoomDefinition[]
  agentParams: AgentParameters
  onElementSelect?: (element: FloorPlanElement) => void
}) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />
      
      {/* Environment */}
      <Environment preset="apartment" />
      
      {/* Grid */}
      <Grid 
        position={[0, 0, 0]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor="#6f6f6f" 
        sectionSize={10} 
        sectionThickness={1} 
        sectionColor="#9d4edd" 
        fadeDistance={30} 
        fadeStrength={1} 
        followCamera={false} 
        infiniteGrid={true} 
      />
      
      {/* Floor */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      
      {/* Render Elements */}
      {elements?.map((element, index) => (
        <Element3D 
          key={element.id || `element-${index}`}
          element={element} 
          agentParams={agentParams}
          onElementSelect={onElementSelect}
        />
      ))}
      
      {/* Render Rooms */}
      {rooms?.map((room, index) => (
        <Room3D 
          key={room.id || `room-${index}`}
          room={room} 
          agentParams={agentParams}
        />
      ))}
    </>
  )
}

// Individual 3D Element Component
function Element3D({ element, agentParams, onElementSelect }: {
  element: FloorPlanElement
  agentParams: AgentParameters
  onElementSelect?: (element: FloorPlanElement) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Get element color based on type
  const getElementColor = (type: string) => {
    // Material-aware color override
    const mat = (element as any).properties?.material as string | undefined
    const materialColors: Record<string, string> = {
      wall_paint: '#b0bec5',
      wood_door: '#8B4513',
      aluminum_window: '#90caf9',
      kitchen_cabinets: '#d7ccc8',
      bathroom_fixtures: '#e0e0e0',
      floor_concrete: '#9e9e9e',
      floor_tile: '#bdbdbd',
      ceiling_white: '#f5f5f5'
    }
    if (mat && materialColors[mat]) return materialColors[mat]
    const colors = {
      wall: '#495057',
      door: '#28a745',
      window: '#17a2b8',
      kitchen: '#fd7e14',
      sanitary: '#6f42c1',
      space: '#6c757d',
      unknown: '#6c757d'
    }
    return colors[type as keyof typeof colors] || colors.unknown
  }
  
  // Handle click
  const handleClick = (event: any) => {
    event.stopPropagation()
    onElementSelect?.(element)
  }
  
  // Get element geometry
  const getElementGeometry = () => {
    if (!element.geometry) return null
    
    if (element.type === 'wall' && element.geometry.points) {
      const points = element.geometry.points
      if (points.length >= 2) {
        const start = points[0]
        const end = points[1]
        const length = Math.sqrt(
          Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
        )
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0])
        const centerX = (start[0] + end[0]) / 2
        const centerY = (start[1] + end[1]) / 2
        
        return {
          type: 'box',
          args: [length, agentParams.wallHeight, 0.3], // Increased thickness
          position: [centerX, agentParams.wallHeight / 2, centerY],
          rotation: [0, angle, 0]
        }
      }
    }
    
    // Handle walls with length property
    const geometryMeta = element.geometry as {
      length?: number
      angle?: number
      center?: [number, number]
    }

    if (element.type === 'wall' && typeof geometryMeta.length === 'number') {
      const length = geometryMeta.length
      const centerX = geometryMeta.center?.[0] ?? 0
      const centerY = geometryMeta.center?.[1] ?? 0
      const angle = geometryMeta.angle ?? 0
      
      return {
        type: 'box',
        args: [length, agentParams.wallHeight, 0.3],
        position: [centerX, agentParams.wallHeight / 2, centerY],
        rotation: [0, angle, 0]
      }
    }
    
    if (element.type === 'door' && element.geometry.points) {
      const points = element.geometry.points
      if (points.length >= 2) {
        const start = points[0]
        const end = points[1]
        const length = Math.sqrt(
          Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
        )
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0])
        const centerX = (start[0] + end[0]) / 2
        const centerY = (start[1] + end[1]) / 2
        
        return {
          type: 'box',
          args: [length, agentParams.doorHeight, 0.1],
          position: [centerX, agentParams.doorHeight / 2, centerY],
          rotation: [0, angle, 0]
        }
      }
    }
    
    if (element.type === 'window' && element.geometry.points) {
      const points = element.geometry.points
      if (points.length >= 2) {
        const start = points[0]
        const end = points[1]
        const length = Math.sqrt(
          Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
        )
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0])
        const centerX = (start[0] + end[0]) / 2
        const centerY = (start[1] + end[1]) / 2
        
        return {
          type: 'box',
          args: [length, agentParams.windowHeight, 0.1],
          position: [centerX, agentParams.windowHeight / 2, centerY],
          rotation: [0, angle, 0]
        }
      }
    }
    
    if (element.type === 'floor' && element.geometry) {
      const b = element.geometry.bounds
      if (b && b.min && b.max) {
        const width = b.max[0] - b.min[0]
        const height = b.max[1] - b.min[1]
        const centerX = (b.min[0] + b.max[0]) / 2
        const centerY = (b.min[1] + b.max[1]) / 2
        return {
          type: 'box',
          args: [width, (agentParams.floorThickness || 0.15), height],
          position: [centerX, (agentParams.floorThickness || 0.15) / 2, centerY],
          rotation: [0, 0, 0]
        }
      }
    }

    if (element.type === 'ceiling' && element.geometry) {
      const b = element.geometry.bounds
      if (b && b.min && b.max) {
        const width = b.max[0] - b.min[0]
        const height = b.max[1] - b.min[1]
        const centerX = (b.min[0] + b.max[0]) / 2
        const centerY = (b.min[1] + b.max[1]) / 2
        const thickness = (agentParams.ceilingThickness || 0.1)
        const z = (agentParams.ceilingHeight || agentParams.wallHeight || 2.7) - thickness / 2
        return {
          type: 'box',
          args: [width, thickness, height],
          position: [centerX, z, centerY],
          rotation: [0, 0, 0]
        }
      }
    }

    if (element.type === 'kitchen' || element.type === 'sanitary') {
      if (element.geometry.bounds) {
        const bounds = element.geometry.bounds
        const width = bounds.max[0] - bounds.min[0]
        const height = bounds.max[1] - bounds.min[1]
        const centerX = (bounds.min[0] + bounds.max[0]) / 2
        const centerY = (bounds.min[1] + bounds.max[1]) / 2
        
        return {
          type: 'box',
          args: [width, 0.8, height],
          position: [centerX, 0.4, centerY],
          rotation: [0, 0, 0]
        }
      }
    }
    
    return null
  }
  
  const geometry = getElementGeometry()
  if (!geometry) return null
  
  return (
    <mesh
      ref={meshRef}
      position={geometry.position}
      rotation={geometry.rotation}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      {geometry.type === 'box' && (
        <boxGeometry args={geometry.args} />
      )}
      <meshStandardMaterial 
        color={getElementColor(element.type)}
        transparent={element.type === 'window'}
        opacity={element.type === 'window' ? 0.7 : 1}
      />
    </mesh>
  )
}

function CameraFocuser({ focusRoomId, rooms, agentParams, controlsRef }: { focusRoomId: string | null, rooms: RoomDefinition[], agentParams: AgentParameters, controlsRef: any }) {
  const { camera } = useThree()
  useEffect(() => {
    if (!focusRoomId) return
    const room = rooms.find(r => (r.id || r.name) === focusRoomId)
    if (!room) return
    let cx = 0, cy = 0
    if (room.bounds) {
      cx = (room.bounds.min[0] + room.bounds.max[0]) / 2
      cy = (room.bounds.min[1] + room.bounds.max[1]) / 2
    } else if (room.geometry?.vertices?.length) {
      const vs = room.geometry.vertices
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      vs.forEach((v: any) => { if (Array.isArray(v) && v.length >= 2) { minX = Math.min(minX, v[0]); minY = Math.min(minY, v[1]); maxX = Math.max(maxX, v[0]); maxY = Math.max(maxY, v[1]); } })
      cx = (minX + maxX) / 2; cy = (minY + maxY) / 2
    }
    const eye = Math.min(Math.max(agentParams.ceilingHeight || 2.7, 1.6), 3.0)
    camera.position.set(cx + 2, eye / 2, cy + 2)
    if (controlsRef.current?.target) {
      controlsRef.current.target.set(cx, eye / 2, cy)
      controlsRef.current.update()
    }
  }, [focusRoomId, rooms, agentParams, camera, controlsRef])
  return null
}

// Individual 3D Room Component
function Room3D({ room, agentParams }: {
  room: RoomDefinition
  agentParams: AgentParameters
}) {
  // Calculate room bounds
  let bounds = room.bounds
  if (!bounds && room.geometry && room.geometry.vertices) {
    const vertices = room.geometry.vertices
    if (vertices && vertices.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      vertices.forEach(vertex => {
        if (Array.isArray(vertex) && vertex.length >= 2) {
          minX = Math.min(minX, vertex[0])
          minY = Math.min(minY, vertex[1])
          maxX = Math.max(maxX, vertex[0])
          maxY = Math.max(maxY, vertex[1])
        }
      })
      bounds = {
        min: [minX, minY],
        max: [maxX, maxY]
      }
    }
  }
  
  // Fallback bounds if none calculated
  if (!bounds) {
    bounds = {
      min: [0, 0],
      max: [1000, 1000]
    }
  }
  
  const width = bounds.max[0] - bounds.min[0]
  const height = bounds.max[1] - bounds.min[1]
  const centerX = (bounds.min[0] + bounds.max[0]) / 2
  const centerY = (bounds.min[1] + bounds.max[1]) / 2
  
  // Only render if room has reasonable dimensions
  if (width < 100 || height < 100) return null
  
  return (
    <group>
      {/* Room floor */}
      <mesh position={[centerX, 0.01, centerY]} receiveShadow>
        <boxGeometry args={[width, 0.02, height]} />
        <meshStandardMaterial 
          color="#f8f9fa" 
          transparent 
          opacity={0.8}
        />
      </mesh>
      
      {/* Room ceiling */}
      <mesh position={[centerX, agentParams.wallHeight - 0.01, centerY]} receiveShadow>
        <boxGeometry args={[width, 0.02, height]} />
        <meshStandardMaterial 
          color="#e9ecef" 
          transparent 
          opacity={0.6}
        />
      </mesh>
      
      {/* Room walls (simplified) */}
      <mesh position={[centerX, agentParams.wallHeight / 2, bounds.min[1] - 0.15]} receiveShadow>
        <boxGeometry args={[width, agentParams.wallHeight, 0.3]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
      <mesh position={[centerX, agentParams.wallHeight / 2, bounds.max[1] + 0.15]} receiveShadow>
        <boxGeometry args={[width, agentParams.wallHeight, 0.3]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
      <mesh position={[bounds.min[0] - 0.15, agentParams.wallHeight / 2, centerY]} receiveShadow>
        <boxGeometry args={[0.3, agentParams.wallHeight, height]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
      <mesh position={[bounds.max[0] + 0.15, agentParams.wallHeight / 2, centerY]} receiveShadow>
        <boxGeometry args={[0.3, agentParams.wallHeight, height]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
    </group>
  )
}

// Floating Panel Component
function FloatingPanel({ 
  title, 
  children, 
  position, 
  isMinimized, 
  onToggleMinimize, 
  onClose 
}: {
  title: string
  children: React.ReactNode
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  isMinimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
}) {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed ${positionClasses[position]} z-40`}
    >
      <div className="surface-overlay shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between border-b border-overlay px-4 py-3 text-overlay">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleMinimize}
              className="rounded-full p-1 text-overlay-muted transition-colors hover:text-overlay"
            >
              {isMinimized ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-overlay-muted transition-colors hover:text-overlay"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="max-h-96 overflow-y-auto p-4 text-overlay-muted">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function DualViewSystem({
  elements = [],
  rooms = [],
  agentParams,
  onElementSelect,
  onMaterialChange,
  onParameterChange
}: DualViewSystemProps) {
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null)
  const controlsRef = useRef<any>(null)
  const [activeView, setActiveView] = useState<'2d' | '3d'>('3d')
  const [selectedElement, setSelectedElement] = useState<FloorPlanElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showParameters, setShowParameters] = useState(false)
  const [showElements, setShowElements] = useState(true)
  const [showStats, setShowStats] = useState(true)
  
  // Panel states
  const [parametersMinimized, setParametersMinimized] = useState(false)
  const [elementsMinimized, setElementsMinimized] = useState(false)
  const [statsMinimized, setStatsMinimized] = useState(false)
  
  const canvas2DRef = useRef<HTMLCanvasElement>(null)

  // Initialize 2D canvas
  useEffect(() => {
    if (canvas2DRef.current && activeView === '2d') {
      draw2DFloorPlan()
    }
  }, [elements, rooms, activeView])

  const draw2DFloorPlan = () => {
    const canvas = canvas2DRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // If no elements, draw a placeholder
    if (!elements || elements.length === 0) {
      drawPlaceholder(ctx, canvas.width, canvas.height)
      return
    }

    // Calculate bounds
    const bounds = calculateBounds(elements)
    const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height) * 0.8
    const offsetX = (canvas.width - bounds.width * scale) / 2
    const offsetY = (canvas.height - bounds.height * scale) / 2

    // Draw grid first
    drawGrid(ctx, canvas.width, canvas.height, scale, offsetX, offsetY)

    // Draw rooms
    if (rooms && Array.isArray(rooms)) {
      rooms.forEach(room => {
        drawRoom(ctx, room, scale, offsetX, offsetY)
      })
    }

    // Draw elements
    if (elements && Array.isArray(elements)) {
      elements.forEach(element => {
        drawElement(ctx, element, scale, offsetX, offsetY)
      })
    }

    // Draw legend
    drawLegend(ctx, canvas.width, canvas.height)
  }

  const drawRoom = (ctx: CanvasRenderingContext2D, room: RoomDefinition, scale: number, offsetX: number, offsetY: number) => {
    // Calculate bounds from room geometry if not available
    let bounds = room.bounds
    if (!bounds && room.geometry && room.geometry.vertices) {
      const vertices = room.geometry.vertices
      if (vertices && vertices.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        vertices.forEach(vertex => {
          if (Array.isArray(vertex) && vertex.length >= 2) {
            minX = Math.min(minX, vertex[0])
            minY = Math.min(minY, vertex[1])
            maxX = Math.max(maxX, vertex[0])
            maxY = Math.max(maxY, vertex[1])
          }
        })
        bounds = {
          min: [minX, minY],
          max: [maxX, maxY]
        }
      }
    }

    // Fallback bounds if still not available
    if (!bounds) {
      bounds = {
        min: [0, 0],
        max: [100, 100]
      }
    }

    const { min, max } = bounds
    const x = min[0] * scale + offsetX
    const y = min[1] * scale + offsetY
    const width = (max[0] - min[0]) * scale
    const height = (max[1] - min[1]) * scale

    // Room background
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(x, y, width, height)

    // Room border
    ctx.strokeStyle = '#dee2e6'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, width, height)

    // Room label
    ctx.fillStyle = '#6c757d'
    ctx.font = '12px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(room.name || room.type || 'Room', x + width / 2, y + height / 2)
  }

  const drawElement = (ctx: CanvasRenderingContext2D, element: FloorPlanElement, scale: number, offsetX: number, offsetY: number) => {
    // Safety check for geometry and points
    if (!element.geometry || !element.geometry.points || !Array.isArray(element.geometry.points)) {
      console.warn('Element missing geometry or points:', element)
      return
    }
    
    const points = element.geometry.points
    if (points.length < 2) return

    // Set style based on element type
    const colors = {
      wall: '#495057',
      door: '#28a745',
      window: '#17a2b8',
      kitchen: '#fd7e14',
      sanitary: '#6f42c1',
      room: '#6c757d',
      unknown: '#6c757d'
    }

    const color = colors[element.type] || colors.unknown
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = element.type === 'wall' ? 4 : 2

    // Draw different shapes based on element type
    if (element.type === 'wall') {
      drawWall(ctx, points, scale, offsetX, offsetY)
    } else if (element.type === 'door') {
      drawDoor(ctx, points, scale, offsetX, offsetY)
    } else if (element.type === 'window') {
      drawWindow(ctx, points, scale, offsetX, offsetY)
    } else if (element.type === 'kitchen' || element.type === 'sanitary') {
      drawFurniture(ctx, element, scale, offsetX, offsetY)
    } else {
      drawGenericElement(ctx, points, scale, offsetX, offsetY)
    }

    // Draw element label
    if (element.geometry && element.geometry.center && Array.isArray(element.geometry.center) && element.geometry.center.length >= 2) {
      const center = element.geometry.center
      ctx.fillStyle = color
      ctx.font = 'bold 10px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(element.type.toUpperCase(), center[0] * scale + offsetX, center[1] * scale + offsetY - 8)
    }
    
    // Draw confidence indicator
    if (element.geometry && element.geometry.center && Array.isArray(element.geometry.center) && element.geometry.center.length >= 2) {
      const center = element.geometry.center
      const confidence = element.properties?.confidence || 0.5
      ctx.fillStyle = confidence > 0.8 ? '#28a745' : confidence > 0.5 ? '#ffc107' : '#dc3545'
      ctx.fillRect(center[0] * scale + offsetX - 5, center[1] * scale + offsetY + 5, 10, 2)
    }
  }

  const drawWall = (ctx: CanvasRenderingContext2D, points: [number, number][], scale: number, offsetX: number, offsetY: number) => {
    ctx.beginPath()
    ctx.moveTo(points[0][0] * scale + offsetX, points[0][1] * scale + offsetY)
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0] * scale + offsetX, points[i][1] * scale + offsetY)
    }
    ctx.stroke()
  }

  const drawDoor = (ctx: CanvasRenderingContext2D, points: [number, number][], scale: number, offsetX: number, offsetY: number) => {
    const start = points[0]
    const end = points[1]
    const midX = (start[0] + end[0]) / 2 * scale + offsetX
    const midY = (start[1] + end[1]) / 2 * scale + offsetY
    
    // Draw door line
    ctx.beginPath()
    ctx.moveTo(start[0] * scale + offsetX, start[1] * scale + offsetY)
    ctx.lineTo(end[0] * scale + offsetX, end[1] * scale + offsetY)
    ctx.stroke()
    
    // Draw door arc
    ctx.beginPath()
    ctx.arc(midX, midY, 15, 0, Math.PI / 2)
    ctx.stroke()
  }

  const drawWindow = (ctx: CanvasRenderingContext2D, points: [number, number][], scale: number, offsetX: number, offsetY: number) => {
    const start = points[0]
    const end = points[1]
    
    // Draw window frame
    ctx.beginPath()
    ctx.moveTo(start[0] * scale + offsetX, start[1] * scale + offsetY)
    ctx.lineTo(end[0] * scale + offsetX, end[1] * scale + offsetY)
    ctx.stroke()
    
    // Draw window cross
    const midX = (start[0] + end[0]) / 2 * scale + offsetX
    const midY = (start[1] + end[1]) / 2 * scale + offsetY
    ctx.beginPath()
    ctx.moveTo(midX, start[1] * scale + offsetY)
    ctx.lineTo(midX, end[1] * scale + offsetY)
    ctx.stroke()
  }

  const drawFurniture = (ctx: CanvasRenderingContext2D, element: FloorPlanElement, scale: number, offsetX: number, offsetY: number) => {
    // Safety check for bounds
    if (!element.geometry || !element.geometry.bounds) {
      console.warn('Element missing bounds for furniture drawing:', element)
      return
    }
    
    const bounds = element.geometry.bounds
    const x = bounds.min[0] * scale + offsetX
    const y = bounds.min[1] * scale + offsetY
    const width = (bounds.max[0] - bounds.min[0]) * scale
    const height = (bounds.max[1] - bounds.min[1]) * scale
    
    // Draw furniture rectangle
    ctx.fillRect(x, y, width, height)
    ctx.strokeRect(x, y, width, height)
  }

  const drawGenericElement = (ctx: CanvasRenderingContext2D, points: [number, number][], scale: number, offsetX: number, offsetY: number) => {
    ctx.beginPath()
    ctx.moveTo(points[0][0] * scale + offsetX, points[0][1] * scale + offsetY)
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0] * scale + offsetX, points[i][1] * scale + offsetY)
    }
    ctx.stroke()
  }

  const drawPlaceholder = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw placeholder when no elements
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#6c757d'
    ctx.font = 'bold 16px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No CAD Data Available', width / 4, height / 4)
    
    ctx.font = '14px Inter, sans-serif'
    ctx.fillText('Upload a CAD file to see the floor plan', width / 4, height / 4 + 25)
  }

  const drawLegend = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const legendItems = [
      { type: 'wall', color: '#495057', label: 'Walls' },
      { type: 'door', color: '#28a745', label: 'Doors' },
      { type: 'window', color: '#17a2b8', label: 'Windows' },
      { type: 'kitchen', color: '#fd7e14', label: 'Kitchen' },
      { type: 'sanitary', color: '#6f42c1', label: 'Sanitary' }
    ]
    
    const legendX = 20
    const legendY = 20
    const itemHeight = 20
    
    // Draw legend background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(legendX - 10, legendY - 10, 150, legendItems.length * itemHeight + 20)
    
    legendItems.forEach((item, index) => {
      const y = legendY + index * itemHeight
      
      // Draw color indicator
      ctx.fillStyle = item.color
      ctx.fillRect(legendX, y - 5, 15, 10)
      
      // Draw label
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(item.label, legendX + 20, y + 3)
    })
  }

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, scale: number, offsetX: number, offsetY: number) => {
    ctx.strokeStyle = '#e9ecef'
    ctx.lineWidth = 0.5

    // Vertical lines
    for (let x = offsetX; x < width; x += 50) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = offsetY; y < height; y += 50) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const calculateBounds = (elements: FloorPlanElement[]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    // Check if elements exists and is an array
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return {
        min: [0, 0],
        max: [100, 100],
        width: 100,
        height: 100
      }
    }

    elements.forEach(element => {
      if (element.geometry && element.geometry.points && Array.isArray(element.geometry.points)) {
        element.geometry.points.forEach(point => {
          if (Array.isArray(point) && point.length >= 2) {
            minX = Math.min(minX, point[0])
            minY = Math.min(minY, point[1])
            maxX = Math.max(maxX, point[0])
            maxY = Math.max(maxY, point[1])
          }
        })
      }
    })

    return {
      min: [minX, minY],
      max: [maxX, maxY],
      width: maxX - minX,
      height: maxY - minY
    }
  }

  const handleElementClick = (element: FloorPlanElement) => {
    setSelectedElement(element)
    onElementSelect?.(element)
  }

  const handleMaterialChange = (materialId: string) => {
    if (selectedElement) {
      onMaterialChange?.(selectedElement.id, materialId)
    }
  }

  const handleParameterChange = (key: keyof AgentParameters, value: number) => {
    onParameterChange?.({ [key]: value })
  }

  // Calculate statistics
  const stats = {
    totalElements: elements?.length || 0,
    totalRooms: rooms?.length || 0,
    wallCount: elements?.filter(e => e.type === 'wall').length || 0,
    doorCount: elements?.filter(e => e.type === 'door').length || 0,
    windowCount: elements?.filter(e => e.type === 'window').length || 0,
    kitchenCount: elements?.filter(e => e.type === 'kitchen').length || 0,
    sanitaryCount: elements?.filter(e => e.type === 'sanitary').length || 0,
    spaceCount: elements?.filter(e => e.type === 'space').length || 0
  }

  const viewButtonClass = (view: '2d' | '3d') =>
    clsx(
      'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
      activeView === view
        ? 'border-[color:var(--sand-500)] bg-[color:var(--sand-500)] text-overlay shadow-[var(--shadow-soft)]'
        : 'border-surface bg-surface-1 text-secondary hover:border-surface-strong hover:bg-surface-hover hover:text-primary'
    )

  return (
    <div
      className={clsx(
        'relative bg-[color:var(--surface-0)] text-primary transition-colors duration-200',
        isFullscreen ? 'fixed inset-0 z-50' : 'h-full'
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface bg-surface-1 px-4 py-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-primary">Professional 3D Viewer</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveView('2d')} className={viewButtonClass('2d')}>
              <EyeIcon className="h-4 w-4" />
              <span>2D Floor Plan</span>
            </button>
            <button onClick={() => setActiveView('3d')} className={viewButtonClass('3d')}>
              <CubeIcon className="h-4 w-4" />
              <span>3D Model</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParameters(!showParameters)}
            className="rounded-full border border-surface bg-surface-1 p-2 text-secondary transition-colors hover:border-surface-strong hover:bg-surface-hover hover:text-primary"
            type="button"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-full border border-surface bg-surface-1 p-2 text-secondary transition-colors hover:border-surface-strong hover:bg-surface-hover hover:text-primary"
            type="button"
          >
            {isFullscreen ? <ArrowsPointingInIcon className="h-5 w-5" /> : <ArrowsPointingOutIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Main View */}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            {activeView === '2d' ? (
              <motion.div
                key="2d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <canvas
                  ref={canvas2DRef}
                  className="w-full h-full cursor-crosshair"
                  onClick={(e) => {
                    // Handle canvas click for element selection
                    const rect = canvas2DRef.current?.getBoundingClientRect()
                    if (rect) {
                      const x = e.clientX - rect.left
                      const y = e.clientY - rect.top
                      // Find clicked element (simplified)
                      const clickedElement = elements && Array.isArray(elements) ? elements.find(el => {
                        if (el.geometry && el.geometry.center && Array.isArray(el.geometry.center) && el.geometry.center.length >= 2) {
                          const center = el.geometry.center
                          const distance = Math.sqrt(
                            Math.pow(x - center[0], 2) + Math.pow(y - center[1], 2)
                          )
                          return distance < 20
                        }
                        return false
                      }) : null
                      if (clickedElement) {
                        handleElementClick(clickedElement)
                      }
                    }
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="3d"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Suspense fallback={
                  <div className="h-full flex items-center justify-center">
                    <div className="text-secondary text-lg">Loading 3D Scene...</div>
                  </div>
                }>
                  <Canvas
                    shadows
                    camera={{ position: [10, 10, 10], fov: 60 }}
                    className="w-full h-full"
                  >
                    <Scene3D 
                      elements={elements} 
                      rooms={rooms} 
                      agentParams={agentParams}
                      onElementSelect={handleElementClick}
                    />
                    <CameraFocuser focusRoomId={focusedRoomId} rooms={rooms} agentParams={agentParams} controlsRef={controlsRef} />
                    <OrbitControls 
                      ref={controlsRef}
                      enablePan={true}
                      enableZoom={true}
                      enableRotate={true}
                      minDistance={5}
                      maxDistance={100}
                    />
                  </Canvas>
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Panels */}
      {showParameters && (
        <FloatingPanel
          title="Agent Parameters"
          position="top-right"
          isMinimized={parametersMinimized}
          onToggleMinimize={() => setParametersMinimized(!parametersMinimized)}
          onClose={() => setShowParameters(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-overlay">Wall Height (m)</label>
              <input
                type="number"
                value={agentParams.wallHeight}
                onChange={(e) => handleParameterChange('wallHeight', parseFloat(e.target.value))}
                className="w-full rounded-xl border border-overlay bg-[color:var(--overlay-800)] px-3 py-2 text-sm text-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
                step="0.1"
                min="0.1"
                max="10"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-overlay">Door Height (m)</label>
              <input
                type="number"
                value={agentParams.doorHeight}
                onChange={(e) => handleParameterChange('doorHeight', parseFloat(e.target.value))}
                className="w-full rounded-xl border border-overlay bg-[color:var(--overlay-800)] px-3 py-2 text-sm text-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
                step="0.1"
                min="0.1"
                max="10"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-overlay">Window Height (m)</label>
              <input
                type="number"
                value={agentParams.windowHeight}
                onChange={(e) => handleParameterChange('windowHeight', parseFloat(e.target.value))}
                className="w-full rounded-xl border border-overlay bg-[color:var(--overlay-800)] px-3 py-2 text-sm text-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
                step="0.1"
                min="0.1"
                max="10"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-overlay">Ceiling Height (m)</label>
              <input
                type="number"
                value={agentParams.ceilingHeight}
                onChange={(e) => handleParameterChange('ceilingHeight', parseFloat(e.target.value))}
                className="w-full rounded-xl border border-overlay bg-[color:var(--overlay-800)] px-3 py-2 text-sm text-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
                step="0.1"
                min="0.1"
                max="10"
              />
            </div>
          </div>
        </FloatingPanel>
      )}

      {showElements && (
        <FloatingPanel
          title={`Elements (${stats.totalElements})`}
          position="bottom-left"
          isMinimized={elementsMinimized}
          onToggleMinimize={() => setElementsMinimized(!elementsMinimized)}
          onClose={() => setShowElements(false)}
        >
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {elements?.map((element, index) => (
              <button
                key={element.id || `element-${index}`}
                onClick={() => handleElementClick(element)}
                className={clsx(
                  'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                  selectedElement?.id === element.id
                    ? 'border-[color:var(--sand-500)] bg-[color:var(--sand-500)]/15 text-overlay'
                    : 'border-overlay bg-[color:var(--overlay-800)] text-overlay hover:border-[color:var(--sand-400)] hover:bg-[color:var(--overlay-900)]'
                )}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{element.type}</span>
                  <span className="text-sm text-overlay-muted">
                    {((element.properties?.confidence || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 text-sm text-overlay-muted">
                  {element.layer}
                </div>
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}

      {showStats && (
        <FloatingPanel
          title="Statistics"
          position="bottom-right"
          isMinimized={statsMinimized}
          onToggleMinimize={() => setStatsMinimized(!statsMinimized)}
          onClose={() => setShowStats(false)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-semibold text-[color:var(--accent-500)]">{stats.totalElements}</div>
                <div className="text-sm text-overlay-muted">Total Elements</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-[color:var(--success-500)]">{stats.totalRooms}</div>
                <div className="text-sm text-overlay-muted">Rooms</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-overlay-muted">Walls:</span>
                <span className="text-overlay">{stats.wallCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-overlay-muted">Doors:</span>
                <span className="text-overlay">{stats.doorCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-overlay-muted">Windows:</span>
                <span className="text-overlay">{stats.windowCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-overlay-muted">Kitchen:</span>
                <span className="text-overlay">{stats.kitchenCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-overlay-muted">Sanitary:</span>
                <span className="text-overlay">{stats.sanitaryCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-overlay-muted">Spaces:</span>
                <span className="text-overlay">{stats.spaceCount}</span>
              </div>
            </div>
          </div>
        </FloatingPanel>
      )}

      {/* Selected Element Panel */}
      {selectedElement && (
        <FloatingPanel
          title="Selected Element"
          position="top-left"
          isMinimized={false}
          onToggleMinimize={() => {}}
          onClose={() => setSelectedElement(null)}
        >
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-overlay">Type:</span>
              <span className="ml-2 inline-flex items-center rounded-full border border-[color:var(--sand-500)] bg-[color:var(--sand-500)]/20 px-2 py-1 text-sm text-overlay">
                {selectedElement.type}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-overlay">Layer:</span>
              <span className="ml-2 text-overlay-muted">{selectedElement.layer}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-overlay">Confidence:</span>
              <span className="ml-2 text-overlay-muted">
                {((selectedElement.properties?.confidence || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-overlay">Material:</span>
              <select
                value={selectedElement.properties?.material || ''}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className="ml-2 rounded-xl border border-overlay bg-[color:var(--overlay-800)] px-3 py-1 text-sm text-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
              >
                <option value="wall_paint">Wall Paint</option>
                <option value="wood_door">Wood Door</option>
                <option value="aluminum_window">Aluminum Window</option>
                <option value="kitchen_cabinets">Kitchen Cabinets</option>
                <option value="bathroom_fixtures">Bathroom Fixtures</option>
              </select>
            </div>
          </div>
        </FloatingPanel>
      )}

      {/* Room Views Panel */}
      <FloatingPanel
        title="Room Views"
        position="bottom-left"
        isMinimized={false}
        onToggleMinimize={() => {}}
        onClose={() => setFocusedRoomId(null)}
      >
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {rooms?.map((room, idx) => (
            <button
              key={room.id || `room-${idx}`}
              className={clsx(
                'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                focusedRoomId === (room.id || room.name)
                  ? 'border-[color:var(--sand-500)] bg-[color:var(--sand-500)]/15 text-overlay shadow-[var(--shadow-soft)]'
                  : 'border-overlay bg-[color:var(--overlay-800)] text-overlay hover:border-[color:var(--sand-400)] hover:bg-[color:var(--overlay-900)]'
              )}
              onClick={() => setFocusedRoomId(room.id || room.name || `room-${idx}`)}
              type="button"
            >
              {room.name || room.type || `Room ${idx + 1}`}
            </button>
          ))}
          {(!rooms || rooms.length === 0) && (
            <div className="text-overlay-muted">No rooms detected</div>
          )}
        </div>
      </FloatingPanel>
    </div>
  )
}
