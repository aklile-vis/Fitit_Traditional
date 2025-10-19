'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CloudArrowUpIcon,
  DocumentIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  ArrowLeftIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  status: 'uploading' | 'processing' | 'success' | 'error'
  progress: number
  error?: string
}

interface ParsedElement {
  id?: string
  type?: string
  [key: string]: unknown
}

interface ProcessedModel {
  id: string
  name: string
  elements: ParsedElement[]
  rooms: ParsedElement[]
  stats: Record<string, unknown>
}

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

function formatBytes(size: number) {
  if (!size) return '0 B'
  const i = Math.floor(Math.log(size) / Math.log(1024))
  const value = size / Math.pow(1024, i)
  const unit = ['B', 'KB', 'MB', 'GB', 'TB'][i] || 'B'
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${unit}`
}

export default function SimpleUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedModel, setProcessedModel] = useState<ProcessedModel | null>(null)
  const [processingStep, setProcessingStep] = useState('')
  const [processingProgress, setProcessingProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uploadLimitLabel = formatBytes(MAX_UPLOAD_SIZE)

  const handleFileUpload = useCallback((selectedFiles: FileList) => {
    const next: UploadedFile[] = []
    let rejectedName: string | null = null

    Array.from(selectedFiles).forEach((file) => {
      if (file.size > MAX_UPLOAD_SIZE) {
        rejectedName = rejectedName ?? file.name
        return
      }
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        file,
        status: 'uploading',
        progress: 0,
      })
    })

    if (rejectedName) {
      setError(`"${rejectedName}" is larger than the ${uploadLimitLabel} limit. Please upload a smaller bundle.`)
    } else {
      setError(null)
    }

    setFiles(next)
  }, [uploadLimitLabel])

  const processFiles = async () => {
    if (files.length === 0) return

    const fileEntry = files[0]
    const fileId = fileEntry.id
    const sourceFile = fileEntry.file

    setIsProcessing(true)
    setProcessingStep('Uploading file...')
    setProcessingProgress(10)

    try {
      // Step 1: Upload file
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'processing', progress: 20 }
          : f
      ))

      const formData = new FormData()
      formData.append('file', sourceFile)

      // Upload file using robust backend
      const uploadResponse = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      const uploadData = await uploadResponse.json()
      console.log('Upload result:', uploadData)

      // Yield control to browser
      await new Promise(resolve => setTimeout(resolve, 200))

      // Step 2: Process file
      setProcessingStep('Processing CAD file...')
      setProcessingProgress(30)
      
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'processing', progress: 40 }
          : f
      ))

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

      // Yield control to browser
      await new Promise(resolve => setTimeout(resolve, 200))

      // Step 3: Parse results
      setProcessingStep('Parsing CAD data...')
      setProcessingProgress(50)
      
      const processResult = await response.json()
      console.log('Processing result:', processResult)

      // Yield control to browser
      await new Promise(resolve => setTimeout(resolve, 200))

      // Step 4: Create processed model
      setProcessingStep('Creating 3D model...')
      setProcessingProgress(70)
      
      const elements: ParsedElement[] = Array.isArray(processResult.elements) ? processResult.elements : []
      const statistics: Record<string, unknown> = (processResult.statistics && typeof processResult.statistics === 'object') ? processResult.statistics as Record<string, unknown> : {}
      
      // Yield control to browser for large files
      if (elements.length > 100) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      const processedModel: ProcessedModel = {
        id: fileId,
        name: fileEntry.name,
        elements,
        rooms: elements.filter((element) => element.type === 'space'),
        stats: {
          totalElements: Number((statistics as any).total_entities) || 0,
          totalLayers: Number((statistics as any).total_layers) || 0,
          wallCount: Number((statistics as any).element_counts?.wall) || 0,
          doorCount: Number((statistics as any).element_counts?.door) || 0,
          windowCount: Number((statistics as any).element_counts?.window) || 0,
          roomCount: Number((statistics as any).element_counts?.space) || 0
        }
      }

      // Yield control to browser
      await new Promise(resolve => setTimeout(resolve, 200))

      // Step 5: Complete
      setProcessingStep('Complete!')
      setProcessingProgress(100)
      
      setProcessedModel(processedModel)
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'success', progress: 100 }
          : f
      ))

      // Optional: Open GLB viewer in new tab if available
      const token = localStorage.getItem('agent_token') || ''
      if (processResult.glbPath) {
        const url = `/agent/glb-viewer?src=${encodeURIComponent(processResult.glbPath)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
        window.open(url, '_blank')
      }

      // Auto-hide processing indicator after 3 seconds
      setTimeout(() => {
        setIsProcessing(false)
        setProcessingStep('')
      }, 3000)
      
    } catch (error) {
      console.error('Processing failed:', error)
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'error', error: 'Processing failed' }
          : f
      ))
      setIsProcessing(false)
      setProcessingStep('')
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFileUpload(droppedFiles)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileUpload(selectedFiles)
    }
  }, [handleFileUpload])

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const canProcess = files.length > 0 && files.every(f => f.status === 'uploading' || f.status === 'success')

  return (
    <div className="min-h-screen bg-[color:var(--app-background)]">
      {/* Header */}
      <div className="surface-header border-b border-surface">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/agent/my-listings')}
                className="rounded-full border border-surface bg-surface-1 p-2 text-secondary transition-colors hover:border-surface-strong hover:bg-surface-hover hover:text-primary"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-primary">Upload Design Files</h1>
                <p className="text-sm text-muted">Upload drawings or 3D models for processing</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Upload Area */}
        {error && (
          <div className="mb-4 rounded-xl border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 px-4 py-3 text-sm text-secondary">
            {error}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
              isDragOver
                ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/12'
                : 'border-surface hover:border-surface-strong'
            }`}
          >
            <CloudArrowUpIcon className="mb-4 mx-auto h-12 w-12 text-[color:var(--accent-500)]" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-primary">
                Drop IFC / CAD / 3D files here, or click to browse
              </p>
              <p className="text-sm text-muted">
                Supports IFC, RVT, DXF/DWG, GLB/GLTF, OBJ/FBX/BLEND, SKP, and ZIP bundles up to {uploadLimitLabel} per file
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ifc,.ifcxml,.rvt,.dxf,.dwg,.glb,.gltf,.obj,.fbx,.skp,.blend,.zip"
              multiple
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </motion.div>

        {/* File List */}
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h3 className="text-primary text-lg font-medium mb-4">Uploaded Files</h3>
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="surface-soft border border-surface p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <DocumentIcon className="h-8 w-8 text-[color:var(--accent-500)]" />
                      <div>
                        <p className="font-medium text-primary">{file.name}</p>
                        <p className="text-sm text-muted">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {file.status === 'success' && (
                        <CheckCircleIcon className="h-6 w-6 text-[color:var(--success-500)]" />
                      )}
                      {file.status === 'error' && (
                        <ExclamationTriangleIcon className="h-6 w-6 text-[color:var(--danger-500)]" />
                      )}
                      {file.status === 'processing' && (
                        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[color:var(--accent-500)]"></div>
                      )}
                      
                      <button
                        onClick={() => removeFile(file.id)}
                        className="text-muted transition-colors hover:text-[color:var(--danger-500)]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  
                  {file.status === 'processing' && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-sm text-muted">
                        <span>{processingStep}</span>
                        <span>{processingProgress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-2">
                        <div
                          className="h-2 rounded-full bg-[color:var(--accent-500)] transition-all duration-300"
                          style={{ width: `${processingProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {file.error && (
                    <div className="mt-3 text-sm text-[color:var(--danger-500)]">
                      {file.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Process Button */}
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-4"
          >
            {files.some(f => f.status === 'success') ? (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    if (processedModel) {
                      localStorage.setItem('latestProcessedModel', JSON.stringify(processedModel))
                      router.push('/agent/viewer')
                    }
                  }}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <EyeIcon className="h-5 w-5" />
                  <span>View 3D Model</span>
                </button>
                <button
                  onClick={() => router.push('/agent/my-listings')}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  <span>Publish to Listings</span>
                </button>
              </div>
            ) : (
              <button
                onClick={processFiles}
                disabled={!canProcess || isProcessing}
                className="btn btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[rgba(255,255,255,0.85)]"></div>
                    <span>{processingStep || 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <Cog6ToothIcon className="h-5 w-5" />
                    <span>Process Files</span>
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-soft border border-surface p-6"
          >
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[color:var(--accent-500)]"></div>
              <h3 className="mb-2 text-lg font-medium text-primary">{processingStep}</h3>
              <p className="mb-4 text-sm text-muted">
                Processing your CAD file... This may take a moment for large files.
              </p>
              <div className="h-3 w-full rounded-full bg-surface-2">
                <div
                  className="h-3 rounded-full bg-[color:var(--accent-500)] transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-muted">{processingProgress}% complete</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
