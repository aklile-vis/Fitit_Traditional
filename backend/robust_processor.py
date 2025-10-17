import os
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Tuple
import json
from datetime import datetime
import math
import numpy as np
from PIL import Image

from .file_storage import FileStorageManager
from .dxf_parser import DXFParser
from .geometry_extractor import GeometryExtractor
from .ifc_generator import IFCGenerator
from .usd_generator import USDGenerator
from .asset_catalog import catalog as asset_catalog
try:  # Optional AI enrichment
    from .ai_assistant import build_assistant
except Exception:  # pragma: no cover - optional dependency
    build_assistant = None  # type: ignore

try:  # Optional GLB post-processing
    from pygltflib import GLTF2, Camera, Node, PerspectiveCameraInfo, Extras
except Exception:  # pragma: no cover
    GLTF2 = None  # type: ignore
    Camera = None  # type: ignore
    Node = None  # type: ignore
    PerspectiveCameraInfo = None  # type: ignore
    Extras = None  # type: ignore

logger = logging.getLogger(__name__)

class RobustProcessor:
    def __init__(self, storage_base_path: str = None):
        """Initialize robust processor with all components"""
        self.storage = FileStorageManager(storage_base_path)
        self.dxf_parser: Optional[DXFParser] = None
        self.geometry_extractor: Optional[GeometryExtractor] = None
        self.ifc_generator = IFCGenerator()
        self.usd_generator = USDGenerator()
        self.ai_assistant = build_assistant() if build_assistant else None
        self._texture_cache: Dict[str, Optional[np.ndarray]] = {}
        try:
            asset_catalog.load()
        except Exception as exc:  # pragma: no cover - catalog is optional
            logger.warning('Asset catalog failed to load: %s', exc)
        self._room_style_slug = 'modern_multi_room'
        self._current_style_slug: Optional[str] = None
        self._catalog_surface_defaults: Dict[str, str] = {}
        self._catalog_guid_overrides: Dict[str, str] = {}
        self._catalog_room_assignments: Optional[Dict[str, Any]] = None
        self._catalog_fixture_instances: List[Dict[str, Any]] = []

        logger.info("Robust processor initialized")

    def process_mesh_file(self, file_path: str, user_id: str = None) -> Dict[str, Any]:
        """Process agent-supplied OBJ/SKP/GLB/GLTF assets."""
        logger.info("Processing mesh upload: %s", file_path)
        try:
            import trimesh
        except Exception as exc:  # pragma: no cover - optional dependency missing
            return {
                'success': False,
                'error': f"Mesh ingestion requires the 'trimesh' package ({exc})"
            }

        source = Path(file_path)
        ext = source.suffix.lower()

        scene, loader_errors = self._load_mesh_scene(trimesh, file_path, ext)
        if scene is None:
            logger.error('Failed to load mesh %s: %s', file_path, '; '.join(loader_errors))
            hint = ''
            if ext == '.skp':
                hint = ' SketchUp imports rely on the optional Assimp/pyassimp dependency or exporting the asset to GLB/OBJ.'
            elif ext == '.blend':
                hint = ' Blender imports rely on the optional Assimp/pyassimp dependency or exporting the asset to GLB/OBJ.'
            detail = loader_errors[-1] if loader_errors else 'unsupported format'
            return {
                'success': False,
                'error': f'Failed to load 3D model ({ext}): {detail}{hint}',
                'loader_errors': loader_errors,
            }

        glb_path = self.storage.models_dir / f"{source.stem}.glb"
        try:
            if ext == '.glb':
                if source.resolve() != glb_path.resolve():
                    shutil.copy2(source, glb_path)
            else:
                scene.export(glb_path, file_type='glb')
        except Exception as exc:
            logger.error('Failed to persist GLB for %s: %s', file_path, exc)
            return {
                'success': False,
                'error': f'Unable to generate GLB from mesh: {exc}'
            }

        materials = self._extract_scene_materials(scene)
        elements = self._build_mesh_elements(scene)
        statistics = self._mesh_statistics(scene)

        defaults = self._default_ifc_surface_defaults()
        catalog_assignments: Dict[str, Any] = {
            'style': self._room_style_slug,
            'surfaceDefaults': {
                'wall': defaults.get('wall'),
                'floor': defaults.get('floor'),
                'ceiling': defaults.get('ceiling'),
            },
            'rooms': [],
        }

        self._catalog_surface_defaults = defaults
        self._catalog_room_assignments = catalog_assignments
        self._catalog_fixture_instances = []
        self._current_style_slug = self._room_style_slug

        glb_result = {
            'success': True,
            'glb_path': str(glb_path),
            'materials': materials,
            'fixtures': [],
        }
        manifest_path = self._persist_catalog_assets(file_path, glb_result, catalog_assignments)

        report = {
            'processing_timestamp': datetime.now().isoformat(),
            'source': 'mesh-upload',
            'catalog_assets_manifest': manifest_path,
            'geometryCount': len(scene.geometry),
            'bounds': statistics.get('bounds'),
        }

        payload: Dict[str, Any] = {
            'success': True,
            'ifc_path': None,
            'glb_path': str(glb_path),
            'usd_path': None,
            'elements': elements,
            'elementsCount': len(elements),
            'statistics': statistics,
            'catalog_assignments': catalog_assignments,
            'glb_materials': materials,
            'report': report,
            'summaryPath': manifest_path,
            'steps_completed': 2,
        }

        return payload

    def _load_mesh_scene(self, trimesh_module: Any, file_path: str, ext: str) -> Tuple[Optional[Any], List[str]]:
        """Attempt to load a mesh scene with fallbacks for exotic formats."""
        loader_errors: List[str] = []

        loaders: List[Tuple[str, Dict[str, Any]]] = [
            ('auto', {'force': 'scene'})
        ]

        fallback_exts = {'.skp', '.blend'}

        for name, kwargs in loaders:
            try:
                loaded = trimesh_module.load(file_path, **kwargs)
                if loaded is None:
                    loader_errors.append(f'{name} loader returned empty scene')
                    continue
                scene = loaded if isinstance(loaded, trimesh_module.Scene) else trimesh_module.Scene(loaded)
                if len(scene.geometry) == 0:
                    loader_errors.append(f'{name} loader produced a scene with no geometry primitives')
                    continue
                return scene, loader_errors
            except Exception as exc:
                loader_errors.append(f'{name} loader failed: {exc}')

        if ext in fallback_exts:
            assimp_scene, assimp_errors = self._load_with_pyassimp(trimesh_module, file_path)
            loader_errors.extend(assimp_errors)
            if assimp_scene is not None:
                return assimp_scene, loader_errors

        return None, loader_errors

    def _load_with_pyassimp(self, trimesh_module: Any, file_path: str) -> Tuple[Optional[Any], List[str]]:
        """Attempt to load meshes via pyassimp when native loaders fail."""
        assimp_errors: List[str] = []
        try:
            import pyassimp
        except BaseException as exc:  # pragma: no cover - optional dependency
            assimp_errors.append(f'pyassimp unavailable: {exc}')
            return None, assimp_errors

        assimp_scene = None
        try:
            assimp_scene = pyassimp.load(file_path)
        except BaseException as exc:
            assimp_errors.append(f'pyassimp failed: {exc}')
            return None, assimp_errors

        try:
            if not getattr(assimp_scene, 'meshes', None):
                assimp_errors.append('pyassimp loader produced no meshes')
                return None, assimp_errors

            mesh_index = {id(mesh): idx for idx, mesh in enumerate(assimp_scene.meshes)}
            scene = trimesh_module.Scene()

            def traverse(node: Any, parent_matrix: np.ndarray) -> None:
                node_matrix = np.array(node.transformation, dtype=np.float64).reshape((4, 4))
                current = parent_matrix @ node_matrix
                for mesh in getattr(node, 'meshes', []) or []:
                    idx = mesh_index.get(id(mesh), len(scene.geometry))
                    tm = self._trimesh_from_assimp_mesh(trimesh_module, mesh)
                    if tm is None:
                        continue
                    geom_name = mesh.name or f'assimp_mesh_{idx}'
                    scene.add_geometry(tm, geom_name=geom_name, transform=current)
                for child in getattr(node, 'children', []) or []:
                    traverse(child, current)

            traverse(assimp_scene.rootnode, np.eye(4))

            if len(scene.geometry) == 0:
                assimp_errors.append('pyassimp loader produced no geometry primitives')
                return None, assimp_errors

            return scene, assimp_errors
        finally:
            if assimp_scene is not None:
                try:
                    pyassimp.release(assimp_scene)
                except Exception:
                    pass

    def _trimesh_from_assimp_mesh(self, trimesh_module: Any, mesh: Any) -> Optional[Any]:
        """Convert a pyassimp mesh into a Trimesh instance."""
        vertices = np.asarray(getattr(mesh, 'vertices', []), dtype=np.float64)
        if vertices.size == 0:
            return None

        raw_faces = getattr(mesh, 'faces', []) or []
        faces_list: List[List[int]] = []
        for face in raw_faces:
            if len(face) < 3:
                continue
            faces_list.append([int(face[0]), int(face[1]), int(face[2])])

        if not faces_list:
            return None

        faces = np.asarray(faces_list, dtype=np.int64)
        try:
            tm = trimesh_module.Trimesh(vertices=vertices, faces=faces, process=False)
        except Exception as exc:
            logger.debug('Failed to convert assimp mesh: %s', exc)
            return None

        if hasattr(mesh, 'normals') and mesh.normals is not None:
            try:
                tm.vertex_normals = np.asarray(mesh.normals, dtype=np.float64)
            except BaseException:
                pass

        return tm

    def _ensure_dxf_pipeline(self) -> None:
        if self.dxf_parser is None:
            self.dxf_parser = DXFParser()
        if self.geometry_extractor is None:
            self.geometry_extractor = GeometryExtractor()

    def process_dxf_file(self, file_path: str, user_id: str = None) -> Dict[str, Any]:
        """Main processing function - comprehensive DXF to IFC conversion"""
        self._ensure_dxf_pipeline()
        try:
            logger.info(f"Starting robust processing: {file_path}")
            
            # Step 1: Parse DXF file
            logger.info("Step 1: Parsing DXF file")
            parsed_dxf = self.dxf_parser.parse_dxf(file_path)
            
            if not parsed_dxf.get('success', False):
                return {
                    'success': False,
                    'error': f"DXF parsing failed: {parsed_dxf.get('error', 'Unknown error')}",
                    'steps_completed': 0
                }
            
            # Step 2: Extract architectural elements
            logger.info("Step 2: Extracting architectural elements")
            elements_result = self.geometry_extractor.extract_architectural_elements(parsed_dxf)

            if not elements_result.get('success', False):
                return {
                    'success': False,
                    'error': f"Element extraction failed: {elements_result.get('error', 'Unknown error')}",
                    'steps_completed': 1,
                    'parsed_dxf': parsed_dxf
                }

            if not isinstance(elements_result.get('elements'), list):
                elements_result['elements'] = elements_result.get('elements') or []

            # Step 2.5: Ensure floors and ceilings exist (generate defaults from spaces)
            try:
                elements_before = len(elements_result.get('elements', []))
                elements_result['elements'] = self._ensure_floors_and_ceilings(
                    elements_result.get('elements', []),
                    defaults={
                        'floor_thickness': 0.15,  # meters
                        'ceiling_height': 2.7,    # meters
                        'ceiling_thickness': 0.1  # meters
                    }
                )
                logger.info(
                    f"Floor/Ceiling synthesis: {elements_before} -> {len(elements_result['elements'])} elements"
                )
                elements_result['elements'] = self._inject_global_floor(
                    parsed_dxf,
                    elements_result.get('elements', []),
                    defaults={'floor_thickness': 0.15}
                )
            except Exception as e:
                logger.warning(f"Default floor/ceiling synthesis failed: {e}")

            if self.ai_assistant:
                enrichment = self._enrich_with_ai(parsed_dxf, elements_result)
                if enrichment:
                    elements_result['ai_enrichment'] = enrichment

            self._catalog_surface_defaults = {}
            self._catalog_guid_overrides = {}
            self._current_style_slug = None

            try:
                catalog_assignments = self._assign_catalog_presets(elements_result.get('elements', []))
                if catalog_assignments:
                    elements_result['catalog_assignments'] = catalog_assignments
                    self._current_style_slug = catalog_assignments.get('style') if isinstance(catalog_assignments, dict) else None
                    self._catalog_surface_defaults = self._derive_catalog_surface_defaults(catalog_assignments)
                    self._catalog_room_assignments = catalog_assignments
                    self._catalog_fixture_instances = self._prepare_fixture_instances(
                        catalog_assignments,
                        elements_result.get('elements', []),
                    )
                    if self._catalog_fixture_instances:
                        catalog_assignments['fixtureInstances'] = self._catalog_fixture_instances
                else:
                    self._catalog_surface_defaults = {}
                    self._current_style_slug = None
                    self._catalog_room_assignments = None
                    self._catalog_fixture_instances = []
            except Exception as exc:
                logger.warning('Catalog preset assignment skipped: %s', exc)

            # Step 3: Generate IFC file
            logger.info("Step 3: Generating IFC file")
            project_name = f"DXF_Project_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            ifc_filename = f"{Path(file_path).stem}.ifc"
            ifc_path = self.storage.processed_dir / ifc_filename
            
            ifc_result = self.ifc_generator.generate_ifc(
                parsed_dxf, 
                elements_result['elements'], 
                str(ifc_path),
                project_name,
                catalog_assignments=self._catalog_room_assignments,
                fixture_instances=self._catalog_fixture_instances
            )

            if not ifc_result.get('success', False):
                return {
                    'success': False,
                    'error': f"IFC generation failed: {ifc_result.get('error', 'Unknown error')}",
                    'steps_completed': 2,
                    'parsed_dxf': parsed_dxf,
                    'elements': elements_result['elements']
                }
            
            print("DEBUG: IFC generation successful, proceeding to USD generation")
            logger.info("IFC generation successful, proceeding to USD generation")
            
            # Step 4: Generate USD file
            print("DEBUG: Starting USD generation step")
            logger.info("Step 4: Generating USD file")
            usd_filename = f"{Path(file_path).stem}.usd"
            usd_path = self.storage.models_dir / usd_filename
            print(f"DEBUG: USD file path: {usd_path}")
            logger.info(f"USD file path: {usd_path}")
            logger.info(f"Elements count: {len(elements_result['elements'])}")
            
            try:
                usd_result = self.usd_generator.generate_usd_from_ifc(
                    str(ifc_path), 
                    str(usd_path), 
                    elements_result['elements'], 
                    project_name
                )
                logger.info(f"USD generation result: {usd_result}")
            except Exception as e:
                logger.error(f"USD generation exception: {str(e)}")
                usd_result = {'success': False, 'error': str(e)}
            
            if not usd_result.get('success', False):
                logger.warning(f"USD generation failed: {usd_result.get('error', 'Unknown error')}")
                # Continue processing even if USD fails
            
            # Step 5: Generate GLB file (prefer baked from IFC with openings)
            logger.info("Step 5: Generating GLB file")
            glb_filename = f"{Path(file_path).stem}.glb"
            glb_path = self.storage.models_dir / glb_filename
            glb_result = {'success': False}
            try:
                glb_result = self._generate_glb_from_ifc(
                    str(ifc_path),
                    str(glb_path),
                    elements_result.get('ai_enrichment')
                )
            except Exception as e:
                logger.warning(f"IFC-based GLB generation failed: {e}")
                glb_result = {'success': False, 'error': str(e)}
            if not glb_result.get('success'):
                logger.info("Falling back to DXF-based GLB generation")
                glb_result = self._generate_glb_file(parsed_dxf, elements_result['elements'], str(glb_path))
            
            # Step 6: Generate processing report
            logger.info("Step 6: Generating processing report")
            report = self._generate_processing_report(parsed_dxf, elements_result, ifc_result, glb_result, usd_result)
            topology_manifest = self._persist_catalog_assets(file_path, glb_result, elements_result.get('catalog_assignments'))

            # Step 7: Save processing results
            logger.info("Step 7: Saving processing results")
            self._save_processing_results(file_path, user_id, ifc_result, glb_result, report, usd_result)
            if topology_manifest is not None:
                report['catalog_assets_manifest'] = topology_manifest

            logger.info("Robust processing completed successfully")

            return {
                'success': True,
                'ifc_path': str(ifc_path),
                'usd_path': str(usd_path) if usd_result.get('success', False) else None,
                'glb_path': str(glb_path),
                'parsed_dxf': parsed_dxf,
                'elements': elements_result['elements'],
                'statistics': elements_result['statistics'],
                'relationships': elements_result.get('relationships'),
                'report': report,
                'ai_enrichment': elements_result.get('ai_enrichment'),
                'glb_materials': glb_result.get('materials'),
                'catalog_assignments': elements_result.get('catalog_assignments'),
                'steps_completed': 7
            }
            
        except Exception as e:
            logger.error(f"Error in robust processing: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'steps_completed': 0
            }

    def _persist_catalog_assets(
        self,
        source_path: str,
        glb_result: Dict[str, Any],
        catalog_assignments: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        try:
            if not glb_result or not glb_result.get('success'):
                return None
            stem = Path(source_path).stem
            manifest_path = self.storage.processed_dir / f"{stem}_assets.json"
            payload = {
                'materials': glb_result.get('materials') or {},
                'fixtures': glb_result.get('fixtures') or [],
                'catalogAssignments': catalog_assignments or {},
            }
            with manifest_path.open('w', encoding='utf-8') as handle:
                json.dump(payload, handle, indent=2)
            logger.info('Catalog asset manifest written to %s', manifest_path)
            return str(manifest_path)
        except Exception as exc:  # pragma: no cover - best effort
            logger.warning('Failed to persist catalog assets manifest: %s', exc)
            return None
    
    def _generate_glb_file(self, parsed_dxf: Dict[str, Any], elements: List[Dict[str, Any]], 
                          output_path: str) -> Dict[str, Any]:
        """Generate GLB file from parsed DXF and elements using trimesh (valid and viewable)."""
        try:
            import trimesh
            from trimesh.creation import box
            scene = trimesh.Scene()

            # Infer unit scale → meters
            scale_to_m = 0.001
            try:
                info = parsed_dxf.get('file_info', {})
                units_name = str(info.get('units_name', '')).lower()
                units_code = int(info.get('units', 0) or 0)
                name_map = {'inches':0.0254,'feet':0.3048,'millimeters':0.001,'centimeters':0.01,'meters':1.0,'kilometers':1000.0}
                code_map = {1:0.0254,2:0.3048,4:0.001,5:0.01,6:1.0,7:1000.0}
                if units_name in name_map:
                    scale_to_m = name_map[units_name]
                elif units_code in code_map:
                    scale_to_m = code_map[units_code]
            except Exception:
                pass

            def color_for(t: str):
                c = {
                    'wall': [0.55,0.55,0.6,1.0],
                    'floor': [0.8,0.8,0.8,1.0],
                    'ceiling': [0.9,0.9,1.0,1.0],
                    'window': [0.6,0.8,1.0,0.6],
                    'door': [0.5,0.3,0.1,1.0],
                    'space': [0.7,0.7,0.7,0.4],
                }
                return c.get((t or 'space').lower(), [0.7,0.7,0.7,1.0])

            count = 0
            # Simple thickness/height defaults in meters
            default_wall_h = 2.7
            default_wall_t = 0.2
            floor_t = 0.1

            # Recentering offset based on DXF bounds (helps cameras; doesn't affect IFC)
            offx = 0.0
            offy = 0.0
            try:
                bmin = parsed_dxf.get('bounds', {}).get('min', [0,0])
                bmax = parsed_dxf.get('bounds', {}).get('max', [0,0])
                cx = ((bmin[0] + bmax[0]) / 2.0) * scale_to_m
                cy = ((bmin[1] + bmax[1]) / 2.0) * scale_to_m
                offx = -cx
                offy = -cy
            except Exception:
                pass

            for el in (elements or [])[:2000]:
                t = (el.get('type') or '').lower()
                geom = el.get('geometry') or {}
                mat_color = color_for(t)

                try:
                    if t == 'wall':
                        # From points or length/center/angle
                        if 'points' in geom and len(geom['points']) >= 2:
                            p0 = geom['points'][0]; p1 = geom['points'][1]
                            x0,y0 = p0[0]*scale_to_m, p0[1]*scale_to_m
                            x1,y1 = p1[0]*scale_to_m, p1[1]*scale_to_m
                            dx,dy = x1-x0, y1-y0
                            length = max((dx**2+dy**2)**0.5, 0.05)
                            cx,cy = (x0+x1)/2,(y0+y1)/2
                            angle = 0.0
                            import math
                            angle = math.atan2(dy,dx)
                        else:
                            length = max(float(geom.get('length',1.0))*scale_to_m, 0.05)
                            cx,cy = (geom.get('center') or [0,0])[0]*scale_to_m,(geom.get('center') or [0,0])[1]*scale_to_m
                            angle = float(geom.get('angle',0.0))
                        size = [length, default_wall_t, default_wall_h]
                        mesh = box(extents=size)
                        # Rotate around Z by angle while centered at origin
                        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, [0,0,1]))
                        # Translate to center and lift by half height
                        mesh.apply_translation([cx + offx, cy + offy, default_wall_h/2])
                    elif t in ('floor','space'):
                        # Use bounds if present
                        b = geom.get('bounds')
                        if b and 'min' in b and 'max' in b:
                            minx,miny = b['min'][0]*scale_to_m, b['min'][1]*scale_to_m
                            maxx,maxy = b['max'][0]*scale_to_m, b['max'][1]*scale_to_m
                            w = max(maxx-minx, 0.1); d = max(maxy-miny, 0.1)
                            cx,cy = (minx+maxx)/2,(miny+maxy)/2
                        else:
                            # fallback small tile
                            w=d=1.0; cx=cy=0.0
                        mesh = box(extents=[w, d, floor_t])
                        # Centered at origin → move to center and lift by half thickness
                        mesh.apply_translation([cx + offx, cy + offy, floor_t/2])
                    elif t == 'ceiling':
                        b = geom.get('bounds')
                        if b and 'min' in b and 'max' in b:
                            minx,miny = b['min'][0]*scale_to_m, b['min'][1]*scale_to_m
                            maxx,maxy = b['max'][0]*scale_to_m, b['max'][1]*scale_to_m
                            w = max(maxx-minx, 0.1); d = max(maxy-miny, 0.1)
                            cx,cy = (minx+maxx)/2,(miny+maxy)/2
                        else:
                            w=d=1.0; cx=cy=0.0
                        mesh = box(extents=[w, d, floor_t])
                        mesh.apply_translation([cx + offx, cy + offy, default_wall_h - floor_t/2])
                    else:
                        # skip other types for now
                        continue

                    # Assign simple color material
                    mesh.visual.vertex_colors = [int(c*255) for c in mat_color[:3]]
                    scene.add_geometry(mesh)
                    count += 1
                except Exception as ge:
                    logger.debug(f"Skipping element due to error: {ge}")
                    continue

            # Export GLB
            scene.export(output_path)
            logger.info(f"GLB file generated: {output_path}")
            return { 'success': True, 'glb_path': output_path, 'elements_count': count }
        except Exception as e:
            logger.error(f"Error generating GLB file: {str(e)}")
            return { 'success': False, 'error': str(e), 'glb_path': None }

    def _generate_glb_from_ifc(self, ifc_path: str, output_path: str, ai_insights: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate GLB from IFC using ifcopenshell.geom tessellation (baked with openings).
        Falls back to error if geometry module unavailable.
        """
        try:
            import ifcopenshell
            try:
                import ifcopenshell.geom as ifcgeom
            except Exception as ge:
                return { 'success': False, 'error': f'IFC geometry module not available: {ge}', 'glb_path': None }

            import trimesh
            settings = ifcgeom.settings()
            try:
                settings.set(settings.USE_WORLD_COORDS, True)
                settings.set(settings.INCLUDE_CURVES, False)
            except Exception:
                pass

            model = ifcopenshell.open(ifc_path)
            scene = trimesh.Scene()
            count_items = 0
            guid_materials: Dict[str, Dict[str, Any]] = {}
            used_node_names: Set[str] = set()
            fixture_results: List[Dict[str, Any]] = []

            fixture_instances = getattr(self, '_catalog_fixture_instances', []) or []
            if fixture_instances:
                for idx, inst in enumerate(fixture_instances):
                    record = asset_catalog.get_fixture(inst.get('slug', ''))
                    if not record or not record.model_path:
                        continue
                    model_path = (record.path / record.model_path.replace('./', '')).resolve()
                    if not model_path.exists():
                        continue
                    try:
                        fixture_mesh = trimesh.load(model_path, merge=True)
                        transform = self._fixture_transform_matrix(inst)
                        node_name = f"fixture_{inst.get('slug')}_{idx}"
                        metadata = {
                            'catalogSlug': inst.get('slug'),
                            'room': inst.get('roomName'),
                            'roomType': inst.get('roomType'),
                        }
                        fixture_mesh.metadata = {**fixture_mesh.metadata, **metadata}
                        scene.add_geometry(fixture_mesh, transform=transform, node_name=node_name)
                        fixture_entry = {
                            'slug': inst.get('slug'),
                            'room': inst.get('roomName'),
                            'roomType': inst.get('roomType'),
                            'position': inst.get('worldPosition'),
                            'rotationDeg': inst.get('rotationDeg'),
                            'scale': inst.get('scale'),
                            'modelPath': record.model_path,
                        }
                        fixture_results.append(fixture_entry)
                    except Exception as exc:
                        logger.debug('Failed to append fixture %s: %s', inst.get('slug'), exc)

            for prod in model.by_type('IfcProduct'):
                try:
                    if not getattr(prod, 'Representation', None):
                        continue
                    shape = ifcgeom.create_shape(settings, prod)
                    verts = np.array(shape.geometry.verts, dtype=float).reshape(-1, 3)
                    faces = np.array(shape.geometry.faces, dtype=int).reshape(-1, 3)
                    if len(verts) == 0 or len(faces) == 0:
                        continue
                    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)

                    mat_info = self._material_info_for_ifc(prod)
                    override_slug = self._catalog_material_slug_for_product(prod)
                    if override_slug:
                        override_info = self._material_info_from_catalog(override_slug)
                        if override_info:
                            mat_info = override_info
                    texture_name = mat_info.get('texture')
                    texture_scale = mat_info.get('uv_scale', 0.35)
                    texture_image = self._get_texture_array(texture_name) if texture_name else None

                    base_color_rgba = mat_info.get('color', [180, 180, 180, 255])
                    if texture_image is not None:
                        try:
                            from trimesh.visual import texture as trimesh_texture
                            uv = self._compute_planar_uv(verts, texture_scale)
                            material = trimesh_texture.SimpleMaterial(image=texture_image)
                            mesh.visual = trimesh_texture.TextureVisuals(uv=uv, image=texture_image, material=material)
                        except Exception as exc:
                            logger.debug('Texture assignment failed for %s: %s', prod, exc)
                            mesh.visual.vertex_colors = base_color_rgba
                    else:
                        mesh.visual.vertex_colors = base_color_rgba

                    guid = getattr(prod, 'GlobalId', None)
                    guid_str = str(guid) if guid else None
                    node_name = guid_str or f"{prod.is_a()}_{count_items}"
                    if node_name in used_node_names:
                        node_name = f"{node_name}_{count_items}"

                    mesh.metadata = (mesh.metadata or {})
                    mesh.metadata.update({
                        'ifc_guid': guid_str,
                        'ifc_type': prod.is_a(),
                    })

                    try:
                        scene.add_geometry(mesh, node_name=node_name, geom_name=f"geom_{node_name}")
                        used_node_names.add(node_name)
                    except Exception:
                        scene.add_geometry(mesh)

                    if guid_str:
                        avg_color = base_color_rgba
                        if hasattr(mesh.visual, 'vertex_colors') and getattr(mesh.visual, 'vertex_colors') is not None:
                            try:
                                avg_color = mesh.visual.vertex_colors.mean(axis=0).tolist()
                            except Exception:
                                avg_color = base_color_rgba
                        entry: Dict[str, Any] = {
                            'ifcType': prod.is_a(),
                            'color': avg_color,
                            'texture': texture_name,
                        }
                        if override_slug:
                            entry['catalogSlug'] = override_slug
                        guid_materials[guid_str] = entry
                    count_items += 1
                except Exception as ge:
                    logger.debug('Failed to tessellate %s: %s', prod, ge)
                    continue

            if count_items == 0:
                return { 'success': False, 'error': 'No geometric items found in IFC', 'glb_path': None }

            export = scene.export(file_type='glb')
            Path(output_path).write_bytes(export)

            if guid_materials:
                self._annotate_glb_nodes_with_guid(output_path, guid_materials)

            if ai_insights:
                self._apply_ai_cameras_to_glb(output_path, ai_insights)

            return {
                'success': True,
                'glb_path': output_path,
                'items': count_items,
                'materials': guid_materials,
                'fixtures': fixture_results,
            }
        except Exception as e:
            logger.error(f"Error generating GLB from IFC: {e}")
            return { 'success': False, 'error': str(e), 'glb_path': None }

    def _ensure_floors_and_ceilings(self, elements: List[Dict[str, Any]], defaults: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Ensure every enclosed space has a corresponding floor + ceiling element."""

        def geom_signature(geom: Dict[str, Any]) -> Optional[str]:
            bounds = geom.get('bounds')
            if bounds:
                mn = bounds.get('min', [0, 0])
                mx = bounds.get('max', [0, 0])
                try:
                    key = (
                        round(float(mn[0]), 3),
                        round(float(mn[1]), 3),
                        round(float(mx[0]), 3),
                        round(float(mx[1]), 3),
                    )
                    return f"bounds:{key}"
                except (TypeError, ValueError):
                    pass
            vertices = geom.get('points') or geom.get('vertices')
            if vertices and isinstance(vertices, list):
                try:
                    coords = tuple(round(float(c), 3) for v in vertices if isinstance(v, (list, tuple)) for c in v[:2])
                    if coords:
                        return f"verts:{coords}"
                except (TypeError, ValueError):
                    return None
            return None

        floors = [e for e in elements if e.get('type') == 'floor']
        ceilings = [e for e in elements if e.get('type') == 'ceiling']
        floor_signatures = {geom_signature(e.get('geometry', {})) for e in floors}
        ceiling_signatures = {geom_signature(e.get('geometry', {})) for e in ceilings}

        spaces = [e for e in elements if e.get('type') in ('space', 'room')]
        if not spaces:
            return elements

        generated: List[Dict[str, Any]] = []
        for idx, space in enumerate(spaces):
            geom = space.get('geometry', {}) or {}
            bounds = geom.get('bounds')
            vertices = geom.get('points') or geom.get('vertices')
            sig = geom_signature(geom) or f"space:{idx}"

            if sig not in floor_signatures:
                floor_geom: Dict[str, Any] = {}
                if bounds:
                    floor_geom['bounds'] = bounds
                if vertices:
                    floor_geom['vertices'] = vertices
                generated.append({
                    'type': 'floor',
                    'layer': space.get('layer', 'default'),
                    'geometry': floor_geom,
                    'properties': {
                        'thickness': int(defaults.get('floor_thickness', 0.15) * 1000),
                        'area': geom.get('area', 0),
                        'sourceSpace': space.get('id') or sig,
                    },
                    'confidence': min(0.85, space.get('confidence', 0.7) + 0.1)
                })
                floor_signatures.add(sig)

            if sig not in ceiling_signatures:
                ceil_geom: Dict[str, Any] = {}
                if bounds:
                    ceil_geom['bounds'] = bounds
                if vertices:
                    ceil_geom['vertices'] = vertices
                generated.append({
                    'type': 'ceiling',
                    'layer': space.get('layer', 'default'),
                    'geometry': ceil_geom,
                    'properties': {
                        'height': int(defaults.get('ceiling_height', 2.7) * 1000),
                        'thickness': int(defaults.get('ceiling_thickness', 0.1) * 1000),
                        'sourceSpace': space.get('id') or sig,
                    },
                    'confidence': 0.65
                })
                ceiling_signatures.add(sig)

        if generated:
            elements = list(elements) + generated
        return elements

    def _extract_scene_materials(self, scene: Any) -> Dict[str, Any]:
        materials: Dict[str, Any] = {}
        try:
            import trimesh
        except Exception:  # pragma: no cover
            return materials

        geometries: Dict[str, trimesh.Trimesh]
        if isinstance(scene, trimesh.Scene):
            geometries = scene.geometry
        else:
            geometries = {"mesh": scene}

        for name, mesh in geometries.items():
            mat_info: Dict[str, Any] = {}
            try:
                material = getattr(mesh.visual, 'material', None)
                mat_name = getattr(material, 'name', None)
                if mat_name:
                    mat_info['name'] = mat_name
                color = None
                if material is not None:
                    color = getattr(material, 'diffuse', None) or getattr(material, 'baseColorTexture', None)
                if color is None and hasattr(mesh.visual, 'vertex_colors'):
                    vc = mesh.visual.vertex_colors
                    if vc is not None and len(vc) > 0:
                        color = [float(vc[0][0]) / 255.0, float(vc[0][1]) / 255.0, float(vc[0][2]) / 255.0]
                if color is not None:
                    mat_info['color'] = color
            except Exception:
                pass
            key = mat_info.get('name') or name
            materials[key] = mat_info
        return materials

    def _build_mesh_elements(self, scene: Any) -> List[Dict[str, Any]]:
        elements: List[Dict[str, Any]] = []
        try:
            import trimesh
        except Exception:  # pragma: no cover
            return elements

        geometries: List[Tuple[str, trimesh.Trimesh]] = []
        if isinstance(scene, trimesh.Scene):
            geometries = list(scene.geometry.items())
        else:
            geometries = [("mesh", scene)]

        for idx, (name, mesh) in enumerate(geometries):
            bbox = None
            area = None
            volume = None
            try:
                if hasattr(mesh, 'bounds'):
                    bbox = mesh.bounds.tolist()
            except Exception:
                bbox = None
            try:
                if hasattr(mesh, 'area'):
                    area = float(mesh.area)
            except Exception:
                area = None
            try:
                if getattr(mesh, 'is_volume', False) and hasattr(mesh, 'volume'):
                    volume = float(mesh.volume)
            except Exception:
                volume = None

            mat_name = None
            try:
                mat = getattr(mesh.visual, 'material', None)
                if mat is not None:
                    mat_name = getattr(mat, 'name', None)
            except Exception:
                mat_name = None

            elements.append({
                'id': f"mesh-{idx}",
                'name': name,
                'type': 'mesh',
                'material': mat_name,
                'geometry': {
                    'bounds': bbox,
                    'area': area,
                    'volume': volume,
                }
            })
        return elements

    def _mesh_statistics(self, scene: Any) -> Dict[str, Any]:
        stats: Dict[str, Any] = {}
        try:
            bounds = getattr(scene, 'bounds', None)
            if bounds is not None:
                stats['bounds'] = bounds.tolist() if hasattr(bounds, 'tolist') else bounds
                min_corner, max_corner = bounds[0], bounds[1]
                size = [float(max_corner[i] - min_corner[i]) for i in range(3)]
                stats['size'] = size
        except Exception:
            pass
        try:
            stats['geometryCount'] = len(scene.geometry) if hasattr(scene, 'geometry') else 1
        except Exception:
            stats['geometryCount'] = 1
        return stats

    def _enrich_with_ai(
        self,
        parsed_dxf: Dict[str, Any],
        extractor_result: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        if not self.ai_assistant:
            return None
        try:
            elements = extractor_result.get('elements') or []
            extractor_stats = extractor_result.get('statistics') or {}
            relationships = extractor_result.get('relationships') or {}
            trimmed_elements = self._prepare_elements_for_ai(elements, relationships)
            dxf_stats = parsed_dxf.get('statistics') or {}
            payload = {
                'file_info': parsed_dxf.get('file_info') or {},
                'dxf_statistics': dxf_stats,
                'layer_classifications': dxf_stats.get('layer_classifications'),
                'disciplines': dxf_stats.get('layer_disciplines'),
                'systems': dxf_stats.get('layer_systems'),
                'elements': trimmed_elements,
                'extraction_statistics': extractor_stats,
                'relationships': extractor_result.get('relationships'),
            }
            space_summaries = self._space_summaries_from_relationships(relationships)
            if space_summaries:
                payload['space_summaries'] = space_summaries
            result = self.ai_assistant.analyze_floorplan(payload)
            logger.info('AI enrichment produced rooms=%s materials=%s cameras=%s',
                        len(result.get('rooms', [])),
                        len(result.get('materials', [])),
                        len(result.get('cameras', [])))
            return result
        except Exception as exc:
            logger.warning('AI enrichment failed: %s', exc)
            return None

    def _prepare_elements_for_ai(
        self,
        elements: List[Dict[str, Any]],
        relationships: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Down-sample element payload for the AI model to control token usage."""
        trimmed: List[Dict[str, Any]] = []
        space_lookup: Dict[int, Dict[str, Any]] = {}
        if relationships and isinstance(relationships.get('spaces'), list):
            for space in relationships.get('spaces', []):
                if isinstance(space, dict):
                    idx = space.get('element_index')
                    if isinstance(idx, int):
                        space_lookup[idx] = space

        for idx, element in enumerate(elements or []):
            elem_type = (element.get('type') or element.get('element_type') or '').lower()
            if not elem_type:
                continue
            properties = element.get('properties') or {}
            layer_meta = properties.get('layer_metadata') or {}
            geometry = element.get('geometry') or {}

            summary = {
                'type': elem_type,
                'layer': element.get('layer'),
                'layer_classification': layer_meta.get('classification'),
                'layer_discipline': layer_meta.get('discipline'),
                'layer_system': layer_meta.get('system'),
                'confidence': round(float(element.get('confidence') or properties.get('confidence') or 0.0), 3),
            }

            if elem_type in ('wall', 'door', 'window', 'beam', 'column'):
                summary['length'] = geometry.get('length')
                summary['start'] = geometry.get('start')
                summary['end'] = geometry.get('end')
            elif elem_type in ('floor', 'space', 'ceiling'):
                summary['area'] = geometry.get('area')
                summary['bounds'] = geometry.get('bounds')
            elif elem_type.startswith('mep') or elem_type in ('fixture', 'furniture'):
                summary['anchor'] = geometry.get('insert_point') or geometry.get('center')
                summary['name'] = properties.get('name') or properties.get('element_type')

            if properties.get('name') and elem_type in ('space', 'room'):
                summary['name'] = properties.get('name')

            if elem_type in ('space', 'room'):
                space_info = space_lookup.get(idx)
                if isinstance(space_info, dict):
                    summary['generated'] = bool(space_info.get('generated'))
                    summary['adjacent_wall_count'] = len(space_info.get('adjacent_walls') or [])
                    summary['neighbor_count'] = len(space_info.get('adjacent_spaces') or [])
                    area_m2 = space_info.get('area')
                    if isinstance(area_m2, (int, float, np.floating)):
                        summary['area_m2'] = float(area_m2)
                    area_units = space_info.get('area_raw')
                    if isinstance(area_units, (int, float, np.floating)):
                        summary['area_units'] = float(area_units)

            trimmed.append(summary)

        # Limit to avoid oversized payloads
        MAX_ELEMENTS = 200
        if len(trimmed) > MAX_ELEMENTS:
            logger.info('Trimming AI element payload from %s to %s records', len(trimmed), MAX_ELEMENTS)
            trimmed = trimmed[:MAX_ELEMENTS]
        return trimmed

    def _space_summaries_from_relationships(
        self,
        relationships: Optional[Dict[str, Any]]
    ) -> Optional[List[Dict[str, Any]]]:
        if not isinstance(relationships, dict):
            return None
        spaces = relationships.get('spaces')
        if not isinstance(spaces, list) or not spaces:
            return None
        scale_to_m = relationships.get('scaleToM')
        summaries: List[Dict[str, Any]] = []
        for space in spaces:
            if not isinstance(space, dict):
                continue
            try:
                idx = space.get('element_index')
                if not isinstance(idx, int):
                    continue
                name = space.get('name') or f'Space {idx}'
                area_m2 = space.get('area') if isinstance(space.get('area'), (int, float, np.floating)) else None
                area_units = space.get('area_raw') if isinstance(space.get('area_raw'), (int, float, np.floating)) else None
                summaries.append({
                    'element_index': idx,
                    'name': name,
                    'generated': bool(space.get('generated')), 
                    'area_m2': float(area_m2) if area_m2 is not None else None,
                    'area_units': float(area_units) if area_units is not None else None,
                    'adjacent_wall_count': len(space.get('adjacent_walls') or []),
                    'neighbor_count': len(space.get('adjacent_spaces') or []),
                    'scale_to_m': float(scale_to_m) if isinstance(scale_to_m, (int, float, np.floating)) else None,
                })
            except Exception:
                continue
        return summaries or None

    def _material_info_for_ifc(self, prod: Any) -> Dict[str, Any]:
        ifc_type = (prod.is_a() or '').upper()
        mapping = {
            'IFCSLAB': {'texture': 'wood', 'uv_scale': 0.25, 'color': [210, 190, 150, 255]},
            'IFCPLATE': {'texture': 'marble', 'uv_scale': 0.3, 'color': [230, 230, 230, 255]},
            'IFCCOVERING': {'texture': 'fabric', 'uv_scale': 0.4, 'color': [240, 240, 240, 255]},
            'IFCWALL': {'texture': 'brick', 'uv_scale': 0.2, 'color': [175, 120, 90, 255]},
            'IFCDOOR': {'texture': 'wood', 'uv_scale': 0.35, 'color': [160, 120, 90, 255]},
            'IFCWINDOW': {'color': [170, 210, 240, 180]},
        }
        default = {'color': [190, 190, 190, 255]}
        info = mapping.get(ifc_type, default).copy()
        if 'color' not in info:
            info['color'] = default['color']
        return info

    def _default_color_for_ifc(self, prod: Any) -> List[int]:
        info = self._material_info_for_ifc(prod)
        return info.get('color', [180, 180, 180, 255])

    def _get_texture_array(self, name: Optional[str]) -> Optional[np.ndarray]:
        if not name:
            return None
        cached = self._texture_cache.get(name)
        if cached is not None:
            return cached

        if name.startswith('catalog:'):
            parts = name.split(':')
            if len(parts) >= 3:
                slug = parts[1]
                key = parts[2]
                record = asset_catalog.get_material(slug)
                if record:
                    texture_rel = (record.textures or {}).get(key)
                    if texture_rel:
                        candidate = (record.path / texture_rel.replace('./', '')).resolve()
                        if candidate.exists():
                            try:
                                image = Image.open(candidate).convert('RGBA')
                                array = np.array(image, dtype=np.uint8)
                                self._texture_cache[name] = array
                                return array
                            except Exception as exc:  # pragma: no cover
                                logger.debug('Failed to load catalog texture %s: %s', candidate, exc)
            self._texture_cache[name] = None
            return None

        textures_dir = Path(__file__).resolve().parent.parent / 'public' / 'textures'
        path = textures_dir / f'{name}.jpg'
        if not path.exists():
            self._texture_cache[name] = None
            return None
        try:
            image = Image.open(path).convert('RGBA')
            array = np.array(image, dtype=np.uint8)
            self._texture_cache[name] = array
            return array
        except Exception as exc:  # pragma: no cover
            logger.debug('Failed to load texture %s: %s', path, exc)
            self._texture_cache[name] = None
            return None

    def _compute_planar_uv(self, vertices: np.ndarray, scale: float) -> np.ndarray:
        if vertices.size == 0:
            return np.zeros((0, 2), dtype=np.float32)
        uv = vertices[:, :2].copy()
        min_vals = uv.min(axis=0)
        uv -= min_vals
        uv *= float(scale)
        return uv.astype(np.float32)

    # ------------------------------------------------------------------
    # Catalog helpers

    def _assign_catalog_presets(self, elements: List[Dict[str, Any]]) -> Dict[str, Any]:
        style = asset_catalog.get_room_style(self._room_style_slug)
        if not style:
            return {}
        material_map: Dict[str, Dict[str, Any]] = {}
        surface_defaults: Dict[str, str] = {}
        for entry in style.materials:
            target = entry.get('target', '')
            if ':' in target:
                room, surface = target.split(':', 1)
            else:
                room, surface = 'default', target
            material_map.setdefault(room.lower(), {})[surface.lower()] = {
                'material': entry.get('material'),
                'priority': entry.get('priority', 0)
            }
            slug = entry.get('material')
            if slug:
                surface_defaults.setdefault(surface.lower(), slug)

        fixture_list = [dict(fix) for fix in (style.fixtures or [])]
        assignments: Dict[str, Any] = {
            'style': style.slug,
            'rooms': []
        }
        for idx, element in enumerate(elements or []):
            if (element.get('type') or '').lower() not in ('space', 'room'):
                continue
            properties = element.get('properties', {}) or {}
            geometry = element.get('geometry', {}) or {}
            name = str(properties.get('name') or f'Room {idx+1}')
            room_type = self._detect_room_type(name)
            if properties.get('generated') or (element.get('layer') == '__generated_space__'):
                room_type = room_type or 'generated_space'
            surfaces = material_map.get(room_type, material_map.get('default', {}))
            centroid = self._centroid_from_geometry(geometry)
            assignments['rooms'].append({
                'name': name,
                'roomType': room_type,
                'materials': surfaces,
                'fixtures': [dict(fix) for fix in fixture_list],
                'elementIndex': idx,
                'centroid': centroid,
            })
            for surface_key, meta in surfaces.items():
                slug = meta.get('material') if isinstance(meta, dict) else None
                if slug:
                    surface_defaults.setdefault(surface_key.lower(), slug)
        assignments['surfaceDefaults'] = surface_defaults
        return assignments

    def _centroid_from_geometry(self, geometry: Dict[str, Any]) -> Optional[List[float]]:
        try:
            if not geometry:
                return None
            if 'center' in geometry and isinstance(geometry['center'], (list, tuple)):
                center = geometry['center']
                if len(center) >= 2:
                    return [float(center[0]), float(center[1]), 0.0]
            if 'vertices' in geometry and isinstance(geometry['vertices'], list) and geometry['vertices']:
                xs = [float(v[0]) for v in geometry['vertices'] if isinstance(v, (list, tuple)) and len(v) >= 2]
                ys = [float(v[1]) for v in geometry['vertices'] if isinstance(v, (list, tuple)) and len(v) >= 2]
                if xs and ys:
                    return [sum(xs) / len(xs), sum(ys) / len(ys), 0.0]
            bounds = geometry.get('bounds') if isinstance(geometry, dict) else None
            if bounds and 'min' in bounds and 'max' in bounds:
                mn = bounds['min']; mx = bounds['max']
                if isinstance(mn, (list, tuple)) and isinstance(mx, (list, tuple)) and len(mn) >= 2 and len(mx) >= 2:
                    return [float(mn[0] + mx[0]) * 0.5, float(mn[1] + mx[1]) * 0.5, 0.0]
        except Exception:
            return None
        return None

    def _derive_catalog_surface_defaults(self, assignments: Optional[Dict[str, Any]]) -> Dict[str, str]:
        defaults: Dict[str, str] = {}
        if not isinstance(assignments, dict):
            return defaults
        surface_entries = assignments.get('surfaceDefaults')
        if isinstance(surface_entries, dict):
            for key, value in surface_entries.items():
                if isinstance(value, str):
                    defaults[key.lower()] = value
        elif isinstance(surface_entries, list):
            for entry in surface_entries:
                if isinstance(entry, dict):
                    surface = str(entry.get('surface') or '').lower()
                    slug = entry.get('material')
                    if surface and isinstance(slug, str):
                        defaults[surface] = slug
        rooms = assignments.get('rooms')
        if isinstance(rooms, list):
            for room in rooms:
                if not isinstance(room, dict):
                    continue
                mats = room.get('materials')
                if isinstance(mats, dict):
                    for surface_key, meta in mats.items():
                        slug = meta.get('material') if isinstance(meta, dict) else (meta if isinstance(meta, str) else None)
                        if slug:
                            defaults.setdefault(surface_key.lower(), slug)
        style_slug = assignments.get('style')
        if isinstance(style_slug, str):
            style_record = asset_catalog.get_room_style(style_slug)
            if style_record:
                for entry in style_record.materials:
                    if not isinstance(entry, dict):
                        continue
                    slug = entry.get('material')
                    if isinstance(slug, str):
                        surface_key = str(entry.get('target', '')).split(':')[-1].lower()
                        if surface_key:
                            defaults.setdefault(surface_key, slug)
        return defaults

    def _prepare_fixture_instances(
        self,
        assignments: Optional[Dict[str, Any]],
        elements: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        instances: List[Dict[str, Any]] = []
        if not isinstance(assignments, dict):
            return instances
        rooms = assignments.get('rooms')
        if not isinstance(rooms, list):
            return instances

        for room in rooms:
            if not isinstance(room, dict):
                continue
            fixtures = room.get('fixtures')
            if not isinstance(fixtures, list) or len(fixtures) == 0:
                continue
            centroid = room.get('centroid')
            idx = room.get('elementIndex')
            if not centroid and isinstance(idx, int) and 0 <= idx < len(elements):
                centroid = self._centroid_from_geometry(elements[idx].get('geometry', {}))
            if not centroid:
                continue
            for fixture in fixtures:
                if not isinstance(fixture, dict):
                    continue
                slug = fixture.get('asset')
                if not isinstance(slug, str):
                    continue
                placement = fixture.get('placement') if isinstance(fixture.get('placement'), dict) else {}
                offset = placement.get('position') if isinstance(placement.get('position'), (list, tuple)) else [0.0, 0.0, 0.0]
                rotation = placement.get('rotation') if isinstance(placement.get('rotation'), (int, float)) else 0.0
                scale = placement.get('scale') if isinstance(placement.get('scale'), (list, tuple)) else [1.0, 1.0, 1.0]
                record = asset_catalog.get_fixture(slug)
                meta_size = record.metadata.get('size') if record and isinstance(record.metadata, dict) else None
                size = placement.get('size') if isinstance(placement.get('size'), (list, tuple)) else meta_size

                try:
                    ox = float(offset[0]) if len(offset) >= 1 else 0.0
                    oy = float(offset[1]) if len(offset) >= 2 else 0.0
                    oz = float(offset[2]) if len(offset) >= 3 else 0.0
                except Exception:
                    ox = oy = oz = 0.0

                world_position = [float(centroid[0]) + ox, float(centroid[1]) + oy, float(centroid[2]) + oz]

                instances.append({
                    'slug': slug,
                    'roomName': room.get('name'),
                    'roomType': room.get('roomType'),
                    'roomElementIndex': idx,
                    'worldPosition': world_position,
                    'rotationDeg': float(rotation) if isinstance(rotation, (int, float)) else 0.0,
                    'scale': [float(scale[0]) if len(scale) > 0 else 1.0,
                              float(scale[1]) if len(scale) > 1 else 1.0,
                              float(scale[2]) if len(scale) > 2 else 1.0],
                    'placement': placement,
                    'size': size,
                    'fixtureMeta': record.metadata if record else {},
                })
        return instances

    def _fixture_transform_matrix(self, inst: Dict[str, Any]) -> np.ndarray:
        from trimesh.transformations import rotation_matrix, translation_matrix

        position = inst.get('worldPosition') or [0.0, 0.0, 0.0]
        rotation_deg = float(inst.get('rotationDeg') or 0.0)
        scale = inst.get('scale') or [1.0, 1.0, 1.0]

        try:
            px = float(position[0]) * self.ifc_generator.unit_scale
            py = float(position[1]) * self.ifc_generator.unit_scale
            pz = float(position[2]) * self.ifc_generator.unit_scale
        except Exception:
            px = py = pz = 0.0

        translation = translation_matrix([px, py, pz])
        rotation = rotation_matrix(math.radians(rotation_deg), [0, 0, 1])
        if isinstance(scale, (list, tuple)) and len(scale) >= 3:
            sx, sy, sz = float(scale[0]), float(scale[1]), float(scale[2])
        else:
            sx = sy = sz = float(scale) if isinstance(scale, (int, float)) else 1.0
        scale_matrix = np.diag([sx, sy, sz, 1.0])
        return translation @ rotation @ scale_matrix

    def _inject_global_floor(
        self,
        parsed_dxf: Dict[str, Any],
        elements: List[Dict[str, Any]],
        defaults: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        try:
            bounds = parsed_dxf.get('bounds') if isinstance(parsed_dxf, dict) else None
            if not isinstance(bounds, dict):
                return elements
            mn = bounds.get('min')
            mx = bounds.get('max')
            if not (isinstance(mn, (list, tuple)) and isinstance(mx, (list, tuple)) and len(mn) >= 2 and len(mx) >= 2):
                return elements
            vertices = [
                [float(mn[0]), float(mn[1])],
                [float(mx[0]), float(mn[1])],
                [float(mx[0]), float(mx[1])],
                [float(mn[0]), float(mx[1])],
            ]
            # Avoid injecting twice if a floor already covers the same bounds
            for element in elements:
                if (element.get('type') or '').lower() != 'floor':
                    continue
                geom = element.get('geometry') or {}
                existing = geom.get('vertices') or geom.get('points')
                if isinstance(existing, list) and len(existing) >= 4:
                    first = existing[0]
                    if isinstance(first, (list, tuple)) and abs(float(first[0]) - vertices[0][0]) < 1e-3:
                        return elements

            thickness = float(defaults.get('floor_thickness', 0.15))
            elements.append({
                'type': 'floor',
                'layer': 'auto_global_floor',
                'geometry': {
                    'vertices': vertices,
                },
                'properties': {
                    'thickness': int(thickness * 1000),
                    'source': 'global_bounds',
                },
                'confidence': 0.4,
            })
            return elements
        except Exception as exc:
            logger.debug('Failed to inject global floor: %s', exc)
            return elements

    def _detect_room_type(self, name: str) -> str:
        lowered = name.lower()
        if any(key in lowered for key in ('bed', 'sleep')):
            return 'bedroom'
        if any(key in lowered for key in ('kitchen', 'cook', 'pantry')):
            return 'kitchen'
        if any(key in lowered for key in ('bath', 'wash', 'restroom', 'wc')):
            return 'bathroom'
        if any(key in lowered for key in ('dining', 'meal')):
            return 'dining'
        if any(key in lowered for key in ('office', 'study')):
            return 'office'
        return 'living'

    def _catalog_material_slug_for_product(self, prod: Any) -> Optional[str]:
        guid = getattr(prod, 'GlobalId', None)
        if guid:
            slug = self._catalog_guid_overrides.get(str(guid))
            if slug:
                return slug
        prod_type = ''
        try:
            prod_type = (prod.is_a() or '').upper()
        except Exception:
            pass
        if prod_type == 'IFCSLAB':
            return self._catalog_surface_defaults.get('floor')
        if prod_type == 'IFCCOVERING':
            name = str(getattr(prod, 'Name', '') or '').lower()
            if 'ceiling' in name:
                return self._catalog_surface_defaults.get('ceiling') or self._catalog_surface_defaults.get('wall')
            return self._catalog_surface_defaults.get('wall')
        if prod_type == 'IFCWALL':
            return self._catalog_surface_defaults.get('wall')
        return None

    def _material_info_from_catalog(self, slug: str) -> Optional[Dict[str, Any]]:
        record = asset_catalog.get_material(slug)
        if not record:
            return None
        props = record.properties or {}
        base_color = props.get('baseColor') if isinstance(props, dict) else None
        if isinstance(base_color, list) and len(base_color) >= 3:
            color_rgba = [float(base_color[0]), float(base_color[1]), float(base_color[2]), 255.0]
        else:
            color_rgba = [200.0, 200.0, 200.0, 255.0]
        uv_scale = props.get('uvScale') if isinstance(props, dict) else None
        if isinstance(uv_scale, (list, tuple)) and len(uv_scale) >= 2:
            scale_value = float(uv_scale[0])
        else:
            scale_value = 0.35
        roughness = props.get('roughness') if isinstance(props, dict) else None
        metalness = props.get('metalness') if isinstance(props, dict) else None
        return {
            'color': color_rgba,
            'texture': f'catalog:{slug}:albedo',
            'uv_scale': float(scale_value),
            'roughness': roughness if isinstance(roughness, (int, float)) else 0.6,
            'metalness': metalness if isinstance(metalness, (int, float)) else 0.0,
            'catalogSlug': slug,
        }

    def _annotate_glb_nodes_with_guid(self, glb_path: str, guid_materials: Dict[str, Dict[str, Any]]) -> None:
        if GLTF2 is None:
            return
        try:
            gltf = GLTF2().load(glb_path)
        except Exception as exc:  # pragma: no cover
            logger.debug('Failed to load GLB for GUID annotation: %s', exc)
            return

        if not gltf.nodes:
            return

        changed = False
        for node in gltf.nodes:
            if node is None:
                continue
            name = (node.name or '').strip()
            if not name:
                continue
            info = guid_materials.get(name)
            if not info:
                continue
            extras: Dict[str, Any] = {}
            if isinstance(node.extras, dict):
                extras.update(node.extras)
            extras['ifcGuid'] = name
            if info.get('ifcType'):
                extras.setdefault('ifcType', info['ifcType'])
            if info.get('texture'):
                extras.setdefault('texture', info['texture'])
            if info.get('color') is not None:
                extras.setdefault('materialColor', info['color'])
            node.extras = extras
            changed = True

        if changed:
            try:
                gltf.save_binary(glb_path)
            except Exception as exc:  # pragma: no cover
                logger.debug('Failed to persist GLB GUID annotations: %s', exc)

    def _apply_ai_cameras_to_glb(self, glb_path: str, ai_insights: Dict[str, Any]) -> None:
        if GLTF2 is None or Camera is None or Node is None or PerspectiveCameraInfo is None:
            logger.debug('pygltflib not available; skipping camera injection')
            return

        cameras = ai_insights.get('cameras')
        if not isinstance(cameras, list) or len(cameras) == 0:
            return

        try:
            gltf = GLTF2().load(glb_path)
        except Exception as exc:  # pragma: no cover
            logger.warning('Failed to load GLB for camera injection: %s', exc)
            return

        if gltf.scenes is None or len(gltf.scenes) == 0:
            gltf.scenes = [gltf.model_scene]

        scene = gltf.scenes[gltf.scene or 0]
        if scene.nodes is None:
            scene.nodes = []

        for cam in cameras[:6]:
            position = cam.get('position') if isinstance(cam, dict) else None
            look_at = cam.get('look_at') or cam.get('lookAt') if isinstance(cam, dict) else None
            if not (isinstance(position, list) and len(position) == 3 and isinstance(look_at, list) and len(look_at) == 3):
                continue

            try:
                camera = Camera(type='perspective', perspective=PerspectiveCameraInfo(yfov=0.8, znear=0.1, zfar=200.0))
                if gltf.cameras is None:
                    gltf.cameras = []
                gltf.cameras.append(camera)
                cam_index = len(gltf.cameras) - 1

                rotation = self._quaternion_from_look_at(position, look_at)
                node = Node(name=cam.get('name', 'ai_camera'), camera=cam_index, translation=position, rotation=rotation)
                if gltf.nodes is None:
                    gltf.nodes = []
                gltf.nodes.append(node)
                node_index = len(gltf.nodes) - 1
                scene.nodes.append(node_index)
            except Exception as exc:  # pragma: no cover
                logger.debug('Skipping camera due to error: %s', exc)
                continue

        try:
            gltf.save(glb_path)
        except Exception as exc:  # pragma: no cover
            logger.warning('Failed to save GLB with cameras: %s', exc)

    def _quaternion_from_look_at(self, position: List[float], target: List[float]) -> List[float]:
        pos = np.array(position, dtype=float)
        tgt = np.array(target, dtype=float)
        forward = tgt - pos
        if np.linalg.norm(forward) < 1e-6:
            forward = np.array([0.0, 0.0, -1.0])
        forward = forward / np.linalg.norm(forward)

        up = np.array([0.0, 1.0, 0.0])
        if abs(np.dot(forward, up)) > 0.99:
            up = np.array([0.0, 0.0, 1.0])

        right = np.cross(up, forward)
        right = right / np.linalg.norm(right)
        true_up = np.cross(forward, right)

        # Build rotation matrix (glTF cameras look down -Z)
        rot = np.array([
            [right[0], true_up[0], -forward[0]],
            [right[1], true_up[1], -forward[1]],
            [right[2], true_up[2], -forward[2]],
        ])

        trace = np.trace(rot)
        if trace > 0.0:
            s = math.sqrt(trace + 1.0) * 2.0
            qw = 0.25 * s
            qx = (rot[2, 1] - rot[1, 2]) / s
            qy = (rot[0, 2] - rot[2, 0]) / s
            qz = (rot[1, 0] - rot[0, 1]) / s
        elif rot[0, 0] > rot[1, 1] and rot[0, 0] > rot[2, 2]:
            s = math.sqrt(1.0 + rot[0, 0] - rot[1, 1] - rot[2, 2]) * 2.0
            qw = (rot[2, 1] - rot[1, 2]) / s
            qx = 0.25 * s
            qy = (rot[0, 1] + rot[1, 0]) / s
            qz = (rot[0, 2] + rot[2, 0]) / s
        elif rot[1, 1] > rot[2, 2]:
            s = math.sqrt(1.0 + rot[1, 1] - rot[0, 0] - rot[2, 2]) * 2.0
            qw = (rot[0, 2] - rot[2, 0]) / s
            qx = (rot[0, 1] + rot[1, 0]) / s
            qy = 0.25 * s
            qz = (rot[1, 2] + rot[2, 1]) / s
        else:
            s = math.sqrt(1.0 + rot[2, 2] - rot[0, 0] - rot[1, 1]) * 2.0
            qw = (rot[1, 0] - rot[0, 1]) / s
            qx = (rot[0, 2] + rot[2, 0]) / s
            qy = (rot[1, 2] + rot[2, 1]) / s
            qz = 0.25 * s

        return [float(qx), float(qy), float(qz), float(qw)]
    
    def _generate_processing_report(self, parsed_dxf: Dict[str, Any], elements_result: Dict[str, Any], 
                                  ifc_result: Dict[str, Any], glb_result: Dict[str, Any], usd_result: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate comprehensive processing report"""
        return {
            'processing_timestamp': datetime.now().isoformat(),
            'dxf_info': parsed_dxf.get('file_info', {}),
            'dxf_statistics': parsed_dxf.get('statistics', {}),
            'elements_extracted': elements_result.get('statistics', {}),
            'ifc_generated': ifc_result.get('elements_created', 0),
            'usd_generated': usd_result.get('success', False) if usd_result else False,
            'usd_materials': usd_result.get('materials_used', []) if usd_result else [],
            'glb_generated': glb_result.get('success', False),
            'catalog_fixtures': glb_result.get('fixtures') if glb_result else [],
            'total_processing_time': 'N/A',  # Could be calculated with timestamps
            'success_rate': self._calculate_success_rate(parsed_dxf, elements_result, ifc_result, glb_result, usd_result)
        }
    
    def _calculate_success_rate(self, parsed_dxf: Dict[str, Any], elements_result: Dict[str, Any], 
                               ifc_result: Dict[str, Any], glb_result: Dict[str, Any], usd_result: Dict[str, Any] = None) -> float:
        """Calculate overall success rate"""
        success_count = 0
        total_steps = 5  # DXF parsing, geometry extraction, IFC generation, USD generation, GLB generation
        
        if parsed_dxf.get('success', False):
            success_count += 1
        if elements_result.get('success', False):
            success_count += 1
        if ifc_result.get('success', False):
            success_count += 1
        if usd_result and usd_result.get('success', False):
            success_count += 1
        if glb_result.get('success', False):
            success_count += 1
        
        return (success_count / total_steps) * 100
    
    def _save_processing_results(self, file_path: str, user_id: str, ifc_result: Dict[str, Any], 
                               glb_result: Dict[str, Any], report: Dict[str, Any], usd_result: Dict[str, Any] = None):
        """Save processing results to database"""
        try:
            # This would save the processing results to the database
            # For now, we'll just log the information
            logger.info(f"Processing results saved for file: {file_path}")
            logger.info(f"IFC elements created: {ifc_result.get('elements_created', 0)}")
            logger.info(f"GLB generation success: {glb_result.get('success', False)}")
            
        except Exception as e:
            logger.warning(f"Error saving processing results: {str(e)}")
    
    def get_processing_status(self, file_id: str) -> Dict[str, Any]:
        """Get processing status for a file"""
        try:
            file_info = self.storage.get_file_info(file_id)
            if not file_info:
                return {'error': 'File not found'}
            
            return {
                'file_id': file_id,
                'status': file_info.get('status', 'unknown'),
                'file_type': file_info.get('file_type', 'unknown'),
                'upload_date': file_info.get('upload_date', 'unknown'),
                'processing_result': file_info.get('processing_result', None)
            }
            
        except Exception as e:
            logger.error(f"Error getting processing status: {str(e)}")
            return {'error': str(e)}
    
    def list_processed_files(self, user_id: str) -> List[Dict[str, Any]]:
        """List all processed files for a user"""
        try:
            return self.storage.list_user_files(user_id)
        except Exception as e:
            logger.error(f"Error listing processed files: {str(e)}")
            return []
    
    def get_storage_statistics(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            return self.storage.get_storage_stats()
        except Exception as e:
            logger.error(f"Error getting storage statistics: {str(e)}")
            return {'error': str(e)}
    
    def cleanup_old_files(self, days_old: int = 30):
        """Clean up old files"""
        try:
            self.storage.cleanup_old_files(days_old)
            logger.info(f"Cleaned up files older than {days_old} days")
        except Exception as e:
            logger.error(f"Error cleaning up old files: {str(e)}")

    def process_ifc_file(self, file_path: str, user_id: str = None) -> Dict[str, Any]:
        """Process an agent-supplied IFC file, ensuring downstream assets and photorealistic materials."""
        logger.info("Starting IFC ingestion pipeline for %s", file_path)
        try:
            import ifcopenshell
        except Exception as exc:
            return {
                'success': False,
                'error': f'IFC support unavailable: {exc}'
            }

        try:
            model = ifcopenshell.open(file_path)
        except Exception as exc:
            logger.error('Failed to open IFC %s: %s', file_path, exc)
            return {
                'success': False,
                'error': f'Failed to open IFC: {exc}'
            }

        lod_report = self._inspect_ifc_lod(model)
        self._catalog_fixture_instances = []
        self._current_style_slug = None
        self._catalog_surface_defaults = self._default_ifc_surface_defaults()
        self._catalog_guid_overrides = {}

        enrichment_report: Optional[Dict[str, Any]] = None
        if lod_report.get('needs_enrichment'):
            enrichment_report = self._enrich_ifc_model(model, lod_report)
        else:
            self._populate_ifc_guid_overrides(model)

        if not self._catalog_guid_overrides:
            # Ensure we still have baseline overrides for downstream material mapping.
            self._populate_ifc_guid_overrides(model)

        elements = self._extract_ifc_elements(model)
        statistics = self._build_ifc_statistics(elements, lod_report)

        project_name = Path(file_path).stem or 'IFC_Project'
        ifc_path = self._ensure_ifc_copy(file_path)

        glb_filename = f"{Path(ifc_path).stem}.glb"
        glb_path = self.storage.models_dir / glb_filename
        glb_result = self._generate_glb_from_ifc(str(ifc_path), str(glb_path), enrichment_report)
        if not glb_result.get('success'):
            logger.error('GLB generation from IFC failed: %s', glb_result.get('error'))
            return {
                'success': False,
                'error': glb_result.get('error', 'Failed to create GLB from IFC')
            }

        usd_filename = f"{Path(ifc_path).stem}.usd"
        usd_path = self.storage.models_dir / usd_filename
        usd_result = self.usd_generator.generate_usd_from_ifc(
            str(ifc_path),
            str(usd_path),
            elements,
            project_name=project_name,
        )

        catalog_assignments = self._catalog_assignments_from_defaults()
        manifest_path = self._persist_catalog_assets(file_path, glb_result, catalog_assignments)
        report = {
            'processing_timestamp': datetime.now().isoformat(),
            'source': 'ifc-upload',
            'lod': lod_report,
            'enrichmentApplied': bool(enrichment_report),
            'glbItems': glb_result.get('items'),
            'usdGenerated': usd_result.get('success', False),
        }
        if manifest_path:
            report['catalog_assets_manifest'] = manifest_path

        payload: Dict[str, Any] = {
            'success': True,
            'ifc_path': str(ifc_path),
            'glb_path': glb_result.get('glb_path'),
            'usd_path': usd_result.get('usd_path') if usd_result.get('success') else None,
            'elements': elements,
            'elementsCount': len(elements),
            'statistics': statistics,
            'lod_report': lod_report,
            'ai_enrichment': enrichment_report,
            'glb_materials': glb_result.get('materials'),
            'catalog_assignments': catalog_assignments,
            'fixtures': glb_result.get('fixtures'),
            'relationships': None,
            'report': report,
            'steps_completed': 4,
        }

        if usd_result and not usd_result.get('success'):
            payload['usd_error'] = usd_result.get('error')

        return payload

    def _ensure_ifc_copy(self, file_path: str) -> Path:
        src = Path(file_path)
        dst = self.storage.processed_dir / src.name
        try:
            if not dst.exists() or dst.resolve() == src.resolve():
                if not dst.exists():
                    shutil.copy2(src, dst)
                return dst
            shutil.copy2(src, dst)
            return dst
        except Exception as exc:
            logger.debug('Failed to copy IFC into processed directory: %s', exc)
            return src

    def _default_ifc_surface_defaults(self) -> Dict[str, Optional[str]]:
        asset_catalog.load()

        def pick(options: List[str]) -> Optional[str]:
            for slug in options:
                if asset_catalog.get_material(slug):
                    return slug
            materials = asset_catalog.list_materials()
            return next(iter(materials.keys())) if materials else None

        return {
            'wall': pick(['wall_paint_matte', 'matte_white_paint', 'paint_matte_white']),
            'floor': pick(['floor_oak_modern', 'default_oak_floor', 'floor_oak_polyhaven']),
            'ceiling': pick(['paint_matte_white', 'matte_white_paint']),
        }

    def _populate_ifc_guid_overrides(self, model: Any) -> Dict[str, str]:
        overrides: Dict[str, str] = {}
        defaults = self._catalog_surface_defaults or {}
        for prod in model.by_type('IfcProduct'):
            try:
                guid = getattr(prod, 'GlobalId', None)
                if not guid:
                    continue
                prod_type = (prod.is_a() or '').upper()
                slug: Optional[str] = None
                if prod_type == 'IFCWALL':
                    slug = defaults.get('wall')
                elif prod_type == 'IFCSLAB':
                    slug = defaults.get('floor')
                elif prod_type == 'IFCCOVERING':
                    name = (getattr(prod, 'Name', '') or '').lower()
                    if 'ceiling' in name:
                        slug = defaults.get('ceiling') or defaults.get('wall')
                    elif 'floor' in name:
                        slug = defaults.get('floor')
                    else:
                        slug = defaults.get('wall')
                if slug:
                    overrides[str(guid)] = slug
            except Exception as exc:
                logger.debug('Failed to derive catalog override for product: %s', exc)
                continue

        self._catalog_guid_overrides = overrides
        return overrides

    def _inspect_ifc_lod(self, model: Any) -> Dict[str, Any]:
        try:
            building_elements = model.by_type('IfcBuildingElement')
        except Exception:
            building_elements = []
        elements_with_geom = 0
        for prod in building_elements:
            try:
                if getattr(prod, 'Representation', None):
                    elements_with_geom += 1
            except Exception:
                continue
        try:
            faceted = len(model.by_type('IfcFacetedBrep'))
        except Exception:
            faceted = 0
        try:
            facesets = len(model.by_type('IfcPolygonalFaceSet'))
        except Exception:
            facesets = 0
        try:
            mats = len(model.by_type('IfcRelAssociatesMaterial'))
        except Exception:
            mats = 0
        try:
            spaces = len(model.by_type('IfcSpace'))
        except Exception:
            spaces = 0

        detail_score = elements_with_geom + faceted + facesets
        material_coverage = mats / max(1, elements_with_geom)
        needs_enrichment = detail_score < 40 or material_coverage < 0.35
        lod_level = 'high'
        if needs_enrichment:
            lod_level = 'low'
        elif detail_score < 120:
            lod_level = 'medium'

        return {
            'elementCount': len(building_elements),
            'elementsWithGeometry': elements_with_geom,
            'facetedBreps': faceted,
            'polygonalFaceSets': facesets,
            'materialRelations': mats,
            'spaces': spaces,
            'detailScore': detail_score,
            'materialCoverage': material_coverage,
            'lod': lod_level,
            'needs_enrichment': needs_enrichment,
        }

    def _extract_ifc_elements(self, model: Any) -> List[Dict[str, Any]]:
        elements: List[Dict[str, Any]] = []
        for prod in model.by_type('IfcProduct'):
            try:
                if not getattr(prod, 'Representation', None):
                    continue
                guid = getattr(prod, 'GlobalId', None)
                if not guid:
                    continue
                guid_str = str(guid)
                elem_type = prod.is_a()
                name = getattr(prod, 'Name', '') or ''
                slug = self._catalog_guid_overrides.get(guid_str)
                elements.append({
                    'guid': guid_str,
                    'type': elem_type,
                    'name': name,
                    'layer': '',
                    'lodSource': 'ifc-upload',
                    'catalogSlug': slug,
                })
            except Exception as exc:
                logger.debug('Skipping IFC product during serialization: %s', exc)
                continue
        return elements

    def _build_ifc_statistics(self, elements: List[Dict[str, Any]], lod_report: Dict[str, Any]) -> Dict[str, Any]:
        counts: Dict[str, int] = {}
        for element in elements:
            key = (element.get('type') or 'UNKNOWN').upper()
            counts[key] = counts.get(key, 0) + 1
        lod_metrics = {
            key: lod_report.get(key)
            for key in ('lod', 'detailScore', 'materialCoverage', 'elementCount', 'elementsWithGeometry')
        }
        return {
            'total_elements': len(elements),
            'element_counts': counts,
            'lod_metrics': lod_metrics,
        }

    def _catalog_assignments_from_defaults(self) -> Optional[Dict[str, Any]]:
        if not self._catalog_surface_defaults:
            return None
        return {
            'style': self._current_style_slug,
            'surfaceDefaults': dict(self._catalog_surface_defaults),
            'guidOverrides': dict(self._catalog_guid_overrides),
            'source': 'ifc-upload',
        }

    def _enrich_ifc_model(self, model: Any, lod_report: Dict[str, Any]) -> Dict[str, Any]:
        report = {
            'lod': lod_report.get('lod'),
            'needsEnrichment': True,
            'strategy': 'catalog_defaults',
        }
        self._populate_ifc_guid_overrides(model)
        report['surfaceDefaults'] = dict(self._catalog_surface_defaults)
        report['guidOverrides'] = dict(self._catalog_guid_overrides)
        return report

    def validate_ifc_file(self, file_path: str) -> Dict[str, Any]:
        """Basic IFC validation prior to ingestion."""
        try:
            if not os.path.exists(file_path):
                return {'valid': False, 'error': 'File does not exist'}
            if not file_path.lower().endswith('.ifc'):
                return {'valid': False, 'error': 'File is not an IFC file'}
            import ifcopenshell
            model = ifcopenshell.open(file_path)
            lod = self._inspect_ifc_lod(model)
            if lod.get('elementCount', 0) == 0:
                return {'valid': False, 'error': 'IFC contains no building elements'}
            return {
                'valid': True,
                'lod': lod,
            }
        except Exception as exc:
            logger.error('Error validating IFC file: %s', exc)
            return {'valid': False, 'error': str(exc)}

    def validate_dxf_file(self, file_path: str) -> Dict[str, Any]:
        """Validate DXF file before processing"""
        try:
            if not os.path.exists(file_path):
                return {'valid': False, 'error': 'File does not exist'}
            
            if not file_path.lower().endswith('.dxf'):
                return {'valid': False, 'error': 'File is not a DXF file'}
            
            # Try to parse the file
            self._ensure_dxf_pipeline()

            parsed_dxf = self.dxf_parser.parse_dxf(file_path)
            
            if parsed_dxf.get('success', False):
                stats = parsed_dxf.get('statistics', {})
                layer_counts = stats.get('layer_classifications', {})
                warnings: List[str] = []

                if layer_counts.get('wall', 0) == 0:
                    warnings.append('No wall geometry detected; ensure architectural layers are exported.')
                if layer_counts.get('space', 0) == 0:
                    warnings.append('No room/space annotations detected; add room boundaries before upload.')
                if layer_counts.get('door', 0) == 0 and layer_counts.get('window', 0) == 0:
                    warnings.append('No door/window layers found; openings may be missing from the plan.')

                total_entities = stats.get('total_entities', 0)
                if total_entities and total_entities < 25:
                    warnings.append('DXF contains very few entities (<25); file may be incomplete.')

                bounds = stats.get('bounds', {}) or {}
                if bounds:
                    try:
                        width = abs(bounds.get('max', [0, 0, 0])[0] - bounds.get('min', [0, 0, 0])[0])
                        depth = abs(bounds.get('max', [0, 0, 0])[1] - bounds.get('min', [0, 0, 0])[1])
                        if width == 0 or depth == 0:
                            warnings.append('DXF bounding box collapsed to zero; geometry may be co-linear or corrupt.')
                    except Exception as exc:  # pragma: no cover - defensive guard
                        logger.debug('Bounding box evaluation failed during validation: %s', exc)

                return {
                    'valid': True,
                    'file_info': parsed_dxf.get('file_info', {}),
                    'statistics': stats,
                    'warnings': warnings,
                    'hasWarnings': bool(warnings),
                    'detected_disciplines': stats.get('layer_disciplines', {}),
                    'detected_systems': stats.get('layer_systems', {}),
                }
            else:
                return {
                    'valid': False,
                    'error': parsed_dxf.get('error', 'Unknown parsing error')
                }
                
        except Exception as e:
            logger.error(f"Error validating DXF file: {str(e)}")
            return {'valid': False, 'error': str(e)}
