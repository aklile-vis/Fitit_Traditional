import os
import logging
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

from .file_storage import FileStorageManager
from .ai_assistant import AIDesignAssistant, build_assistant
from .asset_catalog import AssetCatalog

logger = logging.getLogger(__name__)


class RobustProcessor:
    """Main processor that orchestrates file processing, AI enrichment, and asset management."""
    
    def __init__(self):
        """Initialize the robust processor with all required components."""
        self.storage = FileStorageManager()
        self.ai_assistant = build_assistant()
        self.catalog = AssetCatalog()
        
        logger.info("RobustProcessor initialized successfully")
    
    def validate_ifc_file(self, file_path: str) -> Dict[str, Any]:
        """Validate IFC file format and structure."""
        try:
            if not os.path.exists(file_path):
                return {'valid': False, 'error': 'File not found'}
            
            # Basic IFC validation - check if file starts with IFC header
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                first_line = f.readline().strip()
                if not first_line.startswith('ISO-10303-21'):
                    return {'valid': False, 'error': 'Invalid IFC file format'}
            
            return {'valid': True, 'message': 'IFC file appears valid'}
            
        except Exception as e:
            logger.error(f"Error validating IFC file: {e}")
            return {'valid': False, 'error': str(e)}
    
    def validate_dxf_file(self, file_path: str) -> Dict[str, Any]:
        """Validate DXF file format."""
        try:
            if not os.path.exists(file_path):
                return {'valid': False, 'error': 'File not found'}
            
            # Basic DXF validation - check if file starts with DXF header
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                first_line = f.readline().strip()
                if first_line != '0':
                    return {'valid': False, 'error': 'Invalid DXF file format'}
            
            return {'valid': True, 'message': 'DXF file appears valid'}
            
        except Exception as e:
            logger.error(f"Error validating DXF file: {e}")
            return {'valid': False, 'error': str(e)}
    
    def process_ifc_file(self, file_path: str, user_id: str) -> Dict[str, Any]:
        """Process IFC file and generate outputs."""
        try:
            logger.info(f"Processing IFC file: {file_path}")
            
            # Create processing job
            file_info = self.storage.get_file_info(user_id)
            if not file_info:
                # Create a temporary file record for processing
                file_id = self.storage.create_processing_job("temp_ifc_processing")
            else:
                file_id = file_info['id']
            
            job_id = self.storage.create_processing_job(file_id)
            
            # Update job status
            self.storage.update_processing_job(job_id, 'processing', 10)
            
            # Basic IFC processing simulation
            # In a real implementation, this would use IFC parsing libraries
            elements = self._extract_ifc_elements(file_path)
            
            self.storage.update_processing_job(job_id, 'processing', 50)
            
            # Generate outputs
            ifc_output_path = self._save_processed_ifc(file_path, job_id)
            glb_output_path = self._generate_glb_from_ifc(file_path, job_id)
            usd_output_path = self._generate_usd_from_ifc(file_path, job_id)
            
            self.storage.update_processing_job(job_id, 'processing', 80)
            
            # AI enrichment
            ai_enrichment = None
            if self.ai_assistant and elements:
                try:
                    ai_payload = {
                        'elements': elements,
                        'file_info': {'name': Path(file_path).name},
                        'statistics': {'total_elements': len(elements)}
                    }
                    ai_enrichment = self.ai_assistant.analyze_floorplan(ai_payload)
                except Exception as e:
                    logger.warning(f"AI enrichment failed: {e}")
            
            self.storage.update_processing_job(job_id, 'processing', 90)
            
            # Generate assets catalog
            assets_data = self._generate_assets_catalog(elements, ai_enrichment)
            assets_path = self.storage.save_processed_file(
                job_id, f"{Path(file_path).stem}_assets.json", 
                json.dumps(assets_data).encode(), "assets"
            )
            
            # Complete processing
            self.storage.update_processing_job(job_id, 'completed', 100, result_path=assets_path)
            
            return {
                'success': True,
                'elements': elements,
                'ifc_path': ifc_output_path,
                'glb_path': glb_output_path,
                'usd_path': usd_output_path,
                'ai_enrichment': ai_enrichment,
                'glb_materials': self._extract_materials_from_elements(elements),
                'statistics': {
                    'total_elements': len(elements),
                    'processing_time': 'simulated',
                    'file_size': os.path.getsize(file_path)
                },
                'report': f"Successfully processed IFC file with {len(elements)} elements"
            }
            
        except Exception as e:
            logger.error(f"Error processing IFC file: {e}")
            return {'success': False, 'error': str(e), 'steps_completed': 0}
    
    def process_mesh_file(self, file_path: str, user_id: str) -> Dict[str, Any]:
        """Process 3D mesh files (GLB, GLTF, OBJ, etc.)."""
        try:
            logger.info(f"Processing mesh file: {file_path}")
            
            # Create processing job
            file_id = self.storage.create_processing_job("temp_mesh_processing")
            job_id = self.storage.create_processing_job(file_id)
            
            self.storage.update_processing_job(job_id, 'processing', 20)
            
            # Basic mesh processing simulation
            elements = self._extract_mesh_elements(file_path)
            
            self.storage.update_processing_job(job_id, 'processing', 60)
            
            # Generate outputs
            glb_output_path = self._normalize_to_glb(file_path, job_id)
            usd_output_path = self._convert_to_usd(file_path, job_id)
            
            self.storage.update_processing_job(job_id, 'processing', 80)
            
            # AI enrichment
            ai_enrichment = None
            if self.ai_assistant and elements:
                try:
                    ai_payload = {
                        'elements': elements,
                        'file_info': {'name': Path(file_path).name},
                        'statistics': {'total_elements': len(elements)}
                    }
                    ai_enrichment = self.ai_assistant.analyze_floorplan(ai_payload)
                except Exception as e:
                    logger.warning(f"AI enrichment failed: {e}")
            
            # Complete processing
            self.storage.update_processing_job(job_id, 'completed', 100)
            
            return {
                'success': True,
                'elements': elements,
                'glb_path': glb_output_path,
                'usd_path': usd_output_path,
                'ai_enrichment': ai_enrichment,
                'glb_materials': self._extract_materials_from_elements(elements),
                'statistics': {
                    'total_elements': len(elements),
                    'processing_time': 'simulated',
                    'file_size': os.path.getsize(file_path)
                },
                'report': f"Successfully processed mesh file with {len(elements)} elements"
            }
            
        except Exception as e:
            logger.error(f"Error processing mesh file: {e}")
            return {'success': False, 'error': str(e), 'steps_completed': 0}
    
    def get_processing_status(self, file_id: str) -> Dict[str, Any]:
        """Get processing status for a file."""
        try:
            file_info = self.storage.get_file_info(file_id)
            if not file_info:
                return {'status': 'not_found', 'error': 'File not found'}
            
            # Get processing job status
            import sqlite3
            conn = sqlite3.connect(str(self.storage.db_path))
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT status, progress, error_message, result_path, created_at, completed_at
                FROM processing_jobs 
                WHERE file_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            ''', (file_id,))
            
            job = cursor.fetchone()
            conn.close()
            
            if job:
                return {
                    'status': job[0],
                    'progress': job[1],
                    'error_message': job[2],
                    'result_path': job[3],
                    'created_at': job[4],
                    'completed_at': job[5]
                }
            else:
                return {'status': 'no_job', 'message': 'No processing job found'}
                
        except Exception as e:
            logger.error(f"Error getting processing status: {e}")
            return {'status': 'error', 'error': str(e)}
    
    def list_processed_files(self, user_id: str) -> List[Dict]:
        """List all processed files for a user."""
        try:
            return self.storage.list_user_files(user_id)
        except Exception as e:
            logger.error(f"Error listing files: {e}")
            return []
    
    def get_storage_statistics(self) -> Dict[str, Any]:
        """Get storage statistics."""
        try:
            return self.storage.get_storage_stats()
        except Exception as e:
            logger.error(f"Error getting storage statistics: {e}")
            return {'error': str(e)}
    
    def cleanup_old_files(self, days_old: int = 30):
        """Clean up old files."""
        try:
            self.storage.cleanup_old_files(days_old)
        except Exception as e:
            logger.error(f"Error cleaning up files: {e}")
            raise e
    
    # Helper methods for processing
    
    def _extract_ifc_elements(self, file_path: str) -> List[Dict]:
        """Extract elements from IFC file (simplified implementation)."""
        # This is a simplified implementation
        # In a real system, you would use IFC parsing libraries
        elements = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            # Simple element extraction based on IFC structure
            if 'IFCWALL' in content:
                elements.append({
                    'type': 'wall',
                    'id': 'wall_1',
                    'name': 'Wall',
                    'properties': {'material': 'concrete'}
                })
            
            if 'IFCSPACE' in content:
                elements.append({
                    'type': 'space',
                    'id': 'space_1',
                    'name': 'Room',
                    'properties': {'area': 25.0}
                })
            
            if 'IFCDOOR' in content:
                elements.append({
                    'type': 'door',
                    'id': 'door_1',
                    'name': 'Door',
                    'properties': {'width': 0.9, 'height': 2.1}
                })
            
            if 'IFCWINDOW' in content:
                elements.append({
                    'type': 'window',
                    'id': 'window_1',
                    'name': 'Window',
                    'properties': {'width': 1.2, 'height': 1.5}
                })
                
        except Exception as e:
            logger.warning(f"Error extracting IFC elements: {e}")
        
        return elements
    
    def _extract_mesh_elements(self, file_path: str) -> List[Dict]:
        """Extract elements from mesh file (simplified implementation)."""
        # This is a simplified implementation
        elements = []
        
        try:
            # Basic mesh element extraction
            file_size = os.path.getsize(file_path)
            file_name = Path(file_path).name
            
            elements.append({
                'type': 'mesh',
                'id': 'mesh_1',
                'name': file_name,
                'properties': {
                    'file_size': file_size,
                    'format': Path(file_path).suffix.lower()
                }
            })
                
        except Exception as e:
            logger.warning(f"Error extracting mesh elements: {e}")
        
        return elements
    
    def _save_processed_ifc(self, file_path: str, job_id: str) -> str:
        """Save processed IFC file."""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            output_filename = f"{Path(file_path).stem}.ifc"
            return self.storage.save_processed_file(job_id, output_filename, content, "ifc")
            
        except Exception as e:
            logger.error(f"Error saving processed IFC: {e}")
            return ""
    
    def _generate_glb_from_ifc(self, file_path: str, job_id: str) -> str:
        """Generate GLB from IFC (simplified implementation)."""
        try:
            # In a real implementation, this would convert IFC to GLB
            # For now, we'll create a placeholder GLB file
            output_filename = f"{Path(file_path).stem}.glb"
            
            # Create a minimal GLB file (this is just a placeholder)
            glb_content = b'\x67\x6c\x54\x46'  # "glTF" magic number
            
            return self.storage.save_processed_file(job_id, output_filename, glb_content, "glb")
            
        except Exception as e:
            logger.error(f"Error generating GLB: {e}")
            return ""
    
    def _generate_usd_from_ifc(self, file_path: str, job_id: str) -> str:
        """Generate USD from IFC (simplified implementation)."""
        try:
            # In a real implementation, this would convert IFC to USD
            output_filename = f"{Path(file_path).stem}.usd"
            
            # Create a minimal USD file (this is just a placeholder)
            usd_content = b'#usda 1.0\n\n'
            
            return self.storage.save_processed_file(job_id, output_filename, usd_content.encode(), "usd")
            
        except Exception as e:
            logger.error(f"Error generating USD: {e}")
            return ""
    
    def _normalize_to_glb(self, file_path: str, job_id: str) -> str:
        """Normalize mesh file to GLB format."""
        try:
            output_filename = f"{Path(file_path).stem}.glb"
            
            # For now, just copy the file or create a placeholder
            with open(file_path, 'rb') as f:
                content = f.read()
            
            return self.storage.save_processed_file(job_id, output_filename, content, "glb")
            
        except Exception as e:
            logger.error(f"Error normalizing to GLB: {e}")
            return ""
    
    def _convert_to_usd(self, file_path: str, job_id: str) -> str:
        """Convert mesh file to USD format."""
        try:
            output_filename = f"{Path(file_path).stem}.usd"
            
            # Create a minimal USD file
            usd_content = f'#usda 1.0\n\n# Converted from {Path(file_path).name}\n'
            
            return self.storage.save_processed_file(job_id, output_filename, usd_content.encode(), "usd")
            
        except Exception as e:
            logger.error(f"Error converting to USD: {e}")
            return ""
    
    def _extract_materials_from_elements(self, elements: List[Dict]) -> List[Dict]:
        """Extract material information from elements."""
        materials = []
        
        for element in elements:
            if 'properties' in element and 'material' in element['properties']:
                materials.append({
                    'element_id': element['id'],
                    'material': element['properties']['material'],
                    'type': element['type']
                })
        
        return materials
    
    def _generate_assets_catalog(self, elements: List[Dict], ai_enrichment: Optional[Dict]) -> Dict[str, Any]:
        """Generate assets catalog from processed elements."""
        catalog = {
            'elements': elements,
            'ai_enrichment': ai_enrichment,
            'materials': self._extract_materials_from_elements(elements),
            'generated_at': datetime.now().isoformat(),
            'version': '1.0'
        }
        
        return catalog
