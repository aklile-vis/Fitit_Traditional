// Advanced 2D Floor Plan Analyzer with Rule-Based Processing
export interface FloorPlanElement {
  id: string
  type: 'wall' | 'door' | 'window' | 'kitchen' | 'sanitary' | 'room' | 'floor' | 'ceiling' | 'space' | 'column' | 'beam' | 'slab'
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  layer: string
  geometry: {
    points: [number, number][]
    bounds: {
      min: [number, number]
      max: [number, number]
    }
    center: [number, number]
  }
  dimensions: {
    width?: number
    height?: number
    length?: number
  }
  properties: {
    thickness?: number
    material?: string
    confidence: number
  }
  room?: string
}

export interface RoomDefinition {
  id: string
  name: string
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'hallway' | 'other'
  bounds: {
    min: [number, number]
    max: [number, number]
  }
  elements: string[] // Element IDs
}

export interface AgentParameters {
  wallHeight: number
  doorHeight: number
  windowHeight: number
  windowSillHeight: number
  ceilingHeight: number
  floorThickness: number
}

export class FloorPlanAnalyzer {
  private layerRules: Record<string, string> = {
    // Wall patterns
    'WALL': 'wall',
    'WALLS': 'wall',
    'A-WALL': 'wall',
    'WALL_': 'wall',
    
    // Door patterns
    'DOOR': 'door',
    'DOORS': 'door',
    'A-DOOR': 'door',
    'DOOR_': 'door',
    
    // Window patterns
    'WINDOW': 'window',
    'WINDOWS': 'window',
    'A-WINDOW': 'window',
    'WINDOW_': 'window',
    
    // Kitchen patterns
    'KITCHEN': 'kitchen',
    'KITCHEN_': 'kitchen',
    'CABINET': 'kitchen',
    'CABINETS': 'kitchen',
    
    // Sanitary patterns
    'SANITARY': 'sanitary',
    'BATHROOM': 'sanitary',
    'TOILET': 'sanitary',
    'SINK': 'sanitary',
    'SHOWER': 'sanitary',
    'BATHTUB': 'sanitary',
    
    // Room patterns
    'ROOM': 'room',
    'SPACE': 'room',
    'AREA': 'room'
  }

  private elementPatterns: Record<FloorPlanElement['type'], {
    minLength?: number
    maxThickness?: number
    minThickness?: number
    angleTolerance?: number
    minWidth?: number
    maxWidth?: number
    standardWidths?: number[]
    minArea?: number
    standardApplianceSizes?: Record<string, { width: number; depth: number }>
    standardFixtureSizes?: Record<string, { width: number; depth: number }>
  }> = {
    wall: {
      minLength: 0.5, // meters
      maxThickness: 0.5,
      minThickness: 0.1,
      angleTolerance: 5 // degrees
    },
    door: {
      minWidth: 0.6,
      maxWidth: 1.2,
      standardWidths: [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2]
    },
    window: {
      minWidth: 0.5,
      maxWidth: 3.0,
      standardWidths: [0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.4, 3.0]
    },
    kitchen: {
      minArea: 2.0, // square meters
      standardApplianceSizes: {
        sink: { width: 0.6, depth: 0.4 },
        stove: { width: 0.6, depth: 0.6 },
        refrigerator: { width: 0.6, depth: 0.6 },
        dishwasher: { width: 0.6, depth: 0.6 }
      }
    },
    sanitary: {
      minArea: 1.0,
      standardFixtureSizes: {
        toilet: { width: 0.4, depth: 0.6 },
        sink: { width: 0.5, depth: 0.3 },
        shower: { width: 0.9, depth: 0.9 },
        bathtub: { width: 1.7, depth: 0.7 }
      }
    },
    room: {},
    floor: {},
    ceiling: {},
    space: {},
    column: {},
    beam: {},
    slab: {}
  }

  async analyzeFloorPlan(cadData: any, agentParams: AgentParameters): Promise<{
    elements: FloorPlanElement[]
    rooms: RoomDefinition[]
    metadata: {
      scale: number
      units: string
      totalArea: number
      boundingBox: {
        min: [number, number]
        max: [number, number]
      }
    }
  }> {
    // Step 1: Extract geometry from CAD data
    const geometry = this.extractGeometry(cadData)
    
    // Step 2: Identify layers and classify elements
    const elements = this.classifyElements(geometry)
    
    // Step 3: Detect rooms and spaces
    const rooms = this.detectRooms(elements, geometry)
    
    // Step 4: Calculate dimensions and properties
    const processedElements = this.calculateDimensions(elements, agentParams)
    
    // Step 5: Generate metadata
    const metadata = this.generateMetadata(geometry, processedElements)
    
    return {
      elements: processedElements,
      rooms,
      metadata
    }
  }

  private extractGeometry(_cadData: any): any {
    // Mock geometry extraction - in real implementation, this would parse CAD files
    return {
      layers: [
        {
          name: 'A-WALL',
          entities: [
            { type: 'line', points: [[0, 0], [5, 0]] },
            { type: 'line', points: [[5, 0], [5, 3]] },
            { type: 'line', points: [[5, 3], [0, 3]] },
            { type: 'line', points: [[0, 3], [0, 0]] }
          ]
        },
        {
          name: 'A-DOOR',
          entities: [
            { type: 'line', points: [[2, 0], [2.8, 0]] }
          ]
        },
        {
          name: 'A-WINDOW',
          entities: [
            { type: 'line', points: [[1, 3], [1.5, 3]] }
          ]
        }
      ],
      scale: 1.0,
      units: 'meters'
    }
  }

  private classifyElements(geometry: any): FloorPlanElement[] {
    const elements: FloorPlanElement[] = []
    
    geometry.layers.forEach((layer: any) => {
      const elementType = this.layerRules[layer.name] || 'room'
      
      layer.entities.forEach((entity: any, index: number) => {
        if (entity.type === 'line') {
          const element = this.createElementFromLine(entity, layer.name, elementType, index)
          if (element) {
            elements.push(element)
          }
        }
      })
    })
    
    return elements
  }

  private createElementFromLine(entity: any, layerName: string, type: string, index: number): FloorPlanElement | null {
    const points = entity.points as [number, number][]
    const length = this.calculateDistance(points[0], points[1])
    
    // Apply type-specific validation
    if (!this.validateElement(type, length, points)) {
      return null
    }
    
    const bounds = this.calculateBounds(points)
    const center = this.calculateCenter(points)
    
    return {
      id: `${layerName}_${index}`,
      type: type as any,
      layer: layerName,
      geometry: {
        points,
        bounds,
        center
      },
      dimensions: {
        width: type === 'door' || type === 'window' ? length : undefined,
        length: type === 'wall' ? length : undefined
      },
      properties: {
        thickness: type === 'wall' ? 0.2 : undefined,
        material: this.getDefaultMaterial(type),
        confidence: this.calculateConfidence(type, length, layerName)
      }
    }
  }

  private validateElement(type: string, length: number, points: [number, number][]): boolean {
    const patterns = this.elementPatterns[type as keyof typeof this.elementPatterns]
    if (!patterns) return true
    
    switch (type) {
      case 'wall':
        return length >= (patterns.minLength ?? 0)
      case 'door':
        return length >= (patterns.minWidth ?? 0) && length <= (patterns.maxWidth ?? Number.POSITIVE_INFINITY)
      case 'window':
        return length >= (patterns.minWidth ?? 0) && length <= (patterns.maxWidth ?? Number.POSITIVE_INFINITY)
      case 'kitchen':
        return this.calculateArea(points) >= (patterns.minArea ?? 0)
      case 'sanitary':
        return this.calculateArea(points) >= (patterns.minArea ?? 0)
      default:
        return true
    }
  }

  private calculateConfidence(type: string, length: number, layerName: string): number {
    let confidence = 0.5 // Base confidence
    
    // Layer name match bonus
    if (this.layerRules[layerName] === type) {
      confidence += 0.3
    }
    
    // Dimension validation bonus
    const patterns = this.elementPatterns[type as keyof typeof this.elementPatterns]
    if (patterns) {
      if (type === 'door' || type === 'window') {
        if (patterns.standardWidths?.includes(Math.round(length * 10) / 10)) {
          confidence += 0.2
        }
      }
    }
    
    return Math.min(confidence, 1.0)
  }

  private detectRooms(elements: FloorPlanElement[], _geometry: any): RoomDefinition[] {
    // Simple room detection based on wall boundaries
    const rooms: RoomDefinition[] = []
    
    // Mock room detection - in real implementation, this would use polygon algorithms
    rooms.push({
      id: 'room_1',
      name: 'Living Room',
      type: 'living',
      bounds: {
        min: [0, 0],
        max: [5, 3]
      },
      elements: elements.filter(e => e.type !== 'wall').map(e => e.id)
    })
    
    return rooms
  }

  private calculateDimensions(elements: FloorPlanElement[], agentParams: AgentParameters): FloorPlanElement[] {
    return elements.map(element => {
      const updated = { ...element }
      
      // Add height based on agent parameters
      switch (element.type) {
        case 'wall':
          updated.dimensions.height = agentParams.wallHeight
          break
        case 'door':
          updated.dimensions.height = agentParams.doorHeight
          break
        case 'window':
          updated.dimensions.height = agentParams.windowHeight
          break
      }
      
      return updated
    })
  }

  private generateMetadata(geometry: any, elements: FloorPlanElement[]): any {
    const allPoints = elements.flatMap(e => e.geometry.points)
    const bounds = this.calculateBounds(allPoints)
    const area = (bounds.max[0] - bounds.min[0]) * (bounds.max[1] - bounds.min[1])
    
    return {
      scale: geometry.scale,
      units: geometry.units,
      totalArea: area,
      boundingBox: bounds
    }
  }

  private calculateDistance(p1: [number, number], p2: [number, number]): number {
    return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
  }

  private calculateBounds(points: [number, number][]): { min: [number, number], max: [number, number] } {
    const xCoords = points.map(p => p[0])
    const yCoords = points.map(p => p[1])
    
    return {
      min: [Math.min(...xCoords), Math.min(...yCoords)],
      max: [Math.max(...xCoords), Math.max(...yCoords)]
    }
  }

  private calculateCenter(points: [number, number][]): [number, number] {
    const x = points.reduce((sum, p) => sum + p[0], 0) / points.length
    const y = points.reduce((sum, p) => sum + p[1], 0) / points.length
    return [x, y]
  }

  private calculateArea(points: [number, number][]): number {
    // Simple area calculation for rectangular shapes
    const bounds = this.calculateBounds(points)
    return (bounds.max[0] - bounds.min[0]) * (bounds.max[1] - bounds.min[1])
  }

  private getDefaultMaterial(type: string): string {
    const materials: Record<string, string> = {
      wall: 'wall_paint',
      door: 'wood_door',
      window: 'aluminum_window',
      kitchen: 'kitchen_cabinets',
      sanitary: 'bathroom_fixtures',
      room: 'generic'
    }
    return materials[type] || 'generic'
  }
}

// Export singleton instance
export const floorPlanAnalyzer = new FloorPlanAnalyzer()
