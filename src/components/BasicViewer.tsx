// @ts-nocheck

/**
 * Basic 3D Viewer Component using Three.js
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface ViewerPoint {
  x: number;
  y: number;
  z?: number;
}

interface ViewerElement {
  id?: string;
  type?: string;
  points?: ViewerPoint[];
  color?: string;
  height?: number;
  thickness?: number;
  [key: string]: unknown;
}

interface ViewerRoom {
  id?: string;
  name?: string;
  boundary?: ViewerPoint[];
  [key: string]: unknown;
}

interface AgentViewerParams {
  wallHeight?: number;
  wallThickness?: number;
  [key: string]: unknown;
}

type SceneElementMeta = {
  isElement?: boolean;
  isPlaceholder?: boolean;
  elementIndex?: number;
  element?: ViewerElement;
  onClick?: () => void;
};

export interface BasicViewerProps {
  elements?: ViewerElement[];
  rooms?: ViewerRoom[];
  agentParams?: AgentViewerParams;
  width?: number;
  height?: number;
  onElementSelect?: (element: ViewerElement) => void;
}

export default function BasicViewer({
  elements = [],
  rooms = [],
  agentParams = {} as AgentViewerParams,
  width = 800,
  height = 600,
  onElementSelect
}: BasicViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roomCount = rooms.length;

  const createElementMesh = useCallback(
    (element: ViewerElement, params: AgentViewerParams): THREE.Mesh | null => {
      const points = Array.isArray(element.points) ? element.points : []
      if (points.length < 2) return null

      const geometry = new THREE.BufferGeometry()
      const material = new THREE.MeshLambertMaterial({
        color: typeof element.color === 'string' ? element.color : '#8B7355',
        transparent: true,
        opacity: 0.8,
      })

      const wallHeight = typeof element.height === 'number' ? element.height : params.wallHeight ?? 3.0
      const wallThickness = typeof element.thickness === 'number' ? element.thickness : params.wallThickness ?? 0.2

      const vertices: number[] = []
      const indices: number[] = []
      let vertexIndex = 0

      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i]
        const end = points[i + 1]
        if (!start || !end) continue

        const { x: startX, y: startY } = start
        const { x: endX, y: endY } = end
        if (
          typeof startX !== 'number' ||
          typeof startY !== 'number' ||
          typeof endX !== 'number' ||
          typeof endY !== 'number'
        ) {
          continue
        }

        const dx = endX - startX
        const dy = endY - startY
        const length = Math.hypot(dx, dy)
        if (length === 0) continue

        const dirX = dx / length
        const dirY = dy / length
        const normalX = -dirY
        const normalY = dirX
        const halfThickness = wallThickness / 2

        const wallVertices = [
          // Bottom face
          startX + normalX * halfThickness,
          startY + normalY * halfThickness,
          0,
          startX - normalX * halfThickness,
          startY - normalY * halfThickness,
          0,
          endX - normalX * halfThickness,
          endY - normalY * halfThickness,
          0,
          endX + normalX * halfThickness,
          endY + normalY * halfThickness,
          0,

          // Top face
          startX + normalX * halfThickness,
          startY + normalY * halfThickness,
          wallHeight,
          startX - normalX * halfThickness,
          startY - normalY * halfThickness,
          wallHeight,
          endX - normalX * halfThickness,
          endY - normalY * halfThickness,
          wallHeight,
          endX + normalX * halfThickness,
          endY + normalY * halfThickness,
          wallHeight,
        ]

        vertices.push(...wallVertices)

        const baseIndex = vertexIndex
        const faces = [
          baseIndex,
          baseIndex + 1,
          baseIndex + 2,
          baseIndex,
          baseIndex + 2,
          baseIndex + 3,

          baseIndex + 4,
          baseIndex + 6,
          baseIndex + 5,
          baseIndex + 4,
          baseIndex + 7,
          baseIndex + 6,

          baseIndex,
          baseIndex + 4,
          baseIndex + 5,
          baseIndex,
          baseIndex + 5,
          baseIndex + 1,

          baseIndex + 1,
          baseIndex + 5,
          baseIndex + 6,
          baseIndex + 1,
          baseIndex + 6,
          baseIndex + 2,

          baseIndex + 2,
          baseIndex + 6,
          baseIndex + 7,
          baseIndex + 2,
          baseIndex + 7,
          baseIndex + 3,

          baseIndex + 3,
          baseIndex + 7,
          baseIndex + 4,
          baseIndex + 3,
          baseIndex + 4,
          baseIndex,
        ]

        indices.push(...faces)
        vertexIndex += 8
      }

      if (vertices.length === 0) return null

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true

      if (onElementSelect) {
        mesh.userData.onClick = () => onElementSelect(element)
      }

      return mesh
    },
    [onElementSelect]
  )

  const generate3DElements = useCallback(
    (scene: THREE.Scene, sceneElements: ViewerElement[], params: AgentViewerParams) => {
      const objectsToRemove = scene.children.filter((child) => {
        const meta = child.userData as SceneElementMeta | undefined
        return meta?.isElement === true
      })
      objectsToRemove.forEach((object) => scene.remove(object))

      const workingElements = Array.isArray(sceneElements) ? sceneElements : []
      if (workingElements.length === 0) {
        addPlaceholder(scene)
        return
      }

      workingElements.forEach((element, index) => {
        try {
          const mesh = createElementMesh(element, params)
          if (mesh) {
            mesh.userData = {
              ...(mesh.userData as SceneElementMeta),
              isElement: true,
              elementIndex: index,
              element,
            }
            scene.add(mesh)
          }
        } catch (err) {
          console.warn(`Error creating mesh for element ${index}:`, err)
        }
      })
    },
    [createElementMesh]
  )

  useEffect(() => {
    if (!mountRef.current) return;

    try {
      // Initialize Three.js scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);
      sceneRef.current = scene;

      // Initialize camera
      const camera = new THREE.PerspectiveCamera(
        75,
        width / height,
        0.1,
        1000
      );
      camera.position.set(10, 10, 10);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Initialize renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      // Add renderer to DOM
      mountRef.current.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.enablePan = true;
      controls.screenSpacePanning = true;
      controls.minDistance = 2;
      controls.maxDistance = 200;
      controls.maxPolarAngle = Math.PI * 0.95;

      const handleResize = () => {
        if (!rendererRef.current || !cameraRef.current || !mountRef.current) return;
        const { clientWidth, clientHeight } = mountRef.current;
        const nextWidth = clientWidth || width;
        const nextHeight = clientHeight || height;
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight);
      };
      window.addEventListener('resize', handleResize);

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      // Add grid
      const gridHelper = new THREE.GridHelper(20, 20);
      gridHelper.position.y = -0.01;
      scene.add(gridHelper);

      // Add axes helper
      const axesHelper = new THREE.AxesHelper(5);
      scene.add(axesHelper);

      // Generate 3D elements
      generate3DElements(scene, elements, agentParams);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing 3D viewer:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize 3D viewer');
      setIsLoading(false);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [agentParams, elements, generate3DElements, height, width]);

  const addPlaceholder = (scene: THREE.Scene) => {
    // Add a placeholder cube when no elements are available
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0xcccccc,
      transparent: true,
      opacity: 0.5
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 1, 0);
    cube.userData.isElement = true;
    cube.userData.isPlaceholder = true;
    scene.add(cube);

    // Add text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 256;
      canvas.height = 64;
      context.fillStyle = '#000000';
      context.font = '16px Arial';
      context.textAlign = 'center';
      context.fillText('No 3D Model Available', 128, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const textGeometry = new THREE.PlaneGeometry(4, 1);
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(0, 3, 0);
    textMesh.userData.isElement = true;
    textMesh.userData.isPlaceholder = true;
    scene.add(textMesh);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--brand-600)] mx-auto mb-2"></div>
          <p className="text-gray-600">Loading 3D Model...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error Loading 3D Model</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div 
        ref={mountRef} 
        className="w-full h-full"
        style={{ width, height }}
      />
      
      {/* Controls overlay */}
      <div className="absolute top-4 left-4 bg-white/95 rounded-lg p-3 shadow-lg text-gray-700">
        <h3 className="font-semibold text-sm mb-2">How to move</h3>
        <div className="text-xs space-y-1">
          <p>• Click and drag to look around</p>
          <p>• Right-click and drag to slide across the floor</p>
          <p>• Scroll to zoom in or out</p>
          <p>• Tap once, then drag on touch screens</p>
          <p>• Rooms detected: {roomCount}</p>
        </div>
      </div>
    </div>
  );
}
