import ezdxf
import numpy as np
import json
import logging
from typing import Dict, List, Tuple, Any, Optional
from pathlib import Path
import math
import re

logger = logging.getLogger(__name__)

# Layer classification helpers -------------------------------------------------

LAYER_TOKEN_EXPANSIONS = {
    'RM': {'ROOM'},
    'RMS': {'ROOM'},
    'FLR': {'FLOOR'},
    'FL': {'FLOOR'},
    'FLRS': {'FLOOR'},
    'CLG': {'CEILING'},
    'CL': {'CEILING'},
    'CLNG': {'CEILING'},
    'SLB': {'SLAB'},
    'SLBS': {'SLAB'},
    'COL': {'COLUMN'},
    'COLS': {'COLUMN'},
    'STR': {'STRUCTURE', 'STRUCTURAL'},
    'STRL': {'STRUCTURAL'},
    'MECH': {'MECHANICAL'},
    'ELEC': {'ELECTRICAL'},
    'ELE': {'ELECTRICAL'},
    'PWR': {'POWER'},
    'PLMB': {'PLUMBING'},
    'PLUM': {'PLUMBING'},
    'PLUMB': {'PLUMBING'},
    'SAN': {'SANITARY'},
    'HVAC': {'HVAC', 'MECHANICAL'},
    'DUCT': {'DUCT'},
    'FP': {'FIRE'},
    'GRID': {'GRID'},
    'AX': {'AXIS'},
    'AXES': {'AXIS'},
    'FURN': {'FURNITURE'},
    'CASE': {'CASEWORK'},
    'CAB': {'CABINET'},
    'KIT': {'KITCHEN'},
    'BATH': {'BATHROOM'},
    'APPL': {'APPLIANCE'},
    'EQ': {'EQUIPMENT'},
    'EQUIP': {'EQUIPMENT'},
    'DATA': {'DATA'},
    'TEL': {'TELECOM'},
    'TELCO': {'TELECOM'},
}

LAYER_CATEGORY_DEFINITIONS = (
    {
        'category': 'wall',
        'keywords': {'WALL', 'WALLS', 'PARTITION', 'PART', 'PWALL', 'ENCL', 'MUR'},
        'patterns': ('A-WALL', 'C-WALL', 'WALL-'),
        'discipline': 'architectural',
        'system': 'enclosure',
        'priority': 95,
    },
    {
        'category': 'door',
        'keywords': {'DOOR', 'DOORS', 'DOORFRAME', 'JAMB'},
        'patterns': ('A-DOOR', 'DOOR-'),
        'discipline': 'architectural',
        'system': 'openings',
        'priority': 85,
    },
    {
        'category': 'window',
        'keywords': {'WINDOW', 'WINDOWS', 'WIN', 'GLAZ', 'GLASS'},
        'patterns': ('A-WINDOW', 'WINDOW-'),
        'discipline': 'architectural',
        'system': 'openings',
        'priority': 82,
    },
    {
        'category': 'floor',
        'keywords': {'FLOOR', 'FLOORS', 'SLAB', 'FINISH', 'TILE', 'TILING'},
        'patterns': ('A-FLOOR', 'SLAB-'),
        'discipline': 'architectural',
        'system': 'floor_finish',
        'priority': 78,
    },
    {
        'category': 'ceiling',
        'keywords': {'CEILING', 'CEILINGS', 'CLG', 'SOFFIT'},
        'patterns': ('A-CEILING', 'CEIL-'),
        'discipline': 'architectural',
        'system': 'ceiling_finish',
        'priority': 76,
    },
    {
        'category': 'space',
        'keywords': {'ROOM', 'SPACE', 'ZONE', 'AREA'},
        'patterns': ('A-AREA', 'A-ROOM'),
        'discipline': 'architectural',
        'system': 'space',
        'priority': 74,
    },
    {
        'category': 'dimension',
        'keywords': {'DIM', 'DIMENSION'},
        'patterns': ('A-DIM', 'DIM-'),
        'discipline': 'annotation',
        'system': 'dimensioning',
        'priority': 60,
    },
    {
        'category': 'text',
        'keywords': {'TEXT', 'NOTE', 'ANNOTATION', 'ANNO', 'TAG', 'LABEL'},
        'patterns': ('A-ANNO', 'A-TEXT'),
        'discipline': 'annotation',
        'system': 'documentation',
        'priority': 58,
    },
    {
        'category': 'structure_column',
        'keywords': {'COLUMN', 'COLUMNS', 'COL', 'PIER', 'PILE'},
        'patterns': ('S-COL', 'STR-COL'),
        'discipline': 'structural',
        'system': 'column',
        'priority': 88,
    },
    {
        'category': 'structure_beam',
        'keywords': {'BEAM', 'BEAMS', 'GIRDER', 'BRACE', 'FRAMING'},
        'patterns': ('S-BEAM', 'STR-BEAM'),
        'discipline': 'structural',
        'system': 'beam',
        'priority': 86,
    },
    {
        'category': 'structure_foundation',
        'keywords': {'FOUNDATION', 'FOUND', 'FOOTING', 'PILECAP', 'MAT'},
        'patterns': ('S-FOOT', 'S-FOUND'),
        'discipline': 'structural',
        'system': 'foundation',
        'priority': 80,
    },
    {
        'category': 'stair',
        'keywords': {'STAIR', 'STAIRS', 'STEP', 'STEPS'},
        'patterns': ('A-STAIR',),
        'discipline': 'architectural',
        'system': 'vertical_transport',
        'priority': 72,
    },
    {
        'category': 'furniture',
        'keywords': {'FURNITURE', 'FURN', 'CASEWORK', 'CABINET', 'MILLWORK', 'FFE', 'SOFA', 'BED', 'WARDROBE', 'DESK', 'TABLE'},
        'patterns': ('I-FURN', 'A-FURN'),
        'discipline': 'interior',
        'system': 'furniture',
        'priority': 70,
    },
    {
        'category': 'equipment',
        'keywords': {'EQUIPMENT', 'EQUIP', 'APPLIANCE', 'APPL', 'CASEWORK'},
        'patterns': ('ME-EQ', 'EQP-'),
        'discipline': 'equipment',
        'system': 'equipment',
        'priority': 68,
    },
    {
        'category': 'mep_plumbing',
        'keywords': {'PLUMBING', 'PLUMB', 'SANITARY', 'SAN', 'WASTE', 'VENT', 'PIPE', 'PIPING', 'WATER', 'WTR', 'SEWER', 'DRAIN'},
        'patterns': ('P-PLUM', 'MEP-PLUM', 'PLUMB-'),
        'discipline': 'plumbing',
        'system': 'plumbing',
        'priority': 84,
    },
    {
        'category': 'mep_hvac',
        'keywords': {'HVAC', 'MECHANICAL', 'MECH', 'DUCT', 'VENT', 'AIR', 'AC', 'VAV', 'FCU', 'AHU', 'SUPPLY', 'RETURN'},
        'patterns': ('M-HVAC', 'M-DUCT', 'MEP-HVAC'),
        'discipline': 'mechanical',
        'system': 'hvac',
        'priority': 84,
    },
    {
        'category': 'mep_electrical',
        'keywords': {'ELECTRICAL', 'ELECT', 'ELEC', 'POWER', 'PWR', 'LIGHT', 'LIGHTING', 'LTS', 'SWITCH', 'PANEL', 'CONDUIT', 'CABLE', 'DATA', 'TELECOM', 'SECURITY'},
        'patterns': ('E-POWR', 'E-LITE', 'MEP-ELEC'),
        'discipline': 'electrical',
        'system': 'electrical',
        'priority': 84,
    },
    {
        'category': 'mep_fire_protection',
        'keywords': {'FIRE', 'SPRINKLER', 'SPRINK', 'FP', 'ALARM'},
        'patterns': ('FP-', 'FIRE-'),
        'discipline': 'fire_protection',
        'system': 'fire_protection',
        'priority': 75,
    },
    {
        'category': 'landscape',
        'keywords': {'SITE', 'LAND', 'PLANT', 'TREE', 'LANDSCAPE', 'HARDSCAPE', 'GRADE', 'TOPO'},
        'patterns': ('C-LAND', 'SITE-'),
        'discipline': 'site',
        'system': 'landscape',
        'priority': 60,
    },
    {
        'category': 'grid',
        'keywords': {'GRID', 'AXIS', 'AXES'},
        'patterns': ('GRID-', 'AXIS-'),
        'discipline': 'structural',
        'system': 'grid',
        'priority': 62,
    },
    {
        'category': 'roof',
        'keywords': {'ROOF', 'ROOFING'},
        'patterns': ('A-ROOF',),
        'discipline': 'architectural',
        'system': 'roof',
        'priority': 70,
    },
)

DISCIPLINE_HINTS = {
    'architectural': {'A', 'AR', 'ARCH', 'INT', 'FIN', 'ROOM', 'SPACE', 'FURNITURE'},
    'structural': {'S', 'STR', 'STRUCT', 'STRUCTURAL', 'GRID', 'AXIS'},
    'mechanical': {'M', 'MECH', 'MECHANICAL', 'HVAC', 'DUCT', 'AIR'},
    'electrical': {'E', 'ELEC', 'ELECT', 'POWER', 'LIGHT', 'DATA'},
    'plumbing': {'P', 'PLUMB', 'SAN', 'PIPE', 'WASTE'},
    'fire_protection': {'FP', 'FIRE', 'SPRINK'},
    'site': {'C', 'CIVIL', 'SITE', 'LAND'},
}

class DXFParser:
    def __init__(self):
        self.doc = None
        self.msp = None
        self.layers = {}
        self.entities = []
        self.blocks = {}
        self.bounds = {'min': [0, 0, 0], 'max': [0, 0, 0]}
        
    def parse_dxf(self, file_path: str) -> Dict[str, Any]:
        """Main DXF parsing function - comprehensive analysis"""
        try:
            logger.info(f"Starting DXF parsing: {file_path}")
            
            # Load DXF document
            self.doc = ezdxf.readfile(file_path)
            self.msp = self.doc.modelspace()
            
            # Extract all data
            self._extract_layers()
            self._extract_blocks()
            self._extract_entities()
            self._calculate_bounds()
            
            result = {
                'success': True,
                'file_info': self._get_file_info(),
                'layers': self.layers,
                'entities': self.entities,
                'blocks': self.blocks,
                'bounds': self.bounds,
                'statistics': self._generate_statistics()
            }
            
            logger.info(f"DXF parsing complete: {len(self.entities)} entities, {len(self.layers)} layers")
            return result
            
        except Exception as e:
            logger.error(f"Error parsing DXF file: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'file_info': {},
                'layers': {},
                'entities': [],
                'blocks': {},
                'bounds': self.bounds,
                'statistics': {}
            }
    
    def _extract_layers(self):
        """Extract comprehensive layer information"""
        self.layers = {}
        for layer in self.doc.layers:
            # Get layer properties safely
            try:
                is_on = layer.is_on()
            except:
                is_on = True
            
            try:
                is_frozen = layer.is_frozen()
            except:
                is_frozen = False
                
            try:
                is_locked = layer.is_locked()
            except:
                is_locked = False
                
            try:
                is_plot = not layer.is_off()  # Use is_off() instead of is_plot()
            except:
                is_plot = True
            
            analysis = self._analyze_layer(layer.dxf.name)
            layer_info = {
                'name': layer.dxf.name,
                'color': layer.dxf.color,
                'linetype': layer.dxf.linetype,
                'lineweight': layer.dxf.lineweight,
                'on': is_on,
                'frozen': is_frozen,
                'locked': is_locked,
                'plot': is_plot,
                'entity_count': 0,
            }
            layer_info.update(analysis)
            self.layers[layer.dxf.name] = layer_info
        logger.info(f"Extracted {len(self.layers)} layers")
    
    def _extract_blocks(self):
        """Extract block definitions"""
        self.blocks = {}
        for block in self.doc.blocks:
            if not block.is_any_layout:
                block_entities = []
                for entity in block:
                    try:
                        entity_data = self._extract_entity_data(entity)
                        block_entities.append(entity_data)
                    except Exception as e:
                        logger.warning(f"Error processing block entity: {e}")
                        continue
                
                self.blocks[block.dxf.name] = {
                    'name': block.dxf.name,
                    'entities': block_entities,
                    'entity_count': len(block_entities)
                }
        logger.info(f"Extracted {len(self.blocks)} blocks")
    
    def _extract_entities(self):
        """Extract all entities with comprehensive geometry"""
        self.entities = []
        entity_counts = {}
        
        for entity in self.msp:
            try:
                entity_data = self._extract_entity_data(entity)
                self.entities.append(entity_data)
                
                # Update layer entity count
                layer_name = entity.dxf.layer
                if layer_name in self.layers:
                    self.layers[layer_name]['entity_count'] += 1
                
                # Count entity types
                entity_type = entity.dxftype()
                entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1
                
            except Exception as e:
                logger.warning(f"Error processing entity {entity.dxf.handle}: {str(e)}")
                continue
        
        logger.info(f"Extracted {len(self.entities)} entities")
        logger.info(f"Entity types: {entity_counts}")
    
    def _extract_entity_data(self, entity) -> Dict[str, Any]:
        """Extract comprehensive data for any entity"""
        entity_data = {
            'handle': entity.dxf.handle,
            'type': entity.dxftype(),
            'layer': entity.dxf.layer,
            'color': entity.dxf.color,
            'linetype': entity.dxf.linetype,
            'lineweight': entity.dxf.lineweight,
            'geometry': self._extract_geometry(entity),
            'properties': self._extract_properties(entity)
        }
        
        return entity_data
    
    def _extract_geometry(self, entity) -> Dict[str, Any]:
        """Extract geometry for any entity type"""
        geometry = {'type': entity.dxftype()}
        
        try:
            if entity.dxftype() == 'LINE':
                start = entity.dxf.start
                end = entity.dxf.end
                geometry.update({
                    'start': [start.x, start.y, start.z],
                    'end': [end.x, end.y, end.z],
                    'length': self._calculate_distance(start, end),
                    'angle': self._calculate_angle(start, end)
                })
            
            elif entity.dxftype() == 'CIRCLE':
                center = entity.dxf.center
                radius = entity.dxf.radius
                geometry.update({
                    'center': [center.x, center.y, center.z],
                    'radius': radius,
                    'area': math.pi * radius ** 2,
                    'circumference': 2 * math.pi * radius
                })
            
            elif entity.dxftype() == 'ARC':
                center = entity.dxf.center
                radius = entity.dxf.radius
                start_angle = entity.dxf.start_angle
                end_angle = entity.dxf.end_angle
                geometry.update({
                    'center': [center.x, center.y, center.z],
                    'radius': radius,
                    'start_angle': start_angle,
                    'end_angle': end_angle,
                    'length': radius * abs(end_angle - start_angle),
                    'area': 0.5 * radius ** 2 * abs(end_angle - start_angle)
                })
            
            elif entity.dxftype() in ['LWPOLYLINE', 'POLYLINE']:
                points = []
                for point in entity.get_points():
                    points.append([point[0], point[1], point[2] if len(point) > 2 else 0])
                
                closed = entity.closed if hasattr(entity, 'closed') else entity.is_closed
                area = self._calculate_polyline_area(points, closed)
                
                geometry.update({
                    'points': points,
                    'closed': closed,
                    'area': area,
                    'perimeter': self._calculate_polyline_perimeter(points, closed)
                })
            
            elif entity.dxftype() == 'TEXT':
                insert = entity.dxf.insert
                geometry.update({
                    'text': entity.dxf.text,
                    'insert_point': [insert.x, insert.y, insert.z],
                    'height': entity.dxf.height,
                    'rotation': entity.dxf.rotation,
                    'width': entity.dxf.width,
                    'style': getattr(entity.dxf, 'style', 'STANDARD')
                })
            
            elif entity.dxftype() == 'MTEXT':
                insert = entity.dxf.insert
                geometry.update({
                    'text': entity.text,
                    'insert_point': [insert.x, insert.y, insert.z],
                    'height': entity.dxf.char_height,
                    'width': entity.dxf.width,
                    'rotation': entity.dxf.rotation
                })
            
            elif entity.dxftype() == 'INSERT':
                insert = entity.dxf.insert
                geometry.update({
                    'name': entity.dxf.name,
                    'insert_point': [insert.x, insert.y, insert.z],
                    'scale': [entity.dxf.xscale, entity.dxf.yscale, entity.dxf.zscale],
                    'rotation': entity.dxf.rotation,
                    'is_block': True
                })
            
            elif entity.dxftype() == 'DIMENSION':
                geometry.update({
                    'dimension_type': entity.dxf.dimtype,
                    'text': getattr(entity.dxf, 'text', ''),
                    'def_point': [entity.dxf.defpoint.x, entity.dxf.defpoint.y, entity.dxf.defpoint.z],
                    'is_dimension': True
                })
            
            elif entity.dxftype() == 'ELLIPSE':
                center = entity.dxf.center
                major_axis = entity.dxf.major_axis
                ratio = entity.dxf.ratio
                geometry.update({
                    'center': [center.x, center.y, center.z],
                    'major_axis': [major_axis.x, major_axis.y, major_axis.z],
                    'ratio': ratio,
                    'area': math.pi * np.linalg.norm(major_axis) * ratio
                })
            
            elif entity.dxftype() == 'HATCH':
                # Approximate hatch area and bounds
                area = getattr(entity, 'get_area', lambda: 0)() if hasattr(entity, 'get_area') else 0
                # Some ezdxf versions: entity.paths contains boundary loops
                points = []
                try:
                    for path in entity.paths:
                        # Collect polyline edges only
                        if hasattr(path, 'edges'):
                            for e in path.edges:
                                if hasattr(e, 'start') and hasattr(e, 'end'):
                                    points.append([e.start[0], e.start[1], 0])
                                    points.append([e.end[0], e.end[1], 0])
                except Exception:
                    pass
                geometry.update({
                    'points': points,
                    'closed': True,
                    'area': area,
                    'is_hatch': True
                })

            elif entity.dxftype() == 'SPLINE':
                # Sample spline into polyline points and compute approximate area if closed
                pts = []
                try:
                    # Resolution samples
                    for t in np.linspace(0, 1, 64):
                        p = entity.point(t)
                        pts.append([float(p[0]), float(p[1]), 0])
                except Exception:
                    # fallback to control points
                    for p in getattr(entity, 'control_points', []):
                        pts.append([float(p[0]), float(p[1]), 0])
                closed = getattr(entity, 'closed', False)
                area = self._calculate_polyline_area(pts, closed)
                geometry.update({
                    'points': pts,
                    'closed': bool(closed),
                    'area': area,
                    'is_spline': True
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
    
    def _extract_properties(self, entity) -> Dict[str, Any]:
        """Extract additional properties from entity"""
        properties = {}
        
        try:
            # Common properties
            if hasattr(entity.dxf, 'thickness'):
                properties['thickness'] = entity.dxf.thickness
            
            if hasattr(entity.dxf, 'elevation'):
                properties['elevation'] = entity.dxf.elevation
            
            # Text properties
            if entity.dxftype() in ['TEXT', 'MTEXT']:
                properties['text_height'] = getattr(entity.dxf, 'height', getattr(entity.dxf, 'char_height', 0))
                properties['text_style'] = getattr(entity.dxf, 'style', 'STANDARD')
            
            # Dimension properties
            if entity.dxftype() == 'DIMENSION':
                properties['dimension_style'] = getattr(entity.dxf, 'dimstyle', 'STANDARD')
                properties['measurement'] = getattr(entity.dxf, 'measurement', 0)
            
        except Exception as e:
            properties['extraction_error'] = str(e)
        
        return properties
    
    def _tokenize_layer_name(self, layer_name: str) -> Tuple[List[str], set]:
        name_upper = layer_name.upper()
        raw_tokens = [token for token in re.split(r'[^A-Z0-9]+', name_upper) if token]
        token_set = set(raw_tokens)
        expanded = set(token_set)
        for token in token_set:
            expansions = LAYER_TOKEN_EXPANSIONS.get(token)
            if not expansions:
                continue
            if isinstance(expansions, str):
                expanded.add(expansions)
            else:
                expanded.update(expansions)
        return raw_tokens, expanded

    def _infer_discipline(self, tokens: set, classification: Optional[str] = None) -> str:
        for discipline, hints in DISCIPLINE_HINTS.items():
            if tokens & hints:
                return discipline
        fallback = {
            'wall': 'architectural',
            'door': 'architectural',
            'window': 'architectural',
            'floor': 'architectural',
            'ceiling': 'architectural',
            'space': 'architectural',
            'text': 'annotation',
            'dimension': 'annotation',
            'structure_column': 'structural',
            'structure_beam': 'structural',
            'structure_foundation': 'structural',
            'stair': 'architectural',
            'furniture': 'interior',
            'equipment': 'equipment',
            'mep_plumbing': 'plumbing',
            'mep_hvac': 'mechanical',
            'mep_electrical': 'electrical',
            'mep_fire_protection': 'fire_protection',
            'landscape': 'site',
            'grid': 'structural',
            'roof': 'architectural',
        }
        return fallback.get(classification, 'general')

    def _legacy_classification(self, name_upper: str) -> str:
        """Fallback legacy classifier matching the previous heuristic."""
        if any(pattern in name_upper for pattern in ['WALL', 'MUR', 'WALLS', 'A-WALL']):
            return 'wall'
        if any(pattern in name_upper for pattern in ['DOOR', 'DOORS', 'A-DOOR']):
            return 'door'
        if any(pattern in name_upper for pattern in ['WINDOW', 'WINDOWS', 'WIN', 'A-WINDOW']):
            return 'window'
        if any(pattern in name_upper for pattern in ['FLOOR', 'SLAB', 'FLOORS', 'A-FLOOR']):
            return 'floor'
        if any(pattern in name_upper for pattern in ['CEILING', 'CEIL', 'A-CEILING']):
            return 'ceiling'
        if any(pattern in name_upper for pattern in ['ROOM', 'SPACE', 'AREA', 'A-AREA']):
            return 'space'
        if any(pattern in name_upper for pattern in ['TEXT', 'TEXTS', 'LABEL', 'NOTE']):
            return 'text'
        if any(pattern in name_upper for pattern in ['DIM', 'DIMS', 'DIMENSION']):
            return 'dimension'
        if any(pattern in name_upper for pattern in ['BEAM', 'COLUMN', 'STRUCTURE']):
            return 'structure'
        return 'other'

    def _analyze_layer(self, layer_name: str) -> Dict[str, Any]:
        name_upper = layer_name.upper()
        raw_tokens, token_set = self._tokenize_layer_name(layer_name)
        matches = []

        for definition in LAYER_CATEGORY_DEFINITIONS:
            matched_keywords = token_set & definition['keywords']
            pattern_hits = [pattern for pattern in definition.get('patterns', ()) if pattern in name_upper]
            if not matched_keywords and not pattern_hits:
                continue

            score = 0.0
            if matched_keywords:
                score += definition.get('priority', 50) + len(matched_keywords) * 6
            if pattern_hits:
                score += 10 * len(pattern_hits)

            matches.append({
                'category': definition['category'],
                'score': score,
                'rule': definition,
                'matched_keywords': matched_keywords,
                'pattern_hits': pattern_hits,
            })

        matches.sort(key=lambda item: (item['score'], item['rule'].get('priority', 0)), reverse=True)

        if matches:
            best = matches[0]
            classification = best['category']
            discipline = best['rule'].get('discipline') or self._infer_discipline(token_set, classification)
            system = best['rule'].get('system')
            confidence = max(0.25, min(1.0, best['score'] / 100.0))
            tag_set = set(best['matched_keywords'])
            tag_set.update(best['pattern_hits'])
            tag_set.add(classification)
            tags = sorted(tag_set)
            source = 'rule'
        else:
            classification = self._legacy_classification(name_upper)
            discipline = self._infer_discipline(token_set, classification)
            system = None
            confidence = 0.2 if classification != 'other' else 0.0
            tags = [classification] if classification != 'other' else []
            source = 'fallback'

        return {
            'classification': classification,
            'classification_confidence': round(confidence, 3),
            'classification_source': source,
            'discipline': discipline,
            'system': system,
            'tags': tags,
            'tokens': raw_tokens,
        }

    def _classify_layer(self, layer_name: str) -> str:
        """Compatibility wrapper returning only the classification string."""
        return self._analyze_layer(layer_name)['classification']
    
    def _calculate_distance(self, point1, point2) -> float:
        """Calculate distance between two points"""
        return math.sqrt(
            (point2.x - point1.x)**2 + 
            (point2.y - point1.y)**2 + 
            (point2.z - point1.z)**2
        )
    
    def _calculate_angle(self, point1, point2) -> float:
        """Calculate angle of line from point1 to point2"""
        dx = point2.x - point1.x
        dy = point2.y - point1.y
        return math.atan2(dy, dx)
    
    def _calculate_polyline_area(self, points: List[List[float]], closed: bool) -> float:
        """Calculate area of polyline using shoelace formula"""
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
    
    def _calculate_polyline_perimeter(self, points: List[List[float]], closed: bool) -> float:
        """Calculate perimeter of polyline"""
        if len(points) < 2:
            return 0.0
        
        perimeter = 0.0
        n = len(points)
        
        for i in range(n - 1):
            p1 = points[i]
            p2 = points[i + 1]
            perimeter += math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
        
        if closed and n > 2:
            # Add distance from last to first point
            p1 = points[-1]
            p2 = points[0]
            perimeter += math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
        
        return perimeter
    
    def _calculate_bounds(self):
        """Calculate bounding box of all entities"""
        if not self.entities:
            return
        
        min_x = min_y = min_z = float('inf')
        max_x = max_y = max_z = float('-inf')
        
        for entity in self.entities:
            geom = entity.get('geometry', {})
            
            # Handle different geometry types
            if 'start' in geom and 'end' in geom:
                # Line
                min_x = min(min_x, geom['start'][0], geom['end'][0])
                max_x = max(max_x, geom['start'][0], geom['end'][0])
                min_y = min(min_y, geom['start'][1], geom['end'][1])
                max_y = max(max_y, geom['start'][1], geom['end'][1])
                min_z = min(min_z, geom['start'][2], geom['end'][2])
                max_z = max(max_z, geom['start'][2], geom['end'][2])
            
            elif 'center' in geom and 'radius' in geom:
                # Circle/Arc
                radius = geom['radius']
                center = geom['center']
                min_x = min(min_x, center[0] - radius)
                max_x = max(max_x, center[0] + radius)
                min_y = min(min_y, center[1] - radius)
                max_y = max(max_y, center[1] + radius)
                min_z = min(min_z, center[2])
                max_z = max(max_z, center[2])
            
            elif 'points' in geom:
                # Polyline
                for point in geom['points']:
                    min_x = min(min_x, point[0])
                    max_x = max(max_x, point[0])
                    min_y = min(min_y, point[1])
                    max_y = max(max_y, point[1])
                    min_z = min(min_z, point[2])
                    max_z = max(max_z, point[2])
            
            elif 'insert_point' in geom:
                # Text/Block
                point = geom['insert_point']
                min_x = min(min_x, point[0])
                max_x = max(max_x, point[0])
                min_y = min(min_y, point[1])
                max_y = max(max_y, point[1])
                min_z = min(min_z, point[2])
                max_z = max(max_z, point[2])
        
        self.bounds = {
            'min': [min_x if min_x != float('inf') else 0, min_y if min_y != float('inf') else 0, min_z if min_z != float('inf') else 0],
            'max': [max_x if max_x != float('-inf') else 0, max_y if max_y != float('-inf') else 0, max_z if max_z != float('-inf') else 0]
        }
    
    def _generate_statistics(self) -> Dict[str, Any]:
        """Generate comprehensive statistics"""
        # Count entities by type
        entity_types = {}
        for entity in self.entities:
            entity_type = entity['type']
            entity_types[entity_type] = entity_types.get(entity_type, 0) + 1
        
        # Count entities by layer classification
        layer_classifications = {}
        discipline_counts = {}
        system_counts = {}
        confidences = []

        for layer_name, layer_info in self.layers.items():
            classification = layer_info['classification']
            layer_classifications[classification] = layer_classifications.get(classification, 0) + layer_info['entity_count']
            discipline = layer_info.get('discipline')
            if discipline:
                discipline_counts[discipline] = discipline_counts.get(discipline, 0) + 1
            system = layer_info.get('system')
            if system:
                system_counts[system] = system_counts.get(system, 0) + 1
            confidence = layer_info.get('classification_confidence')
            if confidence is not None:
                confidences.append(confidence)
        
        # Calculate total areas and lengths
        total_line_length = 0
        total_area = 0
        
        for entity in self.entities:
            geom = entity.get('geometry', {})
            if 'length' in geom:
                total_line_length += geom['length']
            if 'area' in geom:
                total_area += geom['area']
        
        return {
            'total_entities': len(self.entities),
            'total_layers': len(self.layers),
            'total_blocks': len(self.blocks),
            'entity_types': entity_types,
            'layer_classifications': layer_classifications,
            'layer_disciplines': discipline_counts,
            'layer_systems': system_counts,
            'avg_classification_confidence': float(np.mean(confidences)) if confidences else 0.0,
            'total_line_length': total_line_length,
            'total_area': total_area,
            'bounds': self.bounds
        }
    
    def _get_file_info(self) -> Dict[str, Any]:
        """Get file information"""
        return {
            'dxf_version': self.doc.dxfversion,
            'units': self.doc.header.get('$INSUNITS', 0),
            'units_name': self._get_units_name(self.doc.header.get('$INSUNITS', 0)),
            'created_date': str(self.doc.header.get('$TDCREATE', 'Unknown')),
            'modified_date': str(self.doc.header.get('$TDUPDATE', 'Unknown')),
            'author': str(self.doc.header.get('$AUTHOR', 'Unknown')),
            'title': str(self.doc.header.get('$TITLE', 'Unknown'))
        }
    
    def _get_units_name(self, units_code: int) -> str:
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
