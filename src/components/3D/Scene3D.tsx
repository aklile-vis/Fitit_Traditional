'use client'

import {
  OrbitControls,
  Environment,
  Box,
  Text,
  useGLTF,
  ContactShadows,
  Sky,
  Stars,
  useTexture,
} from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Vector3, MeshStandardMaterial, RepeatWrapping, Texture, type Mesh, type Object3D } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import LoadingSpinner from '@/components/LoadingSpinner'
import { config } from '@/config/app'
import { materialsDatabase, calculateMaterialCost } from '@/data/materialsDatabase'

import FloorPlan from './FloorPlan'


declare global {
  interface Window {
    teleportCamera?: (position: Vector3) => void
    jumpToCameraPreset?: (preset: { position?: number[] }) => void
  }
}

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true


interface Scene3DProps {
  selectedMaterials: Record<string, string>
  onMaterialChange: (optionId: string, materialId: string) => void
  onPriceUpdate: (totalPrice: number) => void
  glbUrl?: string
  aiDefaults?: {
    rooms?: Array<{ id?: string; type?: string; default_materials?: Record<string, string> }>
    cameras?: Array<{ name?: string; position?: number[]; look_at?: number[] }>
  }
}

// Enhanced 3D House Component with realistic materials and textures
interface HouseProps extends Scene3DProps {
  glbUrl?: string
}

function House3D({ selectedMaterials, onMaterialChange, onPriceUpdate, glbUrl }: HouseProps) {
  const { scene } = useGLTF(glbUrl || '/models/House.glb')
  const textures = useTexture({
    wood: '/textures/wood.jpg',
    brick: '/textures/brick.jpg',
    marble: '/textures/marble.jpg',
    fabric: '/textures/fabric.jpg',
  })

  useMemo(() => {
    Object.values(textures).forEach((tex) => {
      if (!tex) return
      tex.wrapS = tex.wrapT = RepeatWrapping
      tex.anisotropy = 8
    })
  }, [textures])
  
  // Calculate total price when materials change
  useEffect(() => {
    let total = 0
    Object.entries(selectedMaterials).forEach(([optionId, materialId]) => {
      const material = materialsDatabase.find(m => m.id === materialId)
      if (material) {
        const area = getAreaForOption(optionId)
        const quantity = getQuantityForOption(optionId)
        total += calculateMaterialCost(material, area, quantity)
      }
    })
    onPriceUpdate(total)
  }, [selectedMaterials, onPriceUpdate])

  const getAreaForOption = (optionId: string): number => {
    const areas: Record<string, number> = {
      'living_room_floor': 300,
      'living_room_walls': 400,
      'kitchen_countertops': 25,
      'curtains': 20
    }
    return areas[optionId] || 1
  }

  const getQuantityForOption = (optionId: string): number => {
    const quantities: Record<string, number> = {
      'kitchen_cabinets': 12,
      'bathroom_fixtures': 1,
      'lighting': 1,
      'furniture': 1,
      'curtains': 4
    }
    return quantities[optionId] || 1
  }

  // Apply realistic materials to the loaded model
  useEffect(() => {
    if (!scene) return
    scene.traverse((child: Object3D) => {
      if (!isMesh(child)) return
      child.userData = {
        onClick: () => {
          const name = child.name.toLowerCase()
          if (name.includes('floor') || name.includes('ground')) {
            onMaterialChange('living_room_floor', selectedMaterials.living_room_floor || '')
          } else if (name.includes('wall')) {
            onMaterialChange('living_room_walls', selectedMaterials.living_room_walls || '')
          } else if (name.includes('kitchen') || name.includes('cabinet')) {
            onMaterialChange('kitchen_cabinets', selectedMaterials.kitchen_cabinets || '')
          } else if (name.includes('counter') || name.includes('top')) {
            onMaterialChange('kitchen_countertops', selectedMaterials.kitchen_countertops || '')
          } else if (name.includes('sofa') || name.includes('chair') || name.includes('furniture')) {
            onMaterialChange('furniture', selectedMaterials.furniture || '')
          } else if (name.includes('light') || name.includes('lamp')) {
            onMaterialChange('lighting', selectedMaterials.lighting || '')
          } else if (name.includes('curtain') || name.includes('window')) {
            onMaterialChange('curtains', selectedMaterials.curtains || '')
          }
        },
      }

      const name = child.name.toLowerCase()
      const materialId = resolveMaterialForMesh(name, selectedMaterials)
      if (!materialId) return

      const definition = materialsDatabase.find((m) => m.id === materialId)
      const material = new MeshStandardMaterial({ color: getMaterialColor(materialId) || '#ffffff' })

      const texture = resolveTexture(definition?.category || '', name, textures)
      if (texture) {
        const cloned = texture.clone()
        const repeat = resolveTextureRepeat(definition?.category || '')
        cloned.repeat.set(repeat[0], repeat[1])
        material.map = cloned
        material.roughness = resolveRoughness(definition?.category || '')
        material.metalness = resolveMetalness(definition?.category || '')
      }

      child.material = material
      child.castShadow = true
      child.receiveShadow = true
    })
  }, [scene, selectedMaterials, onMaterialChange, textures])

  // Handle model loading errors
  if (!scene) {
    return (
      <group>
        <Box args={[10, 0.1, 10]} position={[0, 0, 0]}>
          <meshStandardMaterial color="#f0f0f0" />
        </Box>
        <Text
          position={[0, 2, 0]}
          fontSize={1}
          color="#666"
          anchorX="center"
          anchorY="middle"
        >
          Loading 3D Model...
        </Text>
      </group>
    )
  }

  return (
    <group>
      <primitive
        object={scene}
        scale={[1, 1, 1]}
        position={[0, 0, 0]}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          const onClick = event.object.userData?.onClick
          if (typeof onClick === 'function') {
            onClick()
          }
        }}
      />
    </group>
  )
}

function getMaterialColor(materialId: string): string | null {
  const material = materialsDatabase.find(m => m.id === materialId)
  if (!material) return null

  // Map material colors to 3D colors
  const colorMap: Record<string, string> = {
    'Classic Gray': '#808080',
    'Navy Blue': '#000080',
    'White': '#FFFFFF',
    'Charcoal Gray': '#36454F',
    'Natural Oak': '#D2B48C',
    'White with Gray Veins': '#F8F8F8',
    'Gray Oak': '#8B7355',
    'Natural Maple': '#DEB887',
    'Chrome': '#C0C0C0',
    'Brass': '#B87333',
    'Natural Linen': '#F5F5DC',
    'Gray': '#808080'
  }

  return colorMap[material.specifications.color || ''] || '#FFFFFF'
}

type TextureMap = {
  wood?: Texture
  brick?: Texture
  marble?: Texture
  fabric?: Texture
}

function resolveMaterialForMesh(name: string, selected: Record<string, string>): string | null {
  if (name.includes('floor') || name.includes('ground')) return selected.living_room_floor || null
  if (name.includes('wall')) return selected.living_room_walls || null
  if (name.includes('kitchen') || name.includes('cabinet')) return selected.kitchen_cabinets || null
  if (name.includes('counter') || name.includes('top')) return selected.kitchen_countertops || null
  if (name.includes('sofa') || name.includes('chair') || name.includes('furniture')) return selected.furniture || null
  if (name.includes('light') || name.includes('lamp')) return selected.lighting || null
  if (name.includes('curtain') || name.includes('window')) return selected.curtains || null
  return null
}

function resolveTexture(category: string, meshName: string, textures: TextureMap): Texture | undefined {
  if (meshName.includes('floor')) return textures.wood
  if (meshName.includes('wall')) return textures.brick
  if (meshName.includes('counter') || category === 'kitchen_countertops') return textures.marble
  if (meshName.includes('sofa') || meshName.includes('chair') || category === 'furniture') return textures.fabric
  if (category === 'flooring') return textures.wood
  if (category === 'wall_paint') return textures.brick
  return undefined
}

function resolveTextureRepeat(category: string): [number, number] {
  switch (category) {
    case 'flooring':
      return [3, 3]
    case 'wall_paint':
      return [2, 2]
    case 'kitchen_countertops':
      return [1.5, 1.5]
    case 'furniture':
      return [2, 2]
    default:
      return [1, 1]
  }
}

function resolveRoughness(category: string): number {
  switch (category) {
    case 'flooring':
      return 0.35
    case 'wall_paint':
      return 0.45
    case 'kitchen_countertops':
      return 0.2
    case 'furniture':
      return 0.65
    default:
      return 0.5
  }
}

function resolveMetalness(category: string): number {
  switch (category) {
    case 'kitchen_countertops':
      return 0.2
    case 'flooring':
      return 0.12
    case 'furniture':
      return 0.05
    default:
      return 0.08
  }
}

function InteriorCameraRig({ controlsRef }: { controlsRef: MutableRefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0.5, 1.6, 2.8)
    camera.lookAt(0, 1.5, 0)
    const controls = controlsRef.current
    if (controls) {
      controls.target.set(0, 1.4, 0)
      controls.update()
    }
  }, [camera, controlsRef])
  return null
}

// Enhanced First-Person Camera Controller
function CameraController({ onPositionChange }: { onPositionChange: (pos: Vector3) => void }) {
  const { camera } = useThree()
  const [position, setPosition] = useState(new Vector3(0, 1.6, 0))
  const [velocity, setVelocity] = useState(new Vector3(0, 0, 0))
  const moveSpeed = config.navigation.moveSpeed
  
  useEffect(() => {
    camera.position.copy(position)
    camera.lookAt(position.x, position.y, position.z - 1)
    onPositionChange(position)
  }, [camera, position, onPositionChange])

  // Teleport function
  const teleport = (newPosition: Vector3) => {
    setPosition(newPosition.clone())
  }

  // Expose teleport function
  useEffect(() => {
    window.teleportCamera = teleport
    return () => {
      delete window.teleportCamera
    }
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const newVelocity = velocity.clone()
      
      switch (event.code) {
        case 'KeyW':
          newVelocity.z -= moveSpeed
          break
        case 'KeyS':
          newVelocity.z += moveSpeed
          break
        case 'KeyA':
          newVelocity.x -= moveSpeed
          break
        case 'KeyD':
          newVelocity.x += moveSpeed
          break
        case 'Space':
          newVelocity.y += moveSpeed
          break
        case 'ShiftLeft':
          newVelocity.y -= moveSpeed
          break
      }
      
      setVelocity(newVelocity)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const newVelocity = velocity.clone()
      
      switch (event.code) {
        case 'KeyW':
        case 'KeyS':
          newVelocity.z = 0
          break
        case 'KeyA':
        case 'KeyD':
          newVelocity.x = 0
          break
        case 'Space':
        case 'ShiftLeft':
          newVelocity.y = 0
          break
      }
      
      setVelocity(newVelocity)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [velocity, moveSpeed])

  // Enhanced collision detection with house model
  const checkCollision = (newPosition: Vector3) => {
    // Define room boundaries within the house with buffer zones
    const roomBounds = Object.values(config.rooms).map(room => room.bounds)
    
    // Check if position is within any room with stricter boundaries
    return roomBounds.some(room => 
      newPosition.x > room.minX &&
      newPosition.x < room.maxX &&
      newPosition.y >= room.minY &&
      newPosition.y <= room.maxY &&
      newPosition.z > room.minZ &&
      newPosition.z < room.maxZ
    )
  }

  // Update position with collision detection
  useFrame(() => {
    if (velocity.length() > 0) {
      const newPosition = position.clone().add(velocity)
      
      if (checkCollision(newPosition)) {
        setPosition(newPosition)
      }
    }
  })

  return null
}

export default function Scene3D({ selectedMaterials, onMaterialChange, onPriceUpdate, glbUrl, aiDefaults }: Scene3DProps) {
  const [currentRoom, setCurrentRoom] = useState('living-room')
  const [isClient, setIsClient] = useState(false)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (aiDefaults?.cameras && aiDefaults.cameras.length) {
      const first = aiDefaults.cameras[0]
      const pos = first?.position
      if (Array.isArray(pos) && pos.length === 3 && window.teleportCamera) {
        window.teleportCamera(new Vector3(pos[0], pos[1], pos[2]))
      }
    }
    window.jumpToCameraPreset = (preset: { position?: number[] }) => {
      const p = preset?.position
      if (Array.isArray(p) && p.length === 3 && window.teleportCamera) {
        window.teleportCamera(new Vector3(p[0], p[1], p[2]))
      }
    }
    return () => {
      delete window.jumpToCameraPreset
    }
  }, [aiDefaults?.cameras])

  const handlePositionChange = (position: Vector3) => {
    // Determine current room based on position
    const { x, z } = position
    if (x >= -6 && x <= 6 && z >= -6 && z <= 2) {
      setCurrentRoom('living-room')
    } else if (x >= -6 && x <= 6 && z >= -8 && z <= -4) {
      setCurrentRoom('kitchen')
    } else if (x >= -8 && x <= -4 && z >= -2 && z <= 2) {
      setCurrentRoom('bedroom-1')
    } else if (x >= 4 && x <= 8 && z >= -2 && z <= 2) {
      setCurrentRoom('bedroom-2')
    } else if (x >= -2 && x <= 2 && z >= 2 && z <= 6) {
      setCurrentRoom('hallway')
    }
  }

  const handleTeleport = (_room: string, position: { x: number; y: number; z: number }) => {
    const newPosition = new Vector3(position.x, position.y, position.z)
    if (window.teleportCamera) {
      window.teleportCamera(newPosition)
    }
  }

  if (!isClient) {
    return <LoadingSpinner />
  }

  return (
    <div className="h-full w-full bg-[#f7f1e8]">
      <Canvas 
        shadows
        style={{ width: '100%', height: '100%' }}
        gl={{ 
          antialias: config.three.antialias,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: config.three.toneMapping,
          toneMappingExposure: config.three.toneMappingExposure
        }}
      >
        <CameraController onPositionChange={handlePositionChange} />
        
        {/* Enhanced Realistic Lighting */}
        <ambientLight intensity={0.4} color="#f0f0f0" />
        
        {/* Main directional light (sun) */}
        <directionalLight
          position={[10, 15, 5]}
          intensity={2.0}
          castShadow
          shadow-mapSize-width={8192}
          shadow-mapSize-height={8192}
          shadow-camera-far={50}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-bias={-0.0001}
          color="#fff8dc"
        />
        
        {/* Warm interior lighting */}
        <pointLight position={[0, 8, 0]} intensity={1.2} color="#fff8dc" />
        <pointLight position={[-5, 6, -5]} intensity={0.8} color="#f0f8ff" />
        <pointLight position={[5, 6, 5]} intensity={0.8} color="#f0f8ff" />
        <pointLight position={[0, 6, -6]} intensity={0.6} color="#fff8dc" />
        
        {/* Accent lighting for cozy atmosphere */}
        <pointLight position={[-3, 4, 0]} intensity={0.4} color="#ffd700" />
        <pointLight position={[3, 4, 0]} intensity={0.4} color="#ffd700" />
        
        {/* Hemisphere light for natural sky lighting */}
        <hemisphereLight
          args={["#87CEEB", "#8B4513", 0.6]}
        />

        {/* 3D Scene */}
        <House3D 
          selectedMaterials={selectedMaterials}
          onMaterialChange={onMaterialChange}
          onPriceUpdate={onPriceUpdate}
          glbUrl={glbUrl}
        />

        {/* Contact shadows for realism */}
        <ContactShadows
          position={[0, -0.1, 0]}
          opacity={0.4}
          scale={20}
          blur={2}
          far={4.5}
          resolution={256}
          color="#000000"
        />

        {/* Enhanced First-Person Controls */}
        <InteriorCameraRig controlsRef={controlsRef} />

        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={12}
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.9}
          enableDamping={true}
          dampingFactor={config.navigation.dampingFactor}
          rotateSpeed={config.navigation.rotateSpeed}
          zoomSpeed={config.navigation.zoomSpeed}
          panSpeed={config.navigation.panSpeed}
          target={[0, 0, 0]}
        />

        {/* Realistic Environment */}
        <Environment preset="apartment" />
        
        {/* Sky for outdoor realism */}
        <Sky
          distance={450000}
          sunPosition={[0, 1, 0]}
          inclination={0.49}
          azimuth={0.25}
        />
        
        {/* Atmospheric particles for cozy feel */}
        <Stars 
          radius={100} 
          depth={50} 
          count={1000} 
          factor={4} 
          saturation={0} 
          fade 
        />

        {/* Enhanced Post-processing Effects */}
        <EffectComposer>
          <Bloom 
            intensity={0.4} 
            luminanceThreshold={0.9} 
            luminanceSmoothing={0.025}
            mipmapBlur={true}
          />
          <DepthOfField 
            focusDistance={0.1} 
            focalLength={0.05} 
            bokehScale={2.0}
            height={480}
          />
          <ChromaticAberration
            offset={[0.001, 0.001]}
          />
        </EffectComposer>
      </Canvas>
      
      {/* Floor Plan Teleportation */}
      <FloorPlan 
        onTeleport={handleTeleport} 
        currentRoom={currentRoom}
      />

      {/* Enhanced Controls Overlay */}
      <div className="absolute bottom-6 left-6 space-y-3 text-[#2f2013]">
        <div className="rounded-2xl border border-[#d9c6b5] bg-[#fefbf7] p-4 text-sm shadow-[0_18px_40px_rgba(59,42,28,0.12)]">
          <div className="mb-3 text-lg font-semibold">Move around</div>
          <div className="space-y-2 text-sm text-[#7b6652]">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-[#c68a3f]"></div>
              <span>Click and drag to look around</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-[#c68a3f]"></div>
              <span>Right-click and drag to slide sideways</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-[#c68a3f]"></div>
              <span>Scroll to zoom in or out</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-[#c68a3f]"></div>
              <span>W / A / S / D keys: Walk through the room</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-[#c68a3f]"></div>
              <span>Space / Shift: Move up or down</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-[#c68a3f]"></div>
              <span>Click furniture or finishes to change them</span>
            </div>
          </div>
          <div className="mt-4 border-t border-[#e9d9c8] pt-3 text-sm">
            You are in: <span className="capitalize text-[#8a5a32]">{currentRoom.replace('-', ' ')}</span>
          </div>
        </div>

        {/* Quick Teleport Buttons */}
        <div className="rounded-2xl border border-[#d9c6b5] bg-[#fefbf7] p-4 text-sm shadow-[0_18px_40px_rgba(59,42,28,0.12)]">
          <div className="mb-3 text-lg font-semibold">Quick Teleport</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[#2f2013]">
            <button 
              onClick={() => handleTeleport('living-room', { x: 0, y: 1.6, z: -2 })}
              className="rounded-xl border border-[#c68a3f]/40 bg-[#c68a3f]/90 px-3 py-2 font-medium text-white transition-all hover:bg-[#b6762b]"
            >
              Living Room
            </button>
            <button 
              onClick={() => handleTeleport('kitchen', { x: 0, y: 1.6, z: -6 })}
              className="rounded-xl border border-[#d9c6b5] bg-white px-3 py-2 font-medium transition-all hover:bg-[#f2e1cf]"
            >
              Kitchen
            </button>
            <button 
              onClick={() => handleTeleport('bedroom-1', { x: -6, y: 1.6, z: 0 })}
              className="rounded-xl border border-[#d9c6b5] bg-white px-3 py-2 font-medium transition-all hover:bg-[#f2e1cf]"
            >
              Bedroom 1
            </button>
            <button 
              onClick={() => handleTeleport('bedroom-2', { x: 6, y: 1.6, z: 0 })}
              className="rounded-xl border border-[#d9c6b5] bg-white px-3 py-2 font-medium transition-all hover:bg-[#f2e1cf]"
            >
              Bedroom 2
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
