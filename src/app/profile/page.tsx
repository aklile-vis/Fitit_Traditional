'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils'

import { useAuth } from '@/contexts/AuthContext'

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout, refresh } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarRemoved, setAvatarRemoved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Notifications removed

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [initialAvatar, setInitialAvatar] = useState<string | null>(null)
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const pathname = usePathname()

  // Section navigation (left sidebar)
  const [activeSection, setActiveSection] = useState<string>('overview')
  const sectionIds = useMemo(() => {
    const isAgentRole = user?.role === 'AGENT' || user?.role === 'ADMIN'
    const base = ['overview', 'details', 'security']
    return isAgentRole
      ? ['overview', 'details', 'agency', 'security', 'my-listings', 'shortcuts']
      : [...base, 'saved']
  }, [user?.role])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (!user) return
    setName(user?.name || '')
    // Load profile from backend
    ;(async () => {
      try {
        const r = await fetch('/api/profile', { cache: 'no-store' })
        const data = await r.json().catch(() => ({} as any))
        if (r.ok && data?.profile) {
          setPhone(data.profile.phone || '')
          setJobTitle(data.profile.jobTitle || '')
          setAgencyName(data.profile.agencyName || '')
          if (data.profile.avatarUrl) {
            setInitialAvatar(data.profile.avatarUrl)
          }
          setAvatarRemoved(false)
        }
      } catch {}
    })()
  }, [user])

  // Removed IntersectionObserver: sidebar now switches panes, not scroll

  const initials = useMemo(() => {
    const src = name || user?.name || 'EP'
    return src
      .split(' ')
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join('')
  }, [name, user?.name])

  const onPickAvatar = () => fileInputRef.current?.click()
  const onAvatarChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarRemoved(false)
      setAvatarPreview(String(reader.result))
    }
    reader.readAsDataURL(f)
  }

  // Auto-dismiss success notices after 3s
  useEffect(() => {
    if (profileNotice?.type === 'success') {
      const t = setTimeout(() => setProfileNotice(null), 3000)
      return () => clearTimeout(t)
    }
  }, [profileNotice])
  useEffect(() => {
    if (passwordNotice?.type === 'success') {
      const t = setTimeout(() => setPasswordNotice(null), 3000)
      return () => clearTimeout(t)
    }
  }, [passwordNotice])

  // Clear notices when switching panes or navigating away
  useEffect(() => {
    setProfileNotice(null)
    setPasswordNotice(null)
  }, [activeSection, pathname])

  const saveProfile: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    try {
      const payload: any = {
        name,
        phone,
        jobTitle,
        agencyName,
      }
      if (avatarPreview && avatarPreview.startsWith('data:image/')) {
        payload.avatarDataUrl = avatarPreview
      } else if (avatarRemoved) {
        payload.removeAvatar = true
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setProfileNotice({ type: 'error', text: String(data?.error || 'Failed to save profile') })
        return
      }
      setInitialAvatar(data?.profile?.avatarUrl || null)
      setAvatarRemoved(false)
      const ts = new Date().toISOString()
      setLastSaved(ts)
      setProfileNotice({ type: 'success', text: 'Profile updated successfully.' })
      // Clear avatarPreview after successful upload/remove so future saves don’t resend
      setAvatarPreview(data?.profile?.avatarUrl ? null : avatarPreview)
      // Refresh auth session so header/avatar reflect changes immediately
      void refresh()
    } catch (err) {
      setProfileNotice({ type: 'error', text: 'Failed to save profile' })
    }
  }

  // Notifications removed

  const changePassword: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!currentPwd || newPwd.length < 8 || newPwd !== confirmPwd) {
      setPasswordNotice({ type: 'error', text: 'Enter current password and a valid new password (min 8 chars) that matches confirmation.' })
      return
    }
    try {
      const r = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setPasswordNotice({ type: 'error', text: String(data?.error || 'Failed to change password') })
        return
      }
      setPasswordNotice({ type: 'success', text: 'Password changed successfully.' })
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch (err) {
      setPasswordNotice({ type: 'error', text: 'Failed to change password' })
    }
  }

  const showProfileLoading = isLoading || !user; if (false) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <div className="text-secondary">Loading profile…</div>
      </div>
    )
  }

  const isAgent = user?.role === 'AGENT' || user?.role === 'ADMIN'

  // Saved and My Listings data
  const [savedList, setSavedList] = useState<Array<{ id: string; title: string; coverImage?: string | null; basePrice?: number; currency?: string | null }>>([])
  const [savedStatus, setSavedStatus] = useState('')
  const [myListings, setMyListings] = useState<Array<{ id: string; unitId?: string; title: string; isPublished?: boolean; coverImage?: string | null; basePrice?: number; currency?: string | null }>>([])
  const [myStatus, setMyStatus] = useState('')

  useEffect(() => {
    const loadSaved = async () => {
      setSavedStatus('Loading…')
      try {
        const r = await fetch('/api/saved', { cache: 'no-store' })
        const rows = await r.json()
        if (!r.ok) { setSavedStatus(rows?.error || 'Failed to load'); return }
        setSavedList(Array.isArray(rows)
          ? rows.map((l: any) => ({
              id: String(l.id),
              title: String(l.title || 'Untitled'),
              coverImage: l.coverImage ?? null,
              basePrice: typeof l.basePrice === 'number' ? l.basePrice : undefined,
              currency: typeof l.currency === 'string' ? l.currency : undefined,
            }))
          : []
        )
        setSavedStatus('')
      } catch { setSavedStatus('Failed to load') }
    }
    if (!isAgent && (activeSection === 'saved' || activeSection === 'overview')) void loadSaved()
  }, [activeSection, isAgent])

  useEffect(() => {
    const loadMine = async () => {
      setMyStatus('Loading…')
      try {
        const r = await fetch('/api/listings/mine', { cache: 'no-store' })
        const rows = await r.json()
        if (!r.ok) { setMyStatus(rows?.error || 'Failed to load'); return }
        setMyListings(Array.isArray(rows)
          ? rows.map((l: any) => ({
              id: String(l.id),
              unitId: l.unitId,
              title: String(l.title || 'Untitled'),
              isPublished: !!l.isPublished,
              coverImage: l.coverImage ?? null,
              basePrice: typeof l.basePrice === 'number' ? l.basePrice : undefined,
              currency: typeof l.currency === 'string' ? l.currency : undefined,
            }))
          : []
        )
        setMyStatus('')
      } catch { setMyStatus('Failed to load') }
    }
    if (isAgent && (activeSection === 'my-listings' || activeSection === 'overview')) void loadMine()
  }, [activeSection, isAgent])

  if (showProfileLoading) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <div className="text-secondary">Loading profile…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[color:var(--brand-50)] via-[color:var(--surface-0)] to-[color:var(--brand-100)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(198,138,63,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(198,138,63,0.08),transparent_50%)]"></div>
        
        <div className="container relative py-12 lg:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-[color:var(--surface-border)]">
                <svg className="h-4 w-4 text-[color:var(--brand-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-medium text-[color:var(--brand-700)]">User Profile</span>
              </div>
              
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-3">
                  My Profile
                </h1>
                <p className="text-lg text-secondary max-w-2xl">
                  Manage your account settings, preferences, and personal information. Keep your profile up to date.
                </p>
              </div>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[color:var(--brand-600)]">{user?.role === 'AGENT' || user?.role === 'ADMIN' ? 'Agent' : 'User'}</div>
                  <div className="text-sm text-muted">Account Type</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[color:var(--brand-600)]">{name ? 'Complete' : 'Incomplete'}</div>
                  <div className="text-sm text-muted">Profile Status</div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => setActiveSection('details')}
                className="btn btn-primary px-6 py-3 text-base font-semibold shadow-lg hover:shadow-xl"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Sidebar */}
        <aside className="lg:col-span-3">
          <div className="glass space-y-6 border border-[color:var(--surface-border)] p-6 rounded-2xl shadow-lg">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-primary">Navigation</h2>
              <p className="text-sm text-secondary">Manage your account and preferences</p>
            </div>
            
            <nav>
              <ul className="space-y-2">
                {sectionIds.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActiveSection(id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                        activeSection === id
                          ? 'bg-[color:var(--brand-500-12)] text-[color:var(--brand-700)] border border-[color:var(--brand-500-28)]'
                          : 'text-secondary hover:bg-[color:var(--surface-hover)] hover:text-primary'
                      }`}
                    >
                      {id === 'overview' && (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Overview
                        </>
                      )}
                      {id === 'details' && (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Profile Details
                        </>
                      )}
                      {id === 'agency' && (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Agency
                        </>
                      )}
                      {id === 'security' && (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Security
                        </>
                      )}
                      {id === 'saved' && (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          Saved
                        </>
                      )}
                      {id === 'my-listings' && (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          My Listings
                        </>
                      )}
                      {id === 'shortcuts' && (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Agent Shortcuts
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Center: Content (pane switching) */}
        <section className="space-y-6 lg:col-span-6">
          {activeSection === 'overview' && (
            <div className="glass space-y-6 border border-[color:var(--surface-border)] p-8 rounded-2xl shadow-lg">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-primary">Account Information</h2>
                <p className="text-secondary">Your profile details and account status</p>
              </div>
              
              <div className="p-6 rounded-xl bg-white/50 border border-[color:var(--surface-border)]">
                <div className="flex items-center gap-6 mb-6">
                  {(!avatarRemoved && (initialAvatar || user?.avatar)) ? (
                    <Image
                      alt={user?.name ?? user?.email ?? 'User avatar'}
                      className="h-20 w-20 rounded-full object-cover border-4 border-white shadow-lg"
                      height={80}
                      src={(initialAvatar || (user?.avatar as string))}
                      width={80}
                    />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--brand-500-12)] text-2xl font-bold text-[color:var(--brand-700)] border-4 border-white shadow-lg">
                      {initials}
                    </span>
                  )}
                  <div>
                    <div className="text-2xl font-bold text-primary mb-1">{name || 'Unnamed User'}</div>
                    <div className="text-base text-secondary mb-1">{user?.email}</div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--brand-500-12)] text-sm font-semibold text-[color:var(--brand-700)]">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {user?.role === 'AGENT' || user?.role === 'ADMIN' ? 'Agent Account' : 'User Account'}
                    </div>
                  </div>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-xl bg-[color:var(--surface-1)] border border-[color:var(--surface-border)] text-center">
                    <div className="text-2xl font-bold text-[color:var(--brand-600)] mb-1">
                      {name && phone && jobTitle ? '100%' : name ? '75%' : '25%'}
                    </div>
                    <div className="text-sm text-secondary">Profile Complete</div>
                  </div>
                  
                  {!isAgent && (
                    <div className="p-4 rounded-xl bg-[color:var(--surface-1)] border border-[color:var(--surface-border)] text-center">
                      <div className="text-2xl font-bold text-[color:var(--brand-600)] mb-1">
                        {savedList.length > 0 ? savedList.length : 0}
                      </div>
                      <div className="text-sm text-secondary">Saved Properties</div>
                    </div>
                  )}
                  
                  {isAgent && (
                    <>
                      <div className="p-4 rounded-xl bg-[color:var(--surface-1)] border border-[color:var(--surface-border)] text-center">
                        <div className="text-2xl font-bold text-[color:var(--brand-600)] mb-1">{myListings.length}</div>
                        <div className="text-sm text-secondary">Total Listings</div>
                      </div>
                      <div className="p-4 rounded-xl bg-[color:var(--surface-1)] border border-[color:var(--surface-border)] text-center">
                        <div className="text-2xl font-bold text-[color:var(--brand-600)] mb-1">{myListings.filter(l => l.isPublished).length}</div>
                        <div className="text-sm text-secondary">Published</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isAgent && activeSection === 'saved' && (
            <div className="glass space-y-6 border border-[color:var(--surface-border)] p-8 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-primary">Saved Listings</h2>
                  <p className="text-secondary">Your favorite properties</p>
                </div>
                <Link href="/saved" className="btn btn-primary px-6 py-3 text-base font-semibold shadow-lg hover:shadow-xl">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View All Saved
                </Link>
              </div>
              
              {savedStatus && (
                <div className="p-4 rounded-xl bg-[color:var(--brand-500-12)] border border-[color:var(--brand-500-28)]">
                  <div className="text-sm text-[color:var(--brand-700)]">{savedStatus}</div>
                </div>
              )}
              
              {!savedStatus && savedList.length === 0 && (
                <div className="text-center py-12">
                  <div className="p-4 rounded-full bg-[color:var(--brand-500-12)] w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <svg className="h-8 w-8 text-[color:var(--brand-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-primary mb-2">No saved listings yet</h3>
                  <p className="text-secondary mb-4">Start building your collection by saving properties you like.</p>
                  <Link href="/listings" className="btn btn-primary">Browse Properties</Link>
                </div>
              )}
              
              {!savedStatus && savedList.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {savedList.map((l) => {
                    const imageSrc = l.coverImage ? `/api/files/binary?path=${encodeURIComponent(l.coverImage)}&listingId=${encodeURIComponent(l.id)}` : null
                    return (
                      <Link key={l.id} href={`/listings/${l.id}`} className="group rounded-2xl border border-[color:var(--surface-border)] bg-white shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                        <div className="h-32 bg-gray-100">
                          {imageSrc ? (
                            <Image alt={l.title} src={imageSrc} width={320} height={128} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">No Image</div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="truncate text-base font-semibold text-primary mb-2">{l.title}</div>
                          {typeof l.basePrice === 'number' && (
                            <div className="text-sm text-[color:var(--brand-600)] font-medium">{formatPrice(l.basePrice, l.currency || 'ETB')}</div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {isAgent && activeSection === 'my-listings' && (
            <div className="glass space-y-6 border border-[color:var(--surface-border)] p-8 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-primary">My Listings</h2>
                  <p className="text-secondary">Manage your property listings</p>
                </div>
                <Link href="/agent/my-listings" className="btn btn-primary px-6 py-3 text-base font-semibold shadow-lg hover:shadow-xl">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View All Listings
                </Link>
              </div>
              
              {myStatus && (
                <div className="p-4 rounded-xl bg-[color:var(--brand-500-12)] border border-[color:var(--brand-500-28)]">
                  <div className="text-sm text-[color:var(--brand-700)]">{myStatus}</div>
                </div>
              )}
              
              {!myStatus && myListings.length === 0 && (
                <div className="text-center py-12">
                  <div className="p-4 rounded-full bg-[color:var(--brand-500-12)] w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <svg className="h-8 w-8 text-[color:var(--brand-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-primary mb-2">No listings yet</h3>
                  <p className="text-secondary mb-4">Start building your portfolio by publishing properties from the Units dashboard.</p>
                  <Link href="/agent/units" className="btn btn-primary">Units Dashboard</Link>
                </div>
              )}
              
              {!myStatus && myListings.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {myListings.map((l) => {
                    const imageSrc = l.coverImage ? `/api/files/binary?path=${encodeURIComponent(l.coverImage)}&listingId=${encodeURIComponent(l.id)}` : null
                    return (
                      <div key={l.id} className="group rounded-2xl border border-[color:var(--surface-border)] bg-white shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                        <Link href={`/listings/${l.id}`} className="block">
                          <div className="relative h-32 bg-gray-100">
                            {imageSrc ? (
                              <Image alt={l.title} src={imageSrc} width={320} height={128} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">No Image</div>
                            )}
                            <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${l.isPublished ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>{l.isPublished ? 'Published' : 'Draft'}</span>
                          </div>
                          <div className="p-4">
                            <div className="truncate text-base font-semibold text-primary mb-2">{l.title}</div>
                            {typeof l.basePrice === 'number' && (
                              <div className="text-sm text-[color:var(--brand-600)] font-medium">{formatPrice(l.basePrice, l.currency || 'ETB')}</div>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-3">
                          {l.unitId && (
                            <Link href={`/agent/units/${encodeURIComponent(l.unitId)}/publish`} className="btn btn-secondary btn-sm">Manage</Link>
                          )}
                          <Link href={`/listings/${l.id}`} className="btn btn-primary btn-sm">Open</Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {(activeSection === 'details' || (activeSection === 'agency' && isAgent)) && (
            <form id="profile-details-form" onSubmit={saveProfile} className="glass space-y-6 border border-[color:var(--surface-border)] p-8 rounded-2xl shadow-lg">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-primary">
                  {activeSection === 'details' ? 'Profile Details' : 'Agency Information'}
                </h2>
                <p className="text-secondary">
                  {activeSection === 'details' ? 'Update your personal information and profile settings' : 'Manage your agency details and branding'}
                </p>
              </div>

              {activeSection === 'details' && (
                <>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {(!avatarRemoved && (avatarPreview || initialAvatar || user?.avatar)) ? (
                        <Image
                          alt={user?.name ?? user?.email ?? 'User avatar'}
                          className="h-20 w-20 rounded-full object-cover"
                          height={80}
                          src={(avatarPreview || initialAvatar || (user?.avatar as string))}
                          width={80}
                        />
                      ) : (
                        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--sand-500)]/20 text-xl font-semibold text-secondary">
                          {initials}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                        <button type="button" className="btn btn-secondary" onClick={onPickAvatar}>Change Photo</button>
                        {(!avatarRemoved && (avatarPreview || initialAvatar || user?.avatar)) && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setAvatarPreview(null)
                              setAvatarRemoved(true)
                              setProfileNotice({ type: 'success', text: 'Avatar removed. Save changes to apply.' })
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">Full Name</label>
                      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">Email</label>
                      <input className="input" value={user?.email} readOnly />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">Phone</label>
                      <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555 123 4567" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">Job Title</label>
                      <input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Agent" />
                    </div>
                  </div>
                </>
              )}

              {activeSection === 'agency' && isAgent && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary">Agency Name</label>
                    <input className="input" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Your agency" />
                  </div>
                </div>
              )}

              {profileNotice && (
                <div
                  className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${
                    profileNotice.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {profileNotice.text}
                </div>
              )}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          )}

          {activeSection === 'security' && (
            <form id="security-form" onSubmit={changePassword} className="glass space-y-6 border border-[color:var(--surface-border)] p-8 rounded-2xl shadow-lg">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-primary">Security Settings</h2>
                <p className="text-secondary">Manage your account security and password settings</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">Current Password</label>
                  <input className="input" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">New Password</label>
                  <input className="input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">Confirm Password</label>
                  <input className="input" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
                </div>
              </div>
              {passwordNotice && (
                <div
                  className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${
                    passwordNotice.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {passwordNotice.text}
                </div>
              )}
              <div className="mt-6 flex items-center justify-end">
                <button type="submit" className="btn btn-primary">Change Password</button>
              </div>
            </form>
          )}

          {isAgent && activeSection === 'shortcuts' && (
            <div className="glass space-y-6 border border-[color:var(--surface-border)] p-8 rounded-2xl shadow-lg">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-primary">Agent Shortcuts</h2>
                <p className="text-secondary">Quick access to your most-used agent tools and features</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <Link href="/agent/upload" className="btn btn-secondary p-4 text-center">
                  <svg className="h-6 w-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload New Unit
                </Link>
                <Link href="/agent/units" className="btn btn-secondary p-4 text-center">
                  <svg className="h-6 w-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  My Units
                </Link>
                <Link href="/agent/review" className="btn btn-secondary p-4 text-center">
                  <svg className="h-6 w-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Review Drafts
                </Link>
                <Link href="/agent/dashboard" className="btn btn-secondary p-4 text-center">
                  <svg className="h-6 w-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Dashboard
                </Link>
                <Link href="/agent/materials-manager" className="btn btn-secondary p-4 text-center">
                  <svg className="h-6 w-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                  </svg>
                  Materials
                </Link>
                <Link href="/agent/models" className="btn btn-secondary p-4 text-center">
                  <svg className="h-6 w-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Models
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Right: Sticky actions */}
        <aside className="lg:col-span-3">
          <div className="sticky top-28 space-y-6">
            <div className="glass space-y-4 border border-[color:var(--surface-border)] p-6 rounded-2xl shadow-lg">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-primary">Quick Actions</h3>
                <p className="text-sm text-secondary">Common tasks and shortcuts</p>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  className="btn btn-secondary w-full justify-start"
                  onClick={() => {
                    setActiveSection('security')
                    setTimeout(() => {
                      document.getElementById('security-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
                    }, 0)
                  }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Change Password
                </button>
                {isAgent ? (
                  <Link href="/agent/dashboard" className="btn btn-secondary w-full justify-start">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Agent Dashboard
                  </Link>
                ) : (
                  <Link href="/listings" className="btn btn-secondary w-full justify-start">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Browse Listings
                  </Link>
                )}
                <button type="button" className="btn btn-primary w-full justify-start" onClick={logout}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>

            <div className="glass space-y-4 border border-[color:var(--surface-border)] p-6 rounded-2xl shadow-lg">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-primary">Account Info</h3>
                <p className="text-sm text-secondary">Your account details</p>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/50 border border-[color:var(--surface-border)]">
                  <div className="text-xs text-secondary mb-1">Email</div>
                  <div className="text-sm font-medium text-primary">{user?.email}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/50 border border-[color:var(--surface-border)]">
                  <div className="text-xs text-secondary mb-1">Role</div>
                  <div className="text-sm font-medium text-primary uppercase">{user?.role}</div>
                </div>
                {lastSaved && (
                  <div className="p-3 rounded-xl bg-white/50 border border-[color:var(--surface-border)]">
                    <div className="text-xs text-secondary mb-1">Last Saved</div>
                    <div className="text-sm font-medium text-primary">{new Date(lastSaved).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
        </div>
      </div>
    </div>
  )
}


