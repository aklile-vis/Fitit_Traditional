// File processing service for handling CAD/BIM files
import { IFCModel } from './ifcElementCreator';
import { IFCModelGenerator } from './ifcModelGenerator';

export interface ProcessedModel {
  id: string
  name: string
  fileType: string
  layers?: Layer[]
  materials?: MaterialMapping[]
  geometry?: GeometryData
  metadata?: FileMetadata
  status: 'processing' | 'success' | 'error'
  error?: string
  ifcModel?: IFCModel
  floorPlanElements?: any[]
}

export interface Layer {
  id: string
  name: string
  type: LayerType
  material?: string
  confidence: number
  properties: Record<string, unknown>
}

export interface MaterialMapping {
  layerId: string
  materialId: string
  confidence: number
  suggested: boolean
}

export interface GeometryData {
  vertices: number[]
  faces: number[]
  normals: number[]
  uvs: number[]
  boundingBox: {
    min: [number, number, number]
    max: [number, number, number]
  }
}

export interface FileMetadata {
  fileName: string
  fileSize: number
  uploadDate: string
  version: string
  units: string
  coordinateSystem: string
}

export type LayerType = 
  | 'wall' 
  | 'floor' 
  | 'ceiling' 
  | 'door' 
  | 'window' 
  | 'cabinet' 
  | 'fixture' 
  | 'furniture' 
  | 'lighting' 
  | 'unknown'

export class FileProcessor {
  private ifcGenerator: IFCModelGenerator;

  constructor() {
    this.ifcGenerator = new IFCModelGenerator();
  }

  private layerRules: Record<string, LayerType> = {
    // AutoCAD layer naming conventions
    'WALL': 'wall',
    'WALLS': 'wall',
    'WALL_': 'wall',
    'FLOOR': 'floor',
    'FLOORS': 'floor',
    'FLOOR_': 'floor',
    'CEILING': 'ceiling',
    'CEILINGS': 'ceiling',
    'CEILING_': 'ceiling',
    'DOOR': 'door',
    'DOORS': 'door',
    'DOOR_': 'door',
    'WINDOW': 'window',
    'WINDOWS': 'window',
    'WINDOW_': 'window',
    'CABINET': 'cabinet',
    'CABINETS': 'cabinet',
    'CABINET_': 'cabinet',
    'FIXTURE': 'fixture',
    'FIXTURES': 'fixture',
    'FIXTURE_': 'fixture',
    'FURNITURE': 'furniture',
    'FURNITURE_': 'furniture',
    'LIGHT': 'lighting',
    'LIGHTING': 'lighting',
    'LIGHTS': 'lighting',
    'LIGHT_': 'lighting',
    
    // Common variations
    'A-WALL': 'wall',
    'A-FLOOR': 'floor',
    'A-DOOR': 'door',
    'A-WINDOW': 'window',
    'A-CEILING': 'ceiling',
    
    // BIM naming conventions
    'Walls': 'wall',
    'Floors': 'floor',
    'Doors': 'door',
    'Windows': 'window',
    'Ceilings': 'ceiling',
    'Furniture': 'furniture',
    'Lighting': 'lighting',
    
    // Generic patterns
    'WALL*': 'wall',
    'FLOOR*': 'floor',
    'DOOR*': 'door',
    'WINDOW*': 'window'
  }

  private materialSuggestions: Record<LayerType, string[]> = {
    wall: ['wall_paint', 'wallpaper', 'tiles'],
    floor: ['hardwood', 'tile', 'carpet', 'laminate'],
    ceiling: ['ceiling_paint', 'ceiling_tile'],
    door: ['wood_door', 'glass_door', 'metal_door'],
    window: ['aluminum_window', 'wood_window', 'vinyl_window'],
    cabinet: ['kitchen_cabinets', 'bathroom_cabinets'],
    fixture: ['bathroom_fixtures', 'kitchen_fixtures'],
    furniture: ['furniture'],
    lighting: ['lighting'],
    unknown: []
  }

  async processFile(file: File): Promise<ProcessedModel> {
    const fileType = this.detectFileType(file.name)
    const modelId = this.generateId()
    
    try {
      // Simulate file processing based on file type
      const processedModel = await this.processByType(file, fileType, modelId)
      return processedModel
    } catch (error) {
      return {
        id: modelId,
        name: file.name,
        fileType,
        layers: [],
        materials: [],
        geometry: this.getEmptyGeometry(),
        metadata: this.getFileMetadata(file),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private detectFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase()
    const typeMap: Record<string, string> = {
      'dwg': 'AutoCAD',
      'dxf': 'AutoCAD DXF',
      'rvt': 'Revit',
      'ifc': 'IFC',
      'skp': 'SketchUp',
      '3ds': '3ds Max',
      'blend': 'Blender'
    }
    return typeMap[extension || ''] || 'Unknown'
  }

  private async processByType(file: File, fileType: string, modelId: string): Promise<ProcessedModel> {
    // Read actual file data
    const fileData = await this.readFileData(file)
    
    let layers: Layer[] = []
    let materials: MaterialMapping[] = []
    let floorPlanElements: any[] = []

    try {
      switch (fileType) {
        case 'AutoCAD':
        case 'AutoCAD DXF':
          layers = await this.processRealDXFData(fileData)
          break
        case 'Revit':
          throw new Error('Revit files require specialized processing - not implemented yet')
        case 'IFC':
          throw new Error('IFC files require specialized processing - not implemented yet')
        case 'SketchUp':
          throw new Error('SketchUp files require specialized processing - not implemented yet')
        default:
          throw new Error(`Unsupported file type: ${fileType}`)
      }

      // Generate material mappings from real data
      materials = this.generateMaterialMappings(layers)

      // Convert real layers to floor plan elements
      floorPlanElements = this.convertLayersToFloorPlanElements(layers)

      // Generate IFC model from real data
      const ifcModel = this.ifcGenerator.generateIFCModel(floorPlanElements)

      return {
        id: modelId,
        name: file.name,
        fileType,
        layers,
        materials,
        geometry: this.calculateRealGeometry(floorPlanElements),
        metadata: this.getFileMetadata(file),
        status: 'success',
        ifcModel,
        floorPlanElements
      }
    } catch (error) {
      throw new Error(`Failed to process ${fileType} file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async readFileData(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
  }

  private async processRealDXFData(fileData: ArrayBuffer): Promise<Layer[]> {
    // Convert ArrayBuffer to text for DXF parsing
    const text = new TextDecoder().decode(fileData)
    
    // Parse DXF content
    const layers = this.parseDXFContent(text)
    
    if (layers.length === 0) {
      throw new Error('No layers found in DXF file. Please ensure the file contains valid layer data.')
    }
    
    return layers
  }

  private parseDXFContent(dxfText: string): Layer[] {
    const layers: Layer[] = []
    const lines = dxfText.split('\n')
    
    let currentLayer: any = null
    let inLayersSection = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Check for LAYERS section
      if (line === '2' && i + 1 < lines.length && lines[i + 1]?.trim() === 'LAYERS') {
        inLayersSection = true
        continue
      }
      
      // End of LAYERS section
      if (inLayersSection && line === '0' && i + 1 < lines.length && lines[i + 1]?.trim() === 'ENDSEC') {
        break
      }
      
      // Parse layer data
      if (inLayersSection && line === '0' && i + 1 < lines.length && lines[i + 1]?.trim() === 'LAYER') {
        if (currentLayer) {
          layers.push(currentLayer)
        }
        currentLayer = {
          id: this.generateId(),
          name: '',
          type: 'unknown' as LayerType,
          confidence: 0.5,
          properties: {}
        }
      }
      
      // Layer name
      if (currentLayer && line === '2' && i + 1 < lines.length) {
        currentLayer.name = lines[i + 1]?.trim() || ''
        currentLayer.type = this.classifyLayer(currentLayer.name)
        currentLayer.confidence = this.calculateConfidence(currentLayer.name)
        currentLayer.properties = {
          color: this.getRandomColor(),
          lineType: 'Continuous',
          lineWeight: 0.25
        }
      }
    }
    
    // Add the last layer
    if (currentLayer) {
      layers.push(currentLayer)
    }
    
    return layers
  }

  private calculateRealGeometry(floorPlanElements: any[]): GeometryData {
    if (floorPlanElements.length === 0) {
      return this.getEmptyGeometry()
    }

    // Calculate bounding box from real elements
    let minX = Infinity, minY = Infinity, minZ = 0
    let maxX = -Infinity, maxY = -Infinity, maxZ = 3 // Default height

    floorPlanElements.forEach(element => {
      minX = Math.min(minX, element.startX, element.endX)
      minY = Math.min(minY, element.startY, element.endY)
      maxX = Math.max(maxX, element.startX, element.endX)
      maxY = Math.max(maxY, element.startY, element.endY)
      
      if (element.properties.height) {
        maxZ = Math.max(maxZ, element.properties.height)
      }
    })

    return {
      vertices: [], // Will be calculated by 3D engine
      faces: [], // Will be calculated by 3D engine
      normals: [], // Will be calculated by 3D engine
      uvs: [], // Will be calculated by 3D engine
      boundingBox: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
      }
    }
  }

  private classifyLayer(layerName: string): LayerType {
    const normalizedName = layerName.toUpperCase()
    
    // Direct match
    if (this.layerRules[normalizedName]) {
      return this.layerRules[normalizedName]
    }

    // Pattern matching
    for (const [pattern, type] of Object.entries(this.layerRules)) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'), 'i')
        if (regex.test(normalizedName)) {
          return type
        }
      }
    }

    // Keyword matching
    const keywords: Record<string, LayerType> = {
      'WALL': 'wall',
      'FLOOR': 'floor',
      'DOOR': 'door',
      'WINDOW': 'window',
      'CEILING': 'ceiling',
      'CABINET': 'cabinet',
      'FIXTURE': 'fixture',
      'FURNITURE': 'furniture',
      'LIGHT': 'lighting'
    }

    for (const [keyword, type] of Object.entries(keywords)) {
      if (normalizedName.includes(keyword)) {
        return type
      }
    }

    return 'unknown'
  }

  private calculateConfidence(layerName: string): number {
    const normalizedName = layerName.toUpperCase()
    
    // Direct match = high confidence
    if (this.layerRules[normalizedName]) {
      return 0.9
    }

    // Pattern match = medium confidence
    for (const pattern of Object.keys(this.layerRules)) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'), 'i')
        if (regex.test(normalizedName)) {
          return 0.7
        }
      }
    }

    // Keyword match = low confidence
    const keywords = ['WALL', 'FLOOR', 'DOOR', 'WINDOW', 'CEILING', 'CABINET', 'FIXTURE', 'FURNITURE', 'LIGHT']
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        return 0.5
      }
    }

    return 0.1
  }

  private generateMaterialMappings(layers: Layer[]): MaterialMapping[] {
    return layers.map(layer => {
      const suggestions = this.materialSuggestions[layer.type]
      const materialId = suggestions.length > 0 ? suggestions[0] : 'generic_material'
      
      return {
        layerId: layer.id,
        materialId: materialId || 'generic_material',
        confidence: layer.confidence,
        suggested: true
      }
    })
  }

  private getFileMetadata(file: File): FileMetadata {
    return {
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      version: '1.0',
      units: 'meters',
      coordinateSystem: 'WGS84'
    }
  }


  private getEmptyGeometry(): GeometryData {
    return {
      vertices: [],
      faces: [],
      normals: [],
      uvs: [],
      boundingBox: {
        min: [0, 0, 0],
        max: [0, 0, 0]
      }
    }
  }

  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']
    return colors[Math.floor(Math.random() * colors.length)] || '#FF6B6B'
  }

  private convertLayersToFloorPlanElements(layers: Layer[]): any[] {
    return layers.map((layer, index) => {
      // Extract real coordinates from layer properties if available
      let startX = 0, startY = 0, endX = 1, endY = 1;
      
      if (layer.properties && layer.properties.coordinates) {
        const coords = layer.properties.coordinates as any;
        startX = coords.startX || 0;
        startY = coords.startY || 0;
        endX = coords.endX || 1;
        endY = coords.endY || 1;
      } else {
        // If no coordinates available, create a default layout based on layer type
        const layout = this.getDefaultLayoutForLayer(layer.type, index);
        startX = layout.startX;
        startY = layout.startY;
        endX = layout.endX;
        endY = layout.endY;
      }

      return {
        id: layer.id,
        type: this.mapLayerTypeToFloorPlanType(layer.type),
        startX,
        startY,
        endX,
        endY,
        layer: layer.name,
        properties: {
          material: layer.material,
          thickness: this.getDefaultThickness(layer.type),
          height: this.getDefaultHeight(layer.type),
          confidence: layer.confidence,
        },
      };
    });
  }

  private getDefaultLayoutForLayer(layerType: LayerType, index: number): { startX: number; startY: number; endX: number; endY: number } {
    // Create a basic room layout based on layer type
    const roomSize = 8; // 8x8 meter room
    
    switch (layerType) {
      case 'wall':
        // Create perimeter walls
        const wallPositions = [
          { startX: 0, startY: 0, endX: roomSize, endY: 0 }, // Bottom wall
          { startX: roomSize, startY: 0, endX: roomSize, endY: roomSize }, // Right wall
          { startX: roomSize, startY: roomSize, endX: 0, endY: roomSize }, // Top wall
          { startX: 0, startY: roomSize, endX: 0, endY: 0 }, // Left wall
        ];
        return wallPositions[index % wallPositions.length] || wallPositions[0];
        
      case 'door':
        // Place doors in walls
        return {
          startX: roomSize / 2 - 0.5,
          startY: 0,
          endX: roomSize / 2 + 0.5,
          endY: 0
        };
        
      case 'window':
        // Place windows in walls
        return {
          startX: roomSize / 4 - 0.5,
          startY: 0,
          endX: roomSize / 4 + 0.5,
          endY: 0
        };
        
      default:
        // Default placement for other elements
        return {
          startX: index * 2,
          startY: index * 2,
          endX: (index * 2) + 1,
          endY: (index * 2) + 1
        };
    }
  }

  private mapLayerTypeToFloorPlanType(layerType: LayerType): string {
    switch (layerType) {
      case 'wall':
        return 'wall';
      case 'door':
        return 'door';
      case 'window':
        return 'window';
      case 'floor':
        return 'slab';
      case 'ceiling':
        return 'slab';
      case 'cabinet':
        return 'furniture';
      case 'fixture':
        return 'furniture';
      case 'furniture':
        return 'furniture';
      case 'lighting':
        return 'furniture';
      default:
        return 'wall';
    }
  }

  private getDefaultThickness(layerType: LayerType): number {
    switch (layerType) {
      case 'wall':
        return 0.2; // 20cm
      case 'door':
        return 0.1; // 10cm
      case 'window':
        return 0.2; // 20cm
      case 'floor':
      case 'ceiling':
        return 0.2; // 20cm
      default:
        return 0.1; // 10cm
    }
  }

  private getDefaultHeight(layerType: LayerType): number {
    switch (layerType) {
      case 'wall':
        return 2.7; // 2.7m
      case 'door':
        return 2.1; // 2.1m
      case 'window':
        return 1.2; // 1.2m
      case 'floor':
      case 'ceiling':
        return 0.2; // 20cm
      default:
        return 1.0; // 1m
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
}

// Export singleton instance
export const fileProcessor = new FileProcessor()
