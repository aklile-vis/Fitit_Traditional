# Asset Catalog Structure

Assets used by the high-fidelity interior pipeline live under this directory. The layout is intentionally simple so new materials/fixtures can be added without touching backend code.

```
public/assets/
  materials/<slug>/
    material.json      # required manifest
    *.jpg/*.png        # PBR textures (optional for now)
  fixtures/<slug>/
    metadata.json      # placement + metadata
    model.glb          # referenced geometry (not versioned yet)
    preview.png        # optional thumbnail
  styles/<slug>/
    manifest.json      # room-style defaults referencing materials + fixtures
```

## Manifest shapes

### materials/<slug>/material.json
```json
{
  "slug": "default_oak_floor",
  "name": "Default Oak Floor",
  "description": "Warm oak planks",
  "textures": {
    "albedo": "./albedo.jpg",
    "normal": "./normal.jpg"
  },
  "properties": {
    "roughness": 0.65,
    "metalness": 0.0,
    "uvScale": [1.5, 1.5]
  }
}
```

### fixtures/<slug>/metadata.json
```json
{
  "slug": "sofa_modern_01",
  "name": "Modern Sofa 3-Seater",
  "modelPath": "./model.glb",
  "thumbnail": "./preview.png",
  "metadata": {
    "footprint": [2.2, 0.9],
    "defaultRotation": 180,
    "tags": ["living", "seating"],
    "anchor": "center"
  }
}
```

### styles/<slug>/manifest.json
```json
{
  "slug": "modern_living",
  "name": "Modern Living Room",
  "materials": [
    { "target": "floor", "material": "default_oak_floor", "priority": 0 }
  ],
  "fixtures": [
    {
      "asset": "sofa_modern_01",
      "placement": { "position": [0, 0, 0], "rotation": 180, "scale": [1, 1, 1] }
    }
  ]
}
```

> Textures and GLB geometry are placeholders in this repo; in production they should be exported assets checked into object storage.
