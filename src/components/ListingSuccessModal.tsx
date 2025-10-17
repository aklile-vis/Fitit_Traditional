import { useEffect } from 'react'
import { CheckCircleIcon, XMarkIcon, PlusIcon, ListBulletIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface ListingSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  listingTitle?: string
}

export default function ListingSuccessModal({ 
  isOpen, 
  onClose, 
  listingTitle 
}: ListingSuccessModalProps) {
  
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg mx-auto rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-[color:var(--surface-2)] hover:text-primary transition-colors"
          aria-label="Close modal"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        
        {/* Success icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircleIcon className="h-6 w-6 text-green-600" />
        </div>
        
        {/* Success content */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-primary mb-5">Listing Published Successfully!</h3>
          {listingTitle && (
            <p className="text-sm text-secondary mb-2">
              <span className="font-medium text-primary">"{listingTitle}"</span> is now live and visible to potential buyers.
            </p>
          )}
          <p className="text-sm text-secondary mb-6">
            What would you like to do next?
          </p>
          
          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <Link
              href="/agent/upload/3d"
              className="btn btn-secondary"
              onClick={onClose}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Another Listing
            </Link>
            <Link
              href="/agent/my-listings"
              className="btn btn-primary"
              onClick={onClose}
            >
              <ListBulletIcon className="h-4 w-4 mr-2" />
              View My Listings
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
