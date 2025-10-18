'use client'

import {
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  BookmarkIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { usePathname } from 'next/navigation'
import WizardWarningModal from '@/components/WizardWarningModal'

const navigation = [
  { label: 'Listings', href: '/listings' },
  { label: 'Agent Studio', href: '/agent' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export default function Header() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const profileMenuRefDesktop = useRef<HTMLDivElement>(null)
  const profileMenuRefMobile = useRef<HTMLDivElement>(null)

  // Check if we're in a wizard page
  const isInWizard = pathname.startsWith('/agent/upload/') || pathname === '/agent/review'
  
  // Don't show modal when navigating within wizard (review -> edit)
  const isNavigatingWithinWizard = useMemo(() => {
    // If we're not in wizard, no protection needed
    if (!isInWizard) return false
    
    // Check if there's a pending navigation that's within wizard
    return false // This will be handled by the hook's logic
  }, [isInWizard])
  
  // Check if there's unsaved wizard data
  const [hasUnsavedWizardData, setHasUnsavedWizardData] = useState(false)
  
  useEffect(() => {
    if (!isInWizard) {
      setHasUnsavedWizardData(false)
      return
    }
    
    const checkForUnsavedData = () => {
      try {
        // Check each step for data
        const step1 = sessionStorage.getItem('agent:uploadStep1')
        const step2 = sessionStorage.getItem('agent:uploadStep2') 
        const step3 = sessionStorage.getItem('agent:uploadStep3')
        const review = sessionStorage.getItem('agent:reviewDraft')
        const editorChanges = sessionStorage.getItem('agent:editorChanges')
        
        // If we're on details page, check both sessionStorage AND current form state
        if (pathname === '/agent/upload/details') {
          let hasMeaningfulData = false
          
          // First check sessionStorage data
          if (step1) {
            try {
              const step1Data = JSON.parse(step1)
              // Check if there's actual property data
              hasMeaningfulData = hasMeaningfulData || !!(
                step1Data.form?.title || 
                step1Data.form?.description || 
                step1Data.form?.address || 
                step1Data.form?.basePrice
              )
            } catch (e) {
              // Ignore parsing errors
            }
          }
          
          // Also check if there's current form data in the DOM (not yet saved to sessionStorage)
          if (!hasMeaningfulData) {
            try {
              // Check if any form fields have values
              const titleInput = document.querySelector('input[name="title"]') as HTMLInputElement
              const priceInput = document.querySelector('input[name="basePrice"]') as HTMLInputElement
              const descriptionTextarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement
              const addressInput = document.querySelector('input[name="address"]') as HTMLInputElement
              const cityInput = document.querySelector('input[name="city"]') as HTMLInputElement
              const subCityInput = document.querySelector('input[name="subCity"]') as HTMLInputElement
              const areaInput = document.querySelector('input[name="areaSqm"]') as HTMLInputElement
              const bedroomsInput = document.querySelector('input[name="bedrooms"]') as HTMLInputElement
              const bathroomsInput = document.querySelector('input[name="bathrooms"]') as HTMLInputElement
              const propertyTypeInput = document.querySelector('input[name="propertyType"]') as HTMLInputElement
              const checkedAmenities = document.querySelectorAll('input[name="amenities"]:checked')
              const checkedFeatures = document.querySelectorAll('input[name="features"]:checked')

              hasMeaningfulData = !!(
                (titleInput && titleInput.value.trim()) ||
                (priceInput && priceInput.value.trim()) ||
                (descriptionTextarea && descriptionTextarea.value.trim()) ||
                (addressInput && addressInput.value.trim()) ||
                (cityInput && cityInput.value.trim()) ||
                (subCityInput && subCityInput.value.trim()) ||
                (areaInput && areaInput.value.trim()) ||
                (bedroomsInput && bedroomsInput.value.trim()) ||
                (bathroomsInput && bathroomsInput.value.trim()) ||
                (propertyTypeInput && propertyTypeInput.value.trim()) ||
                checkedAmenities.length > 0 ||
                checkedFeatures.length > 0
              )
            } catch (e) {
              // Ignore DOM query errors
            }
          }
          
          // Clear any old data from other steps when on details page
          if (!hasMeaningfulData) {
            sessionStorage.removeItem('agent:uploadStep2')
            sessionStorage.removeItem('agent:uploadStep3')
            sessionStorage.removeItem('agent:reviewDraft')
            sessionStorage.removeItem('agent:editorChanges')
          }
          setHasUnsavedWizardData(hasMeaningfulData)
        } else {
          // For media, 3D, or review pages, any data means we should protect
          const hasAnyData = !!(step1 || step2 || step3 || review || editorChanges)
          setHasUnsavedWizardData(hasAnyData)
        }
      } catch {
        setHasUnsavedWizardData(false)
      }
    }
    
    // Check initially
    checkForUnsavedData()
    
    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('agent:upload') || e.key === 'agent:reviewDraft' || e.key === 'agent:editorChanges') {
        checkForUnsavedData()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically in case of same-tab changes
    const interval = setInterval(checkForUnsavedData, 1000)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [isInWizard, pathname])

  // Navigation function that shows themed modal for wizard data protection
  const handleNavClick = (href: string) => {
    if (hasUnsavedWizardData) {
      // Show themed modal before leaving wizard
      setPendingNavigation(href)
      setShowWarningModal(true)
    } else {
      window.location.href = href
    }
  }

  const handleConfirmLeave = () => {
    setShowWarningModal(false)
    if (pendingNavigation) {
      // Clear wizard data and navigate
      sessionStorage.removeItem('agent:uploadStep1')
      sessionStorage.removeItem('agent:uploadStep2')
      sessionStorage.removeItem('agent:uploadStep3')
      sessionStorage.removeItem('agent:reviewDraft')
      sessionStorage.removeItem('agent:editorChanges')
      window.location.href = pendingNavigation
      setPendingNavigation(null)
    }
  }

  const handleCancelLeave = () => {
    setShowWarningModal(false)
    setPendingNavigation(null)
  }

  // Keyboard support for warning modal
  useEffect(() => {
    if (!showWarningModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelLeave()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showWarningModal])

  // Note: beforeunload alerts removed per user request - no alerts for any reason

  const initials = useMemo(() => {
    if (!user?.name) return 'EP'
    return user.name
      .split(' ')
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join('')
  }, [user?.name])

  const isAgent = useMemo(() => user?.role === 'AGENT' || user?.role === 'ADMIN', [user?.role])
  const visibleNavigation = useMemo(
    () => navigation.filter((item) => item.href !== '/agent' || isAgent),
    [isAgent]
  )

  // Close profile menu on outside click or Escape
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      const insideDesktop = profileMenuRefDesktop.current?.contains(t)
      const insideMobile = profileMenuRefMobile.current?.contains(t)
      if (!insideDesktop && !insideMobile) setIsProfileMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <header className="surface-header sticky inset-x-0 top-0 z-50 backdrop-blur-xl supports-[backdrop-filter]:bg-[color:var(--surface-header)]">
      <div className="container">
        <div className="flex h-20 items-center justify-between gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-4 py-2 shadow-sm transition hover:border-[color:var(--surface-border-strong)] hover:bg-[color:var(--surface-hover)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden shadow-md" style={{ background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))' }}>
              <Image
                src="/logo/logo.png"
                alt="EstatePro Logo"
                width={48}
                height={48}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm uppercase tracking-[0.3em] text-muted">Fitit</span>
              <span className="text-sm font-semibold text-primary">Real Estate</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-2 py-1 shadow-sm md:flex">
            {visibleNavigation.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavClick(item.href)}
                className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-secondary transition hover:border-[color:var(--surface-border-strong)] hover:bg-[color:var(--surface-hover)] hover:text-primary"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden flex-1 items-center justify-end gap-4 lg:flex">
            {user ? (
              <div className="flex items-center gap-3">
                {isAgent ? (
                  <Link href="/agent/my-listings" className="btn btn-secondary hidden xl:flex">
                    <BuildingOffice2Icon className="h-4 w-4" />
                    My Listings
                  </Link>
                ) : (
                  <Link href="/saved" className="btn btn-secondary hidden xl:flex">
                    <BookmarkIcon className="h-4 w-4" />
                    Saved
                  </Link>
                )}
                {null}
                <div ref={profileMenuRefDesktop} className="relative">
                  <button
                    aria-haspopup="menu"
                    aria-expanded={isProfileMenuOpen}
                    type="button"
                    onClick={() => setIsProfileMenuOpen((o) => !o)}
                    className="flex items-center gap-3 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-600)]"
                  >
                    {user.avatar ? (
                      <Image
                        alt={user.name ?? user.email ?? 'User avatar'}
                        className="h-9 w-9 rounded-full object-cover"
                        height={36}
                        src={user.avatar}
                        width={36}
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--sand-500)]/20 text-sm font-semibold text-secondary">
                        {initials}
                      </span>
                    )}
                    <div className="text-sm text-secondary">
                      <div className="font-semibold text-primary">{user.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted">
                        <span className="uppercase tracking-wide">{user.role === 'AGENT' ? 'Agent' : 'Buyer'}</span>
                      </div>
                    </div>
                  </button>
                  {isProfileMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft-raised)]"
                    >
                      <Link
                        role="menuitem"
                        href="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-secondary hover:bg-[color:var(--surface-hover)] hover:text-primary"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      {null}
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setIsProfileMenuOpen(false); logout() }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-secondary hover:bg-[color:var(--surface-hover)] hover:text-primary"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="btn btn-secondary">
                  Sign In
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Create Account
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            {user ? (
              <div ref={profileMenuRefMobile} className="relative">
                <button
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  type="button"
                  onClick={() => setIsProfileMenuOpen((o) => !o)}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-0 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-600)]"
                >
                  {user.avatar ? (
                    <Image
                      alt={user.name ?? user.email ?? 'User avatar'}
                      className="h-8 w-8 rounded-full object-cover"
                      height={32}
                      src={user.avatar}
                      width={32}
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--sand-500)]/20 text-xs font-semibold text-secondary">
                      {initials}
                    </span>
                  )}
                </button>
                {isProfileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] shadow-[var(--shadow-soft-raised)]"
                  >
                    <Link
                      role="menuitem"
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-secondary hover:bg-[color:var(--surface-hover)] hover:text-primary"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    {null}
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => { setIsProfileMenuOpen(false); logout() }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-secondary hover:bg-[color:var(--surface-hover)] hover:text-primary"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn btn-secondary px-3 py-1 text-sm">
                Sign In
              </Link>
            )}
            <button
              className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-2 text-secondary"
              onClick={() => setIsMenuOpen((open) => !open)}
              type="button"
            >
              {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              animate={{ opacity: 1, height: 'auto' }}
              className="md:hidden"
              exit={{ opacity: 0, height: 0 }}
              initial={{ opacity: 0, height: 0 }}
            >
              <div className="space-y-4 rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-sm">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input className="input pl-9" placeholder="Search the marketplace" type="search" />
                </div>
                <nav className="flex flex-col gap-2">
                  {visibleNavigation.map((item) => (
                    <button
                      key={item.href}
                      className="rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-secondary transition hover:border-[color:var(--surface-border-strong)] hover:bg-[color:var(--surface-hover)] hover:text-primary"
                      onClick={() => {
                        setIsMenuOpen(false)
                        handleNavClick(item.href)
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
                {user ? (
                  <div className="flex flex-col gap-3">
                    <button className="btn btn-secondary w-full" onClick={logout} type="button">
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link href="/login" className="btn btn-secondary w-full" onClick={() => setIsMenuOpen(false)}>
                      Sign In
                    </Link>
                    <Link href="/register" className="btn btn-primary w-full" onClick={() => setIsMenuOpen(false)}>
                      Create Account
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Warning Modal */}
      <WizardWarningModal
        isOpen={showWarningModal}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
    </header>
  )
}
