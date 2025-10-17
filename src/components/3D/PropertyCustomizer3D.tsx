'use client'

import { 
  PaintBrushIcon,
  HomeIcon,
  WrenchScrewdriverIcon,
  LightBulbIcon,
  EyeIcon,
  BookmarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

import { customizationOptions, getMaterialById } from '@/data/materialsDatabase'
import { formatPrice } from '@/lib/utils'

import LiquidGlassHeader from './LiquidGlassHeader'
import MaterialPanel from './MaterialPanel'
import Scene3D from './Scene3D'

interface PropertyCustomizer3DProps {
  propertyId: string
  onClose: () => void
  onSaveDesign: (design: SavedDesign) => void
}

interface SavedDesign {
  id: string
  name: string
  propertyId: string
  materials: Record<string, string>
  totalPrice: number
  createdAt: string
}

export default function PropertyCustomizer3D({ 
  propertyId, 
  onClose, 
  onSaveDesign 
}: PropertyCustomizer3DProps) {
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, string>>({})
  const [currentOption, setCurrentOption] = useState<string | null>(null)
  const [isMaterialPanelOpen, setIsMaterialPanelOpen] = useState(false)
  const [totalPrice, setTotalPrice] = useState(0)
  const [basePrice] = useState(850000) // Base property price
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  // Initialize with default materials
  useEffect(() => {
    const defaults: Record<string, string> = {}
    customizationOptions.forEach(option => {
      defaults[option.id] = option.defaultMaterial
    })
    setSelectedMaterials(defaults)
  }, [])

  const handleMaterialChange = (optionId: string, materialId: string) => {
    setSelectedMaterials(prev => ({
      ...prev,
      [optionId]: materialId
    }))
  }

  const handleOptionClick = (optionId: string) => {
    setCurrentOption(optionId)
    setIsMaterialPanelOpen(true)
  }

  const handleSaveDesign = () => {
    const design: SavedDesign = {
      id: `design_${Date.now()}`,
      name: 'My Custom Design',
      propertyId,
      materials: selectedMaterials,
      totalPrice: basePrice + totalPrice,
      createdAt: new Date().toISOString()
    }
    onSaveDesign(design)
  }

  const handleReset = () => {
    const defaults: Record<string, string> = {}
    customizationOptions.forEach(option => {
      defaults[option.id] = option.defaultMaterial
    })
    setSelectedMaterials(defaults)
  }

  const toggleFavorite = () => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(propertyId)) {
        newFavorites.delete(propertyId)
      } else {
        newFavorites.add(propertyId)
      }
      return newFavorites
    })
  }

  const getOptionIcon = (category: string) => {
    switch (category) {
      case 'flooring': return HomeIcon
      case 'wall_paint': return PaintBrushIcon
      case 'kitchen_cabinets': return WrenchScrewdriverIcon
      case 'lighting': return LightBulbIcon
      case 'curtains': return EyeIcon
      default: return HomeIcon
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f7f1e8]">
      {/* Liquid Glass Header */}
      <LiquidGlassHeader
        onBack={onClose}
        pageName="3D Property Customizer"
        totalPrice={basePrice + totalPrice}
        isFavorite={favorites.has(propertyId)}
        onToggleFavorite={toggleFavorite}
        onShare={() => {
          // TODO: Implement share functionality
          console.warn('Share property')
        }}
      />

      {/* Full Screen 3D Scene */}
      <div className="relative h-full w-full">
        <Scene3D
          selectedMaterials={selectedMaterials}
          onMaterialChange={handleMaterialChange}
          onPriceUpdate={setTotalPrice}
        />

        {/* Floating Customization Panel - Dark Liquid Glass Style */}
        <div className="absolute right-4 top-24 w-80 max-h-[calc(100vh-10rem)] overflow-hidden">
          <div className="rounded-2xl border border-[#d9c6b5] bg-[#fdf7f0] shadow-[0_24px_60px_rgba(59,42,28,0.14)]">
            <div className="border-b border-[#e9d9c8] bg-[#f8f0e6] p-4">
              <h2 className="mb-2 text-lg font-semibold text-[#2f2013]">Customize Your Space</h2>
              <p className="text-sm text-[#7b6652]">
                Click on any element in the 3D view or use the options below to customize materials, colors, and finishes.
              </p>
            </div>

            <div className="max-h-96 flex-1 space-y-3 overflow-y-auto p-4">
              {customizationOptions.map((option) => {
                const Icon = getOptionIcon(option.category)
                const selectedMaterial = getMaterialById(selectedMaterials[option.id] || '')
                
                return (
                  <motion.div
                    key={option.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOptionClick(option.id)}
                    className="cursor-pointer rounded-xl border border-[#eadbca] bg-white p-3 transition-all hover:border-[#d8c6b4] hover:bg-[#faf2e6]"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="rounded-lg border border-[#eadbca] bg-[#f2e1cf] p-2 text-[#8a5a32]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-[#2f2013]">{option.name}</h3>
                        <p className="mt-1 text-xs text-[#7b6652]">
                          {selectedMaterial?.name || 'Select material'}
                        </p>
                        {selectedMaterial && (
                          <div className="mt-1 flex items-center space-x-2">
                            <div 
                              className="h-4 w-4 rounded border border-[#d8c6b4]"
                              style={{ backgroundColor: getMaterialColor(selectedMaterial.id) }}
                            ></div>
                            <span className="text-xs text-[#7b6652]">
                              {selectedMaterial.specifications.color}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#a08a78]">Click to edit</div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 border-t border-[#e9d9c8] bg-[#f8f0e6] p-4">
              <div className="flex space-x-2">
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center space-x-2 rounded-lg border border-[#eadbca] bg-white px-4 py-2 text-sm font-medium text-[#2f2013] transition-all hover:bg-[#f2e1cf]"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={handleSaveDesign}
                  className="flex-1 flex items-center justify-center space-x-2 rounded-lg border border-[#c68a3f]/40 bg-[#c68a3f] px-4 py-2 text-sm font-medium text-white shadow-[0_10px_25px_rgba(198,138,63,0.25)] transition-all hover:bg-[#b6762b]"
                >
                  <BookmarkIcon className="h-4 w-4" />
                  <span>Save Design</span>
                </button>
              </div>
              
              <div className="text-center">
                <div className="text-sm text-[#7b6652]">
                  Customization adds <span className="font-semibold text-[#3a7a3a]">
                    {formatPrice(totalPrice, 'ETB')}
                  </span> to base price
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Material Selection Panel */}
      <MaterialPanel
        isOpen={isMaterialPanelOpen}
        onClose={() => setIsMaterialPanelOpen(false)}
        selectedMaterials={selectedMaterials}
        onMaterialSelect={handleMaterialChange}
        currentOption={currentOption}
        onOptionSelect={setCurrentOption}
      />
    </div>
  )
}

function getMaterialColor(materialId: string): string {
  const material = getMaterialById(materialId)
  if (!material) return '#FFFFFF'

  const colorMap: Record<string, string> = {
    'Classic Gray': '#808080',
    'Navy Blue': '#000080',
    'White': '#FFFFFF',
    'Charcoal Gray': '#36454F',
    'Natural Oak': '#D2B48C',
    'White with Gray Veins': '#F8F8F8',
    'Gray Oak': '#8B7355',
    'Natural Maple': '#DEB887',
    'Chrome': '#C0C0C0',
    'Brass': '#B87333',
    'Natural Linen': '#F5F5DC',
    'Gray': '#808080'
  }

  return colorMap[material.specifications.color || ''] || '#FFFFFF'
}
