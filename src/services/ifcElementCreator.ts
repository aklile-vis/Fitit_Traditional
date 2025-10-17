import type { FloorPlanElement } from '@/services/floorPlanAnalyzer';

export interface IFCElement {
  id: string;
  type: 'IfcWall' | 'IfcDoor' | 'IfcWindow' | 'IfcColumn' | 'IfcBeam' | 'IfcSlab';
  geometry: {
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
    rotation?: number;
  };
  properties: {
    material?: string;
    thickness?: number;
    height?: number;
    width?: number;
  };
  assumptions?: {
    height?: number;
    thickness?: number;
    material?: string;
    width?: number;
  };
}

export interface IFCModel {
  elements: IFCElement[];
  metadata: {
    created: Date;
    source: string;
    assumptions: string[];
  };
}

export class IFCElementCreator {
  private defaultAssumptions = {
    wallHeight: 2.7, // 2.7m standard ceiling height
    wallThickness: 0.2, // 20cm standard wall thickness
    doorHeight: 2.1, // 2.1m standard door height
    doorWidth: 0.9, // 90cm standard door width
    windowHeight: 1.2, // 1.2m standard window height
    windowWidth: 1.0, // 1m standard window width
    columnHeight: 2.7, // Same as wall height
    beamHeight: 0.3, // 30cm beam height
    slabThickness: 0.2, // 20cm slab thickness
  };

  createIFCElements(elements: FloorPlanElement[]): IFCModel {
    const ifcElements: IFCElement[] = [];
    const assumptions: string[] = [];

    for (const element of elements) {
      const ifcElement = this.createElement(element);
      if (ifcElement) {
        ifcElements.push(ifcElement);
        
        // Track assumptions made
        if (ifcElement.assumptions) {
          Object.entries(ifcElement.assumptions).forEach(([key, value]) => {
            assumptions.push(`${element.type} ${element.id}: assumed ${key} = ${value}`);
          });
        }
      }
    }

    return {
      elements: ifcElements,
      metadata: {
        created: new Date(),
        source: 'DXF Processing',
        assumptions,
      },
    };
  }

  private createElement(element: FloorPlanElement): IFCElement | null {
    const baseGeometry = this.calculateGeometry(element);
    
    switch (element.type) {
      case 'wall':
        return this.createWall(element, baseGeometry);
      case 'door':
        return this.createDoor(element, baseGeometry);
      case 'window':
        return this.createWindow(element, baseGeometry);
      case 'column':
        return this.createColumn(element, baseGeometry);
      case 'beam':
        return this.createBeam(element, baseGeometry);
      case 'slab':
        return this.createSlab(element, baseGeometry);
      default:
        return null;
    }
  }

  private calculateGeometry(element: FloorPlanElement) {
    const startX = element.startX ?? 0
    const startY = element.startY ?? 0
    const endX = element.endX ?? startX
    const endY = element.endY ?? startY

    const length = Math.sqrt(
      Math.pow(endX - startX, 2) + 
      Math.pow(endY - startY, 2)
    );
    
    return {
      position: {
        x: (startX + endX) / 2,
        y: (startY + endY) / 2,
        z: 0,
      },
      length,
      rotation: Math.atan2(endY - startY, endX - startX),
    };
  }

  private createWall(element: FloorPlanElement, geometry: any): IFCElement {
    const assumptions = {
      height: this.defaultAssumptions.wallHeight,
      thickness: this.defaultAssumptions.wallThickness,
    };

    return {
      id: `wall_${element.id}`,
      type: 'IfcWall',
      geometry: {
        position: geometry.position,
        dimensions: {
          width: geometry.length,
          height: assumptions.height,
          depth: assumptions.thickness,
        },
        rotation: geometry.rotation,
      },
      properties: {
        material: 'concrete',
        thickness: assumptions.thickness,
        height: assumptions.height,
      },
      assumptions,
    };
  }

  private createDoor(element: FloorPlanElement, geometry: any): IFCElement {
    const assumptions = {
      height: this.defaultAssumptions.doorHeight,
      width: this.defaultAssumptions.doorWidth,
    };

    return {
      id: `door_${element.id}`,
      type: 'IfcDoor',
      geometry: {
        position: geometry.position,
        dimensions: {
          width: assumptions.width,
          height: assumptions.height,
          depth: 0.1, // 10cm door thickness
        },
        rotation: geometry.rotation,
      },
      properties: {
        material: 'wood',
        height: assumptions.height,
        width: assumptions.width,
      },
      assumptions,
    };
  }

  private createWindow(element: FloorPlanElement, geometry: any): IFCElement {
    const assumptions = {
      height: this.defaultAssumptions.windowHeight,
      width: this.defaultAssumptions.windowWidth,
    };

    return {
      id: `window_${element.id}`,
      type: 'IfcWindow',
      geometry: {
        position: { ...geometry.position, z: 1.0 }, // Windows at 1m height
        dimensions: {
          width: assumptions.width,
          height: assumptions.height,
          depth: 0.2, // 20cm window depth
        },
        rotation: geometry.rotation,
      },
      properties: {
        material: 'glass',
        height: assumptions.height,
        width: assumptions.width,
      },
      assumptions,
    };
  }

  private createColumn(element: FloorPlanElement, geometry: any): IFCElement {
    const assumptions = {
      height: this.defaultAssumptions.columnHeight,
      width: 0.3, // 30cm column width
    };

    return {
      id: `column_${element.id}`,
      type: 'IfcColumn',
      geometry: {
        position: geometry.position,
        dimensions: {
          width: assumptions.width,
          height: assumptions.height,
          depth: assumptions.width, // Square column
        },
      },
      properties: {
        material: 'concrete',
        height: assumptions.height,
        width: assumptions.width,
      },
      assumptions,
    };
  }

  private createBeam(element: FloorPlanElement, geometry: any): IFCElement {
    const assumptions = {
      height: this.defaultAssumptions.beamHeight,
      width: 0.3, // 30cm beam width
    };

    return {
      id: `beam_${element.id}`,
      type: 'IfcBeam',
      geometry: {
        position: { ...geometry.position, z: this.defaultAssumptions.wallHeight },
        dimensions: {
          width: geometry.length,
          height: assumptions.height,
          depth: assumptions.width,
        },
        rotation: geometry.rotation,
      },
      properties: {
        material: 'concrete',
        height: assumptions.height,
        width: assumptions.width,
      },
      assumptions,
    };
  }

  private createSlab(element: FloorPlanElement, geometry: any): IFCElement {
    const assumptions = {
      thickness: this.defaultAssumptions.slabThickness,
    };

    return {
      id: `slab_${element.id}`,
      type: 'IfcSlab',
      geometry: {
        position: { ...geometry.position, z: 0 },
        dimensions: {
          width: geometry.length,
          height: assumptions.thickness,
          depth: geometry.length, // Square slab
        },
        rotation: geometry.rotation,
      },
      properties: {
        material: 'concrete',
        thickness: assumptions.thickness,
      },
      assumptions,
    };
  }

  // Method to update assumptions based on agent input
  updateAssumptions(ifcModel: IFCModel, elementId: string, updates: Partial<IFCElement['assumptions']>): IFCModel {
    if (!updates) {
      return ifcModel;
    }
    const updatedElements = ifcModel.elements.map(element => {
      if (element.id === elementId) {
        return {
          ...element,
          assumptions: { ...element.assumptions, ...updates },
          properties: { ...element.properties, ...updates },
          geometry: {
            ...element.geometry,
            dimensions: {
              ...element.geometry.dimensions,
              ...(updates.height !== undefined ? { height: updates.height } : {}),
              ...(updates.width !== undefined ? { width: updates.width } : {}),
              ...(updates.thickness !== undefined ? { depth: updates.thickness } : {}),
            },
          },
        };
      }
      return element;
    });

    return {
      ...ifcModel,
      elements: updatedElements,
    };
  }
}
