'use client'

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-full bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--brand-600)] mx-auto mb-4"></div>
        <div className="text-gray-900 text-lg">Loading 3D Scene...</div>
        <div className="text-gray-500 text-sm mt-2">Preparing your immersive experience</div>
      </div>
    </div>
  )
}
