// @ts-nocheck

/**
 * Enhanced AI Processor for Architectural Element Recognition
 * Specialized for identifying walls, doors, windows, columns, beams, etc.
 */

export interface LayerClassification {
  type: LayerType
  confidence: number
  reasoning: string
  properties?: {
    thickness?: number
    dimensions?: { width?: number; height?: number; length?: number }
    material?: string
    structural?: boolean
  }
}

export type LayerType = 
  | 'WALL' | 'DOOR' | 'WINDOW' | 'FLOOR' | 'CEILING' 
  | 'COLUMN' | 'BEAM' | 'STAIRS' | 'FURNITURE' 
  | 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'ANNOTATION' | 'OTHER'

export interface EntityAnalysis {
  type: string
  geometry: any
  dimensions?: { width?: number; height?: number; length?: number }
  properties?: any
}

export class ArchitecturalAIProcessor {
  private config: {
    apiKey: string
    model: string
    baseUrl: string
  }
  private cache: Map<string, LayerClassification> = new Map()

  constructor() {
    this.config = {
      apiKey: process.env.HUGGING_FACE_API_KEY || '',
      model: 'google/flan-t5-base',
      baseUrl: 'https://api-inference.huggingface.co'
    }
  }

  /**
   * Classify layer type using AI with enhanced architectural element recognition
   */
  async classifyLayerType(layerName: string, entities: any[]): Promise<LayerClassification> {
    try {
      const entityTypes = entities.map(e => e.type).join(', ')
      const entityCount = entities.length
      
      // Enhanced prompt for better architectural element recognition
      const prompt = `Analyze this CAD layer and classify it as an architectural element:

Layer Name: "${layerName}"
Entity Types: ${entityTypes}
Entity Count: ${entityCount}

Classify this layer as one of these architectural types:
- WALL: Structural walls, exterior walls, interior walls, partitions
- DOOR: Doors, door openings, door frames, door swings
- WINDOW: Windows, window openings, glazing, window frames
- FLOOR: Floor elements, slabs, flooring, floor finishes
- CEILING: Ceiling elements, overhead structures, ceiling finishes
- COLUMN: Structural columns, posts, supports, pillars
- BEAM: Structural beams, lintels, headers, girders
- STAIRS: Staircases, steps, ramps, handrails
- FURNITURE: Furniture, fixtures, equipment, appliances
- PLUMBING: Sanitary fixtures, pipes, plumbing elements
- ELECTRICAL: Electrical fixtures, outlets, switches, wiring
- HVAC: HVAC equipment, ducts, vents, mechanical systems
- ANNOTATION: Text, dimensions, notes, symbols, labels
- OTHER: Any other element not listed above

Consider these patterns:
- WALL layers often contain LWPOLYLINE, LINE entities forming closed shapes
- DOOR layers contain LINE entities representing door swings or openings
- WINDOW layers contain LINE or LWPOLYLINE entities for window frames
- COLUMN layers contain CIRCLE, RECTANGLE, or POLYLINE entities
- BEAM layers contain LINE or LWPOLYLINE entities spanning distances
- DIMENSION layers contain DIMENSION entities with measurement data

Respond with only the classification type (e.g., "WALL", "DOOR", etc.) and a confidence score 0-100.`

      const response = await this.callHuggingFaceAPI(prompt)
      
      // Parse the response to extract classification and confidence
      const lines = response.split('\n').filter(line => line.trim())
      const classification = lines[0]?.trim().toUpperCase() || 'OTHER'
      const confidenceMatch = response.match(/(\d+)/)
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 50

      return {
        type: classification as LayerType,
        confidence: Math.min(Math.max(confidence, 0), 100),
        reasoning: `AI classified "${layerName}" as ${classification} based on entity analysis (${entityTypes})`
      }
    } catch (error) {
      console.warn('AI classification failed, using fallback:', error)
      return this.fallbackClassification(layerName, entities)
    }
  }

  /**
   * Enhanced fallback classification with better pattern recognition
   */
  private fallbackClassification(layerName: string, entities: any[]): LayerClassification {
    const name = layerName.toLowerCase()
    const entityTypes = entities.map(e => e.type?.toLowerCase() || '').join(' ')
    
    // Enhanced pattern matching for architectural elements
    if (name.includes('wall') || name.includes('exterior') || name.includes('interior')) {
      return { 
        type: 'WALL', 
        confidence: 85, 
        reasoning: 'Layer name suggests wall element',
        properties: { thickness: 0.2, structural: true }
      }
    }
    
    if (name.includes('door') || name.includes('opening')) {
      return { 
        type: 'DOOR', 
        confidence: 85, 
        reasoning: 'Layer name suggests door element',
        properties: { dimensions: { width: 0.8, height: 2.1 } }
      }
    }
    
    if (name.includes('window') || name.includes('glazing')) {
      return { 
        type: 'WINDOW', 
        confidence: 85, 
        reasoning: 'Layer name suggests window element',
        properties: { dimensions: { width: 1.2, height: 1.5 } }
      }
    }
    
    if (name.includes('column') || name.includes('post') || name.includes('support')) {
      return { 
        type: 'COLUMN', 
        confidence: 85, 
        reasoning: 'Layer name suggests column element',
        properties: { dimensions: { width: 0.3, height: 3.0 }, structural: true }
      }
    }
    
    if (name.includes('beam') || name.includes('lintel') || name.includes('header')) {
      return { 
        type: 'BEAM', 
        confidence: 85, 
        reasoning: 'Layer name suggests beam element',
        properties: { dimensions: { width: 0.3, height: 0.5 }, structural: true }
      }
    }
    
    if (name.includes('floor') || name.includes('slab')) {
      return { 
        type: 'FLOOR', 
        confidence: 85, 
        reasoning: 'Layer name suggests floor element',
        properties: { thickness: 0.15 }
      }
    }
    
    if (name.includes('ceiling') || name.includes('overhead')) {
      return { 
        type: 'CEILING', 
        confidence: 85, 
        reasoning: 'Layer name suggests ceiling element',
        properties: { thickness: 0.1 }
      }
    }
    
    if (name.includes('stair') || name.includes('step')) {
      return { 
        type: 'STAIRS', 
        confidence: 85, 
        reasoning: 'Layer name suggests stairs element',
        properties: { dimensions: { width: 1.0, height: 2.7 } }
      }
    }
    
    if (name.includes('furniture') || name.includes('fixture') || name.includes('equipment')) {
      return { 
        type: 'FURNITURE', 
        confidence: 85, 
        reasoning: 'Layer name suggests furniture element'
      }
    }
    
    if (name.includes('plumbing') || name.includes('sanitary') || name.includes('toilet') || name.includes('sink')) {
      return { 
        type: 'PLUMBING', 
        confidence: 85, 
        reasoning: 'Layer name suggests plumbing element'
      }
    }
    
    if (name.includes('electrical') || name.includes('outlet') || name.includes('switch')) {
      return { 
        type: 'ELECTRICAL', 
        confidence: 85, 
        reasoning: 'Layer name suggests electrical element'
      }
    }
    
    if (name.includes('hvac') || name.includes('duct') || name.includes('vent')) {
      return { 
        type: 'HVAC', 
        confidence: 85, 
        reasoning: 'Layer name suggests HVAC element'
      }
    }
    
    if (name.includes('dim') || name.includes('text') || name.includes('note') || name.includes('annotation')) {
      return { 
        type: 'ANNOTATION', 
        confidence: 85, 
        reasoning: 'Layer name suggests annotation element'
      }
    }
    
    // Entity-based classification
    if (entityTypes.includes('dimension')) {
      return { 
        type: 'ANNOTATION', 
        confidence: 90, 
        reasoning: 'Contains dimension entities'
      }
    }
    
    if (entityTypes.includes('text') || entityTypes.includes('mtext')) {
      return { 
        type: 'ANNOTATION', 
        confidence: 90, 
        reasoning: 'Contains text entities'
      }
    }
    
    if (entityTypes.includes('circle') && entities.length < 10) {
      return { 
        type: 'COLUMN', 
        confidence: 70, 
        reasoning: 'Contains circular entities (likely columns)',
        properties: { dimensions: { width: 0.3, height: 3.0 }, structural: true }
      }
    }
    
    if (entityTypes.includes('lwpolyline') && entities.length > 5) {
      return { 
        type: 'WALL', 
        confidence: 70, 
        reasoning: 'Contains multiple polyline entities (likely walls)',
        properties: { thickness: 0.2, structural: true }
      }
    }
    
    return { 
      type: 'OTHER', 
      confidence: 50, 
      reasoning: 'No clear pattern identified'
    }
  }

  /**
   * Analyze entities within a layer to extract dimensions and properties
   */
  analyzeEntities(entities: any[]): EntityAnalysis[] {
    return entities.map(entity => {
      const analysis: EntityAnalysis = {
        type: entity.type,
        geometry: entity,
        properties: {}
      }

      // Extract dimensions based on entity type
      switch (entity.type) {
        case 'LWPOLYLINE':
          analysis.dimensions = this.calculatePolylineDimensions(entity)
          break
        case 'LINE':
          analysis.dimensions = this.calculateLineDimensions(entity)
          break
        case 'CIRCLE':
          analysis.dimensions = this.calculateCircleDimensions(entity)
          break
        case 'DIMENSION':
          analysis.dimensions = this.extractDimensionValue(entity)
          break
      }

      return analysis
    })
  }

  private calculatePolylineDimensions(entity: any): { width?: number; height?: number; length?: number } {
    if (!entity.points || entity.points.length < 2) return {}
    
    const points = entity.points
    let minX = points[0].x, maxX = points[0].x
    let minY = points[0].y, maxY = points[0].y
    
    for (const point of points) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
    
    return {
      width: maxX - minX,
      height: maxY - minY,
      length: Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2))
    }
  }

  private calculateLineDimensions(entity: any): { width?: number; height?: number; length?: number } {
    if (!entity.start || !entity.end) return {}
    
    const dx = entity.end.x - entity.start.x
    const dy = entity.end.y - entity.start.y
    
    return {
      width: Math.abs(dx),
      height: Math.abs(dy),
      length: Math.sqrt(dx * dx + dy * dy)
    }
  }

  private calculateCircleDimensions(entity: any): { width?: number; height?: number; length?: number } {
    if (!entity.radius) return {}
    
    const diameter = entity.radius * 2
    return {
      width: diameter,
      height: diameter,
      length: diameter
    }
  }

  private extractDimensionValue(entity: any): { width?: number; height?: number; length?: number } {
    // Extract dimension value from DIMENSION entity
    // This would need to be implemented based on DXF dimension structure
    return {}
  }

  private async callHuggingFaceAPI(prompt: string): Promise<string> {
    if (!this.config.apiKey || this.config.apiKey === 'your_api_key_here') {
      throw new Error('Hugging Face API key not configured')
    }
    
    const response = await fetch(`${this.config.baseUrl}/models/${this.config.model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 100,
          temperature: 0.3,
          top_p: 0.9,
          return_full_text: false
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data[0]?.generated_text || data[0]?.text || ''
  }
}

export const architecturalAIProcessor = new ArchitecturalAIProcessor()
