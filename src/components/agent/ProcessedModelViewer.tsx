'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  PaintBrushIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

import { ProcessedModel } from '@/services/fileProcessor'

interface ProcessedModelViewerProps {
  model: ProcessedModel
  onMaterialChange?: (layerId: string, materialId: string) => void
  onLayerToggle?: (layerId: string, visible: boolean) => void
}

export default function ProcessedModelViewer({ 
  model, 
  onMaterialChange: _onMaterialChange, 
  onLayerToggle 
}: ProcessedModelViewerProps) {
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set((model?.layers || []).map(l => l.id))
  )

  // Safety check for model
  if (!model) {
    return (
      <div className="surface-soft border border-surface p-6">
        <div className="text-center text-secondary">
          <p>No model data available</p>
        </div>
      </div>
    )
  }

  // Show loading state if still processing
  if (model.status === 'processing') {
    return (
      <div className="surface-soft border border-surface p-6">
        <div className="text-center text-secondary">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[color:var(--accent-500)]"></div>
          <p>Processing model...</p>
        </div>
      </div>
    )
  }

  const getLayerTypeColor = (type: string): string => {
    const colors = {
      wall: 'bg-[rgba(198,138,63,0.18)] text-[#8f5c2a] border-[rgba(198,138,63,0.38)]',
      floor: 'bg-[rgba(122,75,46,0.18)] text-[#5c351c] border-[rgba(122,75,46,0.38)]',
      ceiling: 'bg-[rgba(173,117,53,0.18)] text-[#704522] border-[rgba(173,117,53,0.38)]',
      door: 'bg-[rgba(157,104,64,0.18)] text-[#6d4222] border-[rgba(157,104,64,0.36)]',
      window: 'bg-[rgba(210,186,162,0.28)] text-[#725335] border-[rgba(210,186,162,0.45)]',
      cabinet: 'bg-[rgba(138,90,50,0.18)] text-[#704522] border-[rgba(138,90,50,0.36)]',
      fixture: 'bg-[rgba(212,155,45,0.2)] text-[#805511] border-[rgba(212,155,45,0.38)]',
      furniture: 'bg-[rgba(98,59,36,0.2)] text-[#4f301c] border-[rgba(98,59,36,0.4)]',
      lighting: 'bg-[rgba(212,155,45,0.2)] text-[#805511] border-[rgba(212,155,45,0.38)]',
      unknown: 'bg-[rgba(107,114,128,0.18)] text-[#374151] border-[rgba(107,114,128,0.35)]'
    } as const

    return colors[type as keyof typeof colors] || colors.unknown
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-400'
    if (confidence >= 0.6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.8) return 'High'
    if (confidence >= 0.6) return 'Medium'
    return 'Low'
  }

  const handleLayerToggle = (layerId: string) => {
    const newVisibleLayers = new Set(visibleLayers)
    if (newVisibleLayers.has(layerId)) {
      newVisibleLayers.delete(layerId)
    } else {
      newVisibleLayers.add(layerId)
    }
    setVisibleLayers(newVisibleLayers)
    onLayerToggle?.(layerId, newVisibleLayers.has(layerId))
  }

  // const handleMaterialChange = (layerId: string, materialId: string) => {
  //   onMaterialChange?.(layerId, materialId)
  // }

  const getMaterialForLayer = (layerId: string): string => {
    const mapping = (model.materials || []).find(m => m.layerId === layerId)
    return mapping?.materialId || 'No material assigned'
  }

  return (
    <div className="surface-soft border border-surface overflow-hidden">
      <div className="border-b border-surface px-6 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-primary">{model.name}</h2>
            <p className="text-sm text-muted">{model.fileType || 'Unknown'} • {(model.layers || []).length} layers</p>
          </div>
          <div className="flex items-center gap-2 text-[color:var(--success-500)]">
            <CheckCircleIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Processed</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
          <div>
            <div className="text-2xl font-semibold text-primary">{(model.layers || []).length}</div>
            <div className="text-xs uppercase tracking-wide text-muted">Layers</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-primary">
              {(model.materials || []).filter(m => m.suggested).length}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted">Materials</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-primary">
              {Math.round((model.layers || []).reduce((acc, layer) => acc + layer.confidence, 0) / Math.max((model.layers || []).length, 1) * 100)}%
            </div>
            <div className="text-xs uppercase tracking-wide text-muted">Accuracy</div>
          </div>
        </div>
      </div>

      {/* Layers List */}
      <div className="max-h-96 overflow-y-auto">
        <div className="p-4 space-y-2">
          {(model.layers || []).map((layer, index) => (
            <motion.div
              key={layer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={clsx(
                'cursor-pointer rounded-xl border p-4 transition-all',
                selectedLayer === layer.id
                  ? 'border-[color:var(--sand-500)] bg-[color:var(--sand-500)]/15 shadow-[var(--shadow-soft)]'
                  : 'border-surface bg-surface-1 hover:border-[color:var(--sand-400)] hover:bg-surface-hover'
              )}
              onClick={() => setSelectedLayer(selectedLayer === layer.id ? null : layer.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-medium text-primary">{layer.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getLayerTypeColor(layer.type)}`}>
                      {layer.type}
                    </span>
                    <span className={`text-xs ${getConfidenceColor(layer.confidence)}`}>
                      {getConfidenceText(layer.confidence)} confidence
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted">
                    Material: {getMaterialForLayer(layer.id)}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLayerToggle(layer.id)
                    }}
                    className="rounded-full p-2 text-muted transition-colors hover:text-primary"
                  >
                    {visibleLayers.has(layer.id) ? (
                      <EyeIcon className="h-4 w-4" />
                    ) : (
                      <EyeSlashIcon className="h-4 w-4" />
                    )}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // TODO: Open material selector
                    }}
                    className="rounded-full p-2 text-muted transition-colors hover:text-primary"
                  >
                    <PaintBrushIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Layer Details */}
              <AnimatePresence>
                {selectedLayer === layer.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 border-t border-surface pt-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Confidence Score:</span>
                        <span className={getConfidenceColor(layer.confidence)}>
                          {(layer.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Material Assignment:</span>
                        <span className="text-primary">
                          {getMaterialForLayer(layer.id)}
                        </span>
                      </div>

                      {Object.keys(layer.properties).length > 0 && (
                        <div>
                          <div className="mb-1 text-sm text-muted">Properties:</div>
                          <div className="space-y-1">
                            {Object.entries(layer.properties).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-xs text-muted">
                                <span>{key}:</span>
                                <span className="text-secondary">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-surface px-4 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <InformationCircleIcon className="h-4 w-4 text-secondary" />
            <span>Review and adjust material assignments before publishing</span>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-secondary text-sm" type="button">
              Reset All
            </button>
            <button className="btn btn-primary text-sm" type="button">
              Publish Model
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
