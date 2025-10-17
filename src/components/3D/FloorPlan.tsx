'use client'

import { 
  HomeIcon,
  WrenchScrewdriverIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface FloorPlanProps {
  onTeleport: (room: string, position: { x: number; y: number; z: number }) => void
  currentRoom: string
}

const rooms = [
  {
    id: 'living-room',
    name: 'Living Room',
    icon: HomeIcon,
    position: { x: 0, y: 1.6, z: -2 },
    color: 'bg-[color:var(--brand-600)]',
    bounds: { x: -6, y: 6, z: -6, w: 12, h: 8 }
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    icon: WrenchScrewdriverIcon,
    position: { x: 0, y: 1.6, z: -6 },
    color: 'bg-[color:var(--sand-600)]',
    bounds: { x: -6, y: 6, z: -8, w: 12, h: 4 }
  },
  {
    id: 'bedroom-1',
    name: 'Bedroom 1',
    icon: HomeIcon,
    position: { x: -6, y: 1.6, z: 0 },
    color: 'bg-[color:var(--brand-700)]',
    bounds: { x: -8, y: -4, z: -2, w: 4, h: 4 }
  },
  {
    id: 'bedroom-2',
    name: 'Bedroom 2',
    icon: HomeIcon,
    position: { x: 6, y: 1.6, z: 0 },
    color: 'bg-[color:var(--sand-500)]',
    bounds: { x: 4, y: 8, z: -2, w: 4, h: 4 }
  },
  {
    id: 'hallway',
    name: 'Hallway',
    icon: EyeIcon,
    position: { x: 0, y: 1.6, z: 4 },
    color: 'bg-[color:var(--sand-400)]',
    bounds: { x: -2, y: 2, z: 2, w: 4, h: 4 }
  }
]

export default function FloorPlan({ onTeleport, currentRoom }: FloorPlanProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleRoomClick = (room: typeof rooms[0]) => {
    onTeleport(room.id, room.position)
    setIsOpen(false)
  }

  if (!isClient) {
    return null
  }

  return (
    <div className="absolute top-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 shadow-2xl hover:bg-white/20 transition-all border border-white/20"
      >
        <HomeIcon className="h-6 w-6 text-white" />
      </button>

      {/* Floor Plan Modal */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute top-12 right-0 bg-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl min-w-[300px] border border-white/20"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Floor Plan</h3>
          <p className="text-sm text-white/80 mb-4">Click on a room to teleport there</p>
          
          {/* 2D Floor Plan Visualization */}
          <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden mb-4">
            {/* Room rectangles */}
            {rooms.map((room) => (
              <motion.div
                key={room.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleRoomClick(room)}
                className={`absolute ${room.color} ${
                  currentRoom === room.id ? 'ring-2 ring-brand' : ''
                } rounded cursor-pointer transition-all hover:shadow-lg`}
                style={{
                  left: `${((room.bounds.x + 8) / 16) * 100}%`,
                  top: `${((room.bounds.z + 8) / 16) * 100}%`,
                  width: `${(room.bounds.w / 16) * 100}%`,
                  height: `${(room.bounds.h / 16) * 100}%`,
                }}
              >
                <div className="flex items-center justify-center h-full">
                  <room.icon className="h-4 w-4 text-white" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                  {room.name}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Room List */}
          <div className="space-y-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleRoomClick(room)}
                className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-all ${
                  currentRoom === room.id
                    ? 'border-2 border-brand bg-brand-soft'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <div className={`p-2 rounded-lg ${room.color}`}>
                  <room.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white">{room.name}</span>
                {currentRoom === room.id && (
                  <span className="ml-auto text-xs text-brand font-medium">Current</span>
                )}
              </button>
            ))}
          </div>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full mt-4 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors border border-white/20"
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  )
}
