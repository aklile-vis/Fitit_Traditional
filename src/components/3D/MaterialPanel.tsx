'use client'

import { 
  XMarkIcon,
  PaintBrushIcon,
  HomeIcon,
  WrenchScrewdriverIcon,
  LightBulbIcon,
  EyeIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useState, type ComponentType } from 'react'

import { materialsDatabase, Material, MaterialCategory, calculateMaterialCost } from '@/data/materialsDatabase'
import { formatPrice } from '@/lib/utils'

interface MaterialPanelProps {
  isOpen: boolean
  onClose: () => void
  selectedMaterials: Record<string, string>
  onMaterialSelect: (optionId: string, materialId: string) => void
  currentOption: string | null
  onOptionSelect: (optionId: string) => void
}

const categoryIcons: Record<MaterialCategory, ComponentType<{ className?: string }>> = {
  flooring: HomeIcon,
  wall_paint: PaintBrushIcon,
  wallpaper: PaintBrushIcon,
  tiles: HomeIcon,
  kitchen_cabinets: WrenchScrewdriverIcon,
  kitchen_countertops: WrenchScrewdriverIcon,
  kitchen_appliances: WrenchScrewdriverIcon,
  bathroom_fixtures: WrenchScrewdriverIcon,
  bathroom_tiles: HomeIcon,
  lighting: LightBulbIcon,
  curtains: EyeIcon,
  furniture: HomeIcon,
  doors: HomeIcon,
  windows: HomeIcon,
  hardware: WrenchScrewdriverIcon
}

const categoryLabels: Record<MaterialCategory, string> = {
  flooring: 'Flooring',
  wall_paint: 'Wall Paint',
  wallpaper: 'Wallpaper',
  tiles: 'Tiles',
  kitchen_cabinets: 'Kitchen Cabinets',
  kitchen_countertops: 'Countertops',
  kitchen_appliances: 'Appliances',
  bathroom_fixtures: 'Bathroom Fixtures',
  bathroom_tiles: 'Bathroom Tiles',
  lighting: 'Lighting',
  curtains: 'Curtains',
  furniture: 'Furniture',
  doors: 'Doors',
  windows: 'Windows',
  hardware: 'Hardware'
}

export default function MaterialPanel({ 
  isOpen, 
  onClose, 
  selectedMaterials, 
  onMaterialSelect, 
  currentOption
}: MaterialPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const categories = Array.from(new Set(materialsDatabase.map(m => m.category)))
  
  const filteredMaterials = materialsDatabase.filter(material => {
    const matchesCategory = !selectedCategory || material.category === selectedCategory
    const matchesSearch = !searchQuery || 
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleMaterialSelect = (material: Material) => {
    try {
      if (currentOption) {
        onMaterialSelect(currentOption, material.id)
        setError(null)
        onClose()
      } else {
        setError('No customization option selected')
      }
    } catch (err) {
      console.error('Error selecting material:', err)
      setError('Failed to select material')
    }
  }

  const getTotalPrice = () => {
    let total = 0
    Object.entries(selectedMaterials).forEach(([optionId, materialId]) => {
      const material = materialsDatabase.find(m => m.id === materialId)
      if (material) {
        // Simplified calculation - in real app, you'd get actual areas/quantities
        const area = getAreaForOption(optionId)
        const quantity = getQuantityForOption(optionId)
        total += calculateMaterialCost(material, area, quantity)
      }
    })
    return total
  }

  const getAreaForOption = (optionId: string): number => {
    const areas: Record<string, number> = {
      'living_room_floor': 300,
      'living_room_walls': 400,
      'kitchen_countertops': 25,
      'curtains': 20
    }
    return areas[optionId] || 1
  }

  const getQuantityForOption = (optionId: string): number => {
    const quantities: Record<string, number> = {
      'kitchen_cabinets': 12,
      'bathroom_fixtures': 1,
      'lighting': 1,
      'furniture': 1,
      'curtains': 4
    }
    return quantities[optionId] || 1
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 z-50 h-full w-96 overflow-hidden border-l border-[#d9c6b5] bg-[#fdf7f0] shadow-[0_30px_60px_rgba(59,42,28,0.18)]"
      >
        <div className="flex h-full flex-col text-[#2f2013]">
          {/* Header */}
          <div className="border-b border-[#e9d9c8] bg-[#f8f0e6] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#2f2013]">Customize Materials</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-[#7b6652] transition-colors hover:bg-[#f1e2d2] hover:text-[#2f2013]"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Error Display */}
            {error && (
              <div className="mb-4 rounded-lg border border-[#f4c7b5] bg-[#fde7dd] p-3">
                <p className="text-sm text-[#a94b3c]">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-xs text-[#c16851] hover:text-[#a94b3c]"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#e1d2c1] bg-white/80 pl-10 pr-4 py-2 text-sm text-[#2f2013] placeholder-[#a08a78] focus:border-[#c68a3f] focus:outline-none focus:ring-2 focus:ring-[#e8caa2]"
              />
              <PaintBrushIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-[#a08a78]" />
            </div>
          </div>

          {/* Categories */}
          <div className="border-b border-[#e9d9c8] bg-[#fdf7f0] p-4">
            <h3 className="mb-3 text-sm font-medium text-[#7b6652]">Categories</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  !selectedCategory 
                    ? 'bg-[#c68a3f] text-white shadow-[0_6px_16px_rgba(198,138,63,0.25)]' 
                    : 'bg-[#f2e1cf] text-[#7b6652] hover:bg-[#e7d6c3]'
                }`}
              >
                All
              </button>
              {categories.map(category => {
                const Icon = categoryIcons[category]
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors flex items-center space-x-1 ${
                      selectedCategory === category 
                        ? 'bg-[#c68a3f] text-white shadow-[0_6px_16px_rgba(198,138,63,0.25)]' 
                        : 'bg-[#f2e1cf] text-[#7b6652] hover:bg-[#e7d6c3]'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{categoryLabels[category]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Materials Grid */}
          <div className="flex-1 overflow-y-auto bg-[#fefbf7] p-4">
            <div className="grid grid-cols-1 gap-4">
              {filteredMaterials.map((material) => {
                const isSelected = currentOption && selectedMaterials[currentOption] === material.id
                const cost = calculateMaterialCost(
                  material, 
                  getAreaForOption(currentOption || ''), 
                  getQuantityForOption(currentOption || '')
                )
                
                return (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMaterialSelect(material)}
                    className={`relative cursor-pointer rounded-lg border p-4 transition-all ${
                      isSelected 
                        ? 'border-[#c68a3f] bg-[#f4e2cd]' 
                        : 'border-[#eadbca] bg-white hover:border-[#d8c6b4] hover:bg-[#faf2e6]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckIcon className="h-5 w-5 text-[#c68a3f]" />
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <div className="w-16 h-16 relative rounded-lg overflow-hidden">
                        <Image
                          src={material.image}
                          alt={material.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium text-[#2f2013]">
                          {material.name}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-xs text-[#7b6652]">
                          {material.description}
                        </p>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-[#b6762b]">
                            {formatPrice(cost, 'ETB')}
                          </span>
                          <span className="text-xs text-[#7b6652]">
                            {material.priceUnit.replace('_', '/')}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {material.specifications.color && (
                            <span className="inline-flex items-center rounded-full bg-[#f2e1cf] px-2 py-1 text-xs font-medium text-[#7b6652]">
                              {material.specifications.color}
                            </span>
                          )}
                          {material.specifications.finish && (
                            <span className="inline-flex items-center rounded-full bg-[#f2e1cf] px-2 py-1 text-xs font-medium text-[#7b6652]">
                              {material.specifications.finish}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Footer with Total Price */}
          <div className="border-t border-[#e9d9c8] bg-[#f8f0e6] p-4">
            <div className="flex items-center justify-between text-[#2f2013]">
              <span className="text-sm font-medium">Total Cost:</span>
              <span className="text-lg font-bold text-[#3a7a3a]">
                {formatPrice(getTotalPrice(), 'ETB')}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#7b6652]">
              Prices update in real-time as you customize
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
