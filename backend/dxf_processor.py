import ezdxf
import numpy as np
from typing import Dict, List, Tuple, Any
import json
import logging

logger = logging.getLogger(__name__)

class DXFProcessor:
    def __init__(self):
        self.layers = {}
        self.entities = []
        self.architectural_elements = {
            'walls': [],
            'doors': [],
            'windows': [],
            'rooms': [],
            'dimensions': []
        }
    
    def process_dxf(self, file_path: str) -> Dict[str, Any]:
        """Process DXF file and extract architectural elements"""
        try:
            # Load DXF document
            doc = ezdxf.readfile(file_path)
            logger.info(f"Successfully loaded DXF file: {file_path}")
            
            # Extract basic information
            self._extract_layers(doc)
            self._extract_entities(doc)
            self._analyze_architectural_elements(doc)
            
            return {
                'success': True,
                'layers': self.layers,
                'entities': self.entities,
                'architectural_elements': self.architectural_elements,
                'statistics': self._get_statistics()
            }
            
        except Exception as e:
            logger.error(f"Error processing DXF file: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'layers': {},
                'entities': [],
                'architectural_elements': self.architectural_elements,
                'statistics': {}
            }
    
    def _extract_layers(self, doc):
        """Extract layer information from DXF"""
        self.layers = {}
        for layer in doc.layers:
            self.layers[layer.dxf.name] = {
                'name': layer.dxf.name,
                'color': layer.dxf.color,
                'linetype': layer.dxf.linetype,
                'lineweight': layer.dxf.lineweight,
                'on': layer.is_on(),
                'frozen': layer.is_frozen(),
                'locked': layer.is_locked()
            }
        logger.info(f"Found {len(self.layers)} layers")
    
    def _extract_entities(self, doc):
        """Extract all entities from modelspace"""
        self.entities = []
        msp = doc.modelspace()
        
        for entity in msp:
            entity_data = {
                'type': entity.dxftype(),
                'layer': entity.dxf.layer,
                'handle': entity.dxf.handle,
                'color': entity.dxf.color,
                'linetype': entity.dxf.linetype,
                'lineweight': entity.dxf.lineweight
            }
            
            # Extract geometry based on entity type
            try:
                if hasattr(entity, 'dxf') and hasattr(entity.dxf, 'start'):
                    # Line, Arc, etc.
                    entity_data['geometry'] = self._extract_line_geometry(entity)
                elif hasattr(entity, 'dxf') and hasattr(entity.dxf, 'center'):
                    # Circle
                    entity_data['geometry'] = self._extract_circle_geometry(entity)
                elif hasattr(entity, 'dxf') and hasattr(entity.dxf, 'insert'):
                    # Block/Insert
                    entity_data['geometry'] = self._extract_block_geometry(entity)
                elif hasattr(entity, 'dxf') and hasattr(entity.dxf, 'text'):
                    # Text
                    entity_data['geometry'] = self._extract_text_geometry(entity)
                else:
                    # Unknown entity type
                    entity_data['geometry'] = {'type': entity.dxftype(), 'error': 'Unknown entity type'}
            except Exception as geom_error:
                entity_data['geometry'] = {'type': entity.dxftype(), 'error': str(geom_error)}
            
            self.entities.append(entity_data)
        
        logger.info(f"Found {len(self.entities)} entities")
    
    def _extract_line_geometry(self, entity):
        """Extract geometry for line-based entities"""
        geometry = {'type': entity.dxftype()}
        
        if hasattr(entity.dxf, 'start'):
            geometry['start'] = [entity.dxf.start.x, entity.dxf.start.y, entity.dxf.start.z]
        if hasattr(entity.dxf, 'end'):
            geometry['end'] = [entity.dxf.end.x, entity.dxf.end.y, entity.dxf.end.z]
        if hasattr(entity.dxf, 'center'):
            geometry['center'] = [entity.dxf.center.x, entity.dxf.center.y, entity.dxf.center.z]
        if hasattr(entity.dxf, 'radius') and hasattr(entity, 'dxftype') and entity.dxftype() in ['CIRCLE', 'ARC']:
            geometry['radius'] = entity.dxf.radius
        if hasattr(entity.dxf, 'start_angle'):
            geometry['start_angle'] = entity.dxf.start_angle
        if hasattr(entity.dxf, 'end_angle'):
            geometry['end_angle'] = entity.dxf.end_angle
        
        return geometry
    
    def _extract_circle_geometry(self, entity):
        """Extract geometry for circle entities"""
        return {
            'type': 'CIRCLE',
            'center': [entity.dxf.center.x, entity.dxf.center.y, entity.dxf.center.z],
            'radius': entity.dxf.radius
        }
    
    def _extract_block_geometry(self, entity):
        """Extract geometry for block/insert entities"""
        return {
            'type': 'INSERT',
            'name': entity.dxf.name,
            'insert_point': [entity.dxf.insert.x, entity.dxf.insert.y, entity.dxf.insert.z],
            'scale': [entity.dxf.xscale, entity.dxf.yscale, entity.dxf.zscale],
            'rotation': entity.dxf.rotation
        }
    
    def _extract_text_geometry(self, entity):
        """Extract geometry for text entities"""
        return {
            'type': 'TEXT',
            'text': entity.dxf.text,
            'insert_point': [entity.dxf.insert.x, entity.dxf.insert.y, entity.dxf.insert.z],
            'height': entity.dxf.height,
            'rotation': entity.dxf.rotation
        }
    
    def _analyze_architectural_elements(self, doc):
        """Analyze entities to identify architectural elements"""
        msp = doc.modelspace()
        
        # Look for walls (typically lines on specific layers)
        wall_layers = ['WALL', 'WALLS', 'WALL_OUTLINE', 'A-WALL', 'A-WALL-FULL']
        door_layers = ['DOOR', 'DOORS', 'A-DOOR', 'A-DOOR-FULL']
        window_layers = ['WINDOW', 'WINDOWS', 'A-WINDOW', 'A-WINDOW-FULL']
        room_layers = ['ROOM', 'ROOMS', 'SPACE', 'A-AREA']
        
        for entity in msp:
            layer_name = entity.dxf.layer.upper()
            
            if any(wall_layer in layer_name for wall_layer in wall_layers):
                if entity.dxftype() == 'LINE':
                    self.architectural_elements['walls'].append({
                        'type': 'wall',
                        'layer': entity.dxf.layer,
                        'geometry': self._extract_line_geometry(entity),
                        'length': self._calculate_line_length(entity)
                    })
            
            elif any(door_layer in layer_name for door_layer in door_layers):
                if entity.dxftype() in ['LINE', 'ARC', 'CIRCLE']:
                    self.architectural_elements['doors'].append({
                        'type': 'door',
                        'layer': entity.dxf.layer,
                        'geometry': self._extract_line_geometry(entity),
                        'width': self._estimate_door_width(entity)
                    })
            
            elif any(window_layer in layer_name for window_layer in window_layers):
                if entity.dxftype() in ['LINE', 'ARC', 'CIRCLE']:
                    self.architectural_elements['windows'].append({
                        'type': 'window',
                        'layer': entity.dxf.layer,
                        'geometry': self._extract_line_geometry(entity),
                        'width': self._estimate_window_width(entity)
                    })
            
            elif any(room_layer in layer_name for room_layer in room_layers):
                if entity.dxftype() in ['LWPOLYLINE', 'POLYLINE', 'CIRCLE']:
                    self.architectural_elements['rooms'].append({
                        'type': 'room',
                        'layer': entity.dxf.layer,
                        'geometry': self._extract_line_geometry(entity),
                        'area': self._calculate_area(entity)
                    })
            
            elif entity.dxftype() == 'DIMENSION':
                self.architectural_elements['dimensions'].append({
                    'type': 'dimension',
                    'layer': entity.dxf.layer,
                    'geometry': self._extract_line_geometry(entity),
                    'text': getattr(entity.dxf, 'text', '')
                })
        
        logger.info(f"Found architectural elements: {sum(len(v) for v in self.architectural_elements.values())} total")
    
    def _calculate_line_length(self, entity):
        """Calculate length of a line entity"""
        if hasattr(entity.dxf, 'start') and hasattr(entity.dxf, 'end'):
            start = np.array([entity.dxf.start.x, entity.dxf.start.y, entity.dxf.start.z])
            end = np.array([entity.dxf.end.x, entity.dxf.end.y, entity.dxf.end.z])
            return float(np.linalg.norm(end - start))
        return 0.0
    
    def _estimate_door_width(self, entity):
        """Estimate door width based on entity geometry"""
        if entity.dxftype() == 'LINE':
            return self._calculate_line_length(entity)
        elif entity.dxftype() == 'ARC':
            return entity.dxf.radius * 2
        return 0.9  # Default door width
    
    def _estimate_window_width(self, entity):
        """Estimate window width based on entity geometry"""
        if entity.dxftype() == 'LINE':
            return self._calculate_line_length(entity)
        elif entity.dxftype() == 'ARC':
            return entity.dxf.radius * 2
        return 1.2  # Default window width
    
    def _calculate_area(self, entity):
        """Calculate area of a polyline or circle"""
        if entity.dxftype() == 'CIRCLE':
            return float(np.pi * entity.dxf.radius ** 2)
        elif entity.dxftype() in ['LWPOLYLINE', 'POLYLINE']:
            # Simple area calculation for polyline
            return 0.0  # Would need more complex calculation
        return 0.0
    
    def _get_statistics(self):
        """Get processing statistics"""
        return {
            'total_layers': len(self.layers),
            'total_entities': len(self.entities),
            'wall_count': len(self.architectural_elements['walls']),
            'door_count': len(self.architectural_elements['doors']),
            'window_count': len(self.architectural_elements['windows']),
            'room_count': len(self.architectural_elements['rooms']),
            'dimension_count': len(self.architectural_elements['dimensions']),
            'total_architectural_elements': sum(len(v) for v in self.architectural_elements.values())
        }
