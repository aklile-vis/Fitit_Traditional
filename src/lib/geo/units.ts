/**
 * Units inference and conversion utilities for DXF processing
 */

export interface UnitsInfo {
  detectedUnit: string;
  scaleToMeters: number;
  confidence: number;
  reasoning: string[];
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Detect DXF units based on geometry bounds and common architectural patterns
 */
interface UnitEntity {
  type: string;
  points?: { x: number; y: number }[];
}

export function inferUnits(bounds: Bounds, entities: UnitEntity[]): UnitsInfo {
  const reasoning: string[] = [];
  let confidence = 0;
  let detectedUnit = 'mm';
  let scaleToMeters = 0.001;

  const { width, height } = bounds;
  const maxDimension = Math.max(width, height);

  // Rule 1: Check for millimeter patterns (most common in CAD)
  if (maxDimension > 1000 && maxDimension < 100000) {
    detectedUnit = 'mm';
    scaleToMeters = 0.001;
    confidence += 0.4;
    reasoning.push(`Max dimension ${maxDimension.toFixed(0)} suggests millimeters`);
  }

  // Rule 2: Check for meter patterns
  if (maxDimension > 0.5 && maxDimension < 50) {
    detectedUnit = 'm';
    scaleToMeters = 1.0;
    confidence += 0.3;
    reasoning.push(`Max dimension ${maxDimension.toFixed(2)} suggests meters`);
  }

  // Rule 3: Check for centimeter patterns
  if (maxDimension > 50 && maxDimension < 1000) {
    detectedUnit = 'cm';
    scaleToMeters = 0.01;
    confidence += 0.2;
    reasoning.push(`Max dimension ${maxDimension.toFixed(0)} suggests centimeters`);
  }

  // Rule 4: Check for feet patterns (US architectural)
  if (maxDimension > 10 && maxDimension < 200) {
    detectedUnit = 'ft';
    scaleToMeters = 0.3048;
    confidence += 0.15;
    reasoning.push(`Max dimension ${maxDimension.toFixed(0)} suggests feet`);
  }

  // Rule 5: Check for inch patterns
  if (maxDimension > 100 && maxDimension < 2000) {
    detectedUnit = 'in';
    scaleToMeters = 0.0254;
    confidence += 0.1;
    reasoning.push(`Max dimension ${maxDimension.toFixed(0)} suggests inches`);
  }

  // Rule 6: Analyze entity count and complexity
  const entityCount = entities.length;
  if (entityCount > 100) {
    confidence += 0.1;
    reasoning.push(`High entity count (${entityCount}) suggests detailed CAD drawing`);
  }

  // Rule 7: Check for common architectural dimensions
  const commonDimensions = findCommonDimensions(entities);
  if (commonDimensions.length > 0) {
    const avgDim = commonDimensions.reduce((a, b) => a + b, 0) / commonDimensions.length;
    
    if (avgDim > 2000 && avgDim < 5000) {
      detectedUnit = 'mm';
      scaleToMeters = 0.001;
      confidence += 0.2;
      reasoning.push(`Common dimensions around ${avgDim.toFixed(0)} suggest millimeters`);
    } else if (avgDim > 2 && avgDim < 5) {
      detectedUnit = 'm';
      scaleToMeters = 1.0;
      confidence += 0.2;
      reasoning.push(`Common dimensions around ${avgDim.toFixed(1)} suggest meters`);
    }
  }

  // Normalize confidence to 0-1 range
  confidence = Math.min(confidence, 1.0);

  return {
    detectedUnit,
    scaleToMeters,
    confidence,
    reasoning
  };
}

/**
 * Find common dimensions in entities (walls, rooms, etc.)
 */
function findCommonDimensions(entities: UnitEntity[]): number[] {
  const dimensions: number[] = [];
  
  for (const entity of entities) {
    if (entity.type === 'LINE' || entity.type === 'LWPOLYLINE') {
      const points = entity.points || [];
      if (points.length >= 2) {
        for (let i = 0; i < points.length - 1; i++) {
          const dx = points[i + 1].x - points[i].x;
          const dy = points[i + 1].y - points[i].y;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          if (length > 0.1) { // Filter out very small segments
            dimensions.push(length);
          }
        }
      }
    }
  }
  
  return dimensions;
}

/**
 * Convert coordinates from detected units to meters
 */
export function convertToMeters(coords: number[], scaleToMeters: number): number[] {
  return coords.map(coord => coord * scaleToMeters);
}

/**
 * Convert coordinates from meters to target units
 */
export function convertFromMeters(coords: number[], targetUnit: string): number[] {
  const scales: Record<string, number> = {
    'mm': 1000,
    'cm': 100,
    'm': 1,
    'ft': 3.28084,
    'in': 39.3701
  };
  
  const scale = scales[targetUnit] || 1;
  return coords.map(coord => coord * scale);
}

/**
 * Get human-readable unit name
 */
export function getUnitName(unit: string): string {
  const names: { [key: string]: string } = {
    'mm': 'Millimeters',
    'cm': 'Centimeters', 
    'm': 'Meters',
    'ft': 'Feet',
    'in': 'Inches'
  };
  
  return names[unit] || unit;
}
