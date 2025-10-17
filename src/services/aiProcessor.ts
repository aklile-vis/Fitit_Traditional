// AI Processing Service using Hugging Face Inference API
export interface AIProcessingResult {
  elementType: string
  confidence: number
  materialSuggestions: string[]
  properties: {
    thickness?: number
    dimensions?: {
      width?: number
      height?: number
      length?: number
    }
    roomType?: string
  }
  reasoning: string
}

export interface HuggingFaceConfig {
  apiKey: string
  model: string
  baseUrl: string
}

export class AIProcessor {
  private config: HuggingFaceConfig
  private cache: Map<string, AIProcessingResult> = new Map()
  private rateLimiter: { lastCall: number; calls: number } = { lastCall: 0, calls: 0 }

  constructor(config: HuggingFaceConfig) {
    this.config = config
  }

  async processElement(element: any): Promise<AIProcessingResult> {
    // Check cache first
    const cacheKey = this.generateCacheKey(element)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    // Rate limiting (Hugging Face free tier: 1000 requests/month)
    await this.rateLimit()

    try {
      const result = await this.callHuggingFaceAPI(element)
      this.cache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('AI processing failed, falling back to rule-based:', error)
      return this.fallbackProcessing(element)
    }
  }

  private async callHuggingFaceAPI(element: any): Promise<AIProcessingResult> {
    const prompt = this.buildPrompt(element)
    
    // Check if API key is available
    if (!this.config.apiKey || this.config.apiKey === 'your_api_key_here') {
      console.warn('Hugging Face API key not configured, using fallback processing')
      return this.fallbackProcessing(element)
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
          max_length: 200,
          temperature: 0.3,
          top_p: 0.9,
          return_full_text: false
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Hugging Face API error: ${response.status} - ${errorText}`)
      throw new Error(`Hugging Face API error: ${response.status}`)
    }

    const data = await response.json()
    return this.parseResponse(data, element)
  }

  private buildPrompt(element: any): string {
    return `Analyze this architectural element and classify it:

Element Data:
- Layer Name: ${element.layer}
- Geometry: ${JSON.stringify(element.geometry)}
- Current Type: ${element.type}
- Dimensions: ${JSON.stringify(element.dimensions)}

Classify this element as one of: wall, door, window, kitchen, sanitary, room, unknown

Respond in JSON format:
{
  "elementType": "classified_type",
  "confidence": 0.0-1.0,
  "materialSuggestions": ["material1", "material2"],
  "properties": {
    "thickness": number_if_wall,
    "dimensions": { "width": number, "height": number },
    "roomType": "room_type_if_applicable"
  },
  "reasoning": "brief_explanation"
}`
  }

  private parseResponse(data: any, element: any): AIProcessingResult {
    try {
      // Extract text from Hugging Face response
      const text = data[0]?.generated_text || data[0]?.text || ''
      
      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          elementType: parsed.elementType || element.type,
          confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
          materialSuggestions: parsed.materialSuggestions || this.getDefaultMaterials(element.type),
          properties: parsed.properties || {},
          reasoning: parsed.reasoning || 'AI classification'
        }
      }
      
      // Fallback parsing
      return this.parseFallbackResponse(text, element)
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      return this.fallbackProcessing(element)
    }
  }

  private parseFallbackResponse(text: string, element: any): AIProcessingResult {
    // Simple text parsing for when JSON parsing fails
    const elementType = this.extractElementType(text) || element.type
    const confidence = this.extractConfidence(text) || 0.6
    
    return {
      elementType,
      confidence,
      materialSuggestions: this.getDefaultMaterials(elementType),
      properties: {},
      reasoning: 'AI classification (fallback parsing)'
    }
  }

  private extractElementType(text: string): string | null {
    const types = ['wall', 'door', 'window', 'kitchen', 'sanitary', 'room']
    const lowerText = text.toLowerCase()
    
    for (const type of types) {
      if (lowerText.includes(type)) {
        return type
      }
    }
    return null
  }

  private extractConfidence(text: string): number | null {
    const confidenceMatch = text.match(/confidence[:\s]*([0-9.]+)/i)
    if (confidenceMatch) {
      return parseFloat(confidenceMatch[1])
    }
    return null
  }

  private fallbackProcessing(element: any): AIProcessingResult {
    // Rule-based fallback when AI fails
    const elementType = this.ruleBasedClassification(element)
    
    return {
      elementType,
      confidence: 0.7,
      materialSuggestions: this.getDefaultMaterials(elementType),
      properties: this.getDefaultProperties(elementType),
      reasoning: 'Rule-based classification (AI fallback)'
    }
  }

  private ruleBasedClassification(element: any): string {
    const layerName = element.layer?.toLowerCase() || ''
    
    if (layerName.includes('wall')) return 'wall'
    if (layerName.includes('door')) return 'door'
    if (layerName.includes('window')) return 'window'
    if (layerName.includes('kitchen') || layerName.includes('cabinet')) return 'kitchen'
    if (layerName.includes('sanitary') || layerName.includes('bathroom')) return 'sanitary'
    if (layerName.includes('room') || layerName.includes('space')) return 'room'
    
    return 'unknown'
  }

  private getDefaultMaterials(elementType: string): string[] {
    const materialMap: Record<string, string[]> = {
      wall: ['wall_paint', 'wallpaper', 'wood_panel'],
      door: ['wood_door', 'glass_door', 'metal_door'],
      window: ['aluminum_window', 'wood_window', 'vinyl_window'],
      kitchen: ['kitchen_cabinets', 'granite_countertop', 'stainless_steel'],
      sanitary: ['bathroom_fixtures', 'ceramic_tile', 'marble'],
      room: ['generic_material'],
      unknown: ['generic_material']
    }
    
    return materialMap[elementType] || ['generic_material']
  }

  private getDefaultProperties(elementType: string): any {
    const propertyMap: Record<string, any> = {
      wall: { thickness: 0.2 },
      door: { dimensions: { width: 0.8, height: 2.1 } },
      window: { dimensions: { width: 1.2, height: 1.5 } },
      kitchen: { roomType: 'kitchen' },
      sanitary: { roomType: 'bathroom' },
      room: { roomType: 'living' }
    }
    
    return propertyMap[elementType] || {}
  }

  private generateCacheKey(element: any): string {
    return `${element.layer}_${element.type}_${JSON.stringify(element.geometry)}`
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeDiff = now - this.rateLimiter.lastCall
    
    // Reset counter every hour
    if (timeDiff > 3600000) {
      this.rateLimiter.calls = 0
      this.rateLimiter.lastCall = now
    }
    
    // Check if we're within limits (1000 requests/month for free tier)
    if (this.rateLimiter.calls >= 1000) {
      throw new Error('Rate limit exceeded. Consider upgrading to paid tier.')
    }
    
    this.rateLimiter.calls++
    
    // Add small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Batch processing for efficiency
  async processBatch(elements: any[]): Promise<AIProcessingResult[]> {
    const results: AIProcessingResult[] = []
    
    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < elements.length; i += 5) {
      const batch = elements.slice(i, i + 5)
      const batchResults = await Promise.all(
        batch.map(element => this.processElement(element))
      )
      results.push(...batchResults)
      
      // Add delay between batches
      if (i + 5 < elements.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }
}

// Configuration for different Hugging Face models
export const HUGGING_FACE_MODELS = {
  // Free models (1000 requests/month)
  'microsoft/DialoGPT-medium': {
    baseUrl: 'https://api-inference.huggingface.co',
    costPerRequest: 0.0001
  },
  
  // Paid models (more reliable)
  'microsoft/DialoGPT-large': {
    baseUrl: 'https://api-inference.huggingface.co',
    costPerRequest: 0.0002
  },
  
  // Specialized models
  'google/flan-t5-large': {
    baseUrl: 'https://api-inference.huggingface.co',
    costPerRequest: 0.0003
  }
}

// Export singleton instance
export const aiProcessor = new AIProcessor({
  apiKey: process.env.HUGGING_FACE_API_KEY || '',
  model: 'google/flan-t5-base',
  baseUrl: 'https://api-inference.huggingface.co'
})
