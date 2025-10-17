# Auto‑Assumptions (Human-in-the-Loop)

Generated: 2025-09-14T12:46:49.203875Z

This sheet lists the inferred or default values applied during DXF → Elements → Extrusion.

- **Project units**: {units_detected} (confidence {units_confidence})
- **Scale factor**: {scale_factor} DXF → meters
- **Wall thickness default**: 0.20 m
- **Wall height default**: 2.70 m
- **Door default (w × h)**: 0.90 × 2.10 m
- **Window default (sill, height, width)**: 0.90 m, 1.20 m, 1.20 m
- **Room heights**: 2.70 m unless overridden
- **Tolerance**: 1 cm merge epsilon

## Items needing confirmation
- Unjoined endpoints found: {num_open_wall_segments} (show in UI as red)
- Unclassified layers: {unmapped_layers}
- Ambiguous units: {units_ambiguous}

Please review and confirm in the UI. Edits here can be parsed back into the pipeline.
