// @ts-nocheck

// 3D Reconstruction Engine - Converts 2D floor plan to 3D model
import { FloorPlanElement, RoomDefinition, AgentParameters } from './floorPlanAnalyzer'

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface MeshData {
  vertices: number[]
  faces: number[]
  normals: number[]
  uvs: number[]
  materialId: string
}

export interface Reconstructed3DModel {
  id: string
  name: string
  meshes: MeshData[]
  materials: MaterialDefinition[]
  boundingBox: {
    min: Vector3
    max: Vector3
  }
  rooms: Room3D[]
  metadata: {
    totalArea: number
    totalVolume: number
    elementCount: number
  }
}

export interface Room3D {
  id: string
  name: string
  type: string
  floor: MeshData
  walls: MeshData[]
  ceiling: MeshData
  elements: Element3D[]
}

export interface Element3D {
  id: string
  type: string
  mesh: MeshData
  position: Vector3
  rotation: Vector3
  scale: Vector3
  materialId: string
}

export interface MaterialDefinition {
  id: string
  name: string
  type: 'wall' | 'floor' | 'ceiling' | 'door' | 'window' | 'furniture'
  properties: {
    color: string
    roughness: number
    metallic: number
    normalMap?: string
    diffuseMap?: string
  }
}

export class ReconstructionEngine {
  private defaultMaterials: MaterialDefinition[] = [
    {
      id: 'wall_paint',
      name: 'Wall Paint',
      type: 'wall',
      properties: {
        color: '#F5F5F5',
        roughness: 0.8,
        metallic: 0.0
      }
    },
    {
      id: 'wood_floor',
      name: 'Wood Floor',
      type: 'floor',
      properties: {
        color: '#8B4513',
        roughness: 0.6,
        metallic: 0.0
      }
    },
    {
      id: 'ceiling_paint',
      name: 'Ceiling Paint',
      type: 'ceiling',
      properties: {
        color: '#FFFFFF',
        roughness: 0.9,
        metallic: 0.0
      }
    },
    {
      id: 'wood_door',
      name: 'Wood Door',
      type: 'door',
      properties: {
        color: '#8B4513',
        roughness: 0.4,
        metallic: 0.0
      }
    },
    {
      id: 'aluminum_window',
      name: 'Aluminum Window',
      type: 'window',
      properties: {
        color: '#C0C0C0',
        roughness: 0.2,
        metallic: 0.8
      }
    }
  ]

  async reconstruct3D(
    elements: FloorPlanElement[],
    rooms: RoomDefinition[],
    agentParams: AgentParameters
  ): Promise<Reconstructed3DModel> {
    const modelId = this.generateId()
    const meshes: MeshData[] = []
    const room3Ds: Room3D[] = []

    // Process each room
    for (const room of rooms) {
      const roomElements = elements.filter(e => room.elements.includes(e.id))
      const room3D = await this.reconstructRoom(room, roomElements, agentParams)
      room3Ds.push(room3D)
      
      // Add room meshes to main collection
      meshes.push(room3D.floor, room3D.ceiling, ...room3D.walls)
      room3D.elements.forEach(element => meshes.push(element.mesh))
    }

    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(meshes)
    
    // Generate metadata
    const metadata = this.generateMetadata(elements, rooms, meshes)

    return {
      id: modelId,
      name: 'Reconstructed 3D Model',
      meshes,
      materials: this.defaultMaterials,
      boundingBox,
      rooms: room3Ds,
      metadata
    }
  }

  private async reconstructRoom(
    room: RoomDefinition,
    elements: FloorPlanElement[],
    agentParams: AgentParameters
  ): Promise<Room3D> {
    // Create floor
    const floor = this.createFloor(room, agentParams)
    
    // Create walls
    const walls = this.createWalls(room, elements, agentParams)
    
    // Create ceiling
    const ceiling = this.createCeiling(room, agentParams)
    
    // Create 3D elements
    const element3Ds = this.createElements3D(elements, agentParams)

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      floor,
      walls,
      ceiling,
      elements: element3Ds
    }
  }

  private createFloor(room: RoomDefinition, agentParams: AgentParameters): MeshData {
    const { min, max } = room.bounds
    const width = max[0] - min[0]
    const depth = max[1] - min[1]
    
    // Create floor vertices (quad)
    const vertices = [
      min[0], 0, min[1],           // Bottom-left
      max[0], 0, min[1],           // Bottom-right
      max[0], 0, max[1],           // Top-right
      min[0], 0, max[1]            // Top-left
    ]
    
    // Create faces (two triangles)
    const faces = [
      0, 1, 2,  // First triangle
      0, 2, 3   // Second triangle
    ]
    
    // Create normals (pointing up)
    const normals = [
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0
    ]
    
    // Create UVs
    const uvs = [
      0, 0,  // Bottom-left
      1, 0,  // Bottom-right
      1, 1,  // Top-right
      0, 1   // Top-left
    ]

    return {
      vertices,
      faces,
      normals,
      uvs,
      materialId: 'wood_floor'
    }
  }

  private createWalls(room: RoomDefinition, elements: FloorPlanElement[], agentParams: AgentParameters): MeshData[] {
    const walls: MeshData[] = []
    const wallElements = elements.filter(e => e.type === 'wall')
    
    for (const wallElement of wallElements) {
      const wall = this.createWall(wallElement, agentParams)
      walls.push(wall)
    }
    
    return walls
  }

  private createWall(wallElement: FloorPlanElement, agentParams: AgentParameters): MeshData {
    const points = wallElement.geometry.points
    const height = agentParams.wallHeight
    const thickness = wallElement.properties.thickness || 0.2
    
    // Calculate wall direction and normal
    const direction = this.calculateDirection(points[0], points[1])
    const normal = this.calculateNormal(direction)
    
    // Create wall vertices (extruded rectangle)
    const vertices = this.extrudeWall(points, height, thickness, normal)
    const faces = this.createWallFaces()
    const normals = this.createWallNormals(normal)
    const uvs = this.createWallUVs(points, height)

    return {
      vertices,
      faces,
      normals,
      uvs,
      materialId: wallElement.properties.material || 'wall_paint'
    }
  }

  private createCeiling(room: RoomDefinition, agentParams: AgentParameters): MeshData {
    const { min, max } = room.bounds
    const height = agentParams.ceilingHeight
    
    // Create ceiling vertices (same as floor but elevated)
    const vertices = [
      min[0], height, min[1],      // Bottom-left
      max[0], height, min[1],      // Bottom-right
      max[0], height, max[1],      // Top-right
      min[0], height, max[1]       // Top-left
    ]
    
    // Create faces (two triangles, reversed order for correct normal)
    const faces = [
      0, 2, 1,  // First triangle
      0, 3, 2   // Second triangle
    ]
    
    // Create normals (pointing down)
    const normals = [
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0
    ]
    
    // Create UVs
    const uvs = [
      0, 0, 1, 0, 1, 1, 0, 1
    ]

    return {
      vertices,
      faces,
      normals,
      uvs,
      materialId: 'ceiling_paint'
    }
  }

  private createElements3D(elements: FloorPlanElement[], agentParams: AgentParameters): Element3D[] {
    const element3Ds: Element3D[] = []
    
    for (const element of elements) {
      if (element.type === 'door' || element.type === 'window') {
        const element3D = this.createDoorOrWindow(element, agentParams)
        element3Ds.push(element3D)
      } else if (element.type === 'kitchen' || element.type === 'sanitary') {
        const element3D = this.createFurnitureElement(element, agentParams)
        element3Ds.push(element3D)
      }
    }
    
    return element3Ds
  }

  private createDoorOrWindow(element: FloorPlanElement, agentParams: AgentParameters): Element3D {
    const points = element.geometry.points
    const width = element.dimensions.width || 0.8
    const height = element.dimensions.height || agentParams.doorHeight
    const thickness = 0.05
    
    // Create door/window frame
    const vertices = this.createDoorWindowVertices(points, width, height, thickness)
    const faces = this.createDoorWindowFaces()
    const normals = this.createDoorWindowNormals()
    const uvs = this.createDoorWindowUVs()

    return {
      id: element.id,
      type: element.type,
      mesh: {
        vertices,
        faces,
        normals,
        uvs,
        materialId: element.properties.material || (element.type === 'door' ? 'wood_door' : 'aluminum_window')
      },
      position: { x: element.geometry.center[0], y: 0, z: element.geometry.center[1] },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }

  private createFurnitureElement(element: FloorPlanElement, agentParams: AgentParameters): Element3D {
    // Create simple box geometry for furniture
    const bounds = element.geometry.bounds
    const width = bounds.max[0] - bounds.min[0]
    const depth = bounds.max[1] - bounds.min[1]
    const height = 0.8 // Standard furniture height
    
    const vertices = this.createBoxVertices(bounds.min, width, height, depth)
    const faces = this.createBoxFaces()
    const normals = this.createBoxNormals()
    const uvs = this.createBoxUVs()

    return {
      id: element.id,
      type: element.type,
      mesh: {
        vertices,
        faces,
        normals,
        uvs,
        materialId: element.properties.material || 'generic'
      },
      position: { x: element.geometry.center[0], y: 0, z: element.geometry.center[1] },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }

  // Helper methods for geometry creation
  private calculateDirection(p1: [number, number], p2: [number, number]): [number, number] {
    return [p2[0] - p1[0], p2[1] - p1[1]]
  }

  private calculateNormal(direction: [number, number]): [number, number] {
    const length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1])
    return [-direction[1] / length, direction[0] / length]
  }

  private extrudeWall(points: [number, number][], height: number, thickness: number, normal: [number, number]): number[] {
    // Simplified wall extrusion - creates a rectangular wall
    const p1 = points[0]
    const p2 = points[1]
    const halfThickness = thickness / 2
    
    return [
      // Bottom face
      p1[0] - normal[0] * halfThickness, 0, p1[1] - normal[1] * halfThickness,
      p2[0] - normal[0] * halfThickness, 0, p2[1] - normal[1] * halfThickness,
      p2[0] + normal[0] * halfThickness, 0, p2[1] + normal[1] * halfThickness,
      p1[0] + normal[0] * halfThickness, 0, p1[1] + normal[1] * halfThickness,
      
      // Top face
      p1[0] - normal[0] * halfThickness, height, p1[1] - normal[1] * halfThickness,
      p2[0] - normal[0] * halfThickness, height, p2[1] - normal[1] * halfThickness,
      p2[0] + normal[0] * halfThickness, height, p2[1] + normal[1] * halfThickness,
      p1[0] + normal[0] * halfThickness, height, p1[1] + normal[1] * halfThickness
    ]
  }

  private createWallFaces(): number[] {
    // Creates faces for a rectangular wall (8 vertices)
    return [
      // Bottom face
      0, 1, 2, 0, 2, 3,
      // Top face
      4, 6, 5, 4, 7, 6,
      // Side faces
      0, 4, 1, 1, 4, 5,
      1, 5, 2, 2, 5, 6,
      2, 6, 3, 3, 6, 7,
      3, 7, 0, 0, 7, 4
    ]
  }

  private createWallNormals(normal: [number, number]): number[] {
    // Creates normals for wall faces
    const normals = []
    for (let i = 0; i < 8; i++) {
      normals.push(normal[0], 0, normal[1])
    }
    return normals
  }

  private createWallUVs(points: [number, number][], height: number): number[] {
    const length = this.calculateDistance(points[0], points[1])
    return [
      0, 0, length, 0, length, 1, 0, 1,  // Bottom face
      0, 0, length, 0, length, 1, 0, 1   // Top face
    ]
  }

  private createDoorWindowVertices(points: [number, number][], width: number, height: number, thickness: number): number[] {
    // Simplified door/window geometry
    const center = this.calculateCenter(points)
    const halfWidth = width / 2
    
    return [
      // Frame vertices (simplified box)
      center[0] - halfWidth, 0, center[1] - thickness/2,
      center[0] + halfWidth, 0, center[1] - thickness/2,
      center[0] + halfWidth, 0, center[1] + thickness/2,
      center[0] - halfWidth, 0, center[1] + thickness/2,
      center[0] - halfWidth, height, center[1] - thickness/2,
      center[0] + halfWidth, height, center[1] - thickness/2,
      center[0] + halfWidth, height, center[1] + thickness/2,
      center[0] - halfWidth, height, center[1] + thickness/2
    ]
  }

  private createDoorWindowFaces(): number[] {
    return this.createBoxFaces()
  }

  private createDoorWindowNormals(): number[] {
    return this.createBoxNormals()
  }

  private createDoorWindowUVs(): number[] {
    return this.createBoxUVs()
  }

  private createBoxVertices(min: [number, number], width: number, height: number, depth: number): number[] {
    return [
      min[0], 0, min[1],
      min[0] + width, 0, min[1],
      min[0] + width, 0, min[1] + depth,
      min[0], 0, min[1] + depth,
      min[0], height, min[1],
      min[0] + width, height, min[1],
      min[0] + width, height, min[1] + depth,
      min[0], height, min[1] + depth
    ]
  }

  private createBoxFaces(): number[] {
    return [
      // Bottom face
      0, 1, 2, 0, 2, 3,
      // Top face
      4, 6, 5, 4, 7, 6,
      // Side faces
      0, 4, 1, 1, 4, 5,
      1, 5, 2, 2, 5, 6,
      2, 6, 3, 3, 6, 7,
      3, 7, 0, 0, 7, 4
    ]
  }

  private createBoxNormals(): number[] {
    return [
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,  // Bottom
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,      // Top
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,  // Front
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,      // Right
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,      // Back
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0   // Left
    ]
  }

  private createBoxUVs(): number[] {
    return [
      0, 0, 1, 0, 1, 1, 0, 1,  // Bottom
      0, 0, 1, 0, 1, 1, 0, 1,  // Top
      0, 0, 1, 0, 1, 1, 0, 1,  // Front
      0, 0, 1, 0, 1, 1, 0, 1,  // Right
      0, 0, 1, 0, 1, 1, 0, 1,  // Back
      0, 0, 1, 0, 1, 1, 0, 1   // Left
    ]
  }

  private calculateCenter(points: [number, number][]): [number, number] {
    const x = points.reduce((sum, p) => sum + p[0], 0) / points.length
    const y = points.reduce((sum, p) => sum + p[1], 0) / points.length
    return [x, y]
  }

  private calculateDistance(p1: [number, number], p2: [number, number]): number {
    return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
  }

  private calculateBoundingBox(meshes: MeshData[]): { min: Vector3, max: Vector3 } {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    meshes.forEach(mesh => {
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const x = mesh.vertices[i]
        const y = mesh.vertices[i + 1]
        const z = mesh.vertices[i + 2]
        
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        minZ = Math.min(minZ, z)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
        maxZ = Math.max(maxZ, z)
      }
    })

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    }
  }

  private generateMetadata(elements: FloorPlanElement[], rooms: RoomDefinition[], meshes: MeshData[]): any {
    const totalArea = rooms.reduce((sum, room) => {
      const bounds = room.bounds
      return sum + (bounds.max[0] - bounds.min[0]) * (bounds.max[1] - bounds.min[1])
    }, 0)

    const totalVolume = meshes.reduce((sum, mesh) => {
      // Simplified volume calculation
      return sum + mesh.vertices.length / 3 * 0.1
    }, 0)

    return {
      totalArea,
      totalVolume,
      elementCount: elements.length
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
}

// Export singleton instance
export const reconstructionEngine = new ReconstructionEngine()
