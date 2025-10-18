from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
import uvicorn
import logging
import os
import sys

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))
from backend.robust_processor import RobustProcessor
from backend.dxf_parser import DXFParser

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="3D Asset Processing API", version="3.0.0")

# CORS middleware
def configure_allowed_origins() -> list[str]:
    raw = os.getenv('BACKEND_ALLOWED_ORIGINS', '')
    origins = [origin.strip().rstrip('/') for origin in raw.split(',') if origin.strip()]
    if not origins:
        origins = ['http://localhost:3000', 'http://127.0.0.1:3000']
    return origins


allowed_origins = configure_allowed_origins()
logger.info("Configuring CORS allowed origins: %s", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Serve generated artifacts locally (GLB/IFC/USD, status files)
try:
    static_root = Path(__file__).parent.parent / 'file_storage'
    static_root.mkdir(parents=True, exist_ok=True)
    app.mount('/files', StaticFiles(directory=str(static_root), html=False), name='files')
except Exception as e:
    logger.warning(f"Could not mount static files: {e}")

# Initialize robust processor
processor = RobustProcessor()

class ProcessCadRequest(BaseModel):
    filePath: str
    userId: str

class FileUploadRequest(BaseModel):
    filename: str
    fileSize: int
    userId: str

@app.get("/")
async def root():
    return {
        "message": "3D Asset Processing API is running",
        "version": "3.0.0",
        "features": [
            "IFC ingestion with enrichment",
            "GLB/GLTF/OBJ/USD normalization",
            "SKP/Blend staging (experimental)",
            "Local file storage",
            "Catalog + manifest generation"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        stats = processor.get_storage_statistics()
        return {
            "status": "healthy",
            "storage_stats": stats,
            "processor_ready": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "processor_ready": False
        }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user_id: str = "default"):
    """Upload and stage 3D design files"""
    try:
        allowed = ('.ifc', '.glb', '.gltf', '.obj', '.fbx', '.usd', '.usdz', '.skp', '.blend')
        if not file.filename.lower().endswith(allowed):
            raise HTTPException(status_code=400, detail="Supported formats: IFC, GLB/GLTF, USD/USDZ, OBJ/FBX, SKP, BLEND")
        
        # Read file content
        content = await file.read()
        
        # Save file using robust storage
        file_info = processor.storage.save_uploaded_file(content, file.filename, user_id)
        
        logger.info(f"File uploaded: {file.filename} -> {file_info['file_id']}")
        
        return {
            "message": "File uploaded successfully",
            "file_id": file_info['file_id'],
            "file_path": file_info['file_path'],
            "file_size": file_info['file_size'],
            "status": "uploaded"
        }
        
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process-cad")
async def process_cad(request: ProcessCadRequest):
    """Process CAD file using robust processing pipeline"""
    try:
        file_path = request.filePath
        user_id = request.userId
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        logger.info(f"Starting robust processing: {file_path} for user: {user_id}")
        
        suffix = Path(file_path).suffix.lower()

        if suffix == '.ifc':
            validation = processor.validate_ifc_file(file_path)
            if not validation['valid']:
                raise HTTPException(status_code=400, detail=f"Invalid IFC file: {validation['error']}")
            result = processor.process_ifc_file(file_path, user_id)
        elif suffix in {'.glb', '.gltf', '.obj', '.fbx', '.usd', '.usdz', '.skp', '.blend'}:
            result = processor.process_mesh_file(file_path, user_id)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Provide IFC or 3D mesh inputs (GLB/GLTF, USD/USDZ, OBJ/FBX, SKP, BLEND).")
        
        if not result['success']:
            return JSONResponse(status_code=500, content={
                'success': False,
                'error': result.get('error', 'Processing failed'),
                'stepsCompleted': result.get('steps_completed', 0)
            })
        
        # Write results to a simple status file for compatibility
        status_file = f"file_storage/status/{Path(file_path).stem}_status.txt"
        os.makedirs(os.path.dirname(status_file), exist_ok=True)
        with open(status_file, 'w') as f:
            f.write("SUCCESS\n")
            f.write(f"Elements: {len(result.get('elements', []))}\n")
            f.write(f"IFC: {result.get('ifc_path', 'N/A')}\n")
            f.write(f"GLB: {result.get('glb_path', 'N/A')}\n")
            f.write(f"USD: {result.get('usd_path', 'N/A')}\n")

        # Return structured JSON
        payload = {
            'success': True,
            'ifcPath': result.get('ifc_path'),
            'glbPath': result.get('glb_path'),
            'usdPath': result.get('usd_path'),
            'elementsCount': len(result.get('elements', [])),
            'report': result.get('report'),
            'summaryPath': status_file,
            'ai_enrichment': result.get('ai_enrichment'),
            'glbMaterials': result.get('glb_materials'),
            # Include elements and limited parsed data for client-side visualization
            'elements': result.get('elements', []),
            'statistics': result.get('statistics', {})
        }
        try:
            return JSONResponse(content=payload)
        except Exception as e:
            # As a safety net, strip potentially non-serializable fields
            logger.warning(f"Non-serializable content in response, stripping details: {e}")
            safe_payload = {
                'success': payload['success'],
                'ifcPath': payload['ifcPath'],
                'glbPath': payload['glbPath'],
                'usdPath': payload['usdPath'],
                'elementsCount': payload['elementsCount'],
                'summaryPath': payload['summaryPath']
            }
            return JSONResponse(content=safe_payload)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing CAD file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{file_id}")
async def get_processing_status(file_id: str):
    """Get processing status for a file"""
    try:
        status = processor.get_processing_status(file_id)
        return status
    except Exception as e:
        logger.error(f"Error getting processing status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files/{user_id}")
async def list_user_files(user_id: str):
    """List all files for a user"""
    try:
        files = processor.list_processed_files(user_id)
        return {"files": files}
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/storage/stats")
async def get_storage_statistics():
    """Get storage statistics"""
    try:
        stats = processor.get_storage_statistics()
        return stats
    except Exception as e:
        logger.error(f"Error getting storage statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cleanup")
async def cleanup_old_files(days_old: int = 30):
    """Clean up old files"""
    try:
        processor.cleanup_old_files(days_old)
        return {"message": f"Cleaned up files older than {days_old} days"}
    except Exception as e:
        logger.error(f"Error cleaning up files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/validate")
async def validate_dxf_file(file_path: str):
    """Validate DXF file"""
    try:
        validation = processor.validate_dxf_file(file_path)
        return validation
    except Exception as e:
        logger.error(f"Error validating file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_dxf(file_path: str):
    """Return a validation/analysis report explaining classification results."""
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        parser = DXFParser()
        parsed = parser.parse_dxf(file_path)
        # Build a basic report with reasons
        report = {
            'file_info': parsed.get('file_info', {}),
            'bounds': parsed.get('bounds', {}),
            'layers': list(parsed.get('layers', {}).keys()),
            'layer_classifications': {k: v.get('classification') for k, v in parsed.get('layers', {}).items()},
            'entity_types': parsed.get('statistics', {}).get('entity_types', {}),
            'total_entities': parsed.get('statistics', {}).get('total_entities', 0),
        }
        # Heuristics: list unmapped layers with entities
        unmapped = []
        for name, info in parsed.get('layers', {}).items():
            if info.get('entity_count', 0) > 0 and info.get('classification') == 'other':
                unmapped.append(name)
        report['unmapped_layers'] = unmapped
        return JSONResponse(content={'success': True, 'report': report})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/parse")
async def parse_dxf(file_path: str):
    """Return parsed DXF data (layers, entities, bounds) in JSON-safe form."""
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        parser = DXFParser()
        parsed = parser.parse_dxf(file_path)
        # Optionally limit entities to avoid huge payloads
        entities = parsed.get('entities', [])
        if len(entities) > 3000:
            entities = entities[:3000]
        return JSONResponse(content={
            'success': True,
            'layers': parsed.get('layers', {}),
            'entities': entities,
            'bounds': parsed.get('bounds', {}),
            'statistics': parsed.get('statistics', {}),
            'file_info': parsed.get('file_info', {})
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
