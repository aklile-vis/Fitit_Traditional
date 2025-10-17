"""
USD Generator for IFC to USD conversion
Creates USD files with realistic materials and textures
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class USDGenerator:
    """Generates USD files from IFC data with realistic materials"""
    
    def __init__(self):
        self.material_library = self._create_material_library()
        self.texture_paths = self._setup_texture_paths()
    
    def _create_material_library(self) -> Dict[str, Dict[str, Any]]:
        """Create a library of realistic PBR materials"""
        return {
            'concrete': {
                'name': 'Concrete',
                'diffuse_color': [0.7, 0.7, 0.7],
                'roughness': 0.8,
                'metallic': 0.0,
                'specular': 0.5,
                'diffuse_texture': 'concrete_diffuse.jpg',
                'normal_texture': 'concrete_normal.jpg',
                'roughness_texture': 'concrete_roughness.jpg'
            },
            'brick': {
                'name': 'Brick',
                'diffuse_color': [0.8, 0.4, 0.3],
                'roughness': 0.9,
                'metallic': 0.0,
                'specular': 0.3,
                'diffuse_texture': 'brick_diffuse.jpg',
                'normal_texture': 'brick_normal.jpg',
                'roughness_texture': 'brick_roughness.jpg'
            },
            'steel': {
                'name': 'Steel',
                'diffuse_color': [0.6, 0.6, 0.6],
                'roughness': 0.2,
                'metallic': 1.0,
                'specular': 0.8,
                'diffuse_texture': 'steel_diffuse.jpg',
                'normal_texture': 'steel_normal.jpg',
                'roughness_texture': 'steel_roughness.jpg'
            },
            'glass': {
                'name': 'Glass',
                'diffuse_color': [0.9, 0.9, 1.0],
                'roughness': 0.0,
                'metallic': 0.0,
                'specular': 1.0,
                'transmission': 0.9,
                'ior': 1.5,
                'diffuse_texture': 'glass_diffuse.jpg'
            },
            'wood': {
                'name': 'Wood',
                'diffuse_color': [0.6, 0.4, 0.2],
                'roughness': 0.7,
                'metallic': 0.0,
                'specular': 0.4,
                'diffuse_texture': 'wood_diffuse.jpg',
                'normal_texture': 'wood_normal.jpg',
                'roughness_texture': 'wood_roughness.jpg'
            },
            'tile': {
                'name': 'Tile',
                'diffuse_color': [0.9, 0.9, 0.9],
                'roughness': 0.1,
                'metallic': 0.0,
                'specular': 0.9,
                'diffuse_texture': 'tile_diffuse.jpg',
                'normal_texture': 'tile_normal.jpg',
                'roughness_texture': 'tile_roughness.jpg'
            },
            'carpet': {
                'name': 'Carpet',
                'diffuse_color': [0.5, 0.3, 0.2],
                'roughness': 0.9,
                'metallic': 0.0,
                'specular': 0.1,
                'diffuse_texture': 'carpet_diffuse.jpg',
                'normal_texture': 'carpet_normal.jpg',
                'roughness_texture': 'carpet_roughness.jpg'
            }
        }
    
    def _setup_texture_paths(self) -> Dict[str, str]:
        """Setup texture file paths"""
        return {
            'concrete_diffuse.jpg': '/textures/materials/concrete_diffuse.jpg',
            'concrete_normal.jpg': '/textures/materials/concrete_normal.jpg',
            'concrete_roughness.jpg': '/textures/materials/concrete_roughness.jpg',
            'brick_diffuse.jpg': '/textures/materials/brick_diffuse.jpg',
            'brick_normal.jpg': '/textures/materials/brick_normal.jpg',
            'brick_roughness.jpg': '/textures/materials/brick_roughness.jpg',
            'steel_diffuse.jpg': '/textures/materials/steel_diffuse.jpg',
            'steel_normal.jpg': '/textures/materials/steel_normal.jpg',
            'steel_roughness.jpg': '/textures/materials/steel_roughness.jpg',
            'glass_diffuse.jpg': '/textures/materials/glass_diffuse.jpg',
            'wood_diffuse.jpg': '/textures/materials/wood_diffuse.jpg',
            'wood_normal.jpg': '/textures/materials/wood_normal.jpg',
            'wood_roughness.jpg': '/textures/materials/wood_roughness.jpg',
            'tile_diffuse.jpg': '/textures/materials/tile_diffuse.jpg',
            'tile_normal.jpg': '/textures/materials/tile_normal.jpg',
            'tile_roughness.jpg': '/textures/materials/tile_roughness.jpg',
            'carpet_diffuse.jpg': '/textures/materials/carpet_diffuse.jpg',
            'carpet_normal.jpg': '/textures/materials/carpet_normal.jpg',
            'carpet_roughness.jpg': '/textures/materials/carpet_roughness.jpg'
        }
    
    def _get_material_for_element(self, element_type: str, layer_name: str) -> str:
        """Determine the best material for an element based on type and layer"""
        element_type = element_type.lower()
        layer_name = layer_name.lower()
        
        # Material mapping based on element type and layer
        if 'wall' in element_type or 'wall' in layer_name:
            if 'brick' in layer_name:
                return 'brick'
            elif 'steel' in layer_name or 'metal' in layer_name:
                return 'steel'
            else:
                return 'concrete'
        elif 'door' in element_type or 'door' in layer_name:
            if 'steel' in layer_name or 'metal' in layer_name:
                return 'steel'
            else:
                return 'wood'
        elif 'window' in element_type or 'window' in layer_name or 'glass' in layer_name:
            return 'glass'
        elif 'floor' in element_type or 'floor' in layer_name:
            if 'tile' in layer_name:
                return 'tile'
            elif 'carpet' in layer_name:
                return 'carpet'
            else:
                return 'concrete'
        elif 'ceiling' in element_type or 'ceiling' in layer_name:
            return 'concrete'
        else:
            return 'concrete'  # Default material
    
    def generate_usd_from_ifc(self, ifc_file_path: str, output_path: str, 
                            elements: List[Dict[str, Any]], 
                            project_name: str = "DXF_Project") -> Dict[str, Any]:
        """Generate USD file from IFC data and elements"""
        try:
            logger.info(f"Starting USD generation from IFC: {ifc_file_path}")
            
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Generate USD content
            usd_content = self._generate_usd_content(elements, project_name)
            
            # Write USD file
            with open(output_path, 'w') as f:
                f.write(usd_content)
            
            logger.info(f"USD file generated successfully: {output_path}")
            
            return {
                'success': True,
                'usd_path': output_path,
                'elements_count': len(elements),
                'materials_used': self._get_used_materials(elements),
                'file_size': os.path.getsize(output_path)
            }
            
        except Exception as e:
            logger.error(f"Error generating USD file: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'usd_path': None
            }
    
    def _generate_usd_content(self, elements: List[Dict[str, Any]], project_name: str) -> str:
        """Generate USD file content"""
        usd_lines = [
            '#usda 1.0',
            f'# Generated by DXF-IFC-USD Pipeline - {datetime.now().isoformat()}',
            '',
            'def Xform "Root"',
            '{',
            f'    string name = "{project_name}"',
            '    def Scope "Materials"',
            '    {',
            ''
        ]
        
        # Add material definitions
        used_materials = set()
        for element in elements:
            material_type = self._get_material_for_element(
                element.get('type', ''), 
                element.get('layer', '')
            )
            used_materials.add(material_type)
        
        for material_type in used_materials:
            usd_lines.extend(self._generate_material_definition(material_type))
        
        usd_lines.extend([
            '    }',
            '',
            '    def Scope "Geometry"',
            '    {',
            ''
        ])
        
        # Add geometry definitions
        for i, element in enumerate(elements):
            usd_lines.extend(self._generate_element_geometry(element, i))
        
        usd_lines.extend([
            '    }',
            '}'
        ])
        
        return '\n'.join(usd_lines)
    
    def _generate_material_definition(self, material_type: str) -> List[str]:
        """Generate USD material definition"""
        material = self.material_library[material_type]
        material_name = material['name'].replace(' ', '_')
        
        lines = [
            f'        def Material "{material_name}"',
            '        {',
            '            def Shader "PBRShader"',
            '            {',
            '                uniform token info:id = "UsdPreviewSurface"',
            f'                color3f diffuseColor = ({material["diffuse_color"][0]}, {material["diffuse_color"][1]}, {material["diffuse_color"][2]})',
            f'                float roughness = {material["roughness"]}',
            f'                float metallic = {material["metallic"]}',
            f'                float specular = {material["specular"]}',
        ]
        
        # Add texture references if available
        if 'diffuse_texture' in material:
            lines.append(f'                asset diffuseTexture = @{self.texture_paths[material["diffuse_texture"]]}@')
        if 'normal_texture' in material:
            lines.append(f'                asset normalTexture = @{self.texture_paths[material["normal_texture"]]}@')
        if 'roughness_texture' in material:
            lines.append(f'                asset roughnessTexture = @{self.texture_paths[material["roughness_texture"]]}@')
        
        # Add special properties for glass
        if material_type == 'glass':
            lines.extend([
                f'                float transmission = {material["transmission"]}',
                f'                float ior = {material["ior"]}'
            ])
        
        lines.extend([
            '            }',
            '            token outputs:surface.connect = </Root/Materials/' + material_name + '/PBRShader.outputs:surface>',
            '        }',
            ''
        ])
        
        return lines
    
    def _generate_element_geometry(self, element: Dict[str, Any], index: int) -> List[str]:
        """Generate USD geometry for an element"""
        element_type = element.get('type', 'unknown')
        layer = element.get('layer', 'default')
        geometry = element.get('geometry', {})
        
        # Determine material
        material_type = self._get_material_for_element(element_type, layer)
        material_name = self.material_library[material_type]['name'].replace(' ', '_')
        
        # Generate element name
        element_name = f"{element_type}_{index}"
        
        lines = [
            f'        def Xform "{element_name}"',
            '        {',
            f'            string element_type = "{element_type}"',
            f'            string layer = "{layer}"',
            ''
        ]
        
        # Add geometry based on element type
        if element_type == 'wall':
            lines.extend(self._generate_wall_geometry(geometry, element_name, material_name))
        elif element_type in ['floor', 'space', 'room']:
            lines.extend(self._generate_floor_geometry(geometry, element_name, material_name))
        elif element_type == 'ceiling':
            lines.extend(self._generate_ceiling_geometry(geometry, element_name, material_name))
        elif element_type == 'door':
            lines.extend(self._generate_door_geometry(geometry, element_name, material_name))
        elif element_type == 'window':
            lines.extend(self._generate_window_geometry(geometry, element_name, material_name))
        else:
            lines.extend(self._generate_generic_geometry(geometry, element_name, material_name))
        
        lines.extend([
            '        }',
            ''
        ])
        
        return lines
    
    def _generate_wall_geometry(self, geometry: Dict[str, Any], element_name: str, material_name: str) -> List[str]:
        """Generate wall geometry"""
        return [
            '            def Mesh "WallMesh"',
            '            {',
            '                int[] faceVertexCounts = [4]',
            '                int[] faceVertexIndices = [0, 1, 2, 3]',
            '                point3f[] points = [(-1, 0, -1), (1, 0, -1), (1, 0, 1), (-1, 0, 1)]',
            '                float3[] extent = [(-1, 0, -1), (1, 0, 1)]',
            '                rel material:binding = </Root/Materials/' + material_name + '>',
            '            }'
        ]

    def _generate_floor_geometry(self, geometry: Dict[str, Any], element_name: str, material_name: str) -> List[str]:
        """Generate floor geometry as a thin box/plane from bounds if available"""
        return [
            '            def Mesh "FloorMesh"',
            '            {',
            '                int[] faceVertexCounts = [4]',
            '                int[] faceVertexIndices = [0, 1, 2, 3]',
            '                point3f[] points = [(-1, 0, -1), (1, 0, -1), (1, 0, 1), (-1, 0, 1)]',
            '                float3[] extent = [(-1, 0, -1), (1, 0, 1)]',
            '                rel material:binding = </Root/Materials/' + material_name + '>',
            '            }'
        ]

    def _generate_ceiling_geometry(self, geometry: Dict[str, Any], element_name: str, material_name: str) -> List[str]:
        """Generate ceiling geometry similar to floor"""
        return [
            '            def Mesh "CeilingMesh"',
            '            {',
            '                int[] faceVertexCounts = [4]',
            '                int[] faceVertexIndices = [0, 1, 2, 3]',
            '                point3f[] points = [(-1, 0, -1), (1, 0, -1), (1, 0, 1), (-1, 0, 1)]',
            '                float3[] extent = [(-1, 0, -1), (1, 0, 1)]',
            '                rel material:binding = </Root/Materials/' + material_name + '>',
            '            }'
        ]
    
    def _generate_door_geometry(self, geometry: Dict[str, Any], element_name: str, material_name: str) -> List[str]:
        """Generate door geometry"""
        return [
            '            def Mesh "DoorMesh"',
            '            {',
            '                int[] faceVertexCounts = [4]',
            '                int[] faceVertexIndices = [0, 1, 2, 3]',
            '                point3f[] points = [(-0.5, 0, -0.1), (0.5, 0, -0.1), (0.5, 0, 0.1), (-0.5, 0, 0.1)]',
            '                float3[] extent = [(-0.5, 0, -0.1), (0.5, 0, 0.1)]',
            '                rel material:binding = </Root/Materials/' + material_name + '>',
            '            }'
        ]
    
    def _generate_window_geometry(self, geometry: Dict[str, Any], element_name: str, material_name: str) -> List[str]:
        """Generate window geometry"""
        return [
            '            def Mesh "WindowMesh"',
            '            {',
            '                int[] faceVertexCounts = [4]',
            '                int[] faceVertexIndices = [0, 1, 2, 3]',
            '                point3f[] points = [(-0.8, 0, -0.05), (0.8, 0, -0.05), (0.8, 0, 0.05), (-0.8, 0, 0.05)]',
            '                float3[] extent = [(-0.8, 0, -0.05), (0.8, 0, 0.05)]',
            '                rel material:binding = </Root/Materials/' + material_name + '>',
            '            }'
        ]
    
    def _generate_generic_geometry(self, geometry: Dict[str, Any], element_name: str, material_name: str) -> List[str]:
        """Generate generic geometry"""
        return [
            '            def Mesh "GenericMesh"',
            '            {',
            '                int[] faceVertexCounts = [4]',
            '                int[] faceVertexIndices = [0, 1, 2, 3]',
            '                point3f[] points = [(-0.5, 0, -0.5), (0.5, 0, -0.5), (0.5, 0, 0.5), (-0.5, 0, 0.5)]',
            '                float3[] extent = [(-0.5, 0, -0.5), (0.5, 0, 0.5)]',
            '                rel material:binding = </Root/Materials/' + material_name + '>',
            '            }'
        ]
    
    def _get_used_materials(self, elements: List[Dict[str, Any]]) -> List[str]:
        """Get list of materials used in the scene"""
        used_materials = set()
        for element in elements:
            material_type = self._get_material_for_element(
                element.get('type', ''), 
                element.get('layer', '')
            )
            used_materials.add(material_type)
        return list(used_materials)
    
    def create_texture_placeholders(self, output_dir: str) -> Dict[str, str]:
        """Create placeholder texture files"""
        texture_dir = os.path.join(output_dir, 'textures', 'materials')
        os.makedirs(texture_dir, exist_ok=True)
        
        created_textures = {}
        for texture_name in self.texture_paths.keys():
            texture_path = os.path.join(texture_dir, texture_name)
            # Create a simple placeholder file
            with open(texture_path, 'w') as f:
                f.write(f"# Placeholder texture: {texture_name}")
            created_textures[texture_name] = texture_path
        
        return created_textures
