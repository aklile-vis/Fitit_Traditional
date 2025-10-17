"use client"

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'

export default function AutoRenderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState('Preparing…')

  useEffect(() => {
    let engine: BABYLON.Engine | null = null
    let scene: BABYLON.Scene | null = null
    const run = async () => {
      try {
        // load unit to get GLB and bookmarks
        const ur = await fetch(`/api/units/${id}`)
        const uj = await ur.json()
        if (!ur.ok || !uj?.file?.glbPath) { setStatus(uj.error || 'No GLB'); return }
        const er = await fetch(`/api/units/${id}/editor-state`)
        const ej = await er.json()
        const bookmarks = ej?.editorState?.bookmarks || []

        const canvas = canvasRef.current!
        engine = new BABYLON.Engine(canvas, true)
        scene = new BABYLON.Scene(engine)
        scene.createDefaultEnvironment({ createGround: false, createSkybox: false })
        scene.clearColor = new BABYLON.Color4(0,0,0,1)
        const camera = new BABYLON.ArcRotateCamera('cam', Math.PI/2, Math.PI/3, 8, new BABYLON.Vector3(0,1.3,0), scene)
        camera.attachControl(canvas, false)
        const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0,1,0), scene)
        hemi.intensity = 0.9
        const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.5,-1,-0.3), scene)
        dir.intensity = 0.6
        await new Promise<void>((resolve) => {
          BABYLON.SceneLoader.Append('', `/api/files/binary?path=${encodeURIComponent(uj.file.glbPath)}&listingId=${encodeURIComponent(uj.listing?.id || '')}` , scene!, () => resolve())
        })

        const capture = async (name: string) => {
          return new Promise<string>((resolveCap) => {
            scene!.render()
            canvas.toBlob(async (blob) => {
              if (!blob) return resolveCap('')
              const fd = new FormData()
              fd.append('unitId', String(id))
              if (uj?.listing?.id) fd.append('listingId', uj.listing.id)
              fd.append('image', new File([blob], `${name}.png`, { type: 'image/png' }))
              const r = await fetch('/api/renders', { method: 'POST', body: fd })
              const js = await r.json()
              resolveCap(r.ok ? (js.path || '') : '')
            }, 'image/png')
          })
        }

        const shots: Array<{ name: string; alpha: number; beta: number; radius: number; target: {x:number;y:number;z:number} }> = []
        // default angles
        shots.push({ name: 'overview', alpha: Math.PI/2, beta: Math.PI/3, radius: 10, target: { x:0, y:1.3, z:0 } })
        shots.push({ name: 'corner', alpha: Math.PI*0.75, beta: Math.PI/3, radius: 9, target: { x:1, y:1.3, z:1 } })
        // bookmarks
        for (const bm of bookmarks) {
          shots.push({ name: bm.name || 'view', alpha: bm.alpha, beta: bm.beta, radius: bm.radius, target: bm.target })
        }

        setStatus(`Rendering ${shots.length} views…`)
        for (const s of shots) {
          camera.alpha = s.alpha; camera.beta = s.beta; camera.radius = s.radius
          camera.setTarget(new BABYLON.Vector3(s.target.x, s.target.y, s.target.z))
          await new Promise(res => setTimeout(res, 200))
          await capture(s.name)
        }
        setStatus('Done. Redirecting…')
        setTimeout(() => router.push(`/agent/units/${id}`), 400)
      } catch (e: any) {
        setStatus(e?.message || 'Render error')
      }
    }
    run()
    return () => { try { engine?.dispose(); scene?.dispose() } catch {} }
  }, [id, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--app-background)] p-6 text-primary">
      <canvas ref={canvasRef} className="w-[960px] h-[540px] hidden"/>
      <div className="rounded-full border border-surface bg-surface-1 px-4 py-2 text-secondary shadow-[var(--shadow-soft)]">
        {status}
      </div>
    </div>
  )
}
