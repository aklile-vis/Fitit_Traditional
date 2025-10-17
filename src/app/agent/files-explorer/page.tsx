"use client"

import { useEffect, useState } from 'react'

type Item = { name: string; path: string; isDir: boolean; size: number; mtime: number }

export default function FilesExplorer() {
  const [dir, setDir] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string>('')
  const [root, setRoot] = useState<'models' | 'processed' | 'uploads' | 'status' | 'output'>('models')

  const load = async (params?: { dir?: string; root?: string }) => {
    setError('')
    const search = new URLSearchParams()
    if (params?.dir) search.set('dir', params.dir)
    else search.set('root', (params?.root || root) as string)
    const res = await fetch(`/api/files/list?${search.toString()}`)
    const js = await res.json()
    if (!res.ok) {
      setError(js.error || 'Failed to list directory')
      return
    }
    setDir(js.dir)
    setItems(js.items)
  }

  useEffect(() => { load({ root }) }, [root])

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] p-6 text-primary">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold">Files Explorer</h1>
        <div className="flex flex-wrap gap-2">
          {(['models','processed','uploads','status','output'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoot(r)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${root === r ? 'bg-[color:var(--sand-500)] text-overlay shadow-[var(--shadow-soft)]' : 'border border-surface bg-surface-1 text-secondary hover:border-surface-strong hover:bg-surface-hover hover:text-primary'}`}
              type="button"
            >
              {r}
            </button>
          ))}
        </div>
        <div className="text-sm text-secondary">Current: {dir || '(loading...)'}</div>
        {error && (
          <div className="rounded-xl border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 p-3 text-secondary">
            {error}
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-surface bg-surface-1">
          <table className="w-full text-sm text-secondary">
            <thead>
              <tr className="bg-surface-hover text-secondary">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Size</th>
                <th className="p-2 text-left">Modified</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.path} className="border-t border-surface hover:bg-surface-hover">
                  <td className="p-2">
                    {it.isDir ? (
                      <button className="text-primary underline" onClick={() => load({ dir: it.path })} type="button">{it.name}/</button>
                    ) : (
                      <span>{it.name}</span>
                    )}
                  </td>
                  <td className="p-2">{it.isDir ? '-' : `${(it.size/1024).toFixed(1)} KB`}</td>
                  <td className="p-2">{new Date(it.mtime).toLocaleString()}</td>
                  <td className="flex gap-2 p-2">
                    {!it.isDir && it.name.toLowerCase().endsWith('.glb') && (
                      <>
                        <span className="cursor-not-allowed rounded-lg border border-surface bg-surface-2 px-2 py-1 text-xs text-disabled" title="Open via Units after ingest">R3F</span>
                        <a className="rounded-lg border border-surface bg-surface-2 px-2 py-1 text-xs text-secondary transition-colors hover:border-surface-strong hover:bg-surface-hover hover:text-primary" href={`/agent/glb-simple?src=${encodeURIComponent(it.path)}`} target="_blank">Simple</a>
                      </>
                    )}
                    {!it.isDir && (it.name.toLowerCase().endsWith('.ifc') || it.name.toLowerCase().endsWith('.usd') || it.name.toLowerCase().endsWith('.txt') || it.name.toLowerCase().endsWith('.glb')) && (
                      <a className="rounded-lg border border-surface bg-surface-2 px-2 py-1 text-xs text-secondary transition-colors hover:border-surface-strong hover:bg-surface-hover hover:text-primary" href={`/api/files/binary?path=${encodeURIComponent(it.path)}`} target="_blank">Download</a>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td className="p-3 text-muted" colSpan={4}>Empty directory</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
