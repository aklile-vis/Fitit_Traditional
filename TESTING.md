# Testing Guide

This project now centres on a 3D-first workflow. The checks below validate the ingestion of IFC/GLB/GLTF/OBJ/USD/SKP/Blend assets through the FastAPI backend and Next.js frontend.

## 0) Prerequisites
- Python 3.10+
- Node.js 18+
- `pip` and `npm` available on your PATH

## 1) Install dependencies
- Backend (Python):
  - `cd backend && python3 -m pip install -r requirements.txt && cd ..`
- Frontend (Node):
  - `npm install`
- Database (Prisma):
  - `npm run db:generate`
  - `npm run db:push`

## 2) Start services
Open two terminals:
- **Terminal A (backend)**: `npm run backend:dev` — FastAPI on http://localhost:8000
- **Terminal B (frontend)**: `npm run frontend:dev` — Next.js on http://localhost:3000

## 3) Quick health checks
- Backend: `curl http://localhost:8000/health`
  - Expect `{ "status": "healthy", ... }`
- Frontend: open http://localhost:3000

## 4) Automated smoke test
- Run `python3 scripts/smoke_test.py`
  - Uses `fixtures/3d/test_cube.obj`
  - Calls `POST /process-cad`
  - Confirms a GLB artifact is written and the vendored IFC viewer bundle is present
  - Fails fast if the backend health check does not return `healthy`

## 5) Process a model via HTTP
- Upload with curl (example using the OBJ fixture):
  ```bash
  curl -X POST http://localhost:3000/api/upload-simple \
       -F "file=@fixtures/3d/test_cube.obj"
  ```
- Take the returned `filePath` and trigger processing:
  ```bash
  curl -X POST http://localhost:8000/process-cad \
       -H 'Content-Type: application/json' \
       -d '{"filePath":"<absolute_path>","userId":"cli"}'
  ```
- The JSON response includes `glbPath` (and optionally `usdPath`/`ifcPath`).

## 6) View models in the app
- Visit `/agent/glb-viewer?src=<absolute_glb_path>` (requires agent login)
- GLB/IFC/USD assets served from `file_storage/models` remain accessible via `/api/files/binary` once authenticated.

## 7) Manual UI check
- Sign in as the demo agent (see `docs/LIVING_DOCUMENT.md` for credentials)
- Upload IFC/GLB/OBJ/USD/SKP/Blend files through `/agent/upload`
- Ensure the material/fixture/furniture tables render and the new pricing toggle behaves as expected (after the UI refresh is completed).

## Troubleshooting
- **Backend dependency errors**: re-run `python3 -m pip install -r backend/requirements.txt`
- **Unsupported format**: verify the extension is one of IFC/GLB/GLTF/OBJ/USD/USDZ/SKP/BLEND; DXF/DWG intake is archived for later.
- **Viewer not loading**: make sure the GLB path is absolute and points to `file_storage/models` or `processed`.
- **Auth issues**: use the seeded demo credentials and read the token from local storage if needed.
