'use client'

import {
  AdaptiveDpr,
  AdaptiveEvents,
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
  useProgress,
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import {
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="rounded-full border border-overlay bg-[color:var(--overlay-900)] px-6 py-3 text-sm font-medium text-overlay shadow-[var(--shadow-soft)] backdrop-blur">
        Loading {progress.toFixed(0)}%
      </div>
    </Html>
  )
}

function Model({ url }: { url: string }) {
  const gltf = useGLTF(url, true)
  return <primitive object={gltf.scene} />
}

export interface GLBViewerHandle {
  resetView: () => void
}

export const GLBViewerCanvas = forwardRef<GLBViewerHandle, { url: string }>(({ url }, ref) => {
  const controlsRef = useRef<any>(null)

  const defaultPosition = useMemo(() => new THREE.Vector3(6, 4, 8), [])
  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  const resetView = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object
    camera.position.set(defaultPosition.x, defaultPosition.y, defaultPosition.z)
    controls.target.copy(defaultTarget)
    controls.update()
  }, [defaultPosition, defaultTarget])

  useEffect(() => {
    if (controlsRef.current) {
      resetView()
    }
  }, [resetView])

  useImperativeHandle(ref, () => ({ resetView }), [resetView])

  return (
    <div className="relative h-full w-full">
      <Canvas
        className="h-full w-full"
        shadows
        camera={{ position: [6, 4, 8], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <color attach="background" args={[0xfefbf6]} />
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[8, 12, 8]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-6, 8, -4]} intensity={0.35} />
        <Suspense fallback={<Loader />}>
          <Model url={url} />
          <Environment preset="sunset" />
          <ContactShadows position={[0, -0.01, 0]} blur={1.5} opacity={0.65} scale={40} far={40} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          enablePan
          minDistance={2}
          maxDistance={40}
        />
      </Canvas>
      <div className="pointer-events-none absolute top-4 left-4 rounded-2xl border border-surface bg-surface-1 p-4 text-xs text-secondary shadow-[var(--shadow-soft)]">
        <p className="text-sm font-semibold text-primary">Move around</p>
        <ul className="mt-2 space-y-1">
          <li>• Click and drag to look around</li>
          <li>• Right-click and drag to slide sideways</li>
          <li>• Scroll to zoom in or out</li>
          <li>• Tap once, then drag on touch devices</li>
        </ul>
      </div>
    </div>
  )
})

useGLTF.preload('/placeholder.glb')

export default GLBViewerCanvas
