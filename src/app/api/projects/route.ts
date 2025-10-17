import { NextRequest, NextResponse } from 'next/server'
import { realLocalStorage } from '@/services/realLocalStorage'

export async function GET() {
  try {
    await realLocalStorage.init()
    const projects = await realLocalStorage.getAllProjects()
    
    // Return projects without file data to reduce response size
    const projectsList = projects.map(project => ({
      id: project.id,
      name: project.name,
      fileName: project.fileName,
      fileSize: project.fileSize,
      uploadDate: project.uploadDate,
      status: project.status,
      processingStats: project.processingStats,
      hasIFCModel: !!project.ifcModel,
      hasIFCFile: !!project.ifcFile
    }))
    
    return NextResponse.json(projectsList)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('id')
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }
    
    await realLocalStorage.init()
    await realLocalStorage.deleteProject(projectId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
