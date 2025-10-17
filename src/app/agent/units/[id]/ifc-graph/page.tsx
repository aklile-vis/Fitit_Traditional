"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Node = { id: string; type: string }
type Edge = { from: string; to: string }

export default function IfcGraphPage() {
  const { id } = useParams<{ id: string }>()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setStatus('Loading IFC graph…')
      const r = await fetch(`/api/ifc/graph?unitId=${id}`)
      const js = await r.json()
      if (!r.ok) { setStatus(js.error || 'Failed to load graph'); return }
      setNodes(js.nodes || [])
      setEdges(js.edges || [])
      setStatus('')
    }
    load()
  }, [id])

  const filteredEdges = selected ? edges.filter(e => e.from === selected || e.to === selected) : edges.slice(0, 200)
  const neighbors = new Set<string>()
  filteredEdges.forEach(e => { neighbors.add(e.from); neighbors.add(e.to) })

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] p-4 text-primary">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-2xl font-bold">IFC Graph • Unit {id}</h1>
        {status && <div className="mb-3 text-sm text-secondary">{status}</div>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border border-surface bg-surface-1 p-3 shadow-[var(--shadow-soft)]">
            <div className="mb-2 text-sm text-muted">Showing {filteredEdges.length} edges • {neighbors.size} nodes (subset)</div>
            <svg className="h-[70vh] w-full rounded bg-surface-2" viewBox="0 0 800 600">
              {/* naive layout: place neighbor nodes around a circle */}
              {Array.from(neighbors).map((nid, idx, arr) => {
                const angle = (idx / Math.max(arr.length,1)) * Math.PI * 2
                const x = 400 + 250 * Math.cos(angle)
                const y = 300 + 200 * Math.sin(angle)
                return (
                  <g key={nid} onClick={() => setSelected(nid)} cursor="pointer">
                    <circle cx={x} cy={y} r={selected===nid?8:5} fill={selected===nid?'var(--success-500)':'var(--accent-500)'} />
                    {selected===nid && (
                      <text x={x+10} y={y-10} fill="currentColor" fontSize="10" className="text-secondary">{nid} {nodes.find(n=>n.id===nid)?.type||''}</text>
                    )}
                  </g>
                )
              })}
              {filteredEdges.map((e, i) => {
                const a = Array.from(neighbors).indexOf(e.from)
                const b = Array.from(neighbors).indexOf(e.to)
                if (a < 0 || b < 0) return null
                const angleA = (a / Math.max(neighbors.size,1)) * Math.PI * 2
                const angleB = (b / Math.max(neighbors.size,1)) * Math.PI * 2
                const x1 = 400 + 250 * Math.cos(angleA)
                const y1 = 300 + 200 * Math.sin(angleA)
                const x2 = 400 + 250 * Math.cos(angleB)
                const y2 = 300 + 200 * Math.sin(angleB)
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--surface-border)" strokeWidth="1" />
              })}
            </svg>
          </div>
          <div className="space-y-3 rounded-2xl border border-surface bg-surface-1 p-3 shadow-[var(--shadow-soft)]">
            <h2 className="font-semibold text-primary">Entities</h2>
            <input placeholder="Filter type (e.g. IFCSLAB)" className="input" onChange={e=>{
              const v = e.target.value.trim().toUpperCase()
              const n = nodes.find(n=>n.type.includes(v))
              setSelected(n?.id || null)
            }} />
            <div className="max-h-[60vh] space-y-1 overflow-auto text-xs">
              {nodes.slice(0,500).map(n => (
                <button key={n.id} className={`w-full rounded px-2 py-1 text-left transition-colors ${selected===n.id?'bg-[color:var(--accent-500)]/20 text-primary':'bg-surface-2 hover:bg-surface-hover'}`} onClick={()=>setSelected(n.id)}>
                  {n.id} — {n.type}
                </button>
              ))}
              {nodes.length===0 && <div className="text-sm text-muted">No nodes parsed.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
