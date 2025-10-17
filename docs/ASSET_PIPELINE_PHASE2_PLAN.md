# Phase 2 — Asset & Material Pipeline Prototype

This document captures the concrete scope and design choices for the “Step 2” milestone: prototyping a richer asset/material pipeline and enhancing IFC generation to emit high-fidelity interiors.

## Objectives

1. **Curate structured, reusable content** suitable for procedural interior assembly (materials, fixtures, furniture, lighting).
2. **Extend backend data + storage models** to reference those assets and expose them to the processing pipeline.
3. **Modify IFC/GLB generation** so exported scenes contain high-LOD geometry, PBR material assignments, and GUID metadata referencing the new catalog.
4. **Lay the groundwork for editor roundtrip** by tracking which assets/materials were applied per IFC GUID.

## Deliverables

### D1. Data Model Extensions (Prisma)
- `AssetCategory` (e.g., wall_finish, floor_finish, sofa, lighting).
- `Asset` (logical item: unique ID, category, default metadata, preview renders).
- `AssetVariant` (links to actual geometry/material resources, size variants, price, tags).
- `MaterialProfile` (collection of PBR textures + scalar properties).
- `RoomStylePreset` (mapping of default assets/materials per room archetype).
- Bridge tables for availability (`AssetVariantMaterial`, `RoomStylePresetMaterial`).

> **Note:** Keep schema modular; initial implementation can be minimal (wall/floor/ceiling materials + one furniture class) to stay shippable.

### D2. Asset Storage Layout
```
public/assets/
  materials/<slug>/
    material.json        # scalar props (roughness, normal strength, tiling)
    albedo.jpg
    normal.jpg
    roughness.jpg
  fixtures/<slug>/
    model.glb            # canonical mesh
    preview.png          # thumbnail
    metadata.json        # placement hints (footprint, default rotation)
  packs/<room-style>/
    manifest.json        # references to materials + fixtures
```
- Provide tooling (scripts or manual instructions) for adding new assets.
- Use `python scripts/seed_demo_assets.py` to generate lightweight placeholder
  materials and fixtures (self-contained textures and GLB proxies) for local
  development. Swap these files with high-fidelity CC0 assets when ready.
- Ensure hashed filenames (content-addressable) or `version` field for cache busting.

### D3. Backend API & Processing Enhancements
- Loader utilities reading `material.json`/`metadata.json` into in-memory catalog.
- `RobustProcessor` modifications:
  - When an IFC is provided: respect existing geometry/materials, but enrich metadata (guid → catalog reference if possible).
  - When only DXF/topology: instantiate room presets (from `RoomStylePreset`) → place fixture meshes into GLB & IFC.
  - Attach PBR material parameters to both GLB (Three.js-compatible) and IFC (IfcSurfaceStyle / IfcMaterialLayerSet).
  - Persist per-GUID assignments in `glb_materials` and new `glb_assets` fields.
- Optional: background baking step for high-LOD GLB (e.g., decimate vs. full detail toggles).

### D4. Service Interfaces
- `/api/assets` (list/search catalog) – eventually consumed by the editor.
- Update `/api/process/topology` response: include `guidAssets`, `roomStyle` references.
- Store derived data in `file_storage/processed/<stem>_assets.json` (future diffs).

## Implementation Steps

1. **Design Schema Migration**
   - Draft Prisma models & relationships.
   - Create migration with seed placeholders for MVP assets (e.g., `default_oak_floor`, `white_paint`, `sofa_modern_01`).

2. **Asset Loader Module**
   - New backend module `asset_catalog.py` that reads `public/assets` manifests.
   - Provide caching & validation (log missing textures, mismatched metadata).

3. **IFC/GLB Assembly Updates**
   - Extend `RobustProcessor` to pull defaults from `RoomStylePreset`.
   - For each room element, choose appropriate material/fixture variant (initial heuristics: by room type, area, wall orientation).
   - Inject fixture meshes into GLB (using trimesh assembly) and into IFC (IfcFurnishingElement proxies positioned with transformation matrices).

4. **Metadata Persistence**
   - Expand `glb_materials` to include `catalogId` (material/asset slug) and `variantId`.
   - Track placements in new structure `glb_assets` with GUID, transform, asset references.

5. **Validation & Diagnostics**
   - Add processor logs summarizing applied assets/materials.
   - Write test harness (CLI or script) to run pipeline on sample DXFs and inspect outputs.

## Open Questions / Follow-ups
- How to manage asset scaling/orientation across different units? (Need footprint metadata + placement rules.)
- Lighting strategy (baked vs. dynamic). Possibly incorporate light proxies into IFC & GLB.
- Versioning: determine whether assets are immutable once referenced in published listings.
- Editor write-back: future step ensuring material/fixture swaps trigger updates to IFC/GLB manifests.

---

This plan serves as the blueprint for Step 2 execution. Next action is implementing **D1 + D2**: schema migration and initial catalog loader.
