# Measurement UX Requirements (Phase 2 Seed)

## Primary Personas
- **Agent/Designer**: verifies auto-generated geometry, annotates issues, captures annotated screenshots for developers.
- **Buyer**: checks furniture fit, clearance around fixtures, ceiling heights, and understands pricing impact of finish choices.

## Measurement Modes
1. **Point-to-point**: linear distance with snap to vertices, face centroids, and edge midpoints; display both project units and metric fallback.
2. **Multi-segment path**: chained measurements for corridor runs or stair lengths, cumulative total visible in overlay.
3. **Area**: polygon selection on floor/ceiling surfaces; auto-snap to room boundaries and report net/gross figures.
4. **Volume/Height**: vertical distance calculator for ceiling heights or cabinet clearances, leveraging bounding boxes.
5. **Clearance presets**: quick checks (e.g., 36" walkway, 18" counter clearance) rendered as translucent volumes with pass/fail indicators.

## Interaction Model
- Toolbar docked to the right of the 3D viewer with modes, undo, clear, export.
- Hover tooltips show live measurements while dragging; sticky callouts remain when finalized.
- Keyboard shortcuts (`M` to cycle modes, `Esc` to cancel, `Ctrl+Z` undo last segment).
- Snapping feedback (highlight + audio tick) when locking to catalog asset anchors.

## Data & Pricing Integration
- Persist measurements with scene state (`/api/units/[id]/editor-state`) including measurement type, points, result, tolerance, and user role.
- Allow agents to tag measurements as **pricing drivers** (e.g., custom island surface area) so calculators recompute finish costs off measured value instead of defaults.
- Buyers see delta pricing when measurement exceeds catalog thresholds (e.g., oversize wardrobe triggering surcharge) via real-time notifications.

## Visualization Requirements
- Distinct color palette per role (agent: cyan, buyer: amber) to avoid confusion in shared sessions.
- Support orthographic “Plan Measure” mode overlaying 2D floor plan; results synced with 3D scene markers.
- Measurement list panel with sortable columns (type, value, timestamp, attached note) and quick-select to zoom camera.
- Export to PDF/CSV alongside render captures for closing documentation.

## VR Support
- Controller raycast to initiate points, with haptic feedback on snap.
- Floating wrist panel replicating toolbar; voice command hooks for “measure distance” actions.
- Measurements emit audio cues and appear as floating text in-world; results mirrored back to desktop UI for collaboration.

## Validation & Telemetry
- Unit tests for conversion accuracy and snapping tolerance.
- Analytics events: mode usage, average measurements per session, drop-off by role.
- Feature flag gating (e.g., `enableMeasurements`) to roll out incrementally.

## Implementation Notes
- Build on existing React Three Fiber scene graph; measurement overlay lives in dedicated canvas layer with postprocessing disabled for clarity.
- Reuse pricing service to fetch cost modifiers when measurement metadata changes.
- Coordinate with `Phase 1` enrichment so AI-inferred room polygons expose clean boundaries for area mode.
