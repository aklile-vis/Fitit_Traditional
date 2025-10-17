import numpy as np
import math
from typing import Dict, List, Tuple, Any, Optional
import logging
from dataclasses import dataclass

try:  # Optional geometry helpers
    from shapely.geometry import LineString, Polygon
    from shapely.ops import polygonize, unary_union
except ImportError:  # pragma: no cover - shapely should be installed via requirements
    LineString = None  # type: ignore
    Polygon = None  # type: ignore
    polygonize = None  # type: ignore
    unary_union = None  # type: ignore

logger = logging.getLogger(__name__)

@dataclass
class ArchitecturalElement:
    """Data class for architectural elements"""
    element_type: str
    layer: str
    geometry: Dict[str, Any]
    properties: Dict[str, Any]
    classification_confidence: float = 0.0

class GeometryExtractor:
    def __init__(self):
        self.elements = []
        self.rules = self._load_default_rules()
        # Units: default assume millimeters unless inferred
        self.scale_to_m = 0.001  # 1 unit = 0.001 m
        self._thresholds_m = {
            'wall_min_len_m': 0.5,
            'floor_min_area_m2': 2.0,
            'space_min_area_m2': 2.0,
            'window_min_width_m': 0.4,
            'window_max_width_m': 4.0,
            'door_min_radius_m': 0.35,
            'door_max_radius_m': 1.5,
        }
    
    def extract_architectural_elements(self, parsed_dxf: Dict[str, Any]) -> Dict[str, Any]:
        """Extract architectural elements from parsed DXF data"""
        try:
            logger.info("Starting architectural element extraction")
            
            self.elements = []
            entities = parsed_dxf.get('entities', [])
            layers = parsed_dxf.get('layers', {})
            # Infer units/thresholds
            self._infer_units_and_thresholds(parsed_dxf)
            
            # Process each entity
            for entity in entities:
                element = self._analyze_entity(entity, layers)
                if element:
                    self.elements.append(element)
            
            # Post-process elements for better classification
            self._post_process_elements()

            # Relationship graph (spaces ↔ walls etc.)
            relationships = self._compute_relationships()
            
            # Generate statistics
            statistics = self._generate_element_statistics()
            
            result = {
                'success': True,
                'elements': [self._element_to_dict(elem) for elem in self.elements],
                'statistics': statistics,
                'relationships': relationships,
                'rules_applied': len(self.rules)
            }
            
            logger.info(f"Extracted {len(self.elements)} architectural elements")
            return result
            
        except Exception as e:
            logger.error(f"Error extracting architectural elements: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'elements': [],
                'statistics': {},
                'rules_applied': 0
            }
    
    def _analyze_entity(self, entity: Dict[str, Any], layers: Dict[str, Any]) -> Optional[ArchitecturalElement]:
        """Analyze entity and determine if it's an architectural element"""
        entity_type = entity.get('type', '')
        layer_name = entity.get('layer', '')
        geometry = entity.get('geometry', {})
        properties = dict(entity.get('properties', {}) or {})
        
        # Calculate geometry properties
        calculated_geometry = self._calculate_geometry_properties(entity_type, geometry)
        
        # Get layer classification
        layer_info = layers.get(layer_name, {}) or {}
        layer_classification = layer_info.get('classification', 'other')
        layer_context = self._build_layer_context(layer_info)
        if layer_info:
            properties['layer_metadata'] = {
                'classification': layer_classification,
                'classification_confidence': layer_info.get('classification_confidence', 0.0),
                'discipline': layer_info.get('discipline'),
                'system': layer_info.get('system'),
                'tags': layer_context['tags_sorted'],
                'tokens': layer_context['tokens_sorted'],
                'source': layer_info.get('classification_source', 'unknown'),
            }
        
        # Apply rules to determine element type
        element_type, confidence = self._apply_classification_rules(
            entity_type,
            layer_name,
            layer_classification,
            calculated_geometry,
            properties,
            layer_context
        )
        
        if element_type and confidence > 0.3:  # Minimum confidence threshold
            return ArchitecturalElement(
                element_type=element_type,
                layer=layer_name,
                geometry=calculated_geometry,
                properties=properties,
                classification_confidence=confidence
            )
        
        return None
    
    def _calculate_geometry_properties(self, entity_type: str, geometry: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate geometry properties for different entity types"""
        calculated = geometry.copy()
        
        if entity_type == 'LINE':
            start = geometry.get('start', [0, 0, 0])
            end = geometry.get('end', [0, 0, 0])
            if len(start) >= 2 and len(end) >= 2:
                length = math.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2)
                calculated['length'] = length
                calculated['points'] = [start, end]
        
        elif entity_type in ['LWPOLYLINE', 'POLYLINE']:
            vertices = geometry.get('vertices', [])
            if vertices and len(vertices) >= 2:
                # Calculate length
                total_length = 0
                for i in range(len(vertices) - 1):
                    p1 = vertices[i]
                    p2 = vertices[i + 1]
                    if len(p1) >= 2 and len(p2) >= 2:
                        segment_length = math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
                        total_length += segment_length
                calculated['length'] = total_length
                calculated['points'] = vertices
                
                # Calculate area if closed
                if geometry.get('closed', False) and len(vertices) >= 3:
                    area = self._calculate_polygon_area(vertices)
                    calculated['area'] = area
                    calculated['bounds'] = self._calculate_bounds(vertices)
        
        elif entity_type == 'CIRCLE':
            center = geometry.get('center', [0, 0, 0])
            radius = geometry.get('radius', 0)
            if len(center) >= 2:
                calculated['area'] = math.pi * radius * radius
                calculated['circumference'] = 2 * math.pi * radius
                calculated['center'] = center
                calculated['radius'] = radius
        
        elif entity_type == 'ARC':
            center = geometry.get('center', [0, 0, 0])
            radius = geometry.get('radius', 0)
            start_angle = geometry.get('start_angle', 0)
            end_angle = geometry.get('end_angle', 0)
            if len(center) >= 2:
                calculated['radius'] = radius
                calculated['center'] = center
                calculated['arc_length'] = radius * abs(end_angle - start_angle)
                calculated['area'] = 0.5 * radius * radius * abs(end_angle - start_angle)
        
        elif entity_type == 'INSERT':
            insert_point = geometry.get('insert_point', [0, 0, 0])
            block_name = geometry.get('block_name', '')
            calculated['insert_point'] = insert_point
            calculated['block_name'] = block_name
            # For blocks, we might need to get dimensions from the block definition
            calculated['length'] = 1000  # Default size for blocks
        
        elif entity_type in ['TEXT', 'MTEXT']:
            insert_point = geometry.get('insert_point', [0, 0, 0])
            text = geometry.get('text', '')
            calculated['insert_point'] = insert_point
            calculated['text'] = text
            calculated['length'] = len(text) * 100  # Rough text width estimation
        
        return calculated
    
    def _calculate_polygon_area(self, vertices: List[List[float]]) -> float:
        """Calculate area of a polygon using the shoelace formula"""
        if len(vertices) < 3:
            return 0
        
        area = 0
        n = len(vertices)
        for i in range(n):
            j = (i + 1) % n
            if len(vertices[i]) >= 2 and len(vertices[j]) >= 2:
                area += vertices[i][0] * vertices[j][1]
                area -= vertices[j][0] * vertices[i][1]
        return abs(area) / 2
    
    def _calculate_bounds(self, vertices: List[List[float]]) -> Dict[str, List[float]]:
        """Calculate bounding box for vertices"""
        if not vertices:
            return {'min': [0, 0], 'max': [0, 0]}
        
        min_x = min_y = float('inf')
        max_x = max_y = float('-inf')
        
        for vertex in vertices:
            if len(vertex) >= 2:
                min_x = min(min_x, vertex[0])
                min_y = min(min_y, vertex[1])
                max_x = max(max_x, vertex[0])
                max_y = max(max_y, vertex[1])
        
        return {
            'min': [min_x, min_y],
            'max': [max_x, max_y]
        }
    
    def _apply_classification_rules(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        properties: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> Tuple[Optional[str], float]:
        """Apply classification rules to determine element type"""
        score = self._confidence_from_context

        if self._is_wall(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'wall', score(layer_context, 0.85)

        if self._is_door(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'door', score(layer_context, 0.8)

        if self._is_window(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'window', score(layer_context, 0.78)

        if self._is_floor(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'floor', score(layer_context, 0.75)

        if self._is_ceiling(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'ceiling', score(layer_context, 0.7)

        if self._is_space(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'space', score(layer_context, 0.68)

        if self._is_column(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'column', score(layer_context, 0.8)

        if self._is_beam(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'beam', score(layer_context, 0.78)

        if self._is_stair(entity_type, layer_name, layer_classification, geometry, layer_context):
            return 'stair', score(layer_context, 0.65)

        mep_type = self._is_mep_component(entity_type, layer_name, geometry, layer_context)
        if mep_type:
            return mep_type, score(layer_context, 0.7)

        if self._is_furniture(entity_type, layer_name, geometry, layer_context):
            return 'furniture', score(layer_context, 0.65)

        if self._is_fixture(entity_type, layer_name, geometry, layer_context):
            return 'fixture', score(layer_context, 0.62)

        return None, 0.0
    
    def _build_layer_context(self, layer_info: Dict[str, Any]) -> Dict[str, Any]:
        classification = layer_info.get('classification', 'other') or 'other'
        tags = {str(tag).upper() for tag in layer_info.get('tags', []) if tag}
        tokens = {str(tok).upper() for tok in layer_info.get('tokens', []) if tok}
        if classification:
            tags.add(classification.upper())
        discipline = layer_info.get('discipline')
        discipline = discipline.lower() if isinstance(discipline, str) and discipline else None
        system = layer_info.get('system')
        return {
            'classification': classification,
            'discipline': discipline,
            'system': system,
            'tags': tags,
            'tokens': tokens,
            'layer_confidence': float(layer_info.get('classification_confidence') or 0.0),
            'has_semantic_hit': bool(tags or tokens or system or discipline),
            'tags_sorted': sorted(tags),
            'tokens_sorted': sorted(tokens),
        }

    def _confidence_from_context(self, layer_context: Dict[str, Any], base_score: float) -> float:
        confidence = base_score
        layer_conf = layer_context.get('layer_confidence', 0.0)
        if layer_conf:
            confidence += min(0.35, layer_conf * 0.4)
        if layer_context.get('has_semantic_hit'):
            confidence += 0.05
        return max(0.3, min(1.0, confidence))

    def _is_wall(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a wall"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification in {'wall', 'structure_wall'}:
            return True
        if 'WALL' in tags or 'WALL' in tokens:
            return True
        if layer_context.get('discipline') == 'architectural' and 'WALL' in layer_name.upper():
            return True
        
        # Geometry-based detection for lines
        if entity_type == 'LINE':
            length = geometry.get('length', 0)
            length_m = length * self.scale_to_m
            if length_m > self._thresholds_m['wall_min_len_m']:
                return True
        
        # Geometry-based detection for polylines
        if entity_type in ['LWPOLYLINE', 'POLYLINE']:
            if geometry.get('closed', False):
                area = geometry.get('area', 0)
                if area > 1000:  # Minimum wall area
                    return True
        
        return False
    
    def _is_door(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a door"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification == 'door' or 'DOOR' in tags or 'DOOR' in tokens:
            return True
        
        # Block-based detection
        if entity_type == 'INSERT':
            block_name = (geometry.get('name') or geometry.get('block_name') or '').upper()
            if any(pattern in block_name for pattern in ['DOOR', 'DR']):
                return True
        
        # Geometry-based detection (arc representing door swing)
        if entity_type == 'ARC':
            radius = geometry.get('radius', 0)
            radius_m = radius * self.scale_to_m
            if 0.4 <= radius_m <= 1.3:  # Typical door swing radius in meters
                return True
        
        return False
    
    def _is_window(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a window"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification == 'window' or 'WINDOW' in tags or 'WINDOW' in tokens:
            return True
        
        # Block-based detection
        if entity_type == 'INSERT':
            block_name = (geometry.get('name') or geometry.get('block_name') or '').upper()
            if any(pattern in block_name for pattern in ['WINDOW', 'WIN']):
                return True
        
        # Geometry-based detection
        if entity_type == 'LINE':
            length = geometry.get('length', 0)
            width_m = length * self.scale_to_m
            if self._thresholds_m['window_min_width_m'] <= width_m <= self._thresholds_m['window_max_width_m']:
                return True
        
        return False
    
    def _is_floor(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a floor/slab"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification == 'floor' or 'FLOOR' in tags or 'SLAB' in tags:
            return True
        if 'FLOOR' in tokens or 'SLAB' in tokens:
            return True
        
        # Geometry-based detection for closed polylines
        if entity_type in ['LWPOLYLINE', 'POLYLINE', 'HATCH', 'SPLINE']:
            if geometry.get('closed', False):
                area = geometry.get('area', 0)
                area_m2 = (area or 0) * (self.scale_to_m ** 2)
                if area_m2 > self._thresholds_m['floor_min_area_m2']:
                    return True
        
        return False
    
    def _is_ceiling(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a ceiling"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification == 'ceiling' or 'CEILING' in tags or 'CEIL' in tokens:
            return True
        
        return False
    
    def _is_space(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a space/room"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification == 'space' or 'ROOM' in tags or 'SPACE' in tags:
            return True
        
        # Text-based detection for room labels
        if entity_type in ['TEXT', 'MTEXT']:
            text = geometry.get('text', '').upper()
            if any(pattern in text for pattern in ['ROOM', 'SPACE', 'AREA', 'OFFICE', 'BEDROOM', 'KITCHEN']):
                return True
        
        # Geometry-based detection for closed polylines
        if entity_type in ['LWPOLYLINE', 'POLYLINE', 'HATCH', 'SPLINE']:
            if geometry.get('closed', False):
                area = geometry.get('area', 0)
                area_m2 = area * (self.scale_to_m ** 2)
                if area_m2 > self._thresholds_m['space_min_area_m2']:
                    return True
        
        return False

    def _infer_units_and_thresholds(self, parsed_dxf: Dict[str, Any]):
        """Infer drawing units via DXF header and bounds; set thresholds in meters."""
        self.scale_to_m = 0.001
        info = parsed_dxf.get('file_info', {})
        units_name = str(info.get('units_name', '')).lower()
        units_code = int(info.get('units', 0) or 0)

        code_map = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0, 7: 1000.0}
        name_map = {
            'inches': 0.0254,
            'feet': 0.3048,
            'millimeters': 0.001,
            'centimeters': 0.01,
            'meters': 1.0,
            'kilometers': 1000.0,
        }
        if units_name in name_map:
            self.scale_to_m = name_map[units_name]
        elif units_code in code_map:
            self.scale_to_m = code_map[units_code]
        else:
            # Heuristic by bounds
            bounds = parsed_dxf.get('bounds', {})
            mn = bounds.get('min', [0, 0])
            mx = bounds.get('max', [10, 10])
            width = abs(mx[0] - mn[0])
            height = abs(mx[1] - mn[1])
            max_dim = max(width, height)
            if 1000 < max_dim < 100000:
                self.scale_to_m = 0.001
            elif 50 < max_dim < 1000:
                self.scale_to_m = 0.01
            elif 0.5 < max_dim < 200:
                self.scale_to_m = 1.0
            else:
                self.scale_to_m = 0.001
        logger.info(f"[Extractor] 1 unit = {self.scale_to_m} m")
    
    def _is_column(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a column"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification in {'structure_column', 'column'} or 'COLUMN' in tags:
            return True
        if layer_context.get('discipline') == 'structural' and any(pattern in layer_name.upper() for pattern in ['COLUMN', 'COL', 'PILAR', 'PIER']):
            return True
        if 'COLUMN' in tokens or 'COL' in tokens:
            return True
        
        # Block-based detection
        if entity_type == 'INSERT':
            block_name = (geometry.get('name') or geometry.get('block_name') or '').upper()
            if any(pattern in block_name for pattern in ['COLUMN', 'COL', 'PILAR']):
                return True
        
        # Geometry-based detection for circles (circular columns)
        if entity_type == 'CIRCLE':
            radius = geometry.get('radius', 0)
            radius_m = radius * self.scale_to_m
            if 0.08 <= radius_m <= 0.5:  # Typical column radius
                return True
        
        return False
    
    def _is_beam(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a beam"""
        # Layer-based detection
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        if layer_classification in {'structure_beam', 'beam'} or 'BEAM' in tags or 'GIRDER' in tags:
            return True
        if layer_context.get('discipline') == 'structural' and any(pattern in layer_name.upper() for pattern in ['BEAM', 'GIRDER']):
            return True
        if 'BEAM' in tokens or 'GIRDER' in tokens:
            return True
        
        # Block-based detection
        if entity_type == 'INSERT':
            block_name = (geometry.get('name') or geometry.get('block_name') or '').upper()
            if any(pattern in block_name for pattern in ['BEAM', 'GIRDER']):
                return True
        
        return False
    
    def _is_stair(
        self,
        entity_type: str,
        layer_name: str,
        layer_classification: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        """Check if entity is a stair"""
        # Layer-based detection
        if any(pattern in layer_name.upper() for pattern in ['STAIR', 'STAIRS', 'STEPS']):
            return True
        
        # Block-based detection
        if entity_type == 'INSERT':
            block_name = geometry.get('name', '').upper()
            if any(pattern in block_name for pattern in ['STAIR', 'STAIRS', 'STEPS']):
                return True
        
        return False

    def _is_mep_component(
        self,
        entity_type: str,
        layer_name: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> Optional[str]:
        classification = layer_context.get('classification') or 'other'
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        discipline = layer_context.get('discipline')

        if classification in {'mep_plumbing', 'mep_hvac', 'mep_electrical', 'mep_fire_protection'}:
            return classification

        if discipline == 'plumbing' or {'PLUMBING', 'SANITARY', 'DRAIN', 'WASTE'} & tokens:
            return 'mep_plumbing'
        if discipline == 'mechanical' or {'HVAC', 'DUCT', 'VENT', 'AIR'} & tokens:
            return 'mep_hvac'
        if discipline == 'electrical' or {'ELECT', 'POWER', 'LIGHT', 'LIGHTING', 'DATA'} & tokens:
            return 'mep_electrical'
        if discipline == 'fire_protection' or {'FIRE', 'SPRINKLER', 'ALARM'} & tokens:
            return 'mep_fire_protection'

        if 'MOTOR' in tags or 'EQUIPMENT' in tags:
            return 'mep_equipment'

        return None

    def _is_furniture(
        self,
        entity_type: str,
        layer_name: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        classification = layer_context.get('classification') or 'other'
        tokens = layer_context['tokens']
        tags = layer_context['tags']
        discipline = layer_context.get('discipline')

        if classification in {'furniture', 'interior_furniture'}:
            return True
        if discipline in {'interior'} and any(token in tokens for token in ['FURN', 'SOFA', 'BED', 'TABLE', 'CHAIR']):
            return True
        if {'FURNITURE', 'MILLWORK', 'CASEWORK'} & tags:
            return True
        if entity_type == 'INSERT':
            block_name = (geometry.get('name') or geometry.get('block_name') or '').upper()
            if any(token in block_name for token in ['SOFA', 'BED', 'CHAIR', 'TABLE', 'WARDROBE', 'CABINET']):
                return True
        return False

    def _is_fixture(
        self,
        entity_type: str,
        layer_name: str,
        geometry: Dict[str, Any],
        layer_context: Dict[str, Any],
    ) -> bool:
        classification = layer_context.get('classification') or 'other'
        tokens = layer_context['tokens']
        tags = layer_context['tags']

        if classification in {'equipment', 'fixture', 'appliance'}:
            return True
        keywords = {'SINK', 'WC', 'TOILET', 'BATH', 'SHOWER', 'OVEN', 'COOK', 'HOB', 'APPLIANCE', 'FRIDGE', 'LIGHT'}
        if keywords & tokens:
            return True
        if entity_type == 'INSERT':
            name = (geometry.get('name') or geometry.get('block_name') or '').upper()
            if any(word in name for word in keywords):
                return True
        if keywords & tags:
            return True
        return False
    
    def _post_process_elements(self):
        """Post-process elements for better classification and relationships"""
        # Group related elements
        self._group_related_elements()
        
        # Calculate additional properties
        for element in self.elements:
            self._calculate_element_properties(element)

        generated = self._ensure_spaces_from_walls()
        for element in generated:
            self._calculate_element_properties(element)

    def _compute_relationships(self) -> Dict[str, Any]:
        if LineString is None or Polygon is None:
            logger.debug('Shapely not available; skipping relationship computation')
            return {}

        wall_records: List[Tuple[int, ArchitecturalElement, LineString]] = []
        space_records: List[Tuple[int, ArchitecturalElement, Polygon]] = []

        for idx, element in enumerate(self.elements):
            elem_type = (element.element_type or '').lower()
            if elem_type in ('wall', 'partition'):
                line = self._line_from_geometry(element.geometry)
                if line is not None and line.length > 0:
                    wall_records.append((idx, element, line))
            elif elem_type in ('space', 'room', 'floor'):
                poly = self._polygon_from_geometry(element.geometry)
                if poly is not None and poly.area > 0:
                    space_records.append((idx, element, poly))

        if not space_records:
            return {'spaces': [], 'summary': {'spaces': 0, 'walls': len(wall_records)}}

        tolerance_units = self._relationship_tolerance()

        spaces_payload: List[Dict[str, Any]] = []
        for s_idx, element, polygon in space_records:
            properties = element.properties or {}
            area_units = properties.get('area')
            area_m2 = None
            if isinstance(area_units, (int, float, np.floating)):
                try:
                    area_m2 = float(area_units) * float(self.scale_to_m or 1.0) ** 2
                except Exception:
                    area_m2 = None

            info: Dict[str, Any] = {
                'element_index': s_idx,
                'type': element.element_type,
                'name': properties.get('name'),
                'layer': element.layer,
                'generated': bool(properties.get('generated') or element.layer == '__generated_space__'),
                'area': area_m2,
                'area_raw': area_units,
                'adjacent_walls': [],
                'adjacent_spaces': [],
            }

            buffered = polygon.buffer(tolerance_units)
            for w_idx, wall_element, line in wall_records:
                try:
                    if buffered.intersects(line):
                        length_units = wall_element.properties.get('length') if wall_element.properties else None
                        length_m = None
                        if isinstance(length_units, (int, float, np.floating)):
                            try:
                                length_m = float(length_units) * float(self.scale_to_m or 1.0)
                            except Exception:
                                length_m = None
                        info['adjacent_walls'].append({
                            'element_index': w_idx,
                            'layer': wall_element.layer,
                            'length': length_m,
                            'length_raw': length_units,
                        })
                except Exception as exc:  # pragma: no cover - shapely robustness
                    logger.debug('Wall adjacency check failed: %s', exc)

            spaces_payload.append(info)

        # Space-to-space adjacency
        for i, (idx_i, elem_i, poly_i) in enumerate(space_records):
            buffered_i = poly_i.buffer(tolerance_units)
            for j in range(i + 1, len(space_records)):
                idx_j, elem_j, poly_j = space_records[j]
                try:
                    if buffered_i.intersects(poly_j.buffer(tolerance_units)):
                        spaces_payload[i]['adjacent_spaces'].append(idx_j)
                        # Ensure reciprocal entry
                        target = next((record for record in spaces_payload if record['element_index'] == idx_j), None)
                        if target is not None:
                            target.setdefault('adjacent_spaces', []).append(idx_i)
                except Exception as exc:  # pragma: no cover
                    logger.debug('Space adjacency check failed: %s', exc)

        return {
            'spaces': spaces_payload,
            'summary': {
                'spaces': len(space_records),
                'walls': len(wall_records),
                'generatedSpaces': sum(1 for space in spaces_payload if space.get('generated')),
                'averageArea': float(np.mean([space.get('area') for space in spaces_payload if isinstance(space.get('area'), (int, float, np.floating))])) if spaces_payload else 0.0,
            },
            'scaleToM': self.scale_to_m,
        }

    def _ensure_spaces_from_walls(self) -> List[ArchitecturalElement]:
        """Generate pseudo space elements when none exist using wall loops."""
        if Polygon is None or LineString is None or polygonize is None or unary_union is None:
            return []

        has_space = any(elem.element_type in ('space', 'room', 'floor') for elem in self.elements)
        if has_space:
            return []

        wall_lines: List[LineString] = []
        for element in self.elements:
            if element.element_type != 'wall':
                continue
            line = self._line_from_geometry(element.geometry)
            if line is not None and line.length > 0:
                wall_lines.append(line)

        if len(wall_lines) < 3:
            return []

        try:
            merged = unary_union(wall_lines)
            polygons = list(polygonize(merged))
        except Exception as exc:  # pragma: no cover - shapely robustness
            logger.debug('Polygonize from walls failed: %s', exc)
            return []

        min_area_units = self._thresholds_m['space_min_area_m2'] / (self.scale_to_m ** 2) if self.scale_to_m else 4.0
        generated_elements: List[ArchitecturalElement] = []
        for idx, polygon in enumerate(polygons, start=1):
            if polygon.is_empty or not polygon.is_valid:
                continue
            area = polygon.area
            if area < min_area_units:
                continue

            coords = list(polygon.exterior.coords)
            geometry = {
                'type': 'POLYGON',
                'points': [[float(x), float(y), 0.0] for x, y in coords],
                'closed': True,
                'area': area,
                'bounds': {
                    'min': [float(polygon.bounds[0]), float(polygon.bounds[1])],
                    'max': [float(polygon.bounds[2]), float(polygon.bounds[3])]
                }
            }
            properties: Dict[str, Any] = {
                'name': f'Generated Space {idx}',
                'generated': True,
            }
            element = ArchitecturalElement(
                element_type='space',
                layer='__generated_space__',
                geometry=geometry,
                properties=properties,
                classification_confidence=0.45,
            )
            self.elements.append(element)
            generated_elements.append(element)

        if generated_elements:
            logger.info('Generated %s fallback spaces from wall geometry', len(generated_elements))
        return generated_elements

    def _relationship_tolerance(self) -> float:
        scale = self.scale_to_m or 1.0
        base_m = 0.1  # 10cm in meters
        try:
            return max(base_m / scale, 0.01 / scale)
        except ZeroDivisionError:  # pragma: no cover
            return 100.0

    def _polygon_from_geometry(self, geometry: Dict[str, Any]) -> Optional[Polygon]:
        points = geometry.get('points') or geometry.get('vertices')
        if not points or len(points) < 3 or Polygon is None:
            return None
        coords = [(float(p[0]), float(p[1])) for p in points if len(p) >= 2]
        if len(coords) < 3:
            return None
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        try:
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty or not poly.is_valid:
                return None
            return poly
        except Exception as exc:  # pragma: no cover
            logger.debug('Failed to build polygon from geometry: %s', exc)
            return None

    def _line_from_geometry(self, geometry: Dict[str, Any]) -> Optional[LineString]:
        points = geometry.get('points')
        if not points or LineString is None:
            return None
        coords = [(float(p[0]), float(p[1])) for p in points if len(p) >= 2]
        if len(coords) < 2:
            return None
        try:
            line = LineString(coords)
            if line.is_empty or line.length == 0:
                return None
            return line
        except Exception as exc:  # pragma: no cover
            logger.debug('Failed to build linestring: %s', exc)
            return None

    def _group_related_elements(self):
        """Group related architectural elements"""
        # This could be expanded to identify room boundaries, wall connections, etc.
        pass
    
    def _calculate_element_properties(self, element: ArchitecturalElement):
        """Calculate additional properties for architectural elements"""
        geometry = element.geometry
        properties = element.properties
        
        # Calculate dimensions
        if element.element_type == 'wall':
            if 'length' in geometry:
                properties['length'] = geometry['length']
            if 'area' in geometry:
                properties['area'] = geometry['area']
        
        elif element.element_type == 'door':
            if 'radius' in geometry:
                properties['width'] = geometry['radius'] * 2
            elif 'length' in geometry:
                properties['width'] = geometry['length']
            else:
                properties['width'] = 900  # Default door width
        
        elif element.element_type == 'window':
            if 'length' in geometry:
                properties['width'] = geometry['length']
            else:
                properties['width'] = 1200  # Default window width
        
        elif element.element_type in ['floor', 'space']:
            if 'area' in geometry:
                properties['area'] = geometry['area']
        
        # Add standard properties
        properties['element_type'] = element.element_type
        properties['layer'] = element.layer
        properties['confidence'] = element.classification_confidence
    
    def _generate_element_statistics(self) -> Dict[str, Any]:
        """Generate statistics about extracted elements"""
        element_counts = {}
        total_area = 0
        total_length = 0
        discipline_counts: Dict[str, int] = {}
        system_counts: Dict[str, int] = {}
        confidence_bands = {'high': 0, 'medium': 0, 'low': 0}
        
        for element in self.elements:
            element_type = element.element_type
            element_counts[element_type] = element_counts.get(element_type, 0) + 1
            
            # Calculate totals
            if 'area' in element.properties:
                total_area += element.properties['area']
            if 'length' in element.properties:
                total_length += element.properties['length']

            metadata = element.properties.get('layer_metadata') or {}
            discipline = metadata.get('discipline')
            if discipline:
                discipline_counts[discipline] = discipline_counts.get(discipline, 0) + 1
            system = metadata.get('system')
            if system:
                system_counts[system] = system_counts.get(system, 0) + 1

            confidence = element.classification_confidence
            if confidence >= 0.75:
                confidence_bands['high'] += 1
            elif confidence >= 0.5:
                confidence_bands['medium'] += 1
            else:
                confidence_bands['low'] += 1
        
        return {
            'total_elements': len(self.elements),
            'element_counts': element_counts,
            'total_area': total_area,
            'total_length': total_length,
            'average_confidence': np.mean([elem.classification_confidence for elem in self.elements]) if self.elements else 0,
            'discipline_counts': discipline_counts,
            'system_counts': system_counts,
            'confidence_bands': confidence_bands,
        }
    
    def _element_to_dict(self, element: ArchitecturalElement) -> Dict[str, Any]:
        """Convert ArchitecturalElement to dictionary"""
        return {
            'type': element.element_type,
            'layer': element.layer,
            'geometry': element.geometry,
            'properties': element.properties,
            'confidence': element.classification_confidence
        }
    
    def _load_default_rules(self) -> List[Dict[str, Any]]:
        """Load default classification rules"""
        return [
            {
                'name': 'wall_rule',
                'patterns': ['WALL', 'MUR', 'WALLS'],
                'entity_types': ['LINE', 'LWPOLYLINE', 'POLYLINE'],
                'min_length': 100
            },
            {
                'name': 'door_rule',
                'patterns': ['DOOR', 'DOORS', 'DR'],
                'entity_types': ['INSERT', 'ARC'],
                'min_width': 400,
                'max_width': 1200
            },
            {
                'name': 'window_rule',
                'patterns': ['WINDOW', 'WINDOWS', 'WIN'],
                'entity_types': ['INSERT', 'LINE'],
                'min_width': 600,
                'max_width': 3000
            }
        ]
