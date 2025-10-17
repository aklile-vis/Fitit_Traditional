"use client"

import { useEffect, useState } from 'react'

type Library = { id: string; name: string }
type Option = { id: string; name: string; category: string; unit: string; price: number }

export default function MaterialsManager() {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [currentLib, setCurrentLib] = useState<string>('')
  const [opts, setOpts] = useState<Option[]>([])
  const [status, setStatus] = useState('')

  const loadLibs = async () => {
    setStatus('Loading libraries…')
    const r = await fetch('/api/materials/libraries')
    const js = await r.json()
    if (r.ok) {
      setLibraries(js)
      if (!currentLib && js.length) setCurrentLib(js[0].id)
      setStatus('')
    } else setStatus(js.error || 'Failed')
  }
  const loadOpts = async (libId: string) => {
    const r = await fetch(`/api/materials/options?libraryId=${libId}`)
    const js = await r.json()
    if (r.ok) setOpts(js)
  }
  useEffect(() => { loadLibs() }, [])
  useEffect(() => { if (currentLib) loadOpts(currentLib) }, [currentLib])

  const createLib = async (name: string) => {
    const r = await fetch('/api/materials/libraries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    if (r.ok) loadLibs()
  }

  const createOpt = async (data: any) => {
    data.libraryId = currentLib
    const r = await fetch('/api/materials/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (r.ok) loadOpts(currentLib)
  }

  const ensureDefault = async () => {
    setStatus('Ensuring default library…')
    await fetch('/api/materials/seed', { method: 'POST' })
    await loadLibs()
    setStatus('')
  }

  const duplicateCurrent = async () => {
    if (!currentLib) return
    // TODO: Replace with proper input modal
    const name = 'Copy of ' + currentLib.name
    setStatus('Duplicating library…')
    // Create new library
    const make = await fetch('/api/materials/libraries', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name }) })
    if (!make.ok) { setStatus('Failed to create new library'); return }
    const newLib = await make.json()
    // Fetch options from current and replicate
    const r = await fetch(`/api/materials/options?libraryId=${currentLib}`)
    const js = await r.json()
    if (r.ok && Array.isArray(js)) {
      for (const o of js) {
        await fetch('/api/materials/options', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({
          name: o.name,
          category: o.category,
          unit: o.unit,
          price: o.price,
          description: o.description,
          baseColorHex: o.baseColorHex,
          roughness: o.roughness,
          metallic: o.metallic,
          albedoUrl: o.albedoUrl,
          normalUrl: o.normalUrl,
          roughnessMapUrl: o.roughnessMapUrl,
          metallicMapUrl: o.metallicMapUrl,
          aoMapUrl: o.aoMapUrl,
          tilingScale: o.tilingScale,
          libraryId: newLib.id,
        }) })
      }
    }
    await loadLibs()
    setCurrentLib(newLib.id)
    setStatus('')
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] p-6 text-primary">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Materials Manager</h1>
          {status && <div className="text-sm text-secondary">{status}</div>}
        </header>

        <div className="surface-soft space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-secondary">Library:</span>
            <select
              className="rounded-xl border border-surface bg-[color:var(--surface-input)] px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
              value={currentLib}
              onChange={e => setCurrentLib(e.target.value)}
            >
              {libraries.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => {
                // TODO: Replace with proper input modal
                createLib('New Library')
              }}
              type="button"
            >
              New Library
            </button>
            <button className="btn btn-secondary" onClick={ensureDefault} type="button">
              Use Default
            </button>
            <button
              className="btn btn-secondary"
              onClick={duplicateCurrent}
              disabled={!currentLib}
              type="button"
            >
              Duplicate
            </button>
          </div>
          <div className="text-sm text-muted">Total options: {opts.length}</div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="surface-soft space-y-3 p-5">
            <h2 className="font-semibold">Create Option</h2>
            <form onSubmit={async e => {
              e.preventDefault()
              const formEl = e.currentTarget as HTMLFormElement
              const fd = new FormData(formEl)
              await createOpt({
                name: fd.get('name'),
                category: fd.get('category'),
                unit: fd.get('unit'),
                price: parseFloat(String(fd.get('price')||'0')),
                baseColorHex: fd.get('baseColorHex'),
                tilingScale: parseFloat(String(fd.get('tilingScale')||'1')),
                albedoUrl: fd.get('albedoUrl'),
                normalUrl: fd.get('normalUrl'),
                roughnessMapUrl: fd.get('roughnessMapUrl'),
                metallicMapUrl: fd.get('metallicMapUrl'),
                aoMapUrl: fd.get('aoMapUrl'),
              })
              formEl.reset()
            }} className="space-y-2">
              <input name="name" placeholder="Name" className="input" required />
              <input name="category" placeholder="Category (wall|floor|ceiling...)" className="input" required />
              <input name="unit" placeholder="Unit (m2|unit|m)" className="input" required />
              <input name="price" type="number" step="0.01" placeholder="Price" className="input" required />
              <div className="grid grid-cols-2 gap-2">
                <input name="baseColorHex" placeholder="#RRGGBB (optional)" className="input" />
                <input name="tilingScale" type="number" step="0.1" placeholder="Tiling Scale (1.0)" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="albedoUrl" placeholder="Albedo URL" className="input" />
                <input name="normalUrl" placeholder="Normal URL" className="input" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input name="roughnessMapUrl" placeholder="Roughness URL" className="input" />
                <input name="metallicMapUrl" placeholder="Metallic URL" className="input" />
                <input name="aoMapUrl" placeholder="AO URL" className="input" />
              </div>
              <button className="btn btn-primary" type="submit">Create</button>
            </form>
          </div>
          <div className="surface-soft space-y-3 p-5">
            <h2 className="font-semibold">Options</h2>
            <div className="max-h-[360px] space-y-2 overflow-auto">
              {opts.map(o => (
                <div key={o.id} className="rounded-xl border border-surface bg-[color:var(--surface-1)] p-3">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold text-primary">{o.name}</div>
                      <div className="text-sm text-muted">{o.category} • {o.unit} • ${o.price.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {opts.length === 0 && <div className="text-sm text-muted">No options yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
