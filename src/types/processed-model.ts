export interface FloorPlanElement {
  id: string;
  type: 'wall' | 'door' | 'window' | 'kitchen' | 'sanitary' | 'room';
  layer: string;
  geometry: {
    points: [number, number][];
    bounds: {
      min: [number, number];
      max: [number, number];
    };
    center: [number, number];
  };
  dimensions: {
    width?: number;
    height?: number;
    length?: number;
  };
  properties: {
    thickness?: number;
    material?: string;
    confidence: number;
  };
  room?: string;
}

export interface ProcessedModel {
  fileType: string;
  status: 'processing' | 'completed' | 'error';
  elements: FloorPlanElement[];
  bounds: {
    min: [number, number];
    max: [number, number];
  };
  ifcPath?: string;
  glbPath?: string;
  usdPath?: string;
  elementsCount?: number;
  materialsUsed?: string[];
}
