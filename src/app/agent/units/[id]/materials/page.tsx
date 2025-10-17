"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'

type Library = { id: string; name: string }
type Option = { id: string; name: string; category: string; unit: string; price: number }
type Whitelist = { id: string; optionId: string; overridePrice: number | null; option: Option }

export default function UnitMaterialsPage() {
  const params = useParams<{ id: string }>()
  const unitId = params?.id
  const [libs, setLibs] = useState<Library[]>([])
  const [libId, setLibId] = useState<string>('')
  const [opts, setOpts] = useState<Option[]>([])
  const [wl, setWl] = useState<Whitelist[]>([])
  const [status, setStatus] = useState('')
  const { token, user, isAuthenticated } = useAuth()
  const isAgent = user?.role === 'AGENT' || user?.role === 'ADMIN'

  const loadLibs = async () => {
    if (!isAuthenticated || !isAgent) return
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const r = await fetch('/api/materials/libraries', { headers })
    const js = await r.json()
    if (r.ok) {
      setLibs(js)
      if (!libId && js.length) setLibId(js[0].id)
    }
  }
  const loadOpts = async (id: string) => {
    if (!isAuthenticated || !isAgent) return
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const r = await fetch(`/api/materials/options?libraryId=${id}`, { headers })
    const js = await r.json()
    if (r.ok) setOpts(js)
  }
  const loadWl = async () => {
    if (!unitId) return
    const r = await fetch(`/api/units/${unitId}/materials`)
    const js = await r.json()
    if (r.ok) setWl(js)
  }

  useEffect(() => {
    if (!isAuthenticated || !isAgent) return
    loadLibs()
    loadWl()
  }, [unitId, isAuthenticated, isAgent, token])
  useEffect(() => { if (libId) loadOpts(libId) }, [libId, token])

  const addToWhitelist = async (optionId: string, overridePrice?: number) => {
    if (!unitId) return
    if (!isAuthenticated || !isAgent) { setStatus('Authentication required'); return }
    setStatus('Saving…')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const r = await fetch(`/api/units/${unitId}/materials`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ optionId, overridePrice })
    })
    if (r.ok) { setStatus(''); loadWl() } else { setStatus('Failed to save') }
  }
  const removeFromWhitelist = async (optionId: string) => {
    if (!unitId) return
    if (!isAuthenticated || !isAgent) { setStatus('Authentication required'); return }
    setStatus('Deleting…')
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const r = await fetch(`/api/units/${unitId}/materials?optionId=${optionId}`, {
      method: 'DELETE',
      headers,
    })
    if (r.ok) { setStatus(''); loadWl() } else { setStatus('Failed to delete') }
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] p-6 text-primary">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-2xl font-bold">Unit Materials Whitelist</h1>
        <div className="mb-4 text-sm text-muted">Unit: {unitId}</div>
        {status && <div className="mb-3 text-sm text-secondary">{status}</div>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="surface-soft space-y-3 p-4">
            <h2 className="font-semibold text-primary">Material Options</h2>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-secondary">Library</span>
              <select className="select" value={libId} onChange={e => setLibId(e.target.value)}>
                {libs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="max-h-[400px] space-y-2 overflow-auto">
              {opts.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-surface bg-surface-1 p-3">
                  <div>
                    <div className="font-semibold text-primary">{o.name}</div>
                    <div className="text-sm text-muted">{o.category} • {o.unit} • ${o.price.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.01" placeholder="Override" className="input w-28" id={`ov-${o.id}`} />
                    <button className="btn btn-primary" onClick={() => {
                      const val = (document.getElementById(`ov-${o.id}`) as HTMLInputElement)?.value
                      addToWhitelist(o.id, val ? parseFloat(val) : undefined)
                    }}>Allow</button>
                  </div>
                </div>
              ))}
              {opts.length === 0 && <div className="text-sm text-muted">No options in this library.</div>}
            </div>
          </div>

          <div className="surface-soft space-y-3 p-4">
            <h2 className="font-semibold text-primary">Whitelist</h2>
            <div className="max-h-[400px] space-y-2 overflow-auto">
              {wl.map(w => (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-surface bg-surface-1 p-3">
                  <div>
                    <div className="font-semibold text-primary">{w.option.name}</div>
                    <div className="text-sm text-muted">{w.option.category} • {w.option.unit} • Base ${w.option.price.toFixed(2)} {w.overridePrice!=null && <>• Override ${w.overridePrice.toFixed(2)}</>}</div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => removeFromWhitelist(w.optionId)}>Remove</button>
                </div>
              ))}
              {wl.length === 0 && <div className="text-sm text-muted">No materials whitelisted for this unit.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
