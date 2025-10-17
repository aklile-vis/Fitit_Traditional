# Modular DXF Processing Architecture

## Overview
The system has been restructured into a modular architecture where 2D to 3D conversion, USD, and IFC generation are organized into dedicated services for better maintainability and scalability.

## Directory Structure

```
src/
├── services/
│   ├── dxf-processor/
│   │   └── dxf-parser.ts          # DXF file parsing service
│   ├── ifc-generator/
│   │   └── ifc-generator.ts       # IFC file generation service
│   ├── usd-generator/
│   │   └── usd-generator.ts       # USD file generation service
│   ├── 3d-converter/
│   │   └── glb-generator.ts       # GLB/3D conversion service
│   ├── file-manager/
│   │   └── file-manager.ts        # File upload and management service
│   └── processing-service.ts      # Main orchestration service
├── app/
│   └── api/
│       ├── process-direct/        # Original direct processing API
│       └── process-modular/       # New modular processing API
└── lib/
    └── direct-processor.ts        # Client-side processing interface
```

## Services

### 1. DXF Processor (`services/dxf-processor/`)
- **Purpose**: Parse DXF files and extract geometry data
- **Key Features**:
  - Extracts LINE, CIRCLE, ARC, POLYLINE, LWPOLYLINE entities
  - Converts geometry to coordinate arrays
  - Calculates bounds and metadata
  - Returns structured JSON data

### 2. IFC Generator (`services/ifc-generator/`)
- **Purpose**: Generate IFC (Industry Foundation Classes) files
- **Key Features**:
  - Creates IFC4 compliant files
  - Generates building structure (Project → Site → Building → Storey)
  - Converts DXF elements to IFC walls
  - Adds proper IFC properties and relationships

### 3. USD Generator (`services/usd-generator/`)
- **Purpose**: Generate USD (Universal Scene Description) files
- **Key Features**:
  - Creates USD 1.0 compliant files
  - Generates 3D scene hierarchy
  - Converts DXF elements to 3D geometry
  - Supports PBR materials and transformations

### 4. 3D Converter (`services/3d-converter/`)
- **Purpose**: Generate GLB (Binary glTF) files
- **Key Features**:
  - Creates 3D meshes from DXF geometry
  - Uses Trimesh for mesh generation
  - Exports to GLB format for web visualization
  - Supports multiple geometry types

### 5. File Manager (`services/file-manager/`)
- **Purpose**: Handle file uploads and storage
- **Key Features**:
  - Secure file upload handling
  - Unique filename generation
  - Directory management
  - File cleanup and maintenance

### 6. Processing Service (`services/processing-service.ts`)
- **Purpose**: Orchestrate all services
- **Key Features**:
  - Coordinates DXF parsing → IFC/GLB/USD generation
  - Progress tracking and error handling
  - Data format conversion
  - Room detection and generation

## Python Backend

### Modular Python Script (`process_dxf_modular.py`)
- **Purpose**: Server-side processing with modular operations
- **Features**:
  - Command-line interface for different operations
  - `--parse-only`: Extract DXF geometry as JSON
  - `--ifc-only`: Generate only IFC files
  - `--glb-only`: Generate only GLB files
  - `--usd-only`: Generate only USD files
  - Full processing: Generate all formats

## API Endpoints

### 1. `/api/process-direct` (Original)
- Uses `process_dxf_standalone.py`
- Full processing in one call
- Returns all generated files

### 2. `/api/process-modular` (New)
- Uses `process_dxf_modular.py`
- Modular processing approach
- Better error handling and progress tracking

## Benefits of Modular Architecture

### 1. **Separation of Concerns**
- Each service has a single responsibility
- Easy to test individual components
- Clear interfaces between modules

### 2. **Scalability**
- Services can be scaled independently
- Easy to add new file formats
- Microservices-ready architecture

### 3. **Maintainability**
- Code is organized by functionality
- Easy to locate and fix issues
- Clear dependencies between modules

### 4. **Reusability**
- Services can be used independently
- Easy to create new processing pipelines
- Shared utilities across services

### 5. **Testing**
- Each service can be unit tested
- Mock dependencies easily
- Integration testing simplified

## Usage Examples

### Client-Side (Frontend)
```typescript
import { directProcessor } from '@/lib/direct-processor';

const result = await directProcessor.processDXFFile(file, (progress) => {
  console.log(`Progress: ${progress.stage} - ${progress.progress}%`);
});
```

### Server-Side (API)
```typescript
import { ProcessingService } from '@/services/processing-service';

const processingService = new ProcessingService();
const result = await processingService.processDXFFile(file, onProgress);
```

### Python Backend
```bash
# Parse DXF only
python process_dxf_modular.py file.dxf --parse-only

# Generate IFC only
python process_dxf_modular.py --ifc-only --elements '[...]' --output-dir ./output

# Full processing
python process_dxf_modular.py file.dxf output/
```

## Future Enhancements

### 1. **Microservices Deployment**
- Deploy each service as separate containers
- Use message queues for communication
- Implement service discovery

### 2. **Additional File Formats**
- Add support for DWG, DGN, STEP files
- Create format-specific processors
- Unified conversion pipeline

### 3. **Cloud Processing**
- Move heavy processing to cloud functions
- Implement job queues
- Add progress tracking via WebSockets

### 4. **Caching Layer**
- Cache processed results
- Implement smart invalidation
- Reduce processing time for repeated files

## Migration Path

The modular architecture is designed to be backward compatible:

1. **Phase 1**: Keep existing `/api/process-direct` endpoint
2. **Phase 2**: Introduce `/api/process-modular` for new features
3. **Phase 3**: Gradually migrate clients to modular API
4. **Phase 4**: Deprecate old endpoints when ready

This ensures smooth transition while providing the benefits of modular architecture.
