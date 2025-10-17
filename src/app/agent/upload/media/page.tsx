'use client'

import { PhotoIcon, FilmIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, DocumentIcon } from '@heroicons/react/24/outline'
import { useCallback, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { useWizardDataProtection } from '@/hooks/useWizardDataProtection'
import WizardWarningModal from '@/components/WizardWarningModal'

// Images
type ImageItem = { file?: File | null; url: string; isCover?: boolean }
// Videos
type VideoItem = { file?: File | null; url: string }
// Floor Plans
type FloorPlanItem = { file?: File | null; url: string; name: string }

export default function AgentUploadMediaPage() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [floorPlans, setFloorPlans] = useState<FloorPlanItem[]>([])
  const [showValidation, setShowValidation] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  
  // Hide validation when images are uploaded
  useEffect(() => {
    if (images.length > 0 && showValidation) {
      setShowValidation(false)
    }
  }, [images.length, showValidation])
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const floorPlanInputRef = useRef<HTMLInputElement | null>(null)

  const { token } = useAuth()
  const router = useRouter()

  // Check if there's unsaved data
  const hasUnsavedData = Boolean(
    images.length > 0 || 
    videos.length > 0 || 
    floorPlans.length > 0
  )

  // Data protection
  const { 
    showWarningModal, 
    protectedRouterPush, 
    handleConfirmLeave, 
    handleCancelLeave 
  } = useWizardDataProtection({
    hasUnsavedData,
    onConfirmLeave: () => {
      // Clear all wizard data when leaving
      sessionStorage.removeItem('agent:uploadStep1')
      sessionStorage.removeItem('agent:uploadStep2')
      sessionStorage.removeItem('agent:uploadStep3')
      sessionStorage.removeItem('agent:reviewDraft')
      sessionStorage.removeItem('agent:editorChanges')
    },
    onCancelLeave: () => {
      // Stay on the page
    }
  })

  const addImages = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    
    for (const file of imageFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          const result = await response.json()
          setImages(prev => [...prev, { file, url: result.url, isCover: false }])
        } else {
          console.error('Failed to upload image:', file.name)
        }
      } catch (error) {
        console.error('Error uploading image:', error)
      }
    }
  }
  const removeImageAt = (idx: number) => {
    setImages(prev => {
      const copy = [...prev]
      copy.splice(idx, 1)
      return copy
    })
  }

  const addVideos = async (files: FileList | File[]) => {
    const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'))
    
    for (const file of videoFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          const result = await response.json()
          setVideos(prev => [...prev, { file, url: result.url }])
        } else {
          console.error('Failed to upload video:', file.name)
        }
      } catch (error) {
        console.error('Error uploading video:', error)
      }
    }
  }
  const removeVideoAt = (idx: number) => {
    setVideos(prev => {
      const copy = [...prev]
      copy.splice(idx, 1)
      return copy
    })
  }

  const addFloorPlans = async (files: FileList | File[]) => {
    const floorPlanFiles = Array.from(files).filter(f => 
      f.type === 'application/pdf' || f.type.startsWith('image/')
    )
    
    for (const file of floorPlanFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log('Floor plan upload result:', result)
          setFloorPlans(prev => [...prev, { 
            file, 
            url: result.url, 
            name: file.name 
          }])
        } else {
          console.error('Failed to upload floor plan:', file.name)
        }
      } catch (error) {
        console.error('Error uploading floor plan:', error)
      }
    }
  }

  const removeFloorPlanAt = (idx: number) => {
    setFloorPlans(prev => {
      const copy = [...prev]
      copy.splice(idx, 1)
      return copy
    })
  }

  const setCoverImage = (idx: number) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      isCover: i === idx
    })))
  }

  const onCardKeyDown = (e: React.KeyboardEvent, open: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }
  
  // Helper to turn stored path into a usable URL
  const toAbsolute = useCallback((url: string) => {
    return url?.startsWith('http')
      ? url
      : `/api/files/binary?path=${encodeURIComponent(url)}`
  }, [])

  // Modal/lightbox viewer state
  type Viewer = { type: 'image' | 'video'; index: number; isFloorPlan?: boolean } | null
  const [viewer, setViewer] = useState<Viewer>(null)

  const closeViewer = useCallback(() => setViewer(null), [])

  const nextViewer = useCallback(() => {
    if (!viewer) return
    const list = viewer.type === 'image' ? images : videos
    if (!list.length) return
    setViewer({ type: viewer.type, index: (viewer.index + 1) % list.length })
  }, [viewer, images, videos])

  const prevViewer = useCallback(() => {
    if (!viewer) return
    const list = viewer.type === 'image' ? images : videos
    if (!list.length) return
    setViewer({
      type: viewer.type,
      index: (viewer.index - 1 + list.length) % list.length,
    })
  }, [viewer, images, videos])

  // Keyboard + scroll lock while viewer is open
  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeViewer(); return }
      // Allow native seeking for videos; only hijack arrows for images
      if (viewer.type === 'image') {
        if (e.key === 'ArrowRight') { e.preventDefault(); nextViewer() }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); prevViewer() }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [viewer, closeViewer, nextViewer, prevViewer])

  // Save media data and navigate to next step
  const goTo3DStep = useCallback(() => {
    // Validate that at least one image is uploaded
    if (images.length === 0) {
      setShowValidation(true)
      return
    }
    
    // Hide validation if requirements are met
    setShowValidation(false)

    // Auto-set first image as cover if no cover is selected
    let processedImages = [...images]
    const hasCoverImage = images.some(img => img.isCover)
    
    if (!hasCoverImage && images.length > 0) {
      processedImages = images.map((img, idx) => ({
        ...img,
        isCover: idx === 0
      }))
    }
    
    const STORAGE_KEY = 'agent:uploadStep2'
    const step2Data = {
      images: processedImages,
      videos,
      floorPlans,
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(step2Data))
    } catch {
      /* ignore storage errors */
    }
    router.push('/agent/upload/3d')
  }, [images, videos, floorPlans, router])

  // Go back to details step
  const goBackToDetails = useCallback(() => {
    router.push('/agent/upload/details')
  }, [router])

  // Load media data from session storage
  useEffect(() => {
    try {
      // Check if a listing was recently published
      const wasPublished = sessionStorage.getItem('agent:published')
      if (wasPublished) {
        // Clear all data and start fresh
        sessionStorage.removeItem('agent:uploadStep1')
        sessionStorage.removeItem('agent:uploadStep2')
        sessionStorage.removeItem('agent:uploadStep3')
        sessionStorage.removeItem('agent:reviewDraft')
        sessionStorage.removeItem('agent:editorChanges')
        sessionStorage.removeItem('agent:published')
        return
      }
      
        // Otherwise, restore from sessionStorage
        const raw = sessionStorage.getItem('agent:uploadStep2')
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (parsed.images) setImages(parsed.images)
        if (parsed.videos) setVideos(parsed.videos)
        if (parsed.floorPlans) setFloorPlans(parsed.floorPlans)
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary">
      {/* Step Indicator */}
      <div className="border-b border-[color:var(--surface-border)] bg-[color:var(--surface-1)]">
        <div className="container py-6">
          <div className="flex items-center justify-center space-x-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                    step <= 2
                      ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)] text-white'
                      : 'border-[color:var(--surface-border)] bg-[color:var(--surface-1)] text-muted'
                  }`}
                >
                  {step}
                </div>
                <div className="ml-3 text-sm">
                  <p className={`font-medium ${step <= 2 ? 'text-primary' : 'text-muted'}`}>
                    {step === 1 ? 'Property Details' : step === 2 ? 'Media Upload' : '3D Pipeline'}
                  </p>
                </div>
                {step < 3 && (
                  <div className={`ml-8 h-px w-16 ${step < 2 ? 'bg-[color:var(--accent-500)]' : 'bg-[color:var(--surface-border)]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 2: Media Upload */}
      <div className="container space-y-8 py-8">
        <header className="space-y-3 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-4 py-2 text-xs uppercase tracking-[0.4em] text-muted">
            <PhotoIcon className="h-4 w-4" /> Step 2: Media Upload
          </div>
          <h2 className="headline text-3xl">Add photos, videos & floor plans</h2>
          <p className="mx-auto max-w-2xl text-sm text-muted">
            Upload multiple images, short clips, and floor plans to showcase the property.
          </p>
        </header>

        <section className="surface-soft p-8 rounded-2xl border border-[color:var(--surface-border)] space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Images uploader */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-secondary flex items-center gap-2">
                <PhotoIcon className="h-5 w-5 text-muted" /> Photos
              </p>
              <div
                className="rounded-xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-5 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files?.length) addImages(e.dataTransfer.files)
                }}
              >
                <p className="text-sm text-secondary">Drag & drop images here</p>
                <p className="text-xs text-muted">or</p>
                <button type="button" className="btn btn-secondary" onClick={() => imageInputRef.current?.click()}>
                  Select images
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addImages(e.target.files)
                    e.currentTarget.value = ''
                  }}
                />
              </div>

              {images.length > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.map((m, idx) => {
                        return (
                          <div
                            key={m.url}
                            role="button"
                            tabIndex={0}
                            aria-label="Open image"
                            onClick={() => setViewer({ type: 'image', index: idx })}
                            onKeyDown={(e) => onCardKeyDown(e, () => setViewer({ type: 'image', index: idx }))}
                            className="relative group overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)] cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={toAbsolute(m.url)}
                              alt={m.file?.name || 'Listing image'}
                              className="h-32 w-full object-cover"
                              loading="lazy"
                            />
                            
                            {/* Cover image indicator */}
                            {m.isCover && (
                              <div className="absolute left-2 top-2 inline-flex items-center rounded-full bg-[color:var(--accent-500)] px-2 py-1 text-xs font-medium text-white">
                                ✓ Cover Image
                              </div>
                            )}
                            
                            {/* Cover selection button - always visible */}
                            {!m.isCover && (
                              <button
                                type="button"
                                className="absolute left-2 top-2 inline-flex items-center rounded-full bg-[color:var(--accent-500)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--accent-600)] transition-colors"
                                onClick={(e) => { e.stopPropagation(); setCoverImage(idx) }}
                                aria-label="Set as cover image"
                                title="Set as cover image"
                              >
                                Set as Cover
                              </button>
                            )}
                            
                            {/* Action buttons */}
                            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                className="inline-flex items-center rounded-full bg-black/50 p-1.5 text-white"
                                onClick={(e) => { e.stopPropagation(); removeImageAt(idx) }}
                                aria-label="Remove image"
                                title="Remove image"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                    })}
                  </div>
                </div>
              )}
              
              {/* Validation Message for Images */}
              {showValidation && (
                <p className="mt-1 text-xs text-red-500">
                  Please upload at least one image before continuing.
                </p>
              )}
            </div>

            {/* Videos uploader */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-secondary flex items-center gap-2">
                <FilmIcon className="h-5 w-5 text-muted" /> Videos
              </p>
              <div
                className="rounded-xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-5 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files?.length) addVideos(e.dataTransfer.files)
                }}
              >
                <p className="text-sm text-secondary">Drag & drop videos here</p>
                <p className="text-xs text-muted">or</p>
                <button type="button" className="btn btn-secondary" onClick={() => videoInputRef.current?.click()}>
                  Select videos
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addVideos(e.target.files)
                    e.currentTarget.value = ''
                  }}
                />
              </div>

              {videos.length > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {videos.map((v, idx) => {
                        return (
                          <div
                            key={v.url}
                            role="button"
                            tabIndex={0}
                            aria-label="Open video"
                            onClick={() => setViewer({ type: 'video', index: idx })}
                            onKeyDown={(e) => onCardKeyDown(e, () => setViewer({ type: 'video', index: idx }))}
                            className="relative group overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]"
                          >
                            <video
                              className="h-32 w-full object-cover"
                              src={toAbsolute(v.url)}
                              preload="metadata"
                              muted
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-2 inline-flex items-center rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); removeVideoAt(idx) }}
                              aria-label="Remove video"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {/* Floor Plans uploader */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-secondary flex items-center gap-2">
                <DocumentIcon className="h-5 w-5 text-muted" /> Floor Plans
              </p>
              <div
                className="rounded-xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-5 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files?.length) addFloorPlans(e.dataTransfer.files)
                }}
              >
                <p className="text-sm text-secondary">Drag & drop floor plans here</p>
                <p className="text-xs text-muted">PDF or JPG files</p>
                <p className="text-xs text-muted">or</p>
                <button type="button" className="btn btn-secondary" onClick={() => floorPlanInputRef.current?.click()}>
                  Select floor plans
                </button>
                <input
                  ref={floorPlanInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addFloorPlans(e.target.files)
                    e.currentTarget.value = ''
                  }}
                />
              </div>

              {floorPlans.length > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {floorPlans.map((fp, idx) => {
                        const isPdf = fp.file?.type === 'application/pdf' || fp.url.includes('.pdf')
                        const isImage = !isPdf

                        const handleFloorPlanClick = () => {
                          if (isImage) {
                            // For images, open in viewer with floor plan flag
                            setViewer({ type: 'image', index: 0, isFloorPlan: true })
                          } else {
                            // For PDFs, open in embedded viewer
                            setViewer({ type: 'image', index: 0, isFloorPlan: true })
                          }
                        }

                        return (
                          <div
                            key={fp.url}
                            className={`relative group overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-4 ${
                              isImage ? 'cursor-pointer hover:bg-[color:var(--surface-2)] transition-colors' : 'cursor-pointer hover:bg-[color:var(--surface-2)] transition-colors'
                            }`}
                            onClick={handleFloorPlanClick}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleFloorPlanClick()
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[color:var(--surface-border)]">
                                {isPdf ? (
                                  <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-secondary truncate" title={fp.name}>
                                    {fp.name}
                                  </p>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isPdf 
                                      ? 'bg-[color:var(--accent-500)]/10 text-[color:var(--accent-500)]' 
                                      : 'bg-[color:var(--accent-500)]/10 text-[color:var(--accent-500)]'
                                  }`}>
                                    {isPdf ? 'PDF' : 'Image'}
                                  </span>
                                </div>
                                <p className="text-xs text-muted">
                                  {isPdf ? 'PDF Document' : 'Image File'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="btn btn-primary text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleFloorPlanClick()
                                  }}
                                >
                                  Open
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center rounded-full bg-red-500/10 p-1.5 text-red-500 opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(e) => { e.stopPropagation(); removeFloorPlanAt(idx) }}
                                  aria-label="Remove floor plan"
                                  title="Remove floor plan"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Step 2 Navigation */}
        <div className="flex justify-between">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={goBackToDetails}
          >
            Back to Details
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={goTo3DStep}
          >
            Continue
          </button>
        </div>
      </div>

      {/* Media viewer modal (minimal) */}
      {viewer && (() => {
        let list, current, src
        
        if (viewer.isFloorPlan) {
          // Handle floor plan images and PDFs
          list = floorPlans
          current = floorPlans[viewer.index]
          src = current ? toAbsolute(current.url) : ''
        } else {
          // Handle regular images and videos
          list = viewer.type === 'image' ? images : videos
          current = list[viewer.index]
          src = current ? toAbsolute(current.url) : ''
        }

        const isPdf = current && (current.file?.type === 'application/pdf' || current.url.includes('.pdf'))

        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            onClick={closeViewer}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-6xl rounded"
              onClick={(e) => e.stopPropagation()}
            >
              {isPdf ? (
                // PDF viewer with fallback
                <div className="w-full h-full">
                  <iframe
                    src={`${src}#toolbar=0&navpanes=0&scrollbar=1&zoom=FitH`}
                    className="mx-auto max-h-[90vh] w-full max-w-full rounded"
                    title="PDF Viewer"
                    onError={() => {
                      // Fallback: open in new tab if iframe fails
                      window.open(src, '_blank')
                    }}
                  />
                </div>
              ) : viewer.type === 'image' ? (
                // Image viewer
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="mx-auto max-h-[90vh] w-auto max-w-full object-contain rounded-2xl"
                />
              ) : (
                // Video viewer
                <video
                  src={src}
                  className="mx-auto max-h-[90vh] w-auto max-w-full"
                  controls
                  autoPlay
                />
              )}

              {/* Close (icon only) */}
              <button
                type="button"
                onClick={closeViewer}
                aria-label="Close viewer"
                className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white
                          hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              {/* Bottom navigation (only if multiple media) */}
              {list.length > 1 && (
                <div className="absolute inset-x-0 bottom-3 flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-2 py-1">
                    <button
                      type="button"
                      onClick={prevViewer}
                      aria-label="Previous"
                      className="rounded-full p-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={nextViewer}
                      aria-label="Next"
                      className="rounded-full p-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )
      })()}

      {/* Warning Modal */}
      <WizardWarningModal
        isOpen={showWarningModal}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
    </div>
  )
}
