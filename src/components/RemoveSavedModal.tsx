import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect } from 'react'

interface RemoveSavedModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  propertyTitle?: string
}

export default function RemoveSavedModal({
  isOpen,
  onConfirm,
  onCancel,
  propertyTitle = "this property"
}: RemoveSavedModalProps) {
  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 min-h-screen">
      <div className="relative w-full max-w-md mx-auto rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-[color:var(--surface-2)] hover:text-primary transition-colors"
          aria-label="Close modal"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        
        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
        </div>
        
        {/* Warning content */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-primary mb-2">Remove from saved?</h3>
          <p className="text-sm text-secondary mb-6">
            Are you sure you want to remove <span className="font-medium text-primary">"{propertyTitle}"</span> from your saved properties? This action cannot be undone.
          </p>
          
          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={onCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
