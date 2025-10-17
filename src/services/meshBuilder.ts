// @ts-nocheck

/**
 * 3D Mesh Builder for DXF elements
 */

import { Point2D } from '@/lib/geo/normalize';
import { getLayerMapping } from '@/lib/config/layer-mapping';

export interface MeshVertex {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  normal: { x: number; y: number; z: number };
}

export interface MeshFace {
  vertices: number[];
  material: string;
  color: string;
}

export interface Mesh {
  vertices: MeshVertex[];
  faces: MeshFace[];
  materials: { [key: string]: { color: string; type: string } };
}

export interface WallElement {
  id: string;
  type: string;
  points: Point2D[];
  layer: string;
  height: number;
  thickness: number;
  material: string;
  color: string;
}

/**
 * Build 3D mesh from DXF elements
 */
export function buildMesh(elements: any[], agentParams: any): Mesh {
  const mesh: Mesh = {
    vertices: [],
    faces: [],
    materials: {}
  };

  // Process each element
  for (const element of elements) {
    const layerMapping = getLayerMapping(element.layer);
    const wallElement: WallElement = {
      id: element.id || `element_${Math.random().toString(36).substr(2, 9)}`,
      type: layerMapping.type,
      points: element.points || [],
      layer: element.layer,
      height: layerMapping.properties.height || agentParams.wallHeight || 3.0,
      thickness: layerMapping.properties.thickness || agentParams.wallThickness || 0.2,
      material: layerMapping.properties.material || 'concrete',
      color: layerMapping.properties.color || '#8B7355'
    };

    // Generate mesh based on element type
    switch (wallElement.type) {
      case 'wall':
        generateWallMesh(wallElement, mesh);
        break;
      case 'door':
        generateDoorMesh(wallElement, mesh);
        break;
      case 'window':
        generateWindowMesh(wallElement, mesh);
        break;
      case 'kitchen':
        generateKitchenMesh(wallElement, mesh);
        break;
      case 'sanitary':
        generateSanitaryMesh(wallElement, mesh);
        break;
      case 'space':
        generateSpaceMesh(wallElement, mesh);
        break;
      case 'furniture':
        generateFurnitureMesh(wallElement, mesh);
        break;
      default:
        generateGenericMesh(wallElement, mesh);
        break;
    }
  }

  return mesh;
}

/**
 * Generate wall mesh
 */
function generateWallMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 2) return;

  const { points, height, thickness, material, color } = element;
  const halfThickness = thickness / 2;

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'wall' };
  }

  // Generate wall segments
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    // Calculate wall direction and normal
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) continue;
    
    const dirX = dx / length;
    const dirY = dy / length;
    const normalX = -dirY;
    const normalY = dirX;

    // Wall vertices
    const vertices = [
      // Bottom face
      { x: start.x + normalX * halfThickness, y: start.y + normalY * halfThickness, z: 0 },
      { x: start.x - normalX * halfThickness, y: start.y - normalY * halfThickness, z: 0 },
      { x: end.x - normalX * halfThickness, y: end.y - normalY * halfThickness, z: 0 },
      { x: end.x + normalX * halfThickness, y: end.y + normalY * halfThickness, z: 0 },
      
      // Top face
      { x: start.x + normalX * halfThickness, y: start.y + normalY * halfThickness, z: height },
      { x: start.x - normalX * halfThickness, y: start.y - normalY * halfThickness, z: height },
      { x: end.x - normalX * halfThickness, y: end.y - normalY * halfThickness, z: height },
      { x: end.x + normalX * halfThickness, y: end.y + normalY * halfThickness, z: height }
    ];

    // Add vertices to mesh
    const vertexIndices: number[] = [];
    for (const vertex of vertices) {
      const meshVertex: MeshVertex = {
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: 0, // TODO: Calculate proper UV coordinates
        v: 0,
        normal: { x: 0, y: 0, z: 1 } // TODO: Calculate proper normals
      };
      mesh.vertices.push(meshVertex);
      vertexIndices.push(mesh.vertices.length - 1);
    }

    // Add faces
    const faces = [
      // Bottom face
      { vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]], material, color },
      { vertices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]], material, color },
      
      // Top face
      { vertices: [vertexIndices[4], vertexIndices[6], vertexIndices[5]], material, color },
      { vertices: [vertexIndices[4], vertexIndices[7], vertexIndices[6]], material, color },
      
      // Side faces
      { vertices: [vertexIndices[0], vertexIndices[4], vertexIndices[5]], material, color },
      { vertices: [vertexIndices[0], vertexIndices[5], vertexIndices[1]], material, color },
      
      { vertices: [vertexIndices[1], vertexIndices[5], vertexIndices[6]], material, color },
      { vertices: [vertexIndices[1], vertexIndices[6], vertexIndices[2]], material, color },
      
      { vertices: [vertexIndices[2], vertexIndices[6], vertexIndices[7]], material, color },
      { vertices: [vertexIndices[2], vertexIndices[7], vertexIndices[3]], material, color },
      
      { vertices: [vertexIndices[3], vertexIndices[7], vertexIndices[4]], material, color },
      { vertices: [vertexIndices[3], vertexIndices[4], vertexIndices[0]], material, color }
    ];

    mesh.faces.push(...faces);
  }
}

/**
 * Generate door mesh
 */
function generateDoorMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 2) return;

  const { points, height, thickness, material, color } = element;
  const doorHeight = Math.min(height, 2.1); // Standard door height
  const doorThickness = Math.min(thickness, 0.05);

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'door' };
  }

  // Generate door frame
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) continue;
    
    const dirX = dx / length;
    const dirY = dy / length;
    const normalX = -dirY;
    const normalY = dirX;

    // Door frame vertices (simplified)
    const frameThickness = 0.1;
    const vertices = [
      // Frame bottom
      { x: start.x, y: start.y, z: 0 },
      { x: end.x, y: end.y, z: 0 },
      { x: end.x, y: end.y, z: doorHeight },
      { x: start.x, y: start.y, z: doorHeight }
    ];

    // Add vertices and faces (simplified door representation)
    const vertexIndices: number[] = [];
    for (const vertex of vertices) {
      const meshVertex: MeshVertex = {
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: 0,
        v: 0,
        normal: { x: 0, y: 0, z: 1 }
      };
      mesh.vertices.push(meshVertex);
      vertexIndices.push(mesh.vertices.length - 1);
    }

    // Add door face
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]],
      material,
      color
    });
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]],
      material,
      color
    });
  }
}

/**
 * Generate window mesh
 */
function generateWindowMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 2) return;

  const { points, height, thickness, material, color } = element;
  const windowHeight = Math.min(height, 1.2); // Standard window height
  const windowSillHeight = 0.9; // Standard window sill height

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'window' };
  }

  // Generate window frame (simplified)
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) continue;
    
    // Window frame vertices
    const frameThickness = 0.05;
    const vertices = [
      // Frame bottom
      { x: start.x, y: start.y, z: windowSillHeight },
      { x: end.x, y: end.y, z: windowSillHeight },
      { x: end.x, y: end.y, z: windowSillHeight + windowHeight },
      { x: start.x, y: start.y, z: windowSillHeight + windowHeight }
    ];

    // Add vertices and faces (simplified window representation)
    const vertexIndices: number[] = [];
    for (const vertex of vertices) {
      const meshVertex: MeshVertex = {
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: 0,
        v: 0,
        normal: { x: 0, y: 0, z: 1 }
      };
      mesh.vertices.push(meshVertex);
      vertexIndices.push(mesh.vertices.length - 1);
    }

    // Add window face
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]],
      material,
      color
    });
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]],
      material,
      color
    });
  }
}

/**
 * Generate kitchen mesh
 */
function generateKitchenMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 2) return;

  const { points, height, thickness, material, color } = element;
  const cabinetHeight = Math.min(height, 0.9); // Standard cabinet height

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'kitchen' };
  }

  // Generate cabinet mesh (simplified)
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) continue;
    
    // Cabinet vertices
    const vertices = [
      // Cabinet bottom
      { x: start.x, y: start.y, z: 0 },
      { x: end.x, y: end.y, z: 0 },
      { x: end.x, y: end.y, z: cabinetHeight },
      { x: start.x, y: start.y, z: cabinetHeight }
    ];

    // Add vertices and faces (simplified cabinet representation)
    const vertexIndices: number[] = [];
    for (const vertex of vertices) {
      const meshVertex: MeshVertex = {
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: 0,
        v: 0,
        normal: { x: 0, y: 0, z: 1 }
      };
      mesh.vertices.push(meshVertex);
      vertexIndices.push(mesh.vertices.length - 1);
    }

    // Add cabinet face
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]],
      material,
      color
    });
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]],
      material,
      color
    });
  }
}

/**
 * Generate sanitary mesh
 */
function generateSanitaryMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 2) return;

  const { points, height, thickness, material, color } = element;
  const sanitaryHeight = Math.min(height, 0.4); // Standard sanitary height

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'sanitary' };
  }

  // Generate sanitary mesh (simplified)
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) continue;
    
    // Sanitary vertices
    const vertices = [
      // Sanitary bottom
      { x: start.x, y: start.y, z: 0 },
      { x: end.x, y: end.y, z: 0 },
      { x: end.x, y: end.y, z: sanitaryHeight },
      { x: start.x, y: start.y, z: sanitaryHeight }
    ];

    // Add vertices and faces (simplified sanitary representation)
    const vertexIndices: number[] = [];
    for (const vertex of vertices) {
      const meshVertex: MeshVertex = {
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: 0,
        v: 0,
        normal: { x: 0, y: 0, z: 1 }
      };
      mesh.vertices.push(meshVertex);
      vertexIndices.push(mesh.vertices.length - 1);
    }

    // Add sanitary face
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]],
      material,
      color
    });
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]],
      material,
      color
    });
  }
}

/**
 * Generate space mesh (floor area)
 */
function generateSpaceMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 3) return;

  const { points, material, color } = element;

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'space' };
  }

  // Generate floor mesh
  const vertices = points.map(point => ({
    x: point.x,
    y: point.y,
    z: 0
  }));

  // Add vertices
  const vertexIndices: number[] = [];
  for (const vertex of vertices) {
    const meshVertex: MeshVertex = {
      x: vertex.x,
      y: vertex.y,
      z: vertex.z,
      u: 0,
      v: 0,
      normal: { x: 0, y: 0, z: 1 }
    };
    mesh.vertices.push(meshVertex);
    vertexIndices.push(mesh.vertices.length - 1);
  }

  // Triangulate floor area
  for (let i = 1; i < vertexIndices.length - 1; i++) {
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[i], vertexIndices[i + 1]],
      material,
      color
    });
  }
}

/**
 * Generate furniture mesh
 */
function generateFurnitureMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 2) return;

  const { points, height, thickness, material, color } = element;
  const furnitureHeight = Math.min(height, 0.8); // Standard furniture height

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'furniture' };
  }

  // Generate furniture mesh (simplified)
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) continue;
    
    // Furniture vertices
    const vertices = [
      // Furniture bottom
      { x: start.x, y: start.y, z: 0 },
      { x: end.x, y: end.y, z: 0 },
      { x: end.x, y: end.y, z: furnitureHeight },
      { x: start.x, y: start.y, z: furnitureHeight }
    ];

    // Add vertices and faces (simplified furniture representation)
    const vertexIndices: number[] = [];
    for (const vertex of vertices) {
      const meshVertex: MeshVertex = {
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: 0,
        v: 0,
        normal: { x: 0, y: 0, z: 1 }
      };
      mesh.vertices.push(meshVertex);
      vertexIndices.push(mesh.vertices.length - 1);
    }

    // Add furniture face
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]],
      material,
      color
    });
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]],
      material,
      color
    });
  }
}

/**
 * Generate generic mesh for unknown element types
 */
function generateGenericMesh(element: WallElement, mesh: Mesh): void {
  if (element.points.length < 2) return;

  const { points, height, thickness, material, color } = element;

  // Add material
  if (!mesh.materials[material]) {
    mesh.materials[material] = { color, type: 'generic' };
  }

  // Generate generic mesh (simplified)
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) continue;
    
    // Generic vertices
    const vertices = [
      // Generic bottom
      { x: start.x, y: start.y, z: 0 },
      { x: end.x, y: end.y, z: 0 },
      { x: end.x, y: end.y, z: height },
      { x: start.x, y: start.y, z: height }
    ];

    // Add vertices and faces (simplified generic representation)
    const vertexIndices: number[] = [];
    for (const vertex of vertices) {
      const meshVertex: MeshVertex = {
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: 0,
        v: 0,
        normal: { x: 0, y: 0, z: 1 }
      };
      mesh.vertices.push(meshVertex);
      vertexIndices.push(mesh.vertices.length - 1);
    }

    // Add generic face
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[1], vertexIndices[2]],
      material,
      color
    });
    mesh.faces.push({
      vertices: [vertexIndices[0], vertexIndices[2], vertexIndices[3]],
      material,
      color
    });
  }
}
