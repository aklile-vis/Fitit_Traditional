import { IFCElement, IFCModel, IFCElementCreator } from './ifcElementCreator';
import type { FloorPlanElement } from '@/services/floorPlanAnalyzer';

export interface IFCFileData {
  content: string;
  filename: string;
  size: number;
}

export class IFCModelGenerator {
  private elementCreator: IFCElementCreator;

  constructor() {
    this.elementCreator = new IFCElementCreator();
  }

  generateIFCModel(elements: FloorPlanElement[]): IFCModel {
    return this.elementCreator.createIFCElements(elements);
  }

  generateIFCFile(ifcModel: IFCModel): IFCFileData {
    const ifcContent = this.createIFCContent(ifcModel);
    
    return {
      content: ifcContent,
      filename: `model_${Date.now()}.ifc`,
      size: new Blob([ifcContent]).size,
    };
  }

  private createIFCContent(model: IFCModel): string {
    const header = this.createIFCHeader();
    const elements = this.createIFCElements(model.elements);
    const footer = this.createIFCFooter();

    return `${header}\n${elements}\n${footer}`;
  }

  private createIFCHeader(): string {
    return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('model.ifc','${new Date().toISOString()}',('Agent'),('System'),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;

DATA;
#1=IFCPERSON($,'Agent',$,$,$,$,$,$,$);
#2=IFCORGANIZATION($,'System',$,$,$);
#3=IFCPERSONANDORGANIZATION(#1,#2,$);
#4=IFCAPPLICATION(#2,'1.0','System','1.0');
#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,${Date.now()},#3,#4);
#6=IFCUNITASSIGNMENT((#7,#8,#9,#10,#11));
#7=IFCSIUNIT(*,.LENGTHUNIT.,.METRE.);
#8=IFCSIUNIT(*,.AREAUNIT.,.SQUARE_METRE.);
#9=IFCSIUNIT(*,.VOLUMEUNIT.,.CUBIC_METRE.);
#10=IFCSIUNIT(*,.PLANEANGLEUNIT.,.RADIAN.);
#11=IFCSIUNIT(*,.SOLIDANGLEUNIT.,.STERADIAN.);
#12=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.000000000000000E-5,#13,$);
#13=IFCAXIS2PLACEMENT3D(#14,#15,#16);
#14=IFCCARTESIANPOINT((0.,0.,0.));
#15=IFCDIRECTION((0.,0.,1.));
#16=IFCDIRECTION((1.,0.,0.));
#17=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',2,1.000000000000000E-5,#18,$);
#18=IFCAXIS2PLACEMENT2D(#19,#20);
#19=IFCCARTESIANPOINT((0.,0.));
#20=IFCDIRECTION((1.,0.));
#21=IFCPROJECT('${this.generateGUID()}',#5,'Project',$,$,'Project',$,$,$);
#22=IFCSITE('${this.generateGUID()}',#5,'Site',$,$,#23,$,$,.ELEMENT.,(0,0,0),(0,0,0),0,$,$);
#23=IFCLOCALPLACEMENT($,#24);
#24=IFCAXIS2PLACEMENT3D(#25,$,$);
#25=IFCCARTESIANPOINT((0.,0.,0.));
#26=IFCBUILDING('${this.generateGUID()}',#5,'Building',$,$,#27,$,$,.ELEMENT.,$,$,$);
#27=IFCLOCALPLACEMENT(#23,#28);
#28=IFCAXIS2PLACEMENT3D(#29,$,$);
#29=IFCCARTESIANPOINT((0.,0.,0.));
#30=IFCBUILDINGSTOREY('${this.generateGUID()}',#5,'Ground Floor',$,$,#31,$,$,.ELEMENT.,0.);
#31=IFCLOCALPLACEMENT(#27,#32);
#32=IFCAXIS2PLACEMENT3D(#33,$,$);
#33=IFCCARTESIANPOINT((0.,0.,0.));`;
  }

  private createIFCElements(elements: IFCElement[]): string {
    let content = '';
    let idCounter = 100;

    for (const element of elements) {
      content += this.createIFCElement(element, idCounter);
      idCounter += 10;
    }

    return content;
  }

  private createIFCElement(element: IFCElement, startId: number): string {
    const placementId = startId;
    const directionId1 = startId + 2;
    const directionId2 = startId + 3;
    const localPlacementId = startId + 4;
    const cartesianPointId = startId + 6;
    const elementId = startId + 7;

    const { position } = element.geometry;
    
    let elementType = '';
    switch (element.type) {
      case 'IfcWall':
        elementType = 'IFCWALL';
        break;
      case 'IfcDoor':
        elementType = 'IFCDOOR';
        break;
      case 'IfcWindow':
        elementType = 'IFCWINDOW';
        break;
      case 'IfcColumn':
        elementType = 'IFCCOLUMN';
        break;
      case 'IfcBeam':
        elementType = 'IFCBEAM';
        break;
      case 'IfcSlab':
        elementType = 'IFCSLAB';
        break;
    }

    return `#${placementId}=IFCLOCALPLACEMENT(#31,#${localPlacementId});
#${localPlacementId}=IFCAXIS2PLACEMENT3D(#${cartesianPointId},#${directionId1},#${directionId2});
#${cartesianPointId}=IFCCARTESIANPOINT((${position.x},${position.y},${position.z}));
#${directionId1}=IFCDIRECTION((0.,0.,1.));
#${directionId2}=IFCDIRECTION((1.,0.,0.));
#${elementId}=${elementType}('${this.generateGUID()}',#5,'${element.id}',$,$,#${placementId},$,$,$);`;
  }

  private createIFCFooter(): string {
    return `ENDSEC;
END-ISO-10303-21;`;
  }

  private generateGUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Method to update model with agent confirmations
  updateModelWithConfirmations(model: IFCModel, confirmations: Record<string, any>): IFCModel {
    let updatedModel = model;
    
    for (const [elementId, updates] of Object.entries(confirmations)) {
      updatedModel = this.elementCreator.updateAssumptions(updatedModel, elementId, updates);
    }
    
    return updatedModel;
  }

  // Method to export model as different formats
  exportModel(model: IFCModel, format: 'ifc' | 'json' | 'gltf'): any {
    switch (format) {
      case 'ifc':
        return this.generateIFCFile(model);
      case 'json':
        return {
          content: JSON.stringify(model, null, 2),
          filename: `model_${Date.now()}.json`,
          size: JSON.stringify(model).length,
        };
      case 'gltf':
        return this.generateGLTF(model);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private generateGLTF(model: IFCModel): any {
    // Simplified GLTF generation for 3D visualization
    const gltf = {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{
        primitives: model.elements.map((_, index) => ({
          attributes: { POSITION: index },
          mode: 4, // TRIANGLES
        })),
      }],
      accessors: model.elements.map((_, index) => ({
        bufferView: index,
        componentType: 5126, // FLOAT
        count: 8, // 8 vertices for a box
        type: 'VEC3',
      })),
      bufferViews: model.elements.map((_, index) => ({
        buffer: 0,
        byteOffset: index * 96, // 8 vertices * 3 components * 4 bytes
        byteLength: 96,
      })),
      buffers: [{
        byteLength: model.elements.length * 96,
        uri: 'data:application/octet-stream;base64,', // Placeholder
      }],
    };

    return {
      content: JSON.stringify(gltf, null, 2),
      filename: `model_${Date.now()}.gltf`,
      size: JSON.stringify(gltf).length,
    };
  }
}
