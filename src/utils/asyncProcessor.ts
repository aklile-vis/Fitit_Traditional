// Utility function to yield control back to the browser
export const yieldToBrowser = (ms: number = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Chunked processing to prevent blocking the main thread
export const processInChunks = async <T>(
  items: T[],
  processor: (item: T, index: number) => Promise<any>,
  chunkSize: number = 10,
  delay: number = 10
): Promise<any[]> => {
  const results: any[] = []
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    
    // Process chunk
    const chunkResults = await Promise.all(
      chunk.map((item, index) => processor(item, i + index))
    )
    
    results.push(...chunkResults)
    
    // Yield control to browser
    if (i + chunkSize < items.length) {
      await yieldToBrowser(delay)
    }
  }
  
  return results
}

// Progress tracking utility
export class ProgressTracker {
  private current: number = 0
  private total: number
  private onProgress: (progress: number, message: string) => void

  constructor(total: number, onProgress: (progress: number, message: string) => void) {
    this.total = total
    this.onProgress = onProgress
  }

  async step(message: string, increment: number = 1) {
    this.current += increment
    const progress = Math.min((this.current / this.total) * 100, 100)
    this.onProgress(progress, message)
    await yieldToBrowser(50) // Always yield after each step
  }

  setTotal(total: number) {
    this.total = total
  }
}

// Non-blocking file processing
export const processFileAsync = async (
  file: File,
  onProgress: (progress: number, message: string) => void,
  onSuccess: (result: any) => void,
  onError: (error: string) => void
) => {
  const tracker = new ProgressTracker(100, onProgress)
  
  try {
    // Step 1: Validate file
    await tracker.step('Validating file...', 5)
    
    // Step 2: Upload file
    await tracker.step('Uploading file to server...', 10)
    
    const formData = new FormData()
    formData.append('file', file)

    const uploadResponse = await fetch('http://localhost:8000/upload', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      throw new Error('Upload failed')
    }

    const uploadData = await uploadResponse.json()
    console.log('Upload result:', uploadData)

    // Step 3: Process file
    await tracker.step('Processing CAD file...', 15)
    
    const response = await fetch('http://localhost:8000/process-cad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: uploadData.file_path,
        userId: uploadData.file_id
      })
    })

    if (!response.ok) {
      throw new Error('Processing failed')
    }

    // Step 4: Parse results
    await tracker.step('Parsing CAD data...', 20)
    
    const processResult = await response.json()
    console.log('Processing result:', processResult)

    // Step 5: Create processed model
    await tracker.step('Creating 3D model...', 25)
    
    const parsedDxf = processResult.parsed_dxf || {}
    const layersRaw: Record<string, any> = (parsedDxf.layers && typeof parsedDxf.layers === 'object') ? parsedDxf.layers as Record<string, any> : {}
    const elementsRaw: Array<Record<string, any>> = Array.isArray(processResult.elements) ? processResult.elements as Array<Record<string, any>> : []
    const statistics: Record<string, any> = (processResult.statistics && typeof processResult.statistics === 'object') ? processResult.statistics as Record<string, any> : {}
    
    const processedModel = {
      id: uploadData.file_id,
      name: file.name,
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      layers: Object.keys(layersRaw).map((name) => {
        const layer = layersRaw[name] as Record<string, any>
        return {
          name,
          color: layer?.color ?? 0,
          linetype: layer?.linetype ?? 'CONTINUOUS',
          on: layer?.on ?? true,
          classification: layer?.classification ?? 'other',
        }
      }),
      elements: elementsRaw.map((element) => ({
        type: element.type,
        layer: element.layer,
        properties: element.properties,
        geometry: element.geometry,
        confidence: element.confidence,
      })),
      rooms: elementsRaw
        .filter((element) => element.type === 'space')
        .map((room) => ({
          id: (room.id as string) || `room-${Math.random()}`,
          name: room.properties?.name || 'Room',
          type: room.type,
          bounds: room.geometry?.bounds,
          geometry: room.geometry,
          area: room.properties?.area || 0,
        })),
      statistics: {
        totalLayers: Object.keys(layersRaw).length,
        totalElements: elementsRaw.length,
        elementTypes: statistics.element_counts || {},
        totalArea: statistics.total_area || 0,
        processingTime: processResult.processing_time || 0
      },
      ifcModel: processResult.ifc_model || null,
      glbPath: processResult.glb_path || null,
      images: processResult.images || []
    }

    // Step 6: Finalize
    await tracker.step('Finalizing...', 25)
    
    onSuccess(processedModel)
    
  } catch (error) {
    console.error('Processing error:', error)
    onError(error instanceof Error ? error.message : 'Unknown error occurred')
  }
}
