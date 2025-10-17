import fs from 'fs/promises'

import { prisma } from './database'

export interface ProcessingResult {
  success: boolean
  ifcPath?: string
  glbPath?: string
  error?: string
  warnings?: string[]
  usdPath?: string
  summaryPath?: string
}

export async function processCadFile(filePath: string, userId: string): Promise<ProcessingResult> {
  try {
    console.warn(`Processing CAD file: ${filePath} for user: ${userId}`)
    
    // Call our Python backend
    const response = await fetch('http://localhost:8000/process-cad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath,
        userId
      })
    })

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status} ${response.statusText}`)
    }

    // FastAPI returns PlainText like: "STATUS_FILE:/path/to/status.txt"
    const text = await response.text()
    console.warn('Backend processing response:', text)

    if (text.startsWith('STATUS_FILE:')) {
      const statusPath = text.replace('STATUS_FILE:', '').trim()
      try {
        const content = await fs.readFile(statusPath, 'utf-8')
        const parsed = parseStatusContent(content)
        return {
          success: parsed.success,
          ifcPath: parsed.ifcPath,
          glbPath: parsed.glbPath,
          usdPath: parsed.usdPath,
          summaryPath: statusPath,
          warnings: parsed.warnings
        }
      } catch {
        // If we can't read the summary, still succeed but without details
        return { success: true, summaryPath: statusPath }
      }
    }

    // If backend starts returning JSON in future, try to parse gracefully
    try {
      const result = JSON.parse(text)
      return {
        success: true,
        ifcPath: result.ifcPath,
        glbPath: result.glbPath,
        usdPath: result.usdPath,
        warnings: result.report?.warnings || []
      }
    } catch {
      throw new Error('Unexpected backend response format')
    }
  } catch (error) {
    console.error('CAD processing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function getProcessingStatus(fileId: string) {
  const file = await prisma.fileUpload.findUnique({
    where: { id: fileId }
  })

  if (!file) {
    throw new Error('File not found')
  }

  return {
    id: file.id,
    status: file.status,
    errorMessage: file.errorMessage,
    processedFilePath: file.processedFilePath,
    glbFilePath: file.glbFilePath,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt
  }
}

function parseStatusContent(content: string) {
  // Expected lines:
  // SUCCESS | or FAILURE
  // Elements: <n>
  // IFC: <path>
  // GLB: <path>
  // USD: <path>
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const first = lines[0]?.toUpperCase() || ''
  const success = first.includes('SUCCESS')
  let ifcPath: string | undefined
  let glbPath: string | undefined
  let usdPath: string | undefined

  for (const line of lines) {
    if (line.startsWith('IFC:')) ifcPath = line.split(':')[1]?.trim()
    if (line.startsWith('GLB:')) glbPath = line.split(':')[1]?.trim()
    if (line.startsWith('USD:')) usdPath = line.split(':')[1]?.trim()
  }

  return { success, ifcPath, glbPath, usdPath, warnings: [] as string[] }
}
