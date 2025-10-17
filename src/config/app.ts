// Application Configuration
export const config = {
  app: {
    name: 'EstatePro',
    description: 'Modern Real Estate Platform with 3D Customization',
    version: '1.0.0',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  
  // 3D Configuration
  three: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_3D !== 'false',
    quality: process.env.NEXT_PUBLIC_3D_QUALITY || 'high',
    antialias: true,
    shadowMapSize: 8192,
    toneMapping: 2, // ACESFilmicToneMapping
    toneMappingExposure: 1.2,
  },
  
  // Navigation Configuration
  navigation: {
    moveSpeed: 0.4,
    rotationSpeed: 0.08,
    dampingFactor: 0.03,
    rotateSpeed: 2.0,
    zoomSpeed: 1.5,
    panSpeed: 1.2,
  },
  
  // Room Configuration
  rooms: {
    'living-room': {
      name: 'Living Room',
      bounds: { minX: -5.5, maxX: 5.5, minY: 0, maxY: 3, minZ: -5.5, maxZ: 1.5 },
      position: { x: 0, y: 1.6, z: -2 },
      color: 'bg-[color:var(--brand-600)]',
    },
    'kitchen': {
      name: 'Kitchen',
      bounds: { minX: -5.5, maxX: 5.5, minY: 0, maxY: 3, minZ: -7.5, maxZ: -4.5 },
      position: { x: 0, y: 1.6, z: -6 },
      color: 'bg-[color:var(--sand-600)]',
    },
    'bedroom-1': {
      name: 'Bedroom 1',
      bounds: { minX: -7.5, maxX: -4.5, minY: 0, maxY: 3, minZ: -1.5, maxZ: 1.5 },
      position: { x: -6, y: 1.6, z: 0 },
      color: 'bg-[color:var(--brand-700)]',
    },
    'bedroom-2': {
      name: 'Bedroom 2',
      bounds: { minX: 4.5, maxX: 7.5, minY: 0, maxY: 3, minZ: -1.5, maxZ: 1.5 },
      position: { x: 6, y: 1.6, z: 0 },
      color: 'bg-[color:var(--sand-700)]',
    },
    'hallway': {
      name: 'Hallway',
      bounds: { minX: -1.5, maxX: 1.5, minY: 0, maxY: 3, minZ: 2.5, maxZ: 5.5 },
      position: { x: 0, y: 1.6, z: 4 },
      color: 'bg-[color:var(--sand-500)]',
    },
  },
  
  // Material Configuration
  materials: {
    defaultTextureSize: 256,
    textureRepeat: { x: 2, y: 2 },
    defaultRoughness: 0.4,
    defaultMetalness: 0.1,
  },
  
  // UI Configuration
  ui: {
    glassmorphism: {
      background: 'bg-white/10',
      backdrop: 'backdrop-blur-xl',
      border: 'border-white/20',
      shadow: 'shadow-2xl',
    },
    animations: {
      spring: { type: 'spring', damping: 25, stiffness: 200 },
      duration: 200,
    },
  },
  
  // Performance Configuration
  performance: {
    maxFPS: 60,
    enablePostProcessing: true,
    enableShadows: true,
    enableBloom: true,
    bloomIntensity: 0.4,
    enableDepthOfField: true,
    enableChromaticAberration: true,
  },
} as const

export type AppConfig = typeof config
