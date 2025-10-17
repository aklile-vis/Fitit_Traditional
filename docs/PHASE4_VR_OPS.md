# Phase 4 VR & Operations Planning

_Last updated: $(date +%Y-%m-%d)_

## VR / Immersive Roadmap
- **WebXR Viewer (MVP)**
  - ✅ Initial toggle lives in listings viewer using `@react-three/xr` (controllers + hands).
  - Next: define mobile/performance budgets (draw calls, texture sizes) and fallbacks.
  - Add VR-friendly navigation (teleport, gaze cursors) and simplified UI overlays.
- **High-fidelity walkthroughs**
  - Evaluate Unreal/Unity streaming (Pixel Streaming) for marketing-grade visuals.
  - Map asset hand-off requirements (USD/USDZ, baked lighting) from export pipeline.
  - Capture headset QA plan (Quest 3, Vision Pro, high-end PC VR).
- **Content pipeline**
  - Automate LOD generation to keep VR framerates stable.
  - Annotate exports with VR metadata (spawn points, nav meshes) for ingestion.

## Operational Readiness
- **Export Telemetry**
  - Instrument `/api/exports/*` usage (per unit, per role, success/failure) into analytics store.
  - Expose export logs in admin dashboard for audit and support.
- **Alerts & Monitoring**
  - Add health checks/pings for FastAPI processor (USD/IFC generation) and flag job backlog.
  - Integrate log aggregation (e.g., OpenTelemetry) for backend pipelines.
- **Testing & Deployment**
  - Extend CI to run export smoke tests (bundle creation, metadata integrity).
  - Schedule nightly pipeline regression on fixture DXFs and record metrics.
  - Automate static analysis/lint gating to keep VR/exports code quality consistent.

## Next Steps
1. Ship USD generation in the backend, update `/api/exports` to include real assets.
2. Prototype WebXR mode with constrained scene (single unit) and measure FPS on Quest.
3. Implement export telemetry ingestion + admin review page for ops visibility.
