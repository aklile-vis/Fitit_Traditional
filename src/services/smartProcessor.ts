// Smart Processing Pipeline - Combines Rule-based + AI Processing
import { FloorPlanElement, RoomDefinition, AgentParameters } from './floorPlanAnalyzer'
import { Reconstructed3DModel } from './3DReconstructionEngine'
import { AIProcessingResult, aiProcessor } from './aiProcessor'

export interface ProcessingStats {
  totalElements: number
  ruleBasedProcessed: number
  aiProcessed: number
  fallbackProcessed: number
  averageConfidence: number
  processingTime: number
  estimatedCost: number
}

export interface ProcessedElement extends FloorPlanElement {
  processedType: string
  confidence: number
  materialSuggestions: string[]
  processingMethod: 'rule-based' | 'ai' | 'fallback'
  aiResult?: AIProcessingResult
}

export class SmartProcessor {
  private stats: ProcessingStats = {
    totalElements: 0,
    ruleBasedProcessed: 0,
    aiProcessed: 0,
    fallbackProcessed: 0,
    averageConfidence: 0,
    processingTime: 0,
    estimatedCost: 0
  }

  async processFloorPlan(
    elements: FloorPlanElement[],
    rooms: RoomDefinition[],
    agentParams: AgentParameters
  ): Promise<{
    processedElements: ProcessedElement[]
    stats: ProcessingStats
    reconstructedModel?: Reconstructed3DModel
  }> {
    const startTime = Date.now()
    this.resetStats()

    // Step 1: Process elements with smart pipeline
    const processedElements = await this.processElements(elements)

    // Step 2: Calculate statistics
    this.calculateStats(processedElements, startTime)

    // Step 3: Reconstruct 3D model
    const reconstructedModel = await this.reconstruct3D(processedElements, rooms, agentParams)

    return {
      processedElements,
      stats: this.stats,
      reconstructedModel
    }
  }

  private async processElements(elements: FloorPlanElement[]): Promise<ProcessedElement[]> {
    const processedElements: ProcessedElement[] = []

    for (const element of elements) {
      try {
        const processed = await this.processElement(element)
        processedElements.push(processed)
      } catch (error) {
        console.error(`Failed to process element ${element.id}:`, error)
        // Add fallback element
        processedElements.push(this.createFallbackElement(element))
      }
    }

    return processedElements
  }

  private async processElement(element: FloorPlanElement): Promise<ProcessedElement> {
    // Step 1: Try rule-based processing first
    const ruleResult = this.ruleBasedProcessing(element)
    
    if (ruleResult.confidence > 0.8) {
      this.stats.ruleBasedProcessed++
      return {
        ...element,
        processedType: ruleResult.type,
        confidence: ruleResult.confidence,
        materialSuggestions: ruleResult.materialSuggestions,
        processingMethod: 'rule-based'
      }
    }

    // Step 2: Use AI for complex/ambiguous cases (only if confidence is low)
    if (ruleResult.confidence < 0.7) {
      try {
        const aiResult = await aiProcessor.processElement(element)
        this.stats.aiProcessed++
        
        return {
          ...element,
          processedType: aiResult.elementType,
          confidence: aiResult.confidence,
          materialSuggestions: aiResult.materialSuggestions,
          processingMethod: 'ai',
          aiResult
        }
      } catch (error) {
        console.warn(`AI processing failed for element ${element.id}, using rule-based result:`, error)
        this.stats.fallbackProcessed++
        return {
          ...element,
          processedType: ruleResult.type,
          confidence: ruleResult.confidence,
          materialSuggestions: ruleResult.materialSuggestions,
          processingMethod: 'fallback'
        }
      }
    } else {
      // Use rule-based result if confidence is high enough
      this.stats.ruleBasedProcessed++
      return {
        ...element,
        processedType: ruleResult.type,
        confidence: ruleResult.confidence,
        materialSuggestions: ruleResult.materialSuggestions,
        processingMethod: 'rule-based'
      }
    }
  }

  private ruleBasedProcessing(element: FloorPlanElement): {
    type: string
    confidence: number
    materialSuggestions: string[]
  } {
    const layerName = element.layer?.toLowerCase() || ''
    const elementType = element.type?.toLowerCase() || ''

    // High confidence rules
    if (layerName.includes('wall') || elementType === 'wall') {
      return {
        type: 'wall',
        confidence: 0.95,
        materialSuggestions: ['wall_paint', 'wallpaper', 'wood_panel']
      }
    }

    if (layerName.includes('door') || elementType === 'door') {
      return {
        type: 'door',
        confidence: 0.9,
        materialSuggestions: ['wood_door', 'glass_door', 'metal_door']
      }
    }

    if (layerName.includes('window') || elementType === 'window') {
      return {
        type: 'window',
        confidence: 0.9,
        materialSuggestions: ['aluminum_window', 'wood_window', 'vinyl_window']
      }
    }

    // Medium confidence rules
    if (layerName.includes('kitchen') || layerName.includes('cabinet')) {
      return {
        type: 'kitchen',
        confidence: 0.8,
        materialSuggestions: ['kitchen_cabinets', 'granite_countertop', 'stainless_steel']
      }
    }

    if (layerName.includes('sanitary') || layerName.includes('bathroom')) {
      return {
        type: 'sanitary',
        confidence: 0.8,
        materialSuggestions: ['bathroom_fixtures', 'ceramic_tile', 'marble']
      }
    }

    // Dimension-based rules
    if (element.dimensions?.width) {
      const width = element.dimensions.width
      
      // Door width patterns
      if (width >= 0.6 && width <= 1.2) {
        return {
          type: 'door',
          confidence: 0.7,
          materialSuggestions: ['wood_door', 'glass_door']
        }
      }
      
      // Window width patterns
      if (width >= 0.5 && width <= 3.0) {
        return {
          type: 'window',
          confidence: 0.7,
          materialSuggestions: ['aluminum_window', 'wood_window']
        }
      }
    }

    // Low confidence fallback
    return {
      type: elementType || 'unknown',
      confidence: 0.5,
      materialSuggestions: ['generic_material']
    }
  }

  private createFallbackElement(element: FloorPlanElement): ProcessedElement {
    return {
      ...element,
      processedType: element.type || 'unknown',
      confidence: 0.3,
      materialSuggestions: ['generic_material'],
      processingMethod: 'fallback'
    }
  }

  private async reconstruct3D(
    elements: ProcessedElement[],
    rooms: RoomDefinition[],
    agentParams: AgentParameters
  ): Promise<Reconstructed3DModel | undefined> {
    try {
      // Import reconstruction engine dynamically to avoid circular dependencies
      const { reconstructionEngine } = await import('./3DReconstructionEngine')
      
      // Convert processed elements back to FloorPlanElement format
      const floorPlanElements: FloorPlanElement[] = elements.map(el => ({
        ...el,
        type: el.processedType as any
      }))

      return await reconstructionEngine.reconstruct3D(floorPlanElements, rooms, agentParams)
    } catch (error) {
      console.error('3D reconstruction failed:', error)
      return undefined
    }
  }

  private calculateStats(processedElements: ProcessedElement[], startTime: number): void {
    this.stats.totalElements = processedElements.length
    this.stats.processingTime = Date.now() - startTime
    this.stats.averageConfidence = processedElements.reduce((sum, el) => sum + el.confidence, 0) / processedElements.length
    
    // Calculate estimated cost (Hugging Face pricing)
    this.stats.estimatedCost = this.stats.aiProcessed * 0.0001 // $0.0001 per request
  }

  private resetStats(): void {
    this.stats = {
      totalElements: 0,
      ruleBasedProcessed: 0,
      aiProcessed: 0,
      fallbackProcessed: 0,
      averageConfidence: 0,
      processingTime: 0,
      estimatedCost: 0
    }
  }

  // Batch processing for efficiency
  async processBatch(elements: FloorPlanElement[]): Promise<ProcessedElement[]> {
    const processedElements: ProcessedElement[] = []
    
    // Process in batches of 10 to avoid overwhelming the AI service
    for (let i = 0; i < elements.length; i += 10) {
      const batch = elements.slice(i, i + 10)
      const batchResults = await Promise.all(
        batch.map(element => this.processElement(element))
      )
      processedElements.push(...batchResults)
      
      // Add delay between batches
      if (i + 10 < elements.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return processedElements
  }

  // Get processing statistics
  getStats(): ProcessingStats {
    return { ...this.stats }
  }

  // Reset statistics
  resetStatistics(): void {
    this.resetStats()
  }

  // Cost estimation for different scenarios
  estimateCosts(elements: FloorPlanElement[]): {
    ruleBasedOnly: number
    aiOnly: number
    hybrid: number
    savings: number
  } {
    const totalElements = elements.length
    const ruleBasedCount = Math.floor(totalElements * 0.9) // 90% rule-based
    const aiCount = totalElements - ruleBasedCount // 10% AI
    
    return {
      ruleBasedOnly: 0, // Free
      aiOnly: totalElements * 0.0001, // $0.0001 per request
      hybrid: aiCount * 0.0001, // Only AI requests cost money
      savings: (totalElements * 0.0001) - (aiCount * 0.0001) // Savings from hybrid approach
    }
  }
}

// Export singleton instance
export const smartProcessor = new SmartProcessor()
