/**
 * Layer mapping configuration for DXF processing
 */

export interface LayerMapping {
  [layerName: string]: {
    type: string;
    priority: number;
    properties: {
      height?: number;
      thickness?: number;
      material?: string;
      color?: string;
    };
  };
}

export interface LayerMappingConfig {
  mappings: LayerMapping;
  fallback: {
    type: string;
    properties: {
      height: number;
      thickness: number;
      material: string;
      color: string;
    };
  };
  userOverrides?: LayerMapping;
}

type MappingEntry = {
  type: string;
  priority?: number;
  properties: LayerMapping[string]['properties'];
};

/**
 * Default layer mapping configuration
 */
export const DEFAULT_LAYER_MAPPING: LayerMappingConfig = {
  mappings: {
    // Wall layers
    'WALL': { type: 'wall', priority: 1, properties: { height: 3.0, thickness: 0.2, material: 'concrete', color: '#8B7355' } },
    'WALLS': { type: 'wall', priority: 1, properties: { height: 3.0, thickness: 0.2, material: 'concrete', color: '#8B7355' } },
    'WALL-EXTERIOR': { type: 'wall', priority: 1, properties: { height: 3.0, thickness: 0.3, material: 'brick', color: '#A0522D' } },
    'WALL-INTERIOR': { type: 'wall', priority: 1, properties: { height: 3.0, thickness: 0.15, material: 'drywall', color: '#F5F5DC' } },
    'WALL-STRUCTURAL': { type: 'wall', priority: 1, properties: { height: 3.0, thickness: 0.25, material: 'concrete', color: '#696969' } },
    
    // Door layers
    'DOOR': { type: 'door', priority: 2, properties: { height: 2.1, thickness: 0.05, material: 'wood', color: '#8B4513' } },
    'DOORS': { type: 'door', priority: 2, properties: { height: 2.1, thickness: 0.05, material: 'wood', color: '#8B4513' } },
    'DOOR-ENTRANCE': { type: 'door', priority: 2, properties: { height: 2.1, thickness: 0.08, material: 'wood', color: '#654321' } },
    'DOOR-INTERIOR': { type: 'door', priority: 2, properties: { height: 2.1, thickness: 0.04, material: 'wood', color: '#DEB887' } },
    
    // Window layers
    'WINDOW': { type: 'window', priority: 3, properties: { height: 1.2, thickness: 0.1, material: 'glass', color: '#87CEEB' } },
    'WINDOWS': { type: 'window', priority: 3, properties: { height: 1.2, thickness: 0.1, material: 'glass', color: '#87CEEB' } },
    'WINDOW-LARGE': { type: 'window', priority: 3, properties: { height: 1.5, thickness: 0.1, material: 'glass', color: '#87CEEB' } },
    'WINDOW-SMALL': { type: 'window', priority: 3, properties: { height: 0.9, thickness: 0.1, material: 'glass', color: '#87CEEB' } },
    
    // Kitchen layers
    'KITCHEN': { type: 'kitchen', priority: 4, properties: { height: 0.9, thickness: 0.6, material: 'wood', color: '#D2691E' } },
    'CABINET': { type: 'kitchen', priority: 4, properties: { height: 0.9, thickness: 0.6, material: 'wood', color: '#D2691E' } },
    'CABINETS': { type: 'kitchen', priority: 4, properties: { height: 0.9, thickness: 0.6, material: 'wood', color: '#D2691E' } },
    'COUNTER': { type: 'kitchen', priority: 4, properties: { height: 0.9, thickness: 0.6, material: 'granite', color: '#708090' } },
    
    // Sanitary layers
    'SANITARY': { type: 'sanitary', priority: 5, properties: { height: 0.4, thickness: 0.6, material: 'porcelain', color: '#FFFFFF' } },
    'TOILET': { type: 'sanitary', priority: 5, properties: { height: 0.4, thickness: 0.6, material: 'porcelain', color: '#FFFFFF' } },
    'SINK': { type: 'sanitary', priority: 5, properties: { height: 0.4, thickness: 0.6, material: 'porcelain', color: '#FFFFFF' } },
    'BATHROOM': { type: 'sanitary', priority: 5, properties: { height: 0.4, thickness: 0.6, material: 'porcelain', color: '#FFFFFF' } },
    
    // Space/Room layers
    'ROOM': { type: 'space', priority: 6, properties: { height: 0.1, thickness: 0.0, material: 'floor', color: '#F0F8FF' } },
    'SPACE': { type: 'space', priority: 6, properties: { height: 0.1, thickness: 0.0, material: 'floor', color: '#F0F8FF' } },
    'FLOOR': { type: 'space', priority: 6, properties: { height: 0.1, thickness: 0.0, material: 'floor', color: '#F0F8FF' } },
    'AREA': { type: 'space', priority: 6, properties: { height: 0.1, thickness: 0.0, material: 'floor', color: '#F0F8FF' } },
    
    // Furniture layers
    'FURNITURE': { type: 'furniture', priority: 7, properties: { height: 0.8, thickness: 0.5, material: 'wood', color: '#DEB887' } },
    'CHAIR': { type: 'furniture', priority: 7, properties: { height: 0.8, thickness: 0.5, material: 'wood', color: '#DEB887' } },
    'TABLE': { type: 'furniture', priority: 7, properties: { height: 0.8, thickness: 0.5, material: 'wood', color: '#DEB887' } },
    'BED': { type: 'furniture', priority: 7, properties: { height: 0.4, thickness: 1.0, material: 'wood', color: '#DEB887' } },
    
    // Text/Annotation layers
    'TEXT': { type: 'text', priority: 8, properties: { height: 0.0, thickness: 0.0, material: 'text', color: '#000000' } },
    'ANNOTATION': { type: 'text', priority: 8, properties: { height: 0.0, thickness: 0.0, material: 'text', color: '#000000' } },
    'DIMENSION': { type: 'text', priority: 8, properties: { height: 0.0, thickness: 0.0, material: 'text', color: '#000000' } },
    'TITLE': { type: 'text', priority: 8, properties: { height: 0.0, thickness: 0.0, material: 'text', color: '#000000' } }
  },
  fallback: {
    type: 'wall',
    properties: {
      height: 3.0,
      thickness: 0.2,
      material: 'concrete',
      color: '#8B7355'
    }
  }
};

/**
 * Load layer mapping configuration
 */
export function loadLayerMapping(): LayerMappingConfig {
  try {
    // Try to load from localStorage first
    const stored = localStorage.getItem('layerMapping');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_LAYER_MAPPING, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load layer mapping from localStorage:', error);
  }
  
  return DEFAULT_LAYER_MAPPING;
}

/**
 * Save layer mapping configuration
 */
export function saveLayerMapping(config: LayerMappingConfig): void {
  try {
    localStorage.setItem('layerMapping', JSON.stringify(config));
  } catch (error) {
    console.warn('Failed to save layer mapping to localStorage:', error);
  }
}

/**
 * Get layer mapping for a specific layer
 */
export function getLayerMapping(layerName: string, config?: LayerMappingConfig): MappingEntry {
  const mappingConfig = config || loadLayerMapping();
  
  // Check user overrides first
  if (mappingConfig.userOverrides && mappingConfig.userOverrides[layerName]) {
    return mappingConfig.userOverrides[layerName];
  }
  
  // Check main mappings
  if (mappingConfig.mappings[layerName]) {
    return mappingConfig.mappings[layerName];
  }
  
  // Try case-insensitive matching
  const lowerLayerName = layerName.toLowerCase();
  for (const [key, value] of Object.entries(mappingConfig.mappings)) {
    if (key.toLowerCase() === lowerLayerName) {
      return value;
    }
  }
  
  // Try partial matching
  for (const [key, value] of Object.entries(mappingConfig.mappings)) {
    if (lowerLayerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerLayerName)) {
      return value;
    }
  }
  
  // Return fallback
  return mappingConfig.fallback;
}

/**
 * Update layer mapping
 */
export function updateLayerMapping(
  layerName: string,
  mapping: MappingEntry,
  config?: LayerMappingConfig,
): LayerMappingConfig {
  const mappingConfig = config || loadLayerMapping();
  
  if (!mappingConfig.userOverrides) {
    mappingConfig.userOverrides = {};
  }
  
  mappingConfig.userOverrides[layerName] = {
    ...mapping,
    priority: mapping.priority ?? 0,
  } as LayerMapping[string];
  saveLayerMapping(mappingConfig);
  
  return mappingConfig;
}

/**
 * Reset layer mapping to defaults
 */
export function resetLayerMapping(): LayerMappingConfig {
  const config = { ...DEFAULT_LAYER_MAPPING };
  saveLayerMapping(config);
  return config;
}

/**
 * Export layer mapping configuration
 */
export function exportLayerMapping(config: LayerMappingConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import layer mapping configuration
 */
export function importLayerMapping(jsonString: string): LayerMappingConfig {
  try {
    const imported = JSON.parse(jsonString);
    const config = { ...DEFAULT_LAYER_MAPPING, ...imported };
    saveLayerMapping(config);
    return config;
  } catch (error) {
    console.error('Failed to import layer mapping:', error);
    return DEFAULT_LAYER_MAPPING;
  }
}
