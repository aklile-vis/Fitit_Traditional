import { NextRequest, NextResponse } from 'next/server'

import { realLocalStorage, StoredProject } from '@/services/realLocalStorage'
import { IFCModelGenerator } from '@/services/ifcModelGenerator'
import { fileProcessor } from '@/services/fileProcessor'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 100MB.' },
        { status: 400 }
      )
    }

    // Initialize real local storage
    await realLocalStorage.init()

    // Read file data for storage
    const fileData = await file.arrayBuffer()
    
    // Process the file using real file processor
    const processedModel = await fileProcessor.processFile(file)
    
    if (processedModel.status === 'error') {
      return NextResponse.json(
        { error: processedModel.error },
        { status: 400 }
      )
    }

    // Check if this is a DWG file that needs conversion
    if (processedModel.fileType === 'AutoCAD' && file.name.toLowerCase().endsWith('.dwg')) {
      return NextResponse.json(
        { 
          error: 'DWG_CONVERSION_REQUIRED',
          message: 'DWG files require conversion to DXF format for full processing.',
          conversionInstructions: {
            title: 'Convert DWG to DXF',
            methods: [
              {
                name: 'AutoCAD',
                steps: ['Open DWG file', 'File > Save As', 'Choose DXF format', 'Save']
              },
              {
                name: 'Online Converter',
                steps: ['Visit cloudconvert.com', 'Upload DWG file', 'Select DXF output', 'Download']
              },
              {
                name: 'Free Software',
                steps: ['Download LibreCAD or FreeCAD', 'Open DWG file', 'Export as DXF']
              }
            ],
            benefits: [
              'Better layer recognition',
              'Faster processing',
              'More accurate 3D reconstruction',
              'Full architectural element detection'
            ]
          }
        },
        { status: 400 }
      )
    }

    // Store file in local storage
    await realLocalStorage.storeFile({
      id: processedModel.id,
      name: file.name,
      size: file.size,
      type: file.type,
      data: fileData,
      uploadDate: new Date().toISOString()
    })

    // Create project in local storage
    const project: StoredProject = {
      id: processedModel.id,
      name: file.name.replace(/\.[^/.]+$/, ''),
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      fileData: fileData,
      cadData: processedModel.layers,
      floorPlanElements: processedModel.floorPlanElements || [],
      rooms: [],
      ifcModel: processedModel.ifcModel,
      ifcFile: null,
      processingStats: {
        totalElements: processedModel.layers?.length || 0,
        processingTime: Date.now(),
        fileType: processedModel.fileType
      },
      agentParameters: {
        wallHeight: 2.4,
        doorHeight: 2.1,
        windowHeight: 1.5,
        windowSillHeight: 0.9,
        ceilingHeight: 2.7,
        floorThickness: 0.1
      },
      status: 'completed'
    }

    // Generate IFC file if model exists
    if (processedModel.ifcModel) {
      const ifcGenerator = new IFCModelGenerator()
      project.ifcFile = ifcGenerator.generateIFCFile(processedModel.ifcModel)
    }

    // Store project in local storage
    await realLocalStorage.storeProject(project)

    // Return the processed model
    const responseModel = {
      id: project.id,
      name: project.name,
      fileName: project.fileName,
      fileSize: project.fileSize,
      uploadDate: project.uploadDate,
      layers: processedModel.layers,
      elements: processedModel.floorPlanElements,
      rooms: project.rooms,
      stats: project.processingStats,
      cadData: project.cadData,
      ifcModel: project.ifcModel,
      ifcFile: project.ifcFile
    }

    return NextResponse.json(responseModel)
  } catch (error) {
    console.error('File processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: 'File processing API is running' })
}
