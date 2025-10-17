# Phase 4 Export & Audit Notes

_Last updated: $(date +%Y-%m-%d)_

## Current Export Artifacts
- **GLB** — Generated via the FastAPI pipeline (`/api/process/topology` → `callBackendProcess`) and stored on each `FileUpload.glbFilePath` row.
- **IFC** — Same pipeline populates `FileUpload.ifcFilePath`; accessible internally via `/api/files/binary?path=...` when agent-authenticated.
- **Topology JSON** — Written to `file_storage/processed/*_topology.json` for QA (counts, validations, AI enrichment, catalog assignments).
- **IFC Graph JSON** — Optional `*_ifc_graph.json` produced inside `/api/process/topology` for inspection.

## Existing Access Paths
- **REST streaming** — `/api/files/binary` streams raw files when a token (or published listing) is provided.
- **Export bundle API** — `/api/exports/[unitId]` (agents only) returns a ZIP with GLB/IFC/USD/topology, `metadata.json`, `change-log.txt`, and `change-log.pdf`.
- **Agent UI** — Unit details page exposes a “Download Export Bundle” button wired to the new API; editor export controls forthcoming when USD/PDF land.
- **Listing publish flow** — Pre‑publish checklist ensures GLB/IFC presence but does not present export bundles.

## Gaps for Phase 4
1. **Bundled exports** — API foundation now includes USD + PDF; future work is wiring buyer-facing bundles and cost-signoff flows.
2. **USD support** — Backend writes USD files alongside GLB; long term goal is higher-fidelity conversion and validation.
3. **Change log / PDF** — PDF snapshot is in place; enhance with richer pricing breakdown and approval signatures.
4. **Access control** — Buyer-facing exports (after checkout) need scoped tokens; today’s endpoint is agent-only.
5. **Audit trail** — `ExportLog` table now records agent bundle downloads (unit, user, artifact count, metadata). Buyer/export events still need handling.

## Proposed Immediate Tasks
- Design a `/api/export/[unitId]` endpoint producing a zip manifest (metadata + artifacts) with streaming response.
- Extend FastAPI pipeline to output USD (or convert via existing GLB) and stash path in Prisma.
- Draft PDF change-log generator (Node service using topology + selections) to include cost breakdown.
- Wire Agent UI buttons (Unit Details & Editor) to trigger the new bundle download once available.

## Follow-ups
- Explore WebXR/VR handoff only after export tooling stabilizes.
- Add telemetry hooks around export requests for operations monitoring.
- Document export bundle structure (README addition) once implementation lands.
