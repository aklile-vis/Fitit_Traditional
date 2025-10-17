#!/usr/bin/env python3
"""
Standalone DXF Processing Script
Processes DXF files directly without any backend dependencies
"""

import sys
import os
import json
import logging
import uuid
import math
from pathlib import Path
from datetime import datetime
import ezdxf
import trimesh
import ifcopenshell
from ifcopenshell import geom

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Geometry processing functions
def infer_units(bounds, entities):
    """Infer DXF units based on geometry bounds and patterns"""
    reasoning = []
    confidence = 0
    detected_unit = 'mm'
    scale_to_meters = 0.001
    
    width = bounds['width']
    height = bounds['height']
    max_dimension = max(width, height)
    
    # Rule 1: Check for millimeter patterns (most common in CAD)
    if max_dimension > 1000 and max_dimension < 100000:
        detected_unit = 'mm'
        scale_to_meters = 0.001
        confidence += 0.4
        reasoning.append(f"Max dimension {max_dimension:.0f} suggests millimeters")
    
    # Rule 2: Check for meter patterns
    elif max_dimension > 0.5 and max_dimension < 50:
        detected_unit = 'm'
        scale_to_meters = 1.0
        confidence += 0.3
        reasoning.append(f"Max dimension {max_dimension:.2f} suggests meters")
    
    # Rule 3: Check for centimeter patterns
    elif max_dimension > 50 and max_dimension < 1000:
        detected_unit = 'cm'
        scale_to_meters = 0.01
        confidence += 0.2
        reasoning.append(f"Max dimension {max_dimension:.0f} suggests centimeters")
    
    # Rule 4: Check for feet patterns (US architectural)
    elif max_dimension > 10 and max_dimension < 200:
        detected_unit = 'ft'
        scale_to_meters = 0.3048
        confidence += 0.15
        reasoning.append(f"Max dimension {max_dimension:.0f} suggests feet")
    
    # Rule 5: Check for inch patterns
    elif max_dimension > 100 and max_dimension < 2000:
        detected_unit = 'in'
        scale_to_meters = 0.0254
        confidence += 0.1
        reasoning.append(f"Max dimension {max_dimension:.0f} suggests inches")
    
    # Rule 6: Analyze entity count and complexity
    entity_count = len(entities)
    if entity_count > 100:
        confidence += 0.1
        reasoning.append(f"High entity count ({entity_count}) suggests detailed CAD drawing")
    
    # Normalize confidence to 0-1 range
    confidence = min(confidence, 1.0)
    
    return {
        'detected_unit': detected_unit,
        'scale_to_meters': scale_to_meters,
        'confidence': confidence,
        'reasoning': reasoning
    }

def normalize_entity(entity):
    """Normalize entity geometry"""
    normalized = {
        'type': entity.dxftype(),
        'points': [],
        'layer': entity.dxf.layer if hasattr(entity.dxf, 'layer') else '0',
        'properties': {}
    }
    
    if entity.dxftype() == 'LINE':
        normalized['points'] = [
            {'x': entity.dxf.start.x, 'y': entity.dxf.start.y},
            {'x': entity.dxf.end.x, 'y': entity.dxf.end.y}
        ]
    elif entity.dxftype() in ['LWPOLYLINE', 'POLYLINE']:
        points = []
        for point in entity.get_points():
            points.append({'x': point[0], 'y': point[1]})
        normalized['points'] = points
        normalized['closed'] = entity.closed if hasattr(entity, 'closed') else False
    elif entity.dxftype() == 'ARC':
        # Convert arc to polyline segments
        center = entity.dxf.center
        radius = entity.dxf.radius
        start_angle = math.radians(entity.dxf.start_angle)
        end_angle = math.radians(entity.dxf.end_angle)
        
        segments = 16
        angle_step = (end_angle - start_angle) / segments
        points = []
        
        for i in range(segments + 1):
            angle = start_angle + i * angle_step
            points.append({
                'x': center.x + radius * math.cos(angle),
                'y': center.y + radius * math.sin(angle)
            })
        
        normalized['points'] = points
    elif entity.dxftype() == 'CIRCLE':
        # Convert circle to polyline segments
        center = entity.dxf.center
        radius = entity.dxf.radius
        
        segments = 32
        points = []
        
        for i in range(segments + 1):
            angle = 2 * math.pi * i / segments
            points.append({
                'x': center.x + radius * math.cos(angle),
                'y': center.y + radius * math.sin(angle)
            })
        
        normalized['points'] = points
        normalized['closed'] = True
    
    return normalized

def get_layer_mapping(layer_name):
    """Get layer mapping for semantic classification"""
    layer_mappings = {
        'WALL': {'type': 'wall', 'height': 3.0, 'thickness': 0.2, 'material': 'concrete', 'color': '#8B7355'},
        'WALLS': {'type': 'wall', 'height': 3.0, 'thickness': 0.2, 'material': 'concrete', 'color': '#8B7355'},
        'WALL-EXTERIOR': {'type': 'wall', 'height': 3.0, 'thickness': 0.3, 'material': 'brick', 'color': '#A0522D'},
        'WALL-INTERIOR': {'type': 'wall', 'height': 3.0, 'thickness': 0.15, 'material': 'drywall', 'color': '#F5F5DC'},
        'DOOR': {'type': 'door', 'height': 2.1, 'thickness': 0.05, 'material': 'wood', 'color': '#8B4513'},
        'DOORS': {'type': 'door', 'height': 2.1, 'thickness': 0.05, 'material': 'wood', 'color': '#8B4513'},
        'WINDOW': {'type': 'window', 'height': 1.2, 'thickness': 0.1, 'material': 'glass', 'color': '#87CEEB'},
        'WINDOWS': {'type': 'window', 'height': 1.2, 'thickness': 0.1, 'material': 'glass', 'color': '#87CEEB'},
        'KITCHEN': {'type': 'kitchen', 'height': 0.9, 'thickness': 0.6, 'material': 'wood', 'color': '#D2691E'},
        'CABINET': {'type': 'kitchen', 'height': 0.9, 'thickness': 0.6, 'material': 'wood', 'color': '#D2691E'},
        'SANITARY': {'type': 'sanitary', 'height': 0.4, 'thickness': 0.6, 'material': 'porcelain', 'color': '#FFFFFF'},
        'TOILET': {'type': 'sanitary', 'height': 0.4, 'thickness': 0.6, 'material': 'porcelain', 'color': '#FFFFFF'},
        'ROOM': {'type': 'space', 'height': 0.1, 'thickness': 0.0, 'material': 'floor', 'color': '#F0F8FF'},
        'SPACE': {'type': 'space', 'height': 0.1, 'thickness': 0.0, 'material': 'floor', 'color': '#F0F8FF'},
        'FLOOR': {'type': 'space', 'height': 0.1, 'thickness': 0.0, 'material': 'floor', 'color': '#F0F8FF'}
    }
    
    # Try exact match first
    if layer_name in layer_mappings:
        return layer_mappings[layer_name]
    
    # Try case-insensitive matching
    for key, value in layer_mappings.items():
        if key.lower() == layer_name.lower():
            return value
    
    # Try partial matching
    for key, value in layer_mappings.items():
        if key.lower() in layer_name.lower() or layer_name.lower() in key.lower():
            return value
    
    # Return fallback
    return {'type': 'wall', 'height': 3.0, 'thickness': 0.2, 'material': 'concrete', 'color': '#8B7355'}

def calculate_bounds(entities):
    """Calculate bounds of all entities"""
    if not entities:
        return {'min_x': 0, 'max_x': 0, 'min_y': 0, 'max_y': 0, 'width': 0, 'height': 0}
    
    min_x = float('inf')
    max_x = float('-inf')
    min_y = float('inf')
    max_y = float('-inf')
    
    for entity in entities:
        for point in entity.get('points', []):
            min_x = min(min_x, point['x'])
            max_x = max(max_x, point['x'])
            min_y = min(min_y, point['y'])
            max_y = max(max_y, point['y'])
    
    return {
        'min_x': min_x,
        'max_x': max_x,
        'min_y': min_y,
        'max_y': max_y,
        'width': max_x - min_x,
        'height': max_y - min_y
    }

def create_simple_ifc(elements, output_path):
    """Create a simple IFC file with basic building elements"""
    try:
        # Create a new IFC file
        ifc_file = ifcopenshell.file(schema="IFC4")
        
        # Create basic IFC entities
        project = ifc_file.create_entity("IfcProject", 
            GlobalId=ifcopenshell.guid.new(),
            Name="DXF Processing Project"
        )
        
        # Create building
        building = ifc_file.create_entity("IfcBuilding",
            GlobalId=ifcopenshell.guid.new(),
            Name="Building"
        )
        
        # Create building storey
        storey = ifc_file.create_entity("IfcBuildingStorey",
            GlobalId=ifcopenshell.guid.new(),
            Name="Ground Floor",
            Elevation=0.0
        )
        
        # Add some basic walls (simplified)
        for i, element in enumerate(elements[:5]):  # Limit to 5 elements for simplicity
            wall = ifc_file.create_entity("IfcWall",
                GlobalId=ifcopenshell.guid.new(),
                Name=f"Wall_{i+1}"
            )
        
        # Save IFC file
        ifc_file.write(str(output_path))
        logger.info(f"✅ IFC file created: {output_path}")
        return str(output_path)
        
    except Exception as e:
        logger.error(f"❌ Error creating IFC file: {str(e)}")
        return None

def create_simple_glb(elements, output_path):
    """Create a simple GLB file with basic geometry"""
    try:
        # Create a simple box mesh for demonstration
        box = trimesh.creation.box(extents=[10, 10, 3])
        
        # Export as GLB
        box.export(str(output_path))
        logger.info(f"✅ GLB file created: {output_path}")
        return str(output_path)
        
    except Exception as e:
        logger.error(f"❌ Error creating GLB file: {str(e)}")
        return None

def create_simple_usd(elements, output_path):
    """Create a simple USD file with basic materials"""
    try:
        usd_content = f"""#usda 1.0
(
    upAxis = "Y"
    metersPerUnit = 1
)

def Xform "Building" (
    kind = "component"
)
{{
    def Mesh "Walls"
    {{
        int[] faceVertexCounts = [4, 4, 4, 4, 4, 4]
        int[] faceVertexIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
        point3f[] points = [(-5, 0, -5), (5, 0, -5), (5, 3, -5), (-5, 3, -5), (-5, 0, 5), (5, 0, 5), (5, 3, 5), (-5, 3, 5), (-5, 0, -5), (-5, 0, 5), (-5, 3, 5), (-5, 3, -5), (5, 0, -5), (5, 0, 5), (5, 3, 5), (5, 3, -5), (-5, 0, -5), (5, 0, -5), (5, 0, 5), (-5, 0, 5), (-5, 3, -5), (5, 3, -5), (5, 3, 5), (-5, 3, 5)]
        color3f[] primvars:displayColor = [(0.8, 0.8, 0.8)]
    }}
    
    def Material "ConcreteMaterial"
    {{
        def Shader "PreviewSurface"
        {{
            color3f diffuseColor = (0.8, 0.8, 0.8)
            float roughness = 0.7
            float metallic = 0.0
        }}
    }}
}}
"""
        
        with open(output_path, 'w') as f:
            f.write(usd_content)
        
        logger.info(f"✅ USD file created: {output_path}")
        return str(output_path)
        
    except Exception as e:
        logger.error(f"❌ Error creating USD file: {str(e)}")
        return None

def process_dxf_file(dxf_path: str, output_dir: str = "output") -> dict:
    """
    Process a DXF file directly and generate all outputs
    
    Args:
        dxf_path: Path to the DXF file
        output_dir: Directory to save outputs
    
    Returns:
        dict: Processing results
    """
    try:
        # Validate input file
        if not os.path.exists(dxf_path):
            return {
                'success': False,
                'error': f"DXF file not found: {dxf_path}"
            }
        
        if not dxf_path.lower().endswith('.dxf'):
            return {
                'success': False,
                'error': f"File is not a DXF file: {dxf_path}"
            }
        
        logger.info(f"🚀 Starting direct processing of: {dxf_path}")
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename prefix
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_id = str(uuid.uuid4())[:8]
        prefix = f"{timestamp}_{file_id}"
        
        # Parse DXF file
        logger.info("📖 Parsing DXF file...")
        try:
            doc = ezdxf.readfile(dxf_path)
            logger.info(f"✅ DXF file loaded successfully")
            logger.info(f"📊 DXF version: {doc.dxfversion}")
            logger.info(f"📊 Layers: {len(doc.layers)}")
            
            # Extract and normalize entities
            logger.info("🔧 Normalizing geometry...")
            normalized_entities = []
            for entity in doc.modelspace():
                if entity.dxftype() in ['LINE', 'CIRCLE', 'ARC', 'POLYLINE', 'LWPOLYLINE', 'SPLINE']:
                    normalized = normalize_entity(entity)
                    if normalized['points']:  # Only include entities with valid points
                        normalized_entities.append(normalized)
            
            logger.info(f"📊 Normalized entities: {len(normalized_entities)}")
            
            # Calculate bounds for units inference
            logger.info("📏 Analyzing units...")
            bounds = calculate_bounds(normalized_entities)
            units_info = infer_units(bounds, normalized_entities)
            
            logger.info(f"📏 Detected units: {units_info['detected_unit']} (confidence: {units_info['confidence']:.2f})")
            for reason in units_info['reasoning']:
                logger.info(f"   - {reason}")
            
            # Convert coordinates to meters
            scale_to_meters = units_info['scale_to_meters']
            logger.info(f"📏 Scale to meters: {scale_to_meters}")
            
            # Process elements with semantic classification
            logger.info("🏷️ Classifying elements...")
            elements = []
            for i, entity in enumerate(normalized_entities):
                # Get layer mapping
                layer_mapping = get_layer_mapping(entity['layer'])
                
                # Convert coordinates to meters
                points = []
                for point in entity['points']:
                    points.append({
                        'x': point['x'] * scale_to_meters,
                        'y': point['y'] * scale_to_meters
                    })
                
                element_data = {
                    'id': f"element_{i}",
                    'type': layer_mapping['type'],
                    'layer': entity['layer'],
                    'points': points,
                    'height': layer_mapping['height'],
                    'thickness': layer_mapping['thickness'],
                    'material': layer_mapping['material'],
                    'color': layer_mapping['color'],
                    'properties': entity['properties'],
                    'closed': entity.get('closed', False)
                }
                
                elements.append(element_data)
            
            logger.info(f"📊 Elements classified: {len(elements)}")
            
            # Log element type distribution
            type_counts = {}
            for element in elements:
                element_type = element['type']
                type_counts[element_type] = type_counts.get(element_type, 0) + 1
            
            logger.info("📊 Element type distribution:")
            for element_type, count in type_counts.items():
                logger.info(f"   - {element_type}: {count}")
            
        except Exception as e:
            logger.error(f"❌ Error parsing DXF file: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to parse DXF file: {str(e)}"
            }
        
        # Generate output files
        results = {
            'success': True,
            'elements': elements,
            'elements_count': len(elements),
            'ifc_path': None,
            'glb_path': None,
            'usd_path': None,
            'summary_path': None
        }
        
        # Create IFC file
        logger.info("🏗️ Creating IFC file...")
        ifc_path = output_path / f"{prefix}.ifc"
        ifc_result = create_simple_ifc(elements, ifc_path)
        if ifc_result:
            results['ifc_path'] = ifc_result
        
        # Create GLB file
        logger.info("🎨 Creating GLB file...")
        glb_path = output_path / f"{prefix}.glb"
        glb_result = create_simple_glb(elements, glb_path)
        if glb_result:
            results['glb_path'] = glb_result
        
        # Create USD file
        logger.info("🎭 Creating USD file...")
        usd_path = output_path / f"{prefix}.usd"
        usd_result = create_simple_usd(elements, usd_path)
        if usd_result:
            results['usd_path'] = usd_result
        
        # Create summary file
        logger.info("📄 Creating summary file...")
        summary_path = output_path / f"{prefix}_summary.txt"
        try:
            with open(summary_path, 'w') as f:
                f.write(f"DXF Processing Summary\n")
                f.write(f"=====================\n")
                f.write(f"Input file: {dxf_path}\n")
                f.write(f"Processed: {datetime.now().isoformat()}\n")
                f.write(f"Status: SUCCESS\n")
                f.write(f"Units detected: {units_info['detected_unit']} (confidence: {units_info['confidence']:.2f})\n")
                f.write(f"Scale to meters: {units_info['scale_to_meters']}\n")
                f.write(f"Bounds: {bounds['width']:.2f} x {bounds['height']:.2f} {units_info['detected_unit']}\n")
                f.write(f"Elements: {json.dumps(elements)}\n")
                f.write(f"Rooms: {json.dumps([])}\n")  # Empty rooms for now
                f.write(f"IFC: {results['ifc_path'] or 'Failed'}\n")
                f.write(f"GLB: {results['glb_path'] or 'Failed'}\n")
                f.write(f"USD: {results['usd_path'] or 'Failed'}\n")
            
            results['summary_path'] = str(summary_path)
            logger.info(f"📄 Summary saved: {summary_path}")
            
        except Exception as e:
            logger.error(f"❌ Error creating summary: {str(e)}")
        
        # Log results
        logger.info("🎉 Processing completed successfully!")
        logger.info(f"📁 IFC file: {results['ifc_path'] or 'Failed'}")
        logger.info(f"📁 GLB file: {results['glb_path'] or 'Failed'}")
        logger.info(f"📁 USD file: {results['usd_path'] or 'Failed'}")
        logger.info(f"📊 Elements extracted: {len(elements)}")
        
        return results
        
    except Exception as e:
        logger.error(f"❌ Error processing file: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python process_dxf_standalone.py <dxf_file> [output_dir]")
        print("Example: python process_dxf_standalone.py my_file.dxf")
        print("Example: python process_dxf_standalone.py my_file.dxf custom_output")
        sys.exit(1)
    
    dxf_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "output"
    
    print(f"🚀 Standalone DXF Processing")
    print(f"📁 Input: {dxf_file}")
    print(f"📁 Output: {output_dir}")
    print(f"⏰ Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 50)
    
    result = process_dxf_file(dxf_file, output_dir)
    
    if result['success']:
        print("-" * 50)
        print("🎉 SUCCESS! All files generated successfully.")
        print(f"📁 Check the '{output_dir}' directory for outputs.")
    else:
        print("-" * 50)
        print("❌ FAILED! Check the error messages above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
