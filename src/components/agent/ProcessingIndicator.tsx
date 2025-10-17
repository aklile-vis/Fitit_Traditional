'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface ProcessingIndicatorProps {
  isProcessing: boolean
  status: 'idle' | 'processing' | 'success' | 'error'
  message?: string
  progress?: number
}

export default function ProcessingIndicator({ 
  isProcessing, 
  status, 
  message = '', 
  progress = 0 
}: ProcessingIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <ArrowPathIcon className="h-5 w-5 animate-spin text-[color:var(--accent-500)]" />
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-[color:var(--success-500)]" />
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-[color:var(--danger-500)]" />
      default:
        return null
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'border-[color:var(--accent-500)]/50 bg-[color:var(--accent-500)]/12'
      case 'success':
        return 'border-[color:var(--success-500)]/50 bg-[color:var(--success-500)]/12'
      case 'error':
        return 'border-[color:var(--danger-500)]/50 bg-[color:var(--danger-500)]/12'
      default:
        return 'border-overlay bg-[color:var(--overlay-900)]'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'processing':
        return 'Processing CAD file...'
      case 'success':
        return 'Processing complete!'
      case 'error':
        return 'Processing failed'
      default:
        return 'Ready'
    }
  }

  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className={`rounded-xl border px-6 py-4 shadow-[var(--shadow-soft-raised)] backdrop-blur-xl ${getStatusColor()}`}>
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div className="flex-1">
                <div className="font-medium text-overlay">
                  {getStatusText()}
                </div>
                {message && (
                  <div className="mt-1 text-sm text-overlay-muted">
                    {message}
                  </div>
                )}
                {status === 'processing' && progress > 0 && (
                  <div className="mt-2">
                    <div className="h-2 w-64 rounded-full bg-[color:var(--overlay-800)]">
                      <motion.div
                        className="h-2 rounded-full bg-[color:var(--accent-500)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-overlay-muted">
                      {Math.round(progress)}% complete
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
