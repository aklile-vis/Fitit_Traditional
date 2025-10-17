'use client'

import { 
  ArrowLeftIcon,
  HeartIcon,
  ShareIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'

interface LiquidGlassHeaderProps {
  onBack: () => void
  pageName: string
  totalPrice: number
  isFavorite: boolean
  onToggleFavorite: () => void
  onShare: () => void
}

export default function LiquidGlassHeader({
  onBack,
  pageName,
  totalPrice,
  isFavorite,
  onToggleFavorite,
  onShare
}: LiquidGlassHeaderProps) {
  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="border-b border-[#d9c6b5] bg-[#fdf7f0]/95 shadow-[0_16px_40px_rgba(59,42,28,0.12)] backdrop-blur">
        <div className="container mx-auto px-4 py-3 text-[#2f2013]">
          <div className="flex items-center justify-between">
            {/* Left side - Back button and page name */}
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onBack}
                className="flex items-center space-x-2 text-[#7b6652] transition-colors duration-200 hover:text-[#2f2013]"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </motion.button>

              <div className="h-6 w-px bg-[#e5d5c4]"></div>

              <h1 className="text-lg font-semibold tracking-wide text-[#2f2013]">
                {pageName}
              </h1>
            </div>
            
            {/* Right side - Price and action buttons */}
            <div className="flex items-center space-x-6">
              {/* Total Price */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-right"
              >
                <div className="text-xs uppercase tracking-wider text-[#a08a78]">Total Price</div>
                <div className="text-xl font-bold text-[#2f2013]">
                  ${totalPrice.toLocaleString()}
                </div>
              </motion.div>
              
              {/* Action buttons */}
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onToggleFavorite}
                  className="rounded-full border border-[#eadbca] bg-white p-2 text-[#8a5a32] transition-all duration-200 hover:bg-[#f2e1cf]"
                >
                  {isFavorite ? (
                    <HeartSolidIcon className="h-5 w-5 text-[#c4584d]" />
                  ) : (
                    <HeartIcon className="h-5 w-5" />
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onShare}
                  className="rounded-full border border-[#eadbca] bg-white p-2 text-[#7b6652] transition-all duration-200 hover:bg-[#f2e1cf] hover:text-[#2f2013]"
                >
                  <ShareIcon className="h-5 w-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
