import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface UseWizardDataProtectionProps {
  hasUnsavedData: boolean
  onConfirmLeave: () => void
  onCancelLeave: () => void
}

export function useWizardDataProtection({ 
  hasUnsavedData, 
  onConfirmLeave, 
  onCancelLeave 
}: UseWizardDataProtectionProps) {
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const router = useRouter()
  const bypassOnceRef = useRef(false)

  // Handle browser back/forward/refresh
  useEffect(() => {
    if (!hasUnsavedData) return

    // Note: beforeunload is handled by the Header component for navbar navigation
    // This hook only handles popstate and link clicks

    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedData) {
        // Check if we're leaving the wizard (not just navigating within it)
        const currentPath = window.location.pathname
        const isLeavingWizard = !currentPath.startsWith('/agent/upload/') && currentPath !== '/agent/review'
        
        if (isLeavingWizard) {
          e.preventDefault()
          setShowWarningModal(true)
          // Push the state back to prevent navigation
          window.history.pushState(null, '', window.location.href)
        }
      }
    }

    // Intercept all link clicks that would leave the wizard (capture phase to win race with React/Next)
    const handleLinkClick = (e: MouseEvent) => {
      if (!hasUnsavedData) return
      if (bypassOnceRef.current) return

      // Only left-click without modifier keys should be blocked (opening in new tab is allowed)
      const mouseEvent = e as MouseEvent
      if (mouseEvent.button !== 0 || mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey) {
        return
      }

      const target = e.target as HTMLElement
      const link = target.closest('a[href]') as HTMLAnchorElement
      
      if (!link) return
      const href = link.getAttribute('href')
      if (!href) return
      const isWizardNavigation = href.startsWith('/agent/upload/') || href === '/agent/review'
      if (isWizardNavigation) return

      // Block navigation and show modal
      e.preventDefault()
      // @ts-ignore - some environments support this method
      if (typeof (e as any).stopImmediatePropagation === 'function') {
        // Attempt to stop any subsequent handlers from firing
        ;(e as any).stopImmediatePropagation()
      }
      setPendingNavigation(href)
      setShowWarningModal(true)
    }

    // Patch History API to intercept programmatic navigations (router.push, Link internals)
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    const interceptHistory = (
      method: 'pushState' | 'replaceState',
      original: (data: any, unused: string, url?: string | URL | null | undefined) => void,
    ) => {
      return function (this: History, data: any, unused: string, url?: string | URL | null | undefined) {
        try {
          const href = typeof url === 'string' ? url : (url ? (url as URL).toString() : '')
          const isWizardNavigation = href.startsWith('/agent/upload/') || href === '/agent/review'
          if (hasUnsavedData && !isWizardNavigation && !bypassOnceRef.current) {
            setPendingNavigation(href)
            setShowWarningModal(true)
            return
          }
        } catch {
          // ignore parsing errors
        }
        return original.apply(this, [data, unused, url] as any)
      }
    }

    window.addEventListener('popstate', handlePopState)
    // Use capture phase so we run before React/Next handlers
    document.addEventListener('click', handleLinkClick, true)
    window.history.pushState = interceptHistory('pushState', originalPushState)
    window.history.replaceState = interceptHistory('replaceState', originalReplaceState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('click', handleLinkClick, true)
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
    }
  }, [hasUnsavedData])

  // Intercept router navigation - only protect when leaving wizard
  const protectedRouterPush = (url: string) => {
    const isWizardNavigation = url.startsWith('/agent/upload/') || url === '/agent/review'
    
    if (hasUnsavedData && !isWizardNavigation) {
      setPendingNavigation(url)
      setShowWarningModal(true)
    } else {
      router.push(url)
    }
  }

  const handleConfirmLeave = () => {
    setShowWarningModal(false)
    // Allow next navigation to bypass interception
    bypassOnceRef.current = true
    if (pendingNavigation) {
      router.push(pendingNavigation)
      setPendingNavigation(null)
    } else {
      // Handle browser navigation
      window.history.back()
    }
    onConfirmLeave()
    // Reset bypass shortly after navigation is initiated
    setTimeout(() => { bypassOnceRef.current = false }, 1000)
  }

  const handleCancelLeave = () => {
    setShowWarningModal(false)
    setPendingNavigation(null)
    onCancelLeave()
  }

  return {
    showWarningModal,
    protectedRouterPush,
    handleConfirmLeave,
    handleCancelLeave
  }
}
