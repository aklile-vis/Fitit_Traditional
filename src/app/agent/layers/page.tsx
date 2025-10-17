"use client"

import { useEffect, useState } from 'react'

export default function LayerMappingEditor() {
  const [jsonText, setJsonText] = useState('')
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      setStatus('Loading...')
      const res = await fetch('/api/config/layer-mapping')
      if (!res.ok) {
        setStatus('Failed to load mapping')
        return
      }
      const data = await res.json()
      setJsonText(JSON.stringify(data, null, 2))
      setStatus('')
    }
    load()
  }, [])

  const save = async () => {
    try {
      setStatus('Saving...')
      const parsed = JSON.parse(jsonText)
      const res = await fetch('/api/config/layer-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('Saved!')
      setTimeout(() => setStatus(''), 1500)
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'Invalid JSON'}`)
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-primary">Layer Mapping</h1>
          <p className="text-secondary">Edit aliases, fallbacks, and tolerances. This config powers layer → element mapping for robust detection.</p>
          {status && <div className="text-sm text-muted">{status}</div>}
        </header>
        <textarea
          className="h-[480px] w-full rounded-2xl border border-surface bg-[color:var(--surface-1)] p-4 font-mono text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)]"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={save} className="btn btn-primary" type="button">Save</button>
          <a href="/agent/upload" className="btn btn-secondary">Back to Upload</a>
        </div>
      </div>
    </div>
  )
}
