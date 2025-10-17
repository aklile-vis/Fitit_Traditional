#!/usr/bin/env python3
"""
Modular DXF Processing Script
Supports different processing modes via command-line arguments
"""

import sys
import json
import argparse
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_dxf_file(dxf_path: str) -> dict:
    """Parse DXF file and extract elements with geometry"""
    try:
        import ezdxf
        import math
        
        logger.info(f"📖 Parsing DXF file: {dxf_path}")
        doc = ezdxf.readfile(dxf_path)
        logger.info(f"✅ DXF file loaded successfully")
        logger.info(f"📊 DXF version: {doc.dxfversion}")
        logger.info(f"📊 Layers: {len(doc.layers)}")
        
        # Extract elements with geometry
        elements = []
        for i, entity in enumerate(doc.modelspace()):
            if entity.dxftype() in ['LINE', 'CIRCLE', 'ARC', 'POLYLINE', 'LWPOLYLINE']:
                element_data = {
                    'type': entity.dxftype(),
                    'layer': entity.dxf.layer if hasattr(entity.dxf, 'layer') else '0',
                    'handle': entity.dxf.handle,
                    'geometry': []
                }
                
                # Extract geometry based on entity type
                if entity.dxftype() == 'LINE':
                    element_data['geometry'] = [
                        [entity.dxf.start.x, entity.dxf.start.y],
                        [entity.dxf.end.x, entity.dxf.end.y]
                    ]
                elif entity.dxftype() == 'CIRCLE':
                    center = entity.dxf.center
                    radius = entity.dxf.radius
                    # Create a circle approximation with 8 points
                    points = []
                    for angle in range(0, 360, 45):
                        x = center.x + radius * math.cos(math.radians(angle))
                        y = center.y + radius * math.sin(math.radians(angle))
                        points.append([x, y])
                    element_data['geometry'] = points
                elif entity.dxftype() in ['POLYLINE', 'LWPOLYLINE']:
                    points = []
                    for point in entity.get_points():
                        points.append([point[0], point[1]])
                    element_data['geometry'] = points
                elif entity.dxftype() == 'ARC':
                    center = entity.dxf.center
                    radius = entity.dxf.radius
                    start_angle = math.radians(entity.dxf.start_angle)
                    end_angle = math.radians(entity.dxf.end_angle)
                    # Create arc approximation
                    points = []
                    num_points = max(8, int((end_angle - start_angle) * 4))
                    for i in range(num_points + 1):
                        angle = start_angle + (end_angle - start_angle) * i / num_points
                        x = center.x + radius * math.cos(angle)
                        y = center.y + radius * math.sin(angle)
                        points.append([x, y])
                    element_data['geometry'] = points
                
                elements.append(element_data)
        
        # Calculate bounds
        all_points = []
        for element in elements:
            all_points.extend(element['geometry'])
        
        if all_points:
            xs = [p[0] for p in all_points]
            ys = [p[1] for p in all_points]
            bounds = {
                'min': [min(xs), min(ys)],
                'max': [max(xs), max(ys)]
            }
        else:
            bounds = {'min': [0, 0], 'max': [100, 100]}
        
        logger.info(f"📊 Elements extracted: {len(elements)}")
        
        return {
            'success': True,
            'elements': elements,
            'bounds': bounds
        }
        
    except Exception as e:
        logger.error(f"❌ Error parsing DXF file: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'elements': [],
            'bounds': {'min': [0, 0], 'max': [100, 100]}
        }

def generate_ifc(elements: list, output_dir: str, filename: str) -> str:
    """Generate IFC file from elements"""
    try:
        import ifcopenshell
        import ifcopenshell.api
        from datetime import datetime
        
        logger.info("🏗️ Creating IFC file...")
        
        # Create IFC file
        model = ifcopenshell.file(schema="IFC4")
        
        # Create project
        project = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcProject", name=filename)
        
        # Create site
        site = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSite", name="Site")
        ifcopenshell.api.run("aggregate.assign_object", model, product=site, relating_object=project)
        
        # Create building
        building = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuilding", name="Building")
        ifcopenshell.api.run("aggregate.assign_object", model, product=building, relating_object=site)
        
        # Create building storey
        storey = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name="Ground Floor")
        ifcopenshell.api.run("aggregate.assign_object", model, product=storey, relating_object=building)
        
        # Create walls from elements
        for i, element in enumerate(elements):
            if element['type'] == 'LINE' and len(element['geometry']) >= 2:
                # Create wall from line
                wall = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall")
                wall.Name = f"Wall_{i}"
                
                # Set wall properties
                ifcopenshell.api.run("pset.edit_pset", model, product=wall, pset_name="Pset_WallCommon", properties={
                    "Reference": f"Wall_{i}",
                    "LoadBearing": True,
                    "FireRating": "60"
                })
                
                # Assign to storey
                ifcopenshell.api.run("spatial.assign_container", model, product=wall, relating_structure=storey)
        
        # Save IFC file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ifc_filename = f"{timestamp}_{filename}.ifc"
        ifc_path = Path(output_dir) / ifc_filename
        model.write(str(ifc_path))
        
        logger.info(f"✅ IFC file created: {ifc_path}")
        return str(ifc_path)
        
    except Exception as e:
        logger.error(f"❌ Error creating IFC file: {str(e)}")
        return ""

def generate_glb(elements: list, output_dir: str, filename: str) -> str:
    """Generate GLB file from elements"""
    try:
        import trimesh
        import numpy as np
        from datetime import datetime
        
        logger.info("🎨 Creating GLB file...")
        
        # Create scene
        scene = trimesh.Scene()
        
        # Create meshes from elements
        for i, element in enumerate(elements):
            if element['type'] == 'LINE' and len(element['geometry']) >= 2:
                # Create a simple wall mesh from line
                start = element['geometry'][0]
                end = element['geometry'][1]
                
                # Create a simple box for the wall
                length = np.linalg.norm(np.array(end) - np.array(start))
                wall_mesh = trimesh.creation.box(extents=[length, 0.2, 3.0])
                
                # Position the wall
                center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, 1.5]
                wall_mesh.apply_translation(center)
                
                scene.add_geometry(wall_mesh, node_name=f"wall_{i}")
        
        # Export GLB
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        glb_filename = f"{timestamp}_{filename}.glb"
        glb_path = Path(output_dir) / glb_filename
        scene.export(str(glb_path), file_type='glb')
        
        logger.info(f"✅ GLB file created: {glb_path}")
        return str(glb_path)
        
    except Exception as e:
        logger.error(f"❌ Error creating GLB file: {str(e)}")
        return ""

def generate_usd(elements: list, output_dir: str, filename: str) -> str:
    """Generate USD file from elements"""
    try:
        from datetime import datetime
        
        logger.info("🎭 Creating USD file...")
        
        # Create basic USD content
        usd_content = f"""#usda 1.0
(
    defaultPrim = "World"
    upAxis = "Z"
)

def Xform "World" (
    kind = "component"
)
{{
    def Xform "Building" (
        kind = "component"
    )
    {{
"""
        
        # Add elements to USD
        for i, element in enumerate(elements):
            if element['type'] == 'LINE' and len(element['geometry']) >= 2:
                start = element['geometry'][0]
                end = element['geometry'][1]
                center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, 1.5]
                length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
                
                usd_content += f"""        def Xform "Wall_{i}" (
            kind = "component"
        )
        {{
            double3 xformOp:translate = ({center[0]}, {center[1]}, {center[2]})
            uniform token[] xformOpOrder = ["xformOp:translate"]
            
            def Cube "Geometry" (
                kind = "component"
            )
            {{
                double size = 1.0
                double3 xformOp:scale = ({length}, 0.2, 3.0)
                uniform token[] xformOpOrder = ["xformOp:scale"]
            }}
        }}
"""
        
        usd_content += """    }
}
"""
        
        # Save USD file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        usd_filename = f"{timestamp}_{filename}.usd"
        usd_path = Path(output_dir) / usd_filename
        usd_path.write_text(usd_content)
        
        logger.info(f"✅ USD file created: {usd_path}")
        return str(usd_path)
        
    except Exception as e:
        logger.error(f"❌ Error creating USD file: {str(e)}")
        return ""

def main():
    parser = argparse.ArgumentParser(description='Modular DXF Processing')
    parser.add_argument('dxf_path', nargs='?', help='Path to DXF file')
    parser.add_argument('--parse-only', action='store_true', help='Only parse DXF and return JSON')
    parser.add_argument('--ifc-only', action='store_true', help='Only generate IFC file')
    parser.add_argument('--glb-only', action='store_true', help='Only generate GLB file')
    parser.add_argument('--usd-only', action='store_true', help='Only generate USD file')
    parser.add_argument('--elements', help='JSON string of elements for processing')
    parser.add_argument('--output-dir', help='Output directory')
    parser.add_argument('--filename', default='model', help='Base filename for outputs')
    
    args = parser.parse_args()
    
    if args.parse_only and args.dxf_path:
        # Parse DXF and return JSON
        result = parse_dxf_file(args.dxf_path)
        print(json.dumps(result))
        return
    
    if args.ifc_only and args.elements and args.output_dir:
        # Generate IFC only
        elements = json.loads(args.elements)
        ifc_path = generate_ifc(elements, args.output_dir, args.filename)
        print(f"📁 IFC file: {ifc_path}")
        return
    
    if args.glb_only and args.elements and args.output_dir:
        # Generate GLB only
        elements = json.loads(args.elements)
        glb_path = generate_glb(elements, args.output_dir, args.filename)
        print(f"📁 GLB file: {glb_path}")
        return
    
    if args.usd_only and args.elements and args.output_dir:
        # Generate USD only
        elements = json.loads(args.elements)
        usd_path = generate_usd(elements, args.output_dir, args.filename)
        print(f"📁 USD file: {usd_path}")
        return
    
    if args.dxf_path and args.output_dir:
        # Full processing
        result = parse_dxf_file(args.dxf_path)
        if not result['success']:
            print(f"❌ Error: {result['error']}")
            sys.exit(1)
        
        elements = result['elements']
        
        # Generate all outputs
        ifc_path = generate_ifc(elements, args.output_dir, args.filename)
        glb_path = generate_glb(elements, args.output_dir, args.filename)
        usd_path = generate_usd(elements, args.output_dir, args.filename)
        
        print(f"📁 IFC file: {ifc_path}")
        print(f"📁 GLB file: {glb_path}")
        print(f"📁 USD file: {usd_path}")
        print(f"📊 Elements extracted: {len(elements)}")
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
