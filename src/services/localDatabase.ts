// Local Database for storing processed CAD data
import { FloorPlanElement, RoomDefinition, AgentParameters } from './floorPlanAnalyzer'
import { ParsedCADData } from './realCADParser'

export interface StoredProject {
  id: string
  name: string
  fileName: string
  fileSize: number
  uploadDate: Date
  agentParams: AgentParameters
  cadData: ParsedCADData
  floorPlanElements: FloorPlanElement[]
  rooms: RoomDefinition[]
  processingStats: {
    totalElements: number
    ruleBasedProcessed: number
    aiProcessed: number
    processingTime: number
    estimatedCost: number
  }
  status: 'processing' | 'completed' | 'error'
  error?: string
}

export interface DatabaseStats {
  totalProjects: number
  totalElements: number
  totalProcessingTime: number
  totalCost: number
  averageConfidence: number
}

export class LocalDatabase {
  private projects: Map<string, StoredProject> = new Map()
  private storageKey = 'cad_processing_database'

  constructor() {
    this.loadFromStorage()
  }

  async saveProject(project: StoredProject): Promise<void> {
    this.projects.set(project.id, project)
    this.saveToStorage()
  }

  async getProject(id: string): Promise<StoredProject | null> {
    return this.projects.get(id) || null
  }

  async getAllProjects(): Promise<StoredProject[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      b.uploadDate.getTime() - a.uploadDate.getTime()
    )
  }

  async updateProject(id: string, updates: Partial<StoredProject>): Promise<void> {
    const project = this.projects.get(id)
    if (project) {
      const updatedProject = { ...project, ...updates }
      this.projects.set(id, updatedProject)
      this.saveToStorage()
    }
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id)
    this.saveToStorage()
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    const projects = Array.from(this.projects.values())
    
    const totalProjects = projects.length
    const totalElements = projects.reduce((sum, p) => sum + p.processingStats.totalElements, 0)
    const totalProcessingTime = projects.reduce((sum, p) => sum + p.processingStats.processingTime, 0)
    const totalCost = projects.reduce((sum, p) => sum + p.processingStats.estimatedCost, 0)
    
    const allElements = projects.flatMap(p => p.floorPlanElements)
    const averageConfidence = allElements.length > 0 
      ? allElements.reduce((sum, e) => sum + (e.properties.confidence || 0), 0) / allElements.length
      : 0

    return {
      totalProjects,
      totalElements,
      totalProcessingTime,
      totalCost,
      averageConfidence
    }
  }

  async searchProjects(query: string): Promise<StoredProject[]> {
    const projects = Array.from(this.projects.values())
    const lowerQuery = query.toLowerCase()
    
    return projects.filter(project => 
      project.name.toLowerCase().includes(lowerQuery) ||
      project.fileName.toLowerCase().includes(lowerQuery) ||
      project.status.toLowerCase().includes(lowerQuery)
    )
  }

  async getProjectsByStatus(status: StoredProject['status']): Promise<StoredProject[]> {
    return Array.from(this.projects.values()).filter(p => p.status === status)
  }

  async getRecentProjects(limit: number = 10): Promise<StoredProject[]> {
    return Array.from(this.projects.values())
      .sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime())
      .slice(0, limit)
  }

  async clearDatabase(): Promise<void> {
    this.projects.clear()
    this.saveToStorage()
  }

  async exportProject(id: string): Promise<string> {
    const project = this.projects.get(id)
    if (!project) {
      throw new Error('Project not found')
    }

    return JSON.stringify(project, null, 2)
  }

  async importProject(projectData: string): Promise<string> {
    try {
      const project = JSON.parse(projectData) as StoredProject
      
      // Validate project data
      if (!project.id || !project.name || !project.fileName) {
        throw new Error('Invalid project data')
      }

      // Generate new ID to avoid conflicts
      const newId = this.generateId()
      project.id = newId
      project.uploadDate = new Date()

      await this.saveProject(project)
      return newId
    } catch (error) {
      throw new Error(`Failed to import project: ${error}`)
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        this.projects = new Map(data.projects || [])
        
        // Convert date strings back to Date objects
        this.projects.forEach(project => {
          project.uploadDate = new Date(project.uploadDate)
        })
      }
    } catch (error) {
      console.error('Failed to load database from storage:', error)
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        projects: Array.from(this.projects.entries()),
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save database to storage:', error)
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  }

  // Utility methods for project management
  async createProject(
    fileName: string,
    fileSize: number,
    cadData: ParsedCADData,
    agentParams: AgentParameters
  ): Promise<string> {
    const projectId = this.generateId()
    const project: StoredProject = {
      id: projectId,
      name: fileName.replace(/\.[^/.]+$/, ''), // Remove file extension
      fileName,
      fileSize,
      uploadDate: new Date(),
      agentParams,
      cadData,
      floorPlanElements: [],
      rooms: [],
      processingStats: {
        totalElements: 0,
        ruleBasedProcessed: 0,
        aiProcessed: 0,
        processingTime: 0,
        estimatedCost: 0
      },
      status: 'processing'
    }

    await this.saveProject(project)
    return projectId
  }

  async updateProcessingResults(
    projectId: string,
    floorPlanElements: FloorPlanElement[],
    rooms: RoomDefinition[],
    processingStats: StoredProject['processingStats']
  ): Promise<void> {
    await this.updateProject(projectId, {
      floorPlanElements,
      rooms,
      processingStats,
      status: 'completed'
    })
  }

  async markProjectError(projectId: string, error: string): Promise<void> {
    await this.updateProject(projectId, {
      status: 'error',
      error
    })
  }

  // Cleanup methods
  async cleanupOldProjects(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    
    let deletedCount = 0
    for (const [id, project] of this.projects.entries()) {
      if (project.uploadDate < cutoffDate) {
        this.projects.delete(id)
        deletedCount++
      }
    }
    
    if (deletedCount > 0) {
      this.saveToStorage()
    }
    
    return deletedCount
  }

  async getStorageSize(): Promise<number> {
    const data = localStorage.getItem(this.storageKey)
    return data ? new Blob([data]).size : 0
  }

  async getStorageInfo(): Promise<{
    used: number
    available: number
    projects: number
  }> {
    const used = await this.getStorageSize()
    const projects = this.projects.size
    
    // Estimate available storage (this is approximate)
    let available = 0
    try {
      // Try to store a test string to estimate available space
      const testData = 'x'.repeat(1024 * 1024) // 1MB test
      localStorage.setItem('test', testData)
      localStorage.removeItem('test')
      available = 5 * 1024 * 1024 * 1024 // Assume 5GB available (this is not accurate)
    } catch {
      available = 0
    }

    return { used, available, projects }
  }
}

// Export singleton instance
export const localDatabase = new LocalDatabase()

