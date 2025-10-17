import ezdxf
import numpy as np
import json
import logging
from typing import Dict, List, Tuple, Any, Optional
from pathlib import Path
import math

logger = logging.getLogger(__name__)

class RobustDXFProcessor:
    def __init__(self):
        self.doc = None
        self.msp = None
        self.layers = {}
        self.entities = []
        self.architectural_elements = {
            'walls': [],
            'doors': [],
            'windows': [],
            'rooms': [],
            'dimensions': [],
            'text': [],
            'blocks': []
        }
        self.statistics = {}
        self.bounds = {'min': [0, 0, 0], 'max': [0, 0, 0]}
        
    def process_dxf(self, file_path: str) -> Dict[str, Any]:
        """Main processing function - robust DXF analysis"""
        try:
            logger.info(f"Starting robust DXF processing: {file_path}")
            
            # Load DXF document
            self.doc = ezdxf.readfile(file_path)
            self.msp = self.doc.modelspace()
            logger.info(f"Successfully loaded DXF file with {len(self.msp)} entities")
            
            # Extract all data
            self._extract_layers()
            self._extract_entities()
            self._calculate_bounds()
            self._analyze_architectural_elements()
            self._generate_statistics()
            
            result = {
                'success': True,
                'layers': self.layers,
                'entities': self.entities,
                'architectural_elements': self.architectural_elements,
                'statistics': self.statistics,
                'bounds': self.bounds,
                'file_info': self._get_file_info()
            }
            
            logger.info(f"Processing complete: {self.statistics['total_architectural_elements']} architectural elements found")
            return result
            
        except Exception as e:
            logger.error(f"Error in robust DXF processing: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'layers': {},
                'entities': [],
                'architectural_elements': self.architectural_elements,
                'statistics': {},
                'bounds': self.bounds
            }
    
    def _extract_layers(self):
        """Extract comprehensive layer information"""
        self.layers = {}
        for layer in self.doc.layers:
            self.layers[layer.dxf.name] = {
                'name': layer.dxf.name,
                'color': layer.dxf.color,
                'linetype': layer.dxf.linetype,
                'lineweight': layer.dxf.lineweight,
                'on': layer.is_on(),
                'frozen': layer.is_frozen(),
                'locked': layer.is_locked(),
                'plot': layer.is_plot(),
                'entity_count': 0
            }
        logger.info(f"Extracted {len(self.layers)} layers")
    
    def _extract_entities(self):
        """Extract all entities with comprehensive geometry"""
        self.entities = []
        entity_counts = {}
        
        for entity in self.msp:
            try:
                entity_type = entity.dxftype()
                entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1
                
                # Update layer entity count
                layer_name = entity.dxf.layer
                if layer_name in self.layers:
                    self.layers[layer_name]['entity_count'] += 1
                
                entity_data = {
                    'type': entity_type,
                    'layer': layer_name,
                    'handle': entity.dxf.handle,
                    'color': entity.dxf.color,
                    'linetype': entity.dxf.linetype,
                    'lineweight': entity.dxf.lineweight,
                    'geometry': self._extract_entity_geometry(entity)
                }
                
                self.entities.append(entity_data)
                
            except Exception as e:
                logger.warning(f"Error processing entity {entity.dxf.handle}: {str(e)}")
                continue
        
        logger.info(f"Extracted {len(self.entities)} entities")
        logger.info(f"Entity types: {entity_counts}")
    
    def _extract_entity_geometry(self, entity):
        """Extract comprehensive geometry for any entity type"""
        geometry = {'type': entity.dxftype()}
        
        try:
            if entity.dxftype() == 'LINE':
                geometry.update({
                    'start': [entity.dxf.start.x, entity.dxf.start.y, entity.dxf.start.z],
                    'end': [entity.dxf.end.x, entity.dxf.end.y, entity.dxf.end.z],
                    'length': self._calculate_distance(entity.dxf.start, entity.dxf.end)
                })
            
            elif entity.dxftype() == 'CIRCLE':
                geometry.update({
                    'center': [entity.dxf.center.x, entity.dxf.center.y, entity.dxf.center.z],
                    'radius': entity.dxf.radius,
                    'area': math.pi * entity.dxf.radius ** 2
                })
            
            elif entity.dxftype() == 'ARC':
                geometry.update({
                    'center': [entity.dxf.center.x, entity.dxf.center.y, entity.dxf.center.z],
                    'radius': entity.dxf.radius,
                    'start_angle': entity.dxf.start_angle,
                    'end_angle': entity.dxf.end_angle,
                    'length': entity.dxf.radius * abs(entity.dxf.end_angle - entity.dxf.start_angle)
                })
            
            elif entity.dxftype() == 'LWPOLYLINE':
                points = []
                for point in entity.get_points():
                    points.append([point[0], point[1], point[2] if len(point) > 2 else 0])
                geometry.update({
                    'points': points,
                    'closed': entity.closed,
                    'area': self._calculate_polyline_area(points, entity.closed)
                })
            
            elif entity.dxftype() == 'POLYLINE':
                points = []
                for point in entity.points():
                    points.append([point[0], point[1], point[2] if len(point) > 2 else 0])
                geometry.update({
                    'points': points,
                    'closed': entity.is_closed,
                    'area': self._calculate_polyline_area(points, entity.is_closed)
                })
            
            elif entity.dxftype() == 'TEXT':
                geometry.update({
                    'text': entity.dxf.text,
                    'insert_point': [entity.dxf.insert.x, entity.dxf.insert.y, entity.dxf.insert.z],
                    'height': entity.dxf.height,
                    'rotation': entity.dxf.rotation,
                    'width': entity.dxf.width
                })
            
            elif entity.dxftype() == 'MTEXT':
                geometry.update({
                    'text': entity.text,
                    'insert_point': [entity.dxf.insert.x, entity.dxf.insert.y, entity.dxf.insert.z],
                    'height': entity.dxf.char_height,
                    'width': entity.dxf.width
                })
            
            elif entity.dxftype() == 'INSERT':
                geometry.update({
                    'name': entity.dxf.name,
                    'insert_point': [entity.dxf.insert.x, entity.dxf.insert.y, entity.dxf.insert.z],
                    'scale': [entity.dxf.xscale, entity.dxf.yscale, entity.dxf.zscale],
                    'rotation': entity.dxf.rotation
                })
            
            elif entity.dxftype() == 'DIMENSION':
                geometry.update({
                    'dimension_type': entity.dxf.dimtype,
                    'text': getattr(entity.dxf, 'text', ''),
                    'def_point': [entity.dxf.defpoint.x, entity.dxf.defpoint.y, entity.dxf.defpoint.z]
                })
            
            else:
                # Generic entity - extract basic properties
                geometry['properties'] = {}
                for attr in dir(entity.dxf):
                    if not attr.startswith('_') and hasattr(entity.dxf, attr):
                        try:
                            value = getattr(entity.dxf, attr)
                            if isinstance(value, (int, float, str, bool)):
                                geometry['properties'][attr] = value
                        except:
                            continue
            
        except Exception as e:
            geometry['error'] = str(e)
        
        return geometry
    
    def _calculate_distance(self, point1, point2):
        """Calculate distance between two points"""
        return math.sqrt(
            (point2.x - point1.x)**2 + 
            (point2.y - point1.y)**2 + 
            (point2.z - point1.z)**2
        )
    
    def _calculate_polyline_area(self, points, closed):
        """Calculate area of a polyline using shoelace formula"""
        if len(points) < 3:
            return 0.0
        
        if closed and points[0] != points[-1]:
            points.append(points[0])
        
        area = 0.0
        n = len(points)
        for i in range(n - 1):
            area += points[i][0] * points[i + 1][1]
            area -= points[i + 1][0] * points[i][1]
        
        return abs(area) / 2.0
    
    def _calculate_bounds(self):
        """Calculate bounding box of all entities"""
        if not self.entities:
            return
        
        min_x = min_y = min_z = float('inf')
        max_x = max_y = max_z = float('-inf')
        
        for entity in self.entities:
            geom = entity.get('geometry', {})
            if 'start' in geom and 'end' in geom:
                min_x = min(min_x, geom['start'][0], geom['end'][0])
                max_x = max(max_x, geom['start'][0], geom['end'][0])
                min_y = min(min_y, geom['start'][1], geom['end'][1])
                max_y = max(max_y, geom['start'][1], geom['end'][1])
                min_z = min(min_z, geom['start'][2], geom['end'][2])
                max_z = max(max_z, geom['start'][2], geom['end'][2])
            elif 'center' in geom:
                radius = geom.get('radius', 0)
                min_x = min(min_x, geom['center'][0] - radius)
                max_x = max(max_x, geom['center'][0] + radius)
                min_y = min(min_y, geom['center'][1] - radius)
                max_y = max(max_y, geom['center'][1] + radius)
                min_z = min(min_z, geom['center'][2])
                max_z = max(max_z, geom['center'][2])
        
        self.bounds = {
            'min': [min_x if min_x != float('inf') else 0, min_y if min_y != float('inf') else 0, min_z if min_z != float('inf') else 0],
            'max': [max_x if max_x != float('-inf') else 0, max_y if max_y != float('-inf') else 0, max_z if max_z != float('-inf') else 0]
        }
    
    def _analyze_architectural_elements(self):
        """Advanced architectural element analysis"""
        # Define layer patterns for architectural elements
        wall_patterns = ['WALL', 'WALLS', 'WALL_OUTLINE', 'A-WALL', 'A-WALL-FULL', 'WALLS-EXIST', 'WALLS-NEW']
        door_patterns = ['DOOR', 'DOORS', 'A-DOOR', 'A-DOOR-FULL', 'DOOR-EXIST', 'DOOR-NEW']
        window_patterns = ['WINDOW', 'WINDOWS', 'A-WINDOW', 'A-WINDOW-FULL', 'WINDOW-EXIST', 'WINDOW-NEW']
        room_patterns = ['ROOM', 'ROOMS', 'SPACE', 'A-AREA', 'AREA', 'ROOM-EXIST', 'ROOM-NEW']
        text_patterns = ['TEXT', 'TEXTS', 'LABEL', 'LABELS', 'NOTE', 'NOTES']
        dimension_patterns = ['DIM', 'DIMS', 'DIMENSION', 'DIMENSIONS', 'MEASURE', 'MEASURES']
        
        for entity in self.entities:
            layer_name = entity['layer'].upper()
            entity_type = entity['type']
            geometry = entity.get('geometry', {})
            
            # Classify walls
            if any(pattern in layer_name for pattern in wall_patterns):
                if entity_type in ['LINE', 'LWPOLYLINE', 'POLYLINE']:
                    self.architectural_elements['walls'].append({
                        'type': 'wall',
                        'layer': entity['layer'],
                        'geometry': geometry,
                        'length': geometry.get('length', 0),
                        'area': geometry.get('area', 0)
                    })
            
            # Classify doors
            elif any(pattern in layer_name for pattern in door_patterns):
                if entity_type in ['LINE', 'ARC', 'CIRCLE', 'INSERT']:
                    self.architectural_elements['doors'].append({
                        'type': 'door',
                        'layer': entity['layer'],
                        'geometry': geometry,
                        'width': self._estimate_door_width(geometry),
                        'height': 2.1  # Standard door height
                    })
            
            # Classify windows
            elif any(pattern in layer_name for pattern in window_patterns):
                if entity_type in ['LINE', 'ARC', 'CIRCLE', 'INSERT']:
                    self.architectural_elements['windows'].append({
                        'type': 'window',
                        'layer': entity['layer'],
                        'geometry': geometry,
                        'width': self._estimate_window_width(geometry),
                        'height': 1.5  # Standard window height
                    })
            
            # Classify rooms
            elif any(pattern in layer_name for pattern in room_patterns):
                if entity_type in ['LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'TEXT', 'MTEXT']:
                    self.architectural_elements['rooms'].append({
                        'type': 'room',
                        'layer': entity['layer'],
                        'geometry': geometry,
                        'area': geometry.get('area', 0),
                        'name': geometry.get('text', f"Room_{len(self.architectural_elements['rooms'])}")
                    })
            
            # Classify text
            elif any(pattern in layer_name for pattern in text_patterns) or entity_type in ['TEXT', 'MTEXT']:
                self.architectural_elements['text'].append({
                    'type': 'text',
                    'layer': entity['layer'],
                    'geometry': geometry,
                    'content': geometry.get('text', '')
                })
            
            # Classify dimensions
            elif any(pattern in layer_name for pattern in dimension_patterns) or entity_type == 'DIMENSION':
                self.architectural_elements['dimensions'].append({
                    'type': 'dimension',
                    'layer': entity['layer'],
                    'geometry': geometry,
                    'text': geometry.get('text', '')
                })
            
            # Classify blocks
            elif entity_type == 'INSERT':
                self.architectural_elements['blocks'].append({
                    'type': 'block',
                    'layer': entity['layer'],
                    'geometry': geometry,
                    'name': geometry.get('name', 'Unknown')
                })
    
    def _estimate_door_width(self, geometry):
        """Estimate door width from geometry"""
        if 'length' in geometry:
            return geometry['length']
        elif 'radius' in geometry:
            return geometry['radius'] * 2
        elif 'width' in geometry:
            return geometry['width']
        return 0.9  # Standard door width
    
    def _estimate_window_width(self, geometry):
        """Estimate window width from geometry"""
        if 'length' in geometry:
            return geometry['length']
        elif 'radius' in geometry:
            return geometry['radius'] * 2
        elif 'width' in geometry:
            return geometry['width']
        return 1.2  # Standard window width
    
    def _generate_statistics(self):
        """Generate comprehensive statistics"""
        self.statistics = {
            'total_layers': len(self.layers),
            'total_entities': len(self.entities),
            'wall_count': len(self.architectural_elements['walls']),
            'door_count': len(self.architectural_elements['doors']),
            'window_count': len(self.architectural_elements['windows']),
            'room_count': len(self.architectural_elements['rooms']),
            'text_count': len(self.architectural_elements['text']),
            'dimension_count': len(self.architectural_elements['dimensions']),
            'block_count': len(self.architectural_elements['blocks']),
            'total_architectural_elements': sum(len(v) for v in self.architectural_elements.values()),
            'bounds': self.bounds,
            'total_wall_length': sum(wall.get('length', 0) for wall in self.architectural_elements['walls']),
            'total_room_area': sum(room.get('area', 0) for room in self.architectural_elements['rooms']),
            'entity_types': self._count_entity_types()
        }
    
    def _count_entity_types(self):
        """Count different entity types"""
        entity_types = {}
        for entity in self.entities:
            entity_type = entity['type']
            entity_types[entity_type] = entity_types.get(entity_type, 0) + 1
        return entity_types
    
    def _get_file_info(self):
        """Get file information"""
        return {
            'dxf_version': self.doc.dxfversion,
            'units': self.doc.header.get('$INSUNITS', 0),
            'units_name': self._get_units_name(self.doc.header.get('$INSUNITS', 0)),
            'created_date': str(self.doc.header.get('$TDCREATE', 'Unknown')),
            'modified_date': str(self.doc.header.get('$TDUPDATE', 'Unknown'))
        }
    
    def _get_units_name(self, units_code):
        """Convert units code to name"""
        units_map = {
            0: 'Unitless',
            1: 'Inches',
            2: 'Feet',
            3: 'Miles',
            4: 'Millimeters',
            5: 'Centimeters',
            6: 'Meters',
            7: 'Kilometers',
            8: 'Microinches',
            9: 'Mils',
            10: 'Yards',
            11: 'Angstroms',
            12: 'Nanometers',
            13: 'Microns',
            14: 'Decimeters',
            15: 'Decameters',
            16: 'Hectometers',
            17: 'Gigameters',
            18: 'Astronomical units',
            19: 'Light years',
            20: 'Parsecs'
        }
        return units_map.get(units_code, 'Unknown')
