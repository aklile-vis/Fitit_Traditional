// Real CAD Parser - Actually processes uploaded CAD files
import DxfParser from 'dxf-parser'
import { FloorPlanElement, RoomDefinition } from './floorPlanAnalyzer'
import { inferUnits, UnitInference } from './geometry/units'
import { stitchSegments, Seg } from './geometry/stitch'

export interface CADEntity {
  type: string
  layer: string
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  vertices?: Array<{ x: number; y: number }>
  center?: { x: number; y: number }
  radius?: number
  width?: number
  height?: number
  color?: number
  lineType?: string
}

export interface CADLayer {
  name: string
  color: number
  lineType: string
  entities: CADEntity[]
}

export interface ParsedCADData {
  layers: CADLayer[]
  entities: CADEntity[]
  bounds: {
    min: { x: number; y: number }
    max: { x: number; y: number }
  }
  units: string
  scale: number
  unitInference: UnitInference
  metadata?: {
    fileName: string
    fileSize: number
    fileType: string
    dwgVersion?: string
    requiresConversion?: boolean
  }
}

export class RealCADParser {
  private layerMapping: any = null
  private layerRules: Record<string, string> = {}
  private fallbackRules: Record<string, any> = {}
  private tolerances: Record<string, number> = {}

  constructor() {
    this.loadLayerMapping()
  }

  private async loadLayerMapping() {
    try {
      // Load layer mapping configuration
      const response = await fetch('/api/config/layer-mapping')
      if (response.ok) {
        this.layerMapping = await response.json()
        this.buildLayerRules()
        this.buildFallbackRules()
        this.buildTolerances()
        console.log('✅ Layer mapping loaded successfully')
      } else {
        console.warn('⚠️ Could not load layer mapping, using defaults')
        this.loadDefaultLayerMapping()
      }
    } catch (error) {
      console.warn('⚠️ Error loading layer mapping:', error)
      this.loadDefaultLayerMapping()
    }
  }

  private loadDefaultLayerMapping() {
    // Fallback to hardcoded rules if JSON loading fails
    this.layerRules = {
      'WALL': 'wall', 'WALLS': 'wall', 'A-WALL': 'wall',
      'DOOR': 'door', 'DOORS': 'door', 'A-DOOR': 'door',
      'WINDOW': 'window', 'WINDOWS': 'window', 'A-WINDOW': 'window',
      'KITCHEN': 'kitchen', 'CABINET': 'kitchen',
      'BATHROOM': 'sanitary', 'TOILET': 'sanitary',
      'ROOM': 'room', 'SPACE': 'room'
    }
    this.fallbackRules = {
      wall: { thickness_m: 0.2, height_m: 2.7 },
      door: { width_m: 0.9, height_m: 2.1 },
      window: { sill_m: 0.9, height_m: 1.2, width_m: 1.2 }
    }
    this.tolerances = {
      join_eps_m: 0.01,
      collinear_eps_deg: 2.0,
      min_wall_len_m: 0.1
    }
  }

  private buildLayerRules() {
    if (!this.layerMapping?.aliases) return
    
    this.layerRules = {}
    for (const [elementType, patterns] of Object.entries(this.layerMapping.aliases)) {
      for (const pattern of patterns as string[]) {
        this.layerRules[pattern] = elementType
      }
    }
  }

  private buildFallbackRules() {
    if (!this.layerMapping?.fallback) return
    
    this.fallbackRules = this.layerMapping.fallback
  }

  private buildTolerances() {
    if (!this.layerMapping?.tolerances) return
    
    this.tolerances = this.layerMapping.tolerances
  }

  // Public method to update layer mapping at runtime
  public updateLayerMapping(newMapping: any) {
    this.layerMapping = newMapping
    this.buildLayerRules()
    this.buildFallbackRules()
    this.buildTolerances()
    console.log('✅ Layer mapping updated successfully')
  }

  // Public method to get current layer mapping
  public getLayerMapping() {
    return {
      layerRules: this.layerRules,
      fallbackRules: this.fallbackRules,
      tolerances: this.tolerances
    }
  }

  // Generate assumptions sheet for human-in-the-loop validation
  public generateAssumptionsSheet(cadData: ParsedCADData): any {
    const assumptions = {
      timestamp: new Date().toISOString(),
      units: {
        detected: cadData.unitInference.units,
        confidence: cadData.unitInference.confidence,
        scaleFactor: cadData.unitInference.scaleToMeters,
        reasons: cadData.unitInference.reasons
      },
      geometry: {
        bounds: cadData.bounds,
        entityCount: cadData.entities.length,
        layerCount: cadData.layers.length
      },
      defaults: {
        wallThickness: this.fallbackRules.wall?.thickness_m || 0.2,
        wallHeight: this.fallbackRules.wall?.height_m || 2.7,
        doorWidth: this.fallbackRules.door?.width_m || 0.9,
        doorHeight: this.fallbackRules.door?.height_m || 2.1,
        windowSill: this.fallbackRules.window?.sill_m || 0.9,
        windowHeight: this.fallbackRules.window?.height_m || 1.2,
        windowWidth: this.fallbackRules.window?.width_m || 1.2
      },
      tolerances: {
        joinEpsilon: this.tolerances.join_eps_m || 0.01,
        collinearEpsilon: this.tolerances.collinear_eps_deg || 2.0,
        minWallLength: this.tolerances.min_wall_len_m || 0.1
      },
      issues: this.detectIssues(cadData),
      unmappedLayers: this.findUnmappedLayers(cadData)
    }

    return assumptions
  }

  private detectIssues(cadData: ParsedCADData): string[] {
    const issues: string[] = []
    
    // Check for very low confidence units
    if (cadData.unitInference.confidence < 0.5) {
      issues.push(`Low confidence in unit detection (${cadData.unitInference.confidence})`)
    }
    
    // Check for very small or very large bounds
    const width = cadData.bounds.max.x - cadData.bounds.min.x
    const height = cadData.bounds.max.y - cadData.bounds.min.y
    if (width < 1 || height < 1) {
      issues.push(`Very small drawing bounds (${width.toFixed(2)}m x ${height.toFixed(2)}m)`)
    }
    if (width > 1000 || height > 1000) {
      issues.push(`Very large drawing bounds (${width.toFixed(2)}m x ${height.toFixed(2)}m)`)
    }
    
    // Check for no entities
    if (cadData.entities.length === 0) {
      issues.push('No architectural entities found')
    }
    
    return issues
  }

  private findUnmappedLayers(cadData: ParsedCADData): string[] {
    const unmapped: string[] = []
    
    for (const layer of cadData.layers) {
      const layerName = layer.name.toUpperCase()
      let isMapped = false
      
      for (const pattern of Object.keys(this.layerRules)) {
        if (layerName.includes(pattern)) {
          isMapped = true
          break
        }
      }
      
      if (!isMapped && layer.entities.length > 0) {
        unmapped.push(layer.name)
      }
    }
    
    return unmapped
  }

  async parseCADFile(file: File, showAssumptions: boolean = true): Promise<ParsedCADData> {
    const fileExtension = this.getFileExtension(file.name).toLowerCase()
    
    // For very large files, use simplified processing
    if (file.size > 10 * 1024 * 1024) { // 10MB
      console.warn('Large file detected, using simplified processing')
      return this.createSimplifiedCADData(file)
    }
    
    let cadData: ParsedCADData
    
    switch (fileExtension) {
      case 'dxf':
        cadData = await this.parseDXFFile(file)
        break
      case 'dwg':
        cadData = await this.parseDWGFile(file)
        break
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`)
    }

    // Generate assumptions sheet if requested
    if (showAssumptions) {
      const assumptions = this.generateAssumptionsSheet(cadData)
      ;(cadData as any).assumptions = assumptions
    }

    return cadData
  }

  private createSimplifiedCADData(_file: File): ParsedCADData {
    // Create a simplified CAD data structure for large files
    const unitInference: UnitInference = {
      units: 'mm',
      scaleToMeters: 0.001,
      confidence: 0.5,
      reasons: ['Default assumption for large files']
    }

    return {
      layers: [
        {
          name: '0',
          color: 7,
          lineType: 'CONTINUOUS',
          entities: []
        }
      ],
      entities: [],
      bounds: {
        min: { x: 0, y: 0 },
        max: { x: 10, y: 10 }
      },
      units: unitInference.units,
      scale: unitInference.scaleToMeters,
      unitInference
    }
  }

  private async parseDXFFile(file: File): Promise<ParsedCADData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        reject(new Error('File parsing timeout - file may be too large or corrupted'))
      }, 15000) // 15 second timeout
      
      reader.onload = (e) => {
        try {
          clearTimeout(timeoutId)
          const content = e.target?.result as string
          const parser = new DxfParser()
          const dxf = parser.parseSync(content)
          
          const parsedData = this.processDXFData(dxf)
          resolve(parsedData)
        } catch (error) {
          clearTimeout(timeoutId)
          reject(new Error(`Failed to parse DXF file: ${error}`))
        }
      }
      
      reader.onerror = () => {
        clearTimeout(timeoutId)
        reject(new Error('Failed to read DXF file'))
      }
      
      reader.readAsText(file)
    })
  }

  private async parseDWGFile(_file: File): Promise<ParsedCADData> {
    // For DWG files, we need to convert them to DXF first
    // Since we can't parse DWG directly, we'll provide clear instructions
    throw new Error(
      'DWG files need to be converted to DXF format for processing.\n\n' +
      '**Quick Conversion Steps:**\n' +
      '1. Open your DWG file in AutoCAD\n' +
      '2. Go to File > Save As\n' +
      '3. Choose "DXF" format from the dropdown\n' +
      '4. Save the file\n' +
      '5. Upload the DXF file here\n\n' +
      '**Alternative Methods:**\n' +
      '• Online: cloudconvert.com or zamzar.com\n' +
      '• Free Software: LibreCAD, FreeCAD, DraftSight\n\n' +
      'DXF format preserves all your architectural data and allows full 3D reconstruction.'
    )
  }


  private processDXFData(dxf: any): ParsedCADData {
    const layers: CADLayer[] = []
    const entities: CADEntity[] = []
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    // STEP 1: Infer units and scale BEFORE processing entities
    const headerUnits = dxf.header?.$INSUNITS
    const bbox = this.calculateInitialBounds(dxf.entities || [])
    const unitInference = inferUnits({
      headerUnits,
      bbox: { width: bbox.width, height: bbox.height }
    })

    console.log('🔍 Unit Inference:', {
      units: unitInference.units,
      scaleToMeters: unitInference.scaleToMeters,
      confidence: unitInference.confidence,
      reasons: unitInference.reasons
    })

    // Process layers (focus on architectural layers)
    if (dxf.tables && dxf.tables.layer) {
      const layerTable = dxf.tables.layer
      for (const layerName in layerTable) {
        const layer = layerTable[layerName]
        const isArchitectural = this.isArchitecturalLayer(layerName)
        
        if (isArchitectural) {
          layers.push({
            name: layerName,
            color: layer.color || 7,
            lineType: layer.lineType || 'CONTINUOUS',
            entities: []
          })
        }
      }
    }

    // If no architectural layers found, include all layers
    if (layers.length === 0 && dxf.tables && dxf.tables.layer) {
      const layerTable = dxf.tables.layer
      for (const layerName in layerTable) {
        const layer = layerTable[layerName]
        layers.push({
          name: layerName,
          color: layer.color || 7,
          lineType: layer.lineType || 'CONTINUOUS',
          entities: []
        })
      }
    }

    // Process entities (focus on architectural elements) with scaling applied
    if (dxf.entities) {
      const maxEntities = Math.min(dxf.entities.length, 2000) // Increased limit
      for (let i = 0; i < maxEntities; i++) {
        const entity = dxf.entities[i]
        const processedEntity = this.processEntity(entity, unitInference.scaleToMeters)
        if (processedEntity && this.isArchitecturalEntity(processedEntity)) {
          entities.push(processedEntity)
          
          // Update bounds
          this.updateBounds(processedEntity, { minX, minY, maxX, maxY })
        }
      }
    }

    // Apply segment stitching for better geometry quality
    const stitchedEntities = this.applySegmentStitching(entities)
    entities.length = 0 // Clear original entities
    entities.push(...stitchedEntities) // Add stitched entities

    // Group entities by layer
    entities.forEach(entity => {
      const layer = layers.find(l => l.name === entity.layer)
      if (layer) {
        layer.entities.push(entity)
      } else {
        // Create new layer if it doesn't exist
        layers.push({
          name: entity.layer,
          color: entity.color || 7,
          lineType: entity.lineType || 'CONTINUOUS',
          entities: [entity]
        })
      }
    })

    return {
      layers,
      entities,
      bounds: {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY }
      },
      units: unitInference.units,
      scale: unitInference.scaleToMeters,
      unitInference
    }
  }

  private calculateInitialBounds(entities: any[]): { width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    // Quick pass to get rough bounds for unit inference
    for (const entity of entities.slice(0, 100)) { // Sample first 100 entities
      if (entity.vertices && entity.vertices.length > 0) {
        entity.vertices.forEach((v: any) => {
          minX = Math.min(minX, v.x)
          minY = Math.min(minY, v.y)
          maxX = Math.max(maxX, v.x)
          maxY = Math.max(maxY, v.y)
        })
      }
      if (entity.start && entity.end) {
        minX = Math.min(minX, entity.start.x, entity.end.x)
        minY = Math.min(minY, entity.start.y, entity.end.y)
        maxX = Math.max(maxX, entity.start.x, entity.end.x)
        maxY = Math.max(maxY, entity.start.y, entity.end.y)
      }
      if (entity.center && entity.radius) {
        const r = entity.radius
        minX = Math.min(minX, entity.center.x - r)
        minY = Math.min(minY, entity.center.y - r)
        maxX = Math.max(maxX, entity.center.x + r)
        maxY = Math.max(maxY, entity.center.y + r)
      }
    }

    return {
      width: maxX - minX,
      height: maxY - minY
    }
  }

  private applySegmentStitching(entities: CADEntity[]): CADEntity[] {
    // Convert entities to segments for stitching
    const segments: Seg[] = []
    
    entities.forEach(entity => {
      if (entity.type === 'LINE' && entity.start && entity.end) {
        segments.push({
          a: { x: entity.start.x, y: entity.start.y },
          b: { x: entity.end.x, y: entity.end.y },
          layer: entity.layer
        })
      } else if (entity.type === 'LWPOLYLINE' && entity.vertices) {
        // Convert polyline vertices to line segments
        for (let i = 0; i < entity.vertices.length - 1; i++) {
          const current = entity.vertices[i]
          const next = entity.vertices[i + 1]
          if (current && next) {
            segments.push({
              a: { x: current.x, y: current.y },
              b: { x: next.x, y: next.y },
              layer: entity.layer
            })
          }
        }
      }
    })
    
    // Apply stitching with configurable tolerance
    const joinEps = this.tolerances.join_eps_m || 0.01
    const stitchedSegments = stitchSegments(segments, joinEps)
    
    // Convert stitched segments back to entities
    const stitchedEntities: CADEntity[] = []
    stitchedSegments.forEach((segment) => {
      stitchedEntities.push({
        type: 'LINE',
        layer: segment.layer,
        start: { x: segment.a.x, y: segment.a.y },
        end: { x: segment.b.x, y: segment.b.y },
        color: 7,
        lineType: 'CONTINUOUS'
      })
    })
    
    return stitchedEntities
  }

  private arcToPolyline(center: { x: number; y: number }, radius: number, startAngle: number, endAngle: number, scaleToMeters: number): { x: number; y: number }[] {
    // Convert arc to polyline with adaptive resolution
    const scaledRadius = radius * scaleToMeters;
    const scaledCenter = { x: center.x * scaleToMeters, y: center.y * scaleToMeters };
    
    // Calculate number of segments based on arc length
    const arcLength = Math.abs(endAngle - startAngle) * scaledRadius;
    const minSegments = 4;
    const maxSegments = 32;
    const segments = Math.max(minSegments, Math.min(maxSegments, Math.ceil(arcLength / 0.1))); // 10cm segments
    
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + t * (endAngle - startAngle);
      points.push({
        x: scaledCenter.x + scaledRadius * Math.cos(angle),
        y: scaledCenter.y + scaledRadius * Math.sin(angle)
      });
    }
    
    return points;
  }

  private processEntity(entity: any, scaleToMeters: number = 1.0): CADEntity | null {
    const baseEntity = {
      type: entity.type,
      layer: entity.layer || '0',
      color: entity.color,
      lineType: entity.lineType
    }

    switch (entity.type) {
      case 'LINE':
        return {
          ...baseEntity,
          start: { x: entity.vertices[0].x * scaleToMeters, y: entity.vertices[0].y * scaleToMeters },
          end: { x: entity.vertices[1].x * scaleToMeters, y: entity.vertices[1].y * scaleToMeters }
        }

      case 'LWPOLYLINE':
      case 'POLYLINE':
        const vertices = entity.vertices.map((v: any) => ({ x: v.x * scaleToMeters, y: v.y * scaleToMeters }))
        const result: CADEntity = {
          ...baseEntity,
          vertices
        }
        
        if (vertices[0]) {
          result.start = { x: vertices[0].x, y: vertices[0].y }
        }
        
        if (vertices[vertices.length - 1]) {
          result.end = { x: vertices[vertices.length - 1].x, y: vertices[vertices.length - 1].y }
        }
        
        return result

      case 'CIRCLE':
        // Convert circle to polyline
        const circlePoints = this.arcToPolyline(
          entity.center, 
          entity.radius, 
          0, 
          2 * Math.PI, 
          scaleToMeters
        );
        const circleResult: CADEntity = {
          ...baseEntity,
          type: 'LWPOLYLINE', // Convert to polyline
          vertices: circlePoints
        }
        
        if (circlePoints[0]) {
          circleResult.start = circlePoints[0]
        }
        
        if (circlePoints[circlePoints.length - 1]) {
          circleResult.end = circlePoints[circlePoints.length - 1]!
        }
        
        return circleResult

      case 'ARC':
        // Convert arc to polyline
        const arcPoints = this.arcToPolyline(
          entity.center,
          entity.radius,
          entity.startAngle,
          entity.endAngle,
          scaleToMeters
        );
        const arcResult: CADEntity = {
          ...baseEntity,
          type: 'LWPOLYLINE', // Convert to polyline
          vertices: arcPoints
        }
        
        if (arcPoints[0]) {
          arcResult.start = arcPoints[0]
        }
        
        if (arcPoints[arcPoints.length - 1]) {
          arcResult.end = arcPoints[arcPoints.length - 1]!
        }
        
        return arcResult

      case 'INSERT':
        return {
          ...baseEntity,
          center: { x: entity.position.x * scaleToMeters, y: entity.position.y * scaleToMeters },
          width: (entity.scaleX || 1) * scaleToMeters,
          height: (entity.scaleY || 1) * scaleToMeters
        }

      default:
        return null
    }
  }

  private updateBounds(entity: CADEntity, bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
    if (entity.start) {
      bounds.minX = Math.min(bounds.minX, entity.start.x)
      bounds.minY = Math.min(bounds.minY, entity.start.y)
      bounds.maxX = Math.max(bounds.maxX, entity.start.x)
      bounds.maxY = Math.max(bounds.maxY, entity.start.y)
    }

    if (entity.end) {
      bounds.minX = Math.min(bounds.minX, entity.end.x)
      bounds.minY = Math.min(bounds.minY, entity.end.y)
      bounds.maxX = Math.max(bounds.maxX, entity.end.x)
      bounds.maxY = Math.max(bounds.maxY, entity.end.y)
    }

    if (entity.center) {
      bounds.minX = Math.min(bounds.minX, entity.center.x - (entity.radius || 0))
      bounds.minY = Math.min(bounds.minY, entity.center.y - (entity.radius || 0))
      bounds.maxX = Math.max(bounds.maxX, entity.center.x + (entity.radius || 0))
      bounds.maxY = Math.max(bounds.maxY, entity.center.y + (entity.radius || 0))
    }

    if (entity.vertices) {
      entity.vertices.forEach(vertex => {
        bounds.minX = Math.min(bounds.minX, vertex.x)
        bounds.minY = Math.min(bounds.minY, vertex.y)
        bounds.maxX = Math.max(bounds.maxX, vertex.x)
        bounds.maxY = Math.max(bounds.maxY, vertex.y)
      })
    }
  }

  convertToFloorPlanElements(cadData: ParsedCADData): FloorPlanElement[] {
    const elements: FloorPlanElement[] = []

    cadData.entities.forEach((entity, index) => {
      const elementType = this.classifyEntity(entity)
      if (!elementType) return

      const element = this.createFloorPlanElement(entity, elementType, index)
      if (element) {
        elements.push(element)
      }
    })

    return elements
  }

  private classifyEntity(entity: CADEntity): string | null {
    const layerName = entity.layer?.toUpperCase() || ''
    
    // Check layer name patterns from configuration
    for (const [pattern, type] of Object.entries(this.layerRules)) {
      if (layerName.includes(pattern)) {
        return type
      }
    }

    // Check entity type patterns with configurable tolerances
    if (entity.type === 'LINE' || entity.type === 'LWPOLYLINE') {
      const length = this.calculateLength(entity)
      const minWallLen = this.tolerances.min_wall_len_m || 0.1
      if (length > minWallLen && length < 20) { // Typical wall length
        return 'wall'
      }
    }

    if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
      if (entity.radius && entity.radius > 0.1 && entity.radius < 2) {
        return 'door' // Door arc
      }
    }

    return 'unknown'
  }

  private createFloorPlanElement(entity: CADEntity, type: string, index: number): FloorPlanElement | null {
    const points = this.extractPoints(entity)
    if (points.length < 2) return null

    const bounds = this.calculateBounds(points)
    const center = this.calculateCenter(points)

    return {
      id: `${entity.layer}_${index}`,
      type: type as any,
      layer: entity.layer,
      geometry: {
        points: points,
        bounds: bounds,
        center: center
      },
      dimensions: this.calculateDimensions(entity, type),
      properties: {
        material: this.getDefaultMaterial(type),
        confidence: this.calculateConfidence(entity, type),
        ...(this.calculateThickness(entity, type) !== undefined && { thickness: this.calculateThickness(entity, type)! })
      }
    }
  }

  private extractPoints(entity: CADEntity): [number, number][] {
    if (entity.vertices && entity.vertices.length > 0) {
      return entity.vertices.map(v => [v.x, v.y] as [number, number])
    }

    if (entity.start && entity.end) {
      return [entity.start, entity.end].map(p => [p.x, p.y] as [number, number])
    }

    if (entity.center && entity.radius) {
      // Convert circle to points
      const points: [number, number][] = []
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8
        points.push([
          entity.center!.x + entity.radius! * Math.cos(angle),
          entity.center!.y + entity.radius! * Math.sin(angle)
        ])
      }
      return points
    }

    return []
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

  private calculateLength(entity: CADEntity): number {
    if (entity.start && entity.end) {
      return Math.sqrt(
        Math.pow(entity.end.x - entity.start.x, 2) + 
        Math.pow(entity.end.y - entity.start.y, 2)
      )
    }
    return 0
  }

  private calculateDimensions(entity: CADEntity, type: string): any {
    const dimensions: any = {}

    if (type === 'wall') {
      dimensions.length = this.calculateLength(entity)
    } else if (type === 'door' || type === 'window') {
      dimensions.width = this.calculateLength(entity)
    } else if (type === 'kitchen' || type === 'sanitary') {
      const bounds = this.calculateBounds(this.extractPoints(entity))
      dimensions.width = bounds.max[0] - bounds.min[0]
      dimensions.length = bounds.max[1] - bounds.min[1]
    }

    return dimensions
  }

  private calculateThickness(_entity: CADEntity, type: string): number | undefined {
    // Use fallback rules from configuration
    if (this.fallbackRules[type]?.thickness_m) {
      return this.fallbackRules[type].thickness_m
    }
    
    // Default fallbacks
    if (type === 'wall') {
      return 0.2 // Default wall thickness in meters
    }
    return undefined
  }

  private getDefaultMaterial(type: string): string {
    const materials: Record<string, string> = {
      wall: 'wall_paint',
      door: 'wood_door',
      window: 'aluminum_window',
      kitchen: 'kitchen_cabinets',
      sanitary: 'bathroom_fixtures',
      room: 'generic',
      unknown: 'generic'
    }
    return materials[type] || 'generic'
  }

  private calculateConfidence(entity: CADEntity, type: string): number {
    let confidence = 0.5

    // Layer name match bonus
    const layerName = entity.layer?.toUpperCase() || ''
    for (const [pattern, expectedType] of Object.entries(this.layerRules)) {
      if (layerName.includes(pattern) && expectedType === type) {
        confidence += 0.3
        break
      }
    }

    // Entity type validation
    if (type === 'wall' && (entity.type === 'LINE' || entity.type === 'LWPOLYLINE')) {
      confidence += 0.2
    }

    if (type === 'door' && entity.type === 'ARC') {
      confidence += 0.2
    }

    return Math.min(confidence, 1.0)
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() || ''
  }

  private isArchitecturalLayer(layerName: string): boolean {
    const upperName = layerName.toUpperCase()
    
    // Check if layer name contains architectural keywords
    const architecturalKeywords = [
      'WALL', 'DOOR', 'WINDOW', 'KITCHEN', 'BATHROOM', 'SANITARY',
      'FLOOR', 'ROOM', 'SPACE', 'STRUCTURE', 'CABINET', 'FIXTURE',
      'PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'EQUIPMENT'
    ]
    
    return architecturalKeywords.some(keyword => upperName.includes(keyword))
  }

  private isArchitecturalEntity(entity: CADEntity): boolean {
    // Focus on lines, polylines, circles, arcs, and blocks
    const architecturalTypes = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC', 'INSERT']
    
    if (!architecturalTypes.includes(entity.type)) {
      return false
    }
    
    // Check if entity is on an architectural layer
    if (entity.layer) {
      return this.isArchitecturalLayer(entity.layer)
    }
    
    // Check entity properties for architectural characteristics
    if (entity.type === 'LINE' || entity.type === 'LWPOLYLINE') {
      const length = this.calculateLength(entity)
      // Typical architectural element sizes (in drawing units)
      return length > 0.1 && length < 100
    }
    
    if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
      const radius = entity.radius || 0
      // Typical door/window arc sizes
      return radius > 0.1 && radius < 10
    }
    
    return true
  }

  generateRoomsFromElements(elements: FloorPlanElement[]): RoomDefinition[] {
    // Simple room detection based on wall boundaries
    const walls = elements.filter(e => e.type === 'wall')
    const rooms: RoomDefinition[] = []

    if (walls.length === 0) {
      return rooms
    }

    // Find bounding box of all walls
    const allPoints = walls.flatMap(w => w.geometry.points)
    const bounds = this.calculateBounds(allPoints)

    // Create a single room for now (can be improved with polygon detection)
    rooms.push({
      id: 'room_1',
      name: 'Main Space',
      type: 'living',
      bounds: {
        min: [bounds.min[0], bounds.min[1]],
        max: [bounds.max[0], bounds.max[1]]
      },
      elements: elements.map(e => e.id)
    })

    return rooms
  }
}

// Export singleton instance
export const realCADParser = new RealCADParser()
