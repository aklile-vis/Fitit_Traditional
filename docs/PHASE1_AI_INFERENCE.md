# Phase 1 — AI Inference Requirements

## Goal
Establish the intelligence layer that fills gaps left by raw DXF input so the generated IFC/GLB assets are construction-ready. The AI must interpret architectural intent, propose missing elements, and attach metadata that downstream editors rely on.

## Scope of Inference
- **Structural complements**: detect missing slabs, ceilings, columns, beams, cores, and shafts based on walls/grids.
- **Openings & circulation**: reconcile door/window positioning, infer swing direction, generate stair/railing geometry when only footprints exist.
- **MEP utilities**: approximate plumbing stacks, HVAC diffusers/duct trunks, electrical panels, lighting layouts from room semantics and catalog defaults.
- **Interior finishes**: assign baseline materials to surfaces with confidence scores tied to catalog entries.
- **Space semantics**: classify rooms/zones (kitchen, bath, bedroom, corridor) to drive fixture placement and pricing models.

## Required Inputs
- Tokenized layer metadata (`classification`, `discipline`, `tags`, `confidence`) from the enhanced DXF parser.
- Cleaned geometry primitives (lines, arcs, polylines) grouped by element candidates from the extractor.
- Spatial relationships: wall adjacency graph, room polygons, bounding boxes, and story elevation assumptions.
- Catalog manifests (fixtures, materials, parametric assets) with dimensional rules and placement constraints.
- Historical inference traces (when available) to continuously refine confidence thresholds.

## Output Contract
- Serialized AI report attached to `topology.json` containing:
  - `inferredElements`: list of proposed IFC entities with GUID seeds, category, geometry payload, and confidence.
  - `adjustments`: modifications to detected geometry (e.g., door width normalization) with reason strings.
  - `spaceClassification`: per `IfcSpace` label, program type, occupancy hints.
  - `materialSuggestions`: surface GUID → catalog material IDs with rank + score.
  - `qa_flags`: anomalies requiring human review (gaps, overlaps, impossible dimensions).
- Export helper to merge accepted inferences into the IFC graph (`ifc_graph.json`) and GLB meshes.
- The enrichment service defaults to the cost-optimised `gpt-5-mini` model and will only use higher tier models when `OPENAI_ALLOW_EXPENSIVE=true` is explicitly set.
- `relationships`: adjacency graph (spaces ↔ walls/spaces) derived from the extractor to guide furnishing, lighting, and circulation suggestions.

## Processing Pipeline
1. **Feature assembly**: build per-room feature vectors (surface counts, dimensions, adjacency, layer tags, text labels).
2. **Category models**:
   - Rule-first heuristics for deterministic elements (e.g., slab thickness, corridor lights).
   - ML classifiers/LLMs for fuzzy labeling (room type, finish selection).
   - Generative geometry templates (procedural furniture, stair runs) parameterized by room metrics.
3. **Conflict resolution**: detect clashes with original geometry, respect clearance codes, filter low-confidence (<0.5) suggestions.
4. **Persistence**: write enrichment bundle, update catalog usage stats, expose telemetry for monitoring accuracy.

## Acceptance Criteria
- Minimum recall of 90% on wall/door/window validation across regression DXFs without introducing hard clashes.
- At least one plumbing fixture + lighting suggestion per wet zone with confidence ≥0.6.
- End-to-end runtime budget ≤ 90 seconds for 50-room DXF on reference hardware.
- All outputs serializable and reviewable via agent tooling (AI insight drawer).

## Next Steps
- Curate labeled DXF → IFC pairs to seed evaluation set.
- Define schema adapters so AI outputs can be toggled on/off per project.
- Instrument telemetry hooks (`ai_enrichment`) for success/error tracking and manual overrides.
