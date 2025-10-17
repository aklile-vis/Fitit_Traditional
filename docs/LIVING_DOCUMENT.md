# Modern Real Estate Platform — Living Document

This is the living document for the Modern Real Estate Platform. It explains what the platform is about, what has been done so far, and what we are currently working on. Every working session should start with reviewing and updating this document.

## Primary Objective (Immutable)
- Deliver a professional real estate listing platform where agents upload production-ready 3D BIM or mesh assets (IFC, GLB, GLTF, USD, SKP, OBJ, Blend) and instantly obtain photorealistic, navigable interiors available on web and VR, forming the centerpiece of every listing. 2D DXF assets are parked for a future roadmap once the 3D flow reaches production stability.
- Convert incoming 3D geometry into a richly connected IFC graph (and companion USD/GLB assets) by detecting architectural entities, auto-completing missing structural/MEP elements via AI, and preserving precise dimensions, spatial relationships, and metadata. IFC export is deferred until an explicit publish/export action so editing sessions stay mesh-first.
- Apply production-grade PBR materials, fixtures, lighting, and furniture so the generated scenes reach game-engine quality realism while remaining performant for interactive editing and walkthroughs.
- Equip agents with fullscreen editing workspaces to adjust geometry, materials, lighting, furnishings, capture renders, configure pricing rules, and publish listings backed by curated option catalogs. Interfaces should showcase searchable tables for materials, fixtures, and furniture with buyer availability toggles and price editing modes.
- Empower buyers to explore listings without login, then sign in to customize finishes and furnishings within developer-defined limits, using built-in measuring tools and receiving live price feedback for every change.
- Keep authoritative technical artifacts (IFC, USD, supporting data) in the backend, releasing them only when agents or buyers export originals or final configurations; export bundles must include the detailed BIM file and a locked PDF summarizing every change with cost breakdowns.

- Immersive property marketplace combining listing management, automated BIM enrichment, and photorealistic 3D/VR presentation.
- Agent accounts manage uploads, curated material/furniture catalogs, pricing rules, renders, and publishable listings.
- Robust CAD pipeline: 3D-first ingestion → topology build → GLB/USD assets stored server-side; IFC generation only occurs when an export bundle is requested. DXF parsing utilities are kept in `legacy/dxf/` for future phases and do not participate in the active workflow.
- Editors deliver React Three Fiber experiences with element selection, material swapping, furniture placement, lighting tweaks, measurement tools, render capture, VR mode, and navigation UI that highlights orbit/pan/zoom presets plus floor locking.
- Buyers browse publicly, then log in to customize within developer-defined allowances, track pricing deltas, and export final BIM + PDF packages when ready.

## Architecture Summary
- Frontend: Next.js App Router, React Three Fiber (Three.js) for 3D, Tailwind for styling, Prisma/SQLite for data.
- Backend (Node Next API): Uploads, materials, listings, units, file streaming, selections, and orchestration endpoints (e.g., topology build).
- Backend (Python FastAPI): Robust CAD processing focused on IFC/GLB/OBJ/USD ingestion; SKP/Blend support is in progress. Legacy DXF parsers are sidelined until we revisit 2D automation.

## Key Data Models (Prisma)
- `FileUpload` (ingested files + result paths), `PropertyUnit` (unit and editor state), `UnitListing` (public listing), `MaterialLibrary/MaterialOption` (PBR-ready), `UnitMaterialWhitelist` (per-unit allowed finishes with optional overrides), `BuyerSelection` (saved designs), `User`.

## Project Evaluation — 2025-09-21
- Platform foundation is strong: Next.js agent/buyer flows, R3F viewers, Prisma models, and the FastAPI pipeline already exchange DXF → IFC/GLB/USD artifacts with catalog-driven defaults.
- Photorealism and automation gap: current R3F materials and lighting offer an elevated look but fall short of the game-engine realism, AI-complete fixture placement, and automated finish synthesis promised in the primary objective.
- Buyer tooling gap: the public/buyer viewer supports surface swapping and pricing by area, yet lacks measurement tools, constrained catalogs per room, configuration persistence, checkout, and formal buyer authentication/authorization.
- VR and immersive channel missing: no WebXR mode, headset UX, or performance budgets exist, so immersive walkthroughs remain aspirational.
- Export and reporting incomplete: IFC download hooks exist server-side, but there is no user-triggered export flow, USD packaging, cost delta PDF generation, or change log tying selections to construction deliverables.
- Operational readiness risks: authentication is mocked, pricing logic is simplistic, testing is thin across backend parsers and 3D UI, and there is no monitoring/analytics to support production rollout.
- Repository hygiene: runtime `file_storage/**` artifacts and legacy DXF helpers occupy root space; we need scripts plus gitignore rules to keep only active fixtures.

## What’s Been Done Recently
- Added a direct IFC ingest lane: agent uploads now accept IFC alongside DXF, inspect incoming LOD, and auto-enrich low-detail models with catalog materials before generating GLB/USD assets and topology manifests.
- Kicked off the 3D-first pivot: DXF processing is archived, ingest now prioritises IFC/GLB/GLTF/USD/OBJ, and SKP/Blend handlers are queued for implementation.
- Deprecated the “assumptions” review path in favour of mesh-first editing sessions; IFC generation is now planned as a publish/export operation.
- Archived the DXF CLI/scripts under `legacy/dxf/`, introduced an OBJ-based smoke test (`scripts/smoke_test.py`), and added `fixtures/3d/test_cube.obj` so 3D ingestion can be validated without the DXF toolchain.

## Reliability Watchlist — 2025-09-21
- Three.js alignment: upgraded runtime `three` to `0.180.0` (`package.json:59`) so `@react-three/drei` can load gainmap environments without Turbopack crashing on `LinearSRGBColorSpace`. Reverting will break `/agent/glb-viewer` during local dev; rerun the GLB viewer smoke check after any dependency sync.
- IFC viewer compatibility: dropped the npm `web-ifc-viewer` package—viewer assets now load from `public/libs/web-ifc-viewer/` alongside `web-ifc@0.0.44`. Keep the vendored JS/WASM bundle current or GLB/IFC previews may drift.
- Radix/Leva vs React 19: npm overrides pin Radix subpackages to the React‑19 compatible line (`@radix-ui/*` ≥1.1). If new installs reintroduce warnings, refresh the overrides or update Leva’s dependency graph.
- Mesh ingestion: IFC/GLB/GLTF/OBJ/USD uploads flow through the robust backend—fallback GLB generation, catalog defaults, and topology manifests are written so agents can edit meshes without a DXF precursor. SKP/Blend converters remain on the short-term roadmap.
- Dev port collisions: stray processes previously locked `:3000` (PID 41222), forcing Next.js to hop to 3002–3004. Run `lsof -nP -iTCP:3000` before demos so documentation links and multi-tool scripts resolve correctly.
- Pipeline smoke: `python3 scripts/smoke_test.py` drives OBJ ingestion through `/process-cad`, confirms a GLB artifact is produced, and validates the vendored IFC viewer bundle stays present.
- Secure defaults: server boot now fails without a strong `JWT_SECRET`; keep secrets out of source control and refresh `.env.*` before sharing builds.
- Backend CORS now honours `BACKEND_ALLOWED_ORIGINS` (defaulting to localhost). Update the env var when deploying to staging/prod or multi-domain setups.
- File/IFC streaming routes require agent/admin auth unless a published listing grants access. If downloads break, confirm the requester has a valid session or that the listing remains published.
- Buyer selections now persist BOM-style line items + pricing deltas; `/api/selections` responses include history snapshots so the agent export bundle can mirror buyer choices exactly.

## Legacy DXF Resilience Strategy (Archived)
- Normalize every upload: align units, collapse exploded blocks, and fail fast on collapsed bounds or empty drawings before invoking heavy processing.
- Classify beyond layer names: derive walls, spaces, openings, and structural grids through geometry/topology, then backfill semantics with AI when layers are missing or mislabeled.
- Mine room and fixture intent from text labels, dimensions, and repeated geometry clusters; escalate low-confidence matches for agent review instead of silently accepting them.
- Run AI enrichment on the parsed topology to propose missing slabs, ceilings, MEP runs, and furnishings with confidence scores, injecting only high-confidence results automatically.
- Default the enrichment stack to `gpt-5-mini` for cost control (higher tier models require `OPENAI_ALLOW_EXPENSIVE=true`).
- Surface validation warnings (missing walls/spaces/openings, degenerate extents) directly in the agent upload UI with click-to-confirm reclassification and heatmap overlays.
- Capture every human override as training data so heuristic thresholds and AI models continuously improve on messy DXFs.

- Phase 0 — Workspace hygiene: flush runtime `file_storage/**` artifacts, ensure `gitignore` shields generated assets, and consolidate DXF samples under `legacy/dxf/` to keep the tree focused on 3D workflows.
- Phase 1 — Mesh-first ingestion: wire SKP/Blend conversion via Blender CLI or Assimp, guarantee IFC/GLB/GLTF/USD/OBJ uploads stay performant, and keep DXF modules dormant until reactivated later.
- Phase 2 — Photorealistic interactive editor: refactor the agent/buyer viewers to a shared core with physically based lighting presets, material/fixture/furniture tables (search + price editing + buyer availability), and a navigation toolbar that surfaces orbit/pan/zoom, planar locks, and camera presets.
- Phase 3 — Buyer journey & pricing: deliver real auth/roles, constrain buyer catalogs per space, support configuration save/restore, connect pricing to bill-of-material quantities, and expose developer review flows before publication.
- Phase 4 — Export, VR, and operations: build IFC/USD/PDF export services triggered from publish/export, integrate WebXR or streamed engine (e.g., Unreal Pixel Streaming) for headset walkthroughs, add analytics/monitoring, testing pipelines, and deployment automation.

## What's Been Done Recently
- **Enhanced Listings Marketplace (2025-01-XX)**: Redesigned the listings page with professional card layouts featuring property details (bedrooms, bathrooms, area) with icons, dynamic pricing display, and improved location information. Made "Immersive ready" tags conditional based on `has3D` field, added "Normal listing" tags for non-3D properties, and implemented agent-only visibility for "Publish your listing" button using authentication context.
- **Fixed Location Display Logic**: Resolved critical bug where `subCity` values were being stored in both `city` and `subCity` database fields during listing creation. Updated the review page location parsing to correctly assign address, subcity, and city values, ensuring proper display of location hierarchy (e.g., "Bole, Addis Ababa").
- **Improved Data Consistency**: Implemented case-insensitive deduplication for location display to prevent "Bole, Bole" duplication issues, ensuring clean location presentation across listings page, detail pages, and TraditionalViewer component.
- Hardened agent authentication by replacing mock portal login with the shared JWT flow, wrapping the `/agent` workspace in a role guard, and locking upload/listing/material APIs behind AGENT/ADMIN checks; agent tooling now forwards tokens automatically when calling protected routes.
- Buyer customizer now hides disallowed finishes per surface, enforces catalog slugs client-side, and the `/api/selections` endpoint rejects non-whitelisted materials while recomputing server-trusted pricing before persisting selections.
- Replaced localStorage auth with HttpOnly session cookies and a `/api/auth/session` hydrator so both agent and buyer flows rely on server-verified tokens; `/api/auth/logout` now clears cookies for consistent sign-out.
- Buyer customizer displays backend-calculated line items after each save, showing base price, upgrade subtotals, and synch status directly from `/api/selections`.
- Measurement tooling gained axis snapping, undo/redo history, and JSON export controls; developer review gating is now enforced before publish with dedicated UI + API workflows.
- Captured Phase 4 export audit (`docs/PHASE4_EXPORT_AUDIT.md`) outlining current GLB/IFC/topology outputs, access paths, and the missing USD/PDF bundle work.
- Added `/api/exports/[unitId]` ZIP bundling for agents (GLB/IFC/topology + metadata) with export logging (`ExportLog` model) and Download buttons in unit details.
- Export bundles now include buyer selection snapshots (`change-log.txt`) and a USD placeholder; telemetry logs persist metadata, and VR/ops roadmap captured under `docs/PHASE4_VR_OPS.md`.
- Backend now writes real USD assets (placeholder file replaced by processor output) and emits bundled PDF change logs via `pdf-lib`; export telemetry append to `file_storage/telemetry.log`, and WebXR beta toggle is live in the buyer viewer per Phase 4 roadmap.
- Seeded the Phase 2 asset catalog with synthetic PBR materials, fixture proxies, and the `modern_multi_room` style via `python scripts/seed_demo_assets.py`; the backend catalog loader now reports 8 materials, 5 fixtures, and 2 room styles ready for assignment.
- Fixed the IFC generator to aggregate `IfcSpace` entities through `aggregate.assign_object`, unblocking native IFC export so downstream catalog metadata and topology JSON persist without forcing STEP fallbacks.
- Hardened the IFC→GLB exporter so `ifcopenshell.geom` tessellates successfully and catalog textures survive (guard against zero-thickness walls and handle texture visuals without vertex colors).
- Wired the agent editor and buyer-facing customizer to read GLB catalog extras, pre-populate catalog assignments, surface base material slugs directly in the UI, and auto-map catalog defaults onto whitelist options for pricing baselines.
- Persisted GLB catalog outputs (`*_assets.json`) capturing material + fixture manifests for each run, and tightened measurement tooling with inline undo to support the Phase 2 workflow polish.
- Purged redundant archives, venvs, node modules, and generated assets so the workspace only retains purposeful source directories.
- Upgraded the DXF parsing pipeline with multi-discipline layer analysis, validation warnings, and documented AI inference + measurement UX requirements to kick off Phase 1.
- Re-provisioned frontend/backend dependencies after cleanup and validated the enhanced DXF warnings on `test_house_improvements.dxf` (now archived under `legacy/dxf/`) to document the legacy flow before pivoting to 3D-first ingestion.
- Added a shapely-backed adjacency pass so the extractor outputs wall/space relationship graphs for downstream AI and QA tooling (reports gracefully when spaces are absent).
- When DXFs arrive without explicit room polygons we now synthesize fallback spaces from wall loops, restoring adjacency data for AI enrichment and editor tooling.
- Agent editor now surfaces room adjacency summaries (area, neighbouring spaces, generated-room badges) fed directly from the topology API payload.
- Pricing logic falls back to room areas/wall lengths when mesh coverage is missing, so generated rooms still receive material cost estimates, and topology validations flag uploads where every room is auto-generated.
- Topology validations (eg. `roomsGenerated`, `hasOnlyGeneratedRooms`) flow through the API and agent UI so the pre-publish checklist can flag uploads needing manual review.
- Sidebar refactored into collapsible panels for selection, catalog prep, pricing, assumptions, measurement tooling, AI defaults, and cameras to streamline agent workflow.
- Measurement tools scaffold (distance/area/volume/clearance) now lives in the agent sidebar, preparing for interactive capture workflows.
- Interactive measurement overlay renders in-scene rulers and area outlines with real-time readouts tied to the toolbar selections.
- Pre-publish checklist consumes topology validations (rooms generated, IFC metrics) so agents cannot publish without confirming base assets and reviewer checks.
- Delivered a cross-app visual refresh: gradient shell, glass header/footer, modernized home/listing/login screens, and consistent design tokens for buttons, inputs, and cards.
- Fixed Next.js build break (homepage JSX) after the redesign sweep.
- Rebuilt agent GLB viewer, IFC viewer, and DXF upload flow: direct asset resolution (fileId/unit/listing), modern canvas UI, and end-to-end DXF→IFC/GLB pipeline with topology persistence.
- Patched agent viewers to stream GLB/IFC via Next API (no more absolute path fetches) and load `web-ifc-viewer` from local deps (add `web-ifc`, `web-ifc-viewer` and run `npm install`) so Turbopack builds cleanly offline.
- Upgraded pipeline + viewer fidelity: every extracted space now gets synthetic floor/ceiling elements, the 3D scene boots with an interior camera rig, and default materials use high-res wood/brick/marble/fabric textures shipped in `public/textures/` for a photo-real baseline. IFC viewer still supports CDN loading, but for offline mode drop `web-ifc-viewer.esm.js` under `public/libs/` and `web-ifc.wasm` under `public/wasm/`.
- Added optional GPT-5 mini enrichment: set `OPENAI_API_KEY`/`OPENAI_MODEL` in `.env.local` to unlock AI room/material/camera suggestions. Upload flow shows AI insights and topology JSON now stores them for downstream tools.
- GLB exporter now generates textured meshes straight from the produced IFC (wood/brick/fabric presets) and inserts AI camera bookmarks directly into the file; doors/windows get placeholder geometry so the viewer has real fixtures.
- Hardened the IFC-driven GLB exporter so the new textured/camera pipeline executes reliably (fixed try/except indentation and restored math utilities for camera quaternions).
- Wired the agent customizer to load IFC-driven GLBs, read mesh GUID metadata, and surface AI room/camera defaults so recommended finishes apply in one click.
- Legacy DXF regression run (archived) confirmed GUID extras landed in GLB meshes and informed the current IFC/mesh enrichment approach.
- Vendored `web-ifc-viewer` + `web-ifc.wasm` locally so the IFC viewer works offline/Turbopack without hitting the CDN.
- Created the asset catalog data model + loader and seeded starter manifests; catalog defaults now flow into topology results for upcoming interior automation.
- Generated local synthetic assets (`python scripts/seed_demo_assets.py`) so we have PBR placeholders and fixture proxies without relying on external downloads; exporter/editor now surface catalog metadata.
- Replaced fragmented GLB viewers with a single robust 3D stack using React Three Fiber (Three.js) for both agent editor and buyer viewer.
- Implemented PBR-ready materials (albedo/normal/roughness/metalness/AO + tiling) and applied them in viewer/editor.
- Added topology‑first pipeline: `POST /api/process/topology` calls the robust backend, saves `topology.json`, GLB, IFC, and `ifc_graph.json` for inspection.
- Pre‑publish checklist enforcing GLB/IFC presence, whitelist coverage, listing metadata, cover image (render), and camera bookmark.
- Render flow: client-side snapshots and bulk auto renders; covers set on listing via `/api/renders`.
- Legacy “assumptions” heuristics/UI slated for removal; flows now bypass that step so agents stay in the material/fixture editors before export.
- Listings-first UX; legacy Properties pages now redirect.

## Current Focus (Today)
1. Ship mesh-first editing: remove legacy assumption/checklist pages, confirm IFC export only triggers during publish, and retheme agent/buyer workspaces to the white + dark brown system.
2. Implement navigation upgrades: add orbit/pan/zoom toolbar overlays, lockable floor plane controls (XY at z=0), and camera presets aimed at non-technical users across agent and buyer viewers.
3. Spike SKP/Blend ingestion: prototype Blender CLI/Assimp conversions, capture gaps, and update the backend mesh pipeline so these formats reach parity with IFC/GLB/OBJ/USD.

### Mesh-First Engineering Package
1. **Prune legacy flows** — Remove `/agent/units/[id]/assumptions`, checklist follow-up pages, and any references to automatic assumptions capture. Ensure publish flows simply confirm listing details before export triggers IFC packaging.
2. **Retheme shared components** — Replace dark blue glassmorphism with the white primary / dark brown accent palette across `src/components/3D/*`, global layout headers, and the agent/buyer dashboards; document new tokens in Tailwind config.
3. **Navigation toolbar** — Introduce reusable UI elements for orbit/pan/zoom, preset cameras, and floor locking (XY plane at z=0 with constrained X/Y rotation) that render in both agent and buyer viewers.
4. **SKP/Blend spike** — Wrap Blender CLI or Assimp to convert SKP/Blend uploads into GLB + IFC-ready meshes, capture conversion metrics, and expose feature flags for fallbacks while format parity stabilises.
5. **Backend pipeline refactor** — Keep DXF processors dormant by default, ensure `process_mesh_file` handles new conversions, and move IFC generation into the export bundle service so editing sessions remain mesh-only.

## Theming Refactor (In Progress)
- Introduced sand-first design tokens and surface utilities in `src/app/globals.css`, including overlay variants so dark glass components can migrate without contrast loss.
- Converted shared chrome (`src/components/Layout/Header.tsx`, `Footer.tsx`, `Layout.tsx`) to the new palette and gradients, removing hard-coded glass blues.
- Refreshed the public home flow (`src/app/page.tsx`) with sand surfaces, updated chips, and elevated card shadows as the first migrated experience.
- Brought the agent studio into the sand theme: Dual View overlays, GLB loaders, processing indicators, uploads, login, and content curation screens now consume shared surface/overlay tokens (`src/components/agent/*`, `src/app/agent/upload/page.tsx`, `src/app/agent/unified-upload/page.tsx`, `src/app/agent/login/page.tsx`, `src/app/agent/materials-manager/page.tsx`, `src/app/agent/files-explorer/page.tsx`, `src/app/agent/glb-viewer/page.tsx`, `src/app/agent/editor/[id]/page.tsx`).
- Extended the sand palette to dashboard stats, quick upload, and layer mapping tools (`src/app/agent/dashboard/page.tsx`, `src/app/agent/upload-simple/page.tsx`, `src/app/agent/layers/page.tsx`), aligning badges/progress indicators with the shared semantic tokens.
- Completed the remaining agent viewer surfaces: models listing, IFC viewer shell, and auto-render workflow now use sand/overlay tokens (`src/app/agent/models/page.tsx`, `src/app/agent/ifc-viewer/page.tsx`, `src/app/agent/units/[id]/render/page.tsx`, `src/app/agent/viewer/[id]/page.tsx`).
- Swept the remaining agent tools (unit materials whitelist, IFC graph, quick upload, models list) into sand/dark tokens so no blue glass or invisible text remains (`src/app/agent/units/[id]/materials/page.tsx`, `src/app/agent/units/[id]/ifc-graph/page.tsx`, etc.).
- Remaining focus: sweep secondary agent tools (materials manager, quick upload, legacy tables) and buyer dashboards for lingering dark-glass classes, then tune success/error ribbons to shared semantic tokens.

## Next Objectives (Upcoming)
- Continue migrating agent/editor flows to sand theme tokens (DualViewSystem surface panels, Details panels, catalog tables, upload pages) and audit overlays for dark-mode fallbacks.
- Harden SKP/Blend ingestion with automated tests and documented conversion fallbacks.
- Build export-time IFC/USD packaging with cost breakdown PDFs tied to buyer selections.
- Connect pricing to quantity takeoffs/BOM output so saved selections drive cost tracking.
- Implement buyer save/restore UX with authenticated API calls and audit history.
- Introduce agent/buyer role dashboards with approval queues before listings go live.
- Optional: server-side/CI renders (Puppeteer driving R3F scenes) for deterministic marketing imagery.
- Optional: feature‑flag LLM assistance (layer semantics, room labels, IFC QA) with clear human-in-the-loop review.

## Repository Hygiene Plan
- Script a `npm run clean:artifacts` (or Make target) that prunes `file_storage/**`, `backend/file_storage/**`, `.next/`, and other generated outputs while preserving committed fixtures.
- Extend `.gitignore` so runtime models, processed assets, and sqlite scratch DBs never reappear in diffs; relocate any must-keep samples into `fixtures/`.
- Consolidate file storage to a single root (prefer project-level `file_storage/`) and mount the backend to that path to avoid duplicate artifact hierarchies.
- Sweep for lingering archives or stray DXF helpers outside `legacy/dxf/`; relocate or delete to keep the repo clearly 3D-first.

## How To Run
- Frontend: `npm run dev`
- Backend (robust CAD): `npm run backend:dev` (FastAPI must be running for topology/IFC/GLB flows)
- Database: Prisma/SQLite; `npm run db:push` after schema changes.

## Demo Accounts
- Agent: `agent@example.com / password` (seed with `npm run seed:demo-users`)
- Buyer: `user@example.com / password` (seed with `npm run seed:demo-users`)

## Important Endpoints
- `POST /api/process/topology` → build topology/GLB/IFC; writes artifacts to `file_storage`.
- `GET /api/files/binary?path=...&listingId=...` → secure asset streaming for published listings.
- `GET/POST /api/materials/...`, `GET/POST/DELETE /api/units/[id]/materials` → material libraries and per-unit whitelist.
- `POST /api/renders` → upload a PNG and (optionally) set listing cover image.
- `GET/PUT /api/units/[id]/editor-state` → persist viewer/editor state (camera bookmarks, selections).

## Session Reminder
When we start a new working session:
1. Open this document (docs/LIVING_DOCUMENT.md) and skim “What’s Been Done Recently” and “Current Focus (Today)”.
2. Confirm the backend FastAPI is running (for topology/IFC/GLB) and that seeded materials exist.
3. Proceed with the top priority under “Next Objectives (Upcoming)”, and update this document at the end of the session.
