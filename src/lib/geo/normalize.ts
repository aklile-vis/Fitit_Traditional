/**
 * Geometry normalization utilities for DXF processing
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface NormalizedEntity {
  type: string;
  points: Point2D[];
  layer: string;
  closed?: boolean;
  properties?: Record<string, unknown>;
}

interface RawEntity {
  type: string;
  layer?: string;
  properties?: Record<string, unknown>;
  start?: Point2D;
  end?: Point2D;
  points?: Point2D[];
  closed?: boolean;
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  controlPoints?: Point2D[];
}

/**
 * Convert arc to polyline segments
 */
export function arcToPolyline(
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number = 16
): Point2D[] {
  const points: Point2D[] = [];
  const angleStep = (endAngle - startAngle) / segments;
  
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + i * angleStep;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }
  
  return points;
}

/**
 * Convert circle to polyline segments
 */
export function circleToPolyline(
  center: Point2D,
  radius: number,
  segments: number = 32
): Point2D[] {
  return arcToPolyline(center, radius, 0, 2 * Math.PI, segments);
}

/**
 * Normalize entity geometry
 */
export function normalizeEntity(entity: RawEntity): NormalizedEntity {
  const normalized: NormalizedEntity = {
    type: entity.type,
    points: [],
    layer: entity.layer || '0',
    properties: entity.properties || {}
  };

  switch (entity.type) {
    case 'LINE':
      if (entity.start && entity.end) {
        normalized.points = [
          { x: entity.start.x, y: entity.start.y },
          { x: entity.end.x, y: entity.end.y },
        ];
      }
      break;

    case 'LWPOLYLINE':
    case 'POLYLINE':
      normalized.points = Array.isArray(entity.points) ? entity.points : [];
      normalized.closed = entity.closed || false;
      break;

    case 'ARC':
      if (entity.center && typeof entity.radius === 'number' && typeof entity.startAngle === 'number' && typeof entity.endAngle === 'number') {
        const arcPoints = arcToPolyline(
          entity.center,
          entity.radius,
          entity.startAngle,
          entity.endAngle,
        );
        normalized.points = arcPoints;
      }
      break;

    case 'CIRCLE':
      if (entity.center && typeof entity.radius === 'number') {
        const circlePoints = circleToPolyline(entity.center, entity.radius);
        normalized.points = circlePoints;
        normalized.closed = true;
      }
      break;

    case 'SPLINE':
      // Convert spline to polyline approximation
      normalized.points = approximateSpline(entity.controlPoints || [], 16);
      break;

    default:
      // For other entity types, try to extract points
      if (Array.isArray(entity.points)) {
        normalized.points = entity.points;
      }
      break;
  }

  return normalized;
}

/**
 * Approximate spline with polyline segments
 */
function approximateSpline(controlPoints: Point2D[], segments: number): Point2D[] {
  if (controlPoints.length < 2) return controlPoints;
  
  const points: Point2D[] = [];
  const step = 1 / segments;
  
  for (let i = 0; i <= segments; i++) {
    const t = i * step;
    const point = bezierPoint(controlPoints, t);
    points.push(point);
  }
  
  return points;
}

/**
 * Calculate point on Bezier curve
 */
function bezierPoint(controlPoints: Point2D[], t: number): Point2D {
  const n = controlPoints.length - 1;
  let x = 0;
  let y = 0;
  
  for (let i = 0; i <= n; i++) {
    const bernstein = binomialCoefficient(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i);
    x += controlPoints[i].x * bernstein;
    y += controlPoints[i].y * bernstein;
  }
  
  return { x, y };
}

/**
 * Calculate binomial coefficient
 */
function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  
  return result;
}

/**
 * Weld nearby points together
 */
export function weldPoints(points: Point2D[], tolerance: number = 0.001): Point2D[] {
  if (points.length === 0) return points;
  
  const welded: Point2D[] = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    const lastPoint = welded[welded.length - 1];
    const currentPoint = points[i];
    
    const distance = Math.sqrt(
      Math.pow(currentPoint.x - lastPoint.x, 2) + 
      Math.pow(currentPoint.y - lastPoint.y, 2)
    );
    
    if (distance > tolerance) {
      welded.push(currentPoint);
    }
  }
  
  return welded;
}

/**
 * Close gaps between line segments
 */
export function closeGaps(entities: NormalizedEntity[], gapTolerance: number = 0.01): NormalizedEntity[] {
  const closed: NormalizedEntity[] = [];
  
  for (const entity of entities) {
    if (entity.points.length < 2) {
      closed.push(entity);
      continue;
    }
    
    const points = [...entity.points];
    
    // Check if first and last points are close enough to close
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    const distance = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) + 
      Math.pow(lastPoint.y - firstPoint.y, 2)
    );
    
    if (distance <= gapTolerance && !entity.closed) {
      // Close the polyline
      points[points.length - 1] = firstPoint;
      closed.push({
        ...entity,
        points,
        closed: true
      });
    } else {
      closed.push(entity);
    }
  }
  
  return closed;
}

/**
 * Normalize all entities in a DXF file
 */
export function normalizeEntities(entities: RawEntity[]): NormalizedEntity[] {
  const normalized = entities.map(normalizeEntity);
  const welded = normalized.map(entity => ({
    ...entity,
    points: weldPoints(entity.points)
  }));
  const closed = closeGaps(welded);
  
  return closed;
}

/**
 * Calculate entity bounds
 */
export function calculateBounds(entities: NormalizedEntity[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (entities.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  
  for (const entity of entities) {
    for (const point of entity.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }
  
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}
