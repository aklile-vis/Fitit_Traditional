#!/usr/bin/env python3
"""Generate placeholder material/fixture assets for the demo catalog.

This script creates synthetic PBR texture sets and simple GLB proxies so the
pipeline can demonstrate catalog-driven assignments without large external
downloads.  Assets are placed under `public/assets/` following the manifest
layout consumed by `backend.asset_catalog`.

Usage:
    python scripts/seed_demo_assets.py
    python scripts/seed_demo_assets.py --override   # regenerate even if present
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Tuple

from PIL import Image
import numpy as np
import trimesh

ASSETS_ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets'
MATERIALS_DIR = ASSETS_ROOT / 'materials'
FIXTURES_DIR = ASSETS_ROOT / 'fixtures'
STYLES_DIR = ASSETS_ROOT / 'styles'


@dataclass
class MaterialSpec:
    slug: str
    name: str
    description: str
    base_color: Tuple[int, int, int]
    roughness: float
    metalness: float
    uv_scale: Tuple[float, float]
    tags: Iterable[str]


@dataclass
class FixtureSpec:
    slug: str
    name: str
    description: str
    size: Tuple[float, float, float]
    color: Tuple[int, int, int]
    default_room: str
    tags: Iterable[str]
    placement: Dict[str, Iterable[float]]


MATERIAL_SPECS = [
    MaterialSpec(
        slug='floor_oak_modern',
        name='Modern Oak Floor',
        description='Warm medium-tone oak planks for living/bedroom floors.',
        base_color=(166, 126, 88),
        roughness=0.55,
        metalness=0.02,
        uv_scale=(1.2, 1.2),
        tags=['floor', 'wood', 'living', 'bedroom'],
    ),
    MaterialSpec(
        slug='wall_paint_matte',
        name='Matte White Paint',
        description='Neutral matte paint for walls and ceilings.',
        base_color=(235, 235, 232),
        roughness=0.92,
        metalness=0.0,
        uv_scale=(1.0, 1.0),
        tags=['wall', 'ceiling'],
    ),
    MaterialSpec(
        slug='kitchen_quartz_white',
        name='White Quartz Slab',
        description='Subtle speckled quartz countertop finish.',
        base_color=(223, 223, 220),
        roughness=0.38,
        metalness=0.02,
        uv_scale=(1.4, 1.4),
        tags=['counter', 'kitchen'],
    ),
    MaterialSpec(
        slug='tile_ceramic_grey',
        name='Ceramic Grey Tile',
        description='Grey ceramic tile suitable for kitchens and bathrooms.',
        base_color=(126, 127, 130),
        roughness=0.42,
        metalness=0.01,
        uv_scale=(1.0, 1.0),
        tags=['floor', 'bathroom', 'kitchen'],
    ),
]

FIXTURE_SPECS = [
    FixtureSpec(
        slug='sofa_modern_block',
        name='Modern Sofa (Placeholder)',
        description='Three-seat sofa proxy for catalog demos.',
        size=(2.2, 0.9, 0.75),
        color=(180, 190, 200),
        default_room='living',
        tags=['living', 'seating'],
        placement={'position': [0.0, 0.0, 0.0], 'rotation': 180.0, 'scale': [1.0, 1.0, 1.0]},
    ),
    FixtureSpec(
        slug='bed_platform_block',
        name='Platform Bed (Placeholder)',
        description='Queen-size bed proxy for catalog demos.',
        size=(2.0, 1.6, 0.6),
        color=(210, 205, 198),
        default_room='bedroom',
        tags=['bedroom', 'sleep'],
        placement={'position': [0.0, 0.0, 0.0], 'rotation': 0.0, 'scale': [1.0, 1.0, 1.0]},
    ),
    FixtureSpec(
        slug='dining_table_block',
        name='Dining Table (Placeholder)',
        description='Rectangular dining table proxy.',
        size=(1.8, 0.9, 0.75),
        color=(165, 140, 110),
        default_room='dining',
        tags=['dining'],
        placement={'position': [0.0, 0.0, 0.0], 'rotation': 0.0, 'scale': [1.0, 1.0, 1.0]},
    ),
    FixtureSpec(
        slug='kitchen_island_block',
        name='Kitchen Island (Placeholder)',
        description='Simple kitchen island block for staging.',
        size=(2.4, 1.0, 0.9),
        color=(200, 200, 205),
        default_room='kitchen',
        tags=['kitchen'],
        placement={'position': [0.0, 0.0, 0.0], 'rotation': 0.0, 'scale': [1.0, 1.0, 1.0]},
    ),
]

STYLE_MANIFEST = {
    'slug': 'modern_multi_room',
    'name': 'Modern Multi-room Starter',
    'description': 'Default materials and proxy fixtures for living, bedroom, kitchen and dining spaces.',
    'materials': [
        {'target': 'living:floor', 'material': 'floor_oak_modern', 'priority': 0},
        {'target': 'living:wall', 'material': 'wall_paint_matte', 'priority': 0},
        {'target': 'bedroom:floor', 'material': 'floor_oak_modern', 'priority': 0},
        {'target': 'bedroom:wall', 'material': 'wall_paint_matte', 'priority': 0},
        {'target': 'kitchen:floor', 'material': 'tile_ceramic_grey', 'priority': 0},
        {'target': 'kitchen:counter', 'material': 'kitchen_quartz_white', 'priority': 0},
        {'target': 'dining:floor', 'material': 'floor_oak_modern', 'priority': 0},
        {'target': 'bathroom:floor', 'material': 'tile_ceramic_grey', 'priority': 0},
        {'target': 'bathroom:wall', 'material': 'wall_paint_matte', 'priority': 0},
    ],
    'fixtures': [
        {'asset': 'sofa_modern_block', 'placement': FIXTURE_SPECS[0].placement},
        {'asset': 'bed_platform_block', 'placement': FIXTURE_SPECS[1].placement},
        {'asset': 'dining_table_block', 'placement': FIXTURE_SPECS[2].placement},
        {'asset': 'kitchen_island_block', 'placement': FIXTURE_SPECS[3].placement},
    ],
    'metadata': {
        'tags': ['modern', 'starter'],
    },
}


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def create_material(material: MaterialSpec, override: bool) -> None:
    material_dir = MATERIALS_DIR / material.slug
    ensure_dir(material_dir)
    albedo_path = material_dir / 'albedo.png'
    normal_path = material_dir / 'normal.png'
    roughness_path = material_dir / 'roughness.png'
    ao_path = material_dir / 'ao.png'

    if override or not albedo_path.exists():
        create_flat_texture(albedo_path, material.base_color)
    if override or not normal_path.exists():
        create_normal_texture(normal_path)
    if override or not roughness_path.exists():
        value = int(max(0.0, min(1.0, material.roughness)) * 255)
        create_greyscale_texture(roughness_path, value)
    if override or not ao_path.exists():
        create_greyscale_texture(ao_path, 255)

    manifest = {
        'slug': material.slug,
        'name': material.name,
        'description': material.description,
        'textures': {
            'albedo': './albedo.png',
            'normal': './normal.png',
            'roughness': './roughness.png',
            'ao': './ao.png',
        },
        'properties': {
            'roughness': material.roughness,
            'metalness': material.metalness,
            'uvScale': list(material.uv_scale),
            'baseColor': list(material.base_color),
        },
        'targets': list(material.tags),
        'source': {
            'type': 'synthetic_demo',
        },
    }
    (material_dir / 'material.json').write_text(json.dumps(manifest, indent=2))


def create_flat_texture(path: Path, rgb: Tuple[int, int, int], size: int = 256) -> None:
    img = Image.new('RGB', (size, size), rgb)
    img.save(path)


def create_normal_texture(path: Path, size: int = 256) -> None:
    # Flat normal pointing up (0.5, 0.5, 1.0)
    img = Image.new('RGB', (size, size), (128, 128, 255))
    img.save(path)


def create_greyscale_texture(path: Path, value: int, size: int = 256) -> None:
    img = Image.new('L', (size, size), value)
    img.convert('RGB').save(path)


def create_fixture(fixture: FixtureSpec, override: bool) -> None:
    fixture_dir = FIXTURES_DIR / fixture.slug
    ensure_dir(fixture_dir)
    model_path = fixture_dir / 'model.glb'
    preview_path = fixture_dir / 'preview.png'

    if override or not model_path.exists():
        generate_fixture_glb(model_path, fixture.size, fixture.color)
    if override or not preview_path.exists():
        create_flat_texture(preview_path, fixture.color, size=128)

    manifest = {
        'slug': fixture.slug,
        'name': fixture.name,
        'description': fixture.description,
        'modelPath': './model.glb',
        'thumbnail': './preview.png',
        'metadata': {
            'defaultRoom': fixture.default_room,
            'tags': list(fixture.tags),
            'placement': fixture.placement,
            'size': list(fixture.size),
        },
        'source': {
            'type': 'synthetic_demo',
        },
    }
    (fixture_dir / 'metadata.json').write_text(json.dumps(manifest, indent=2))


def generate_fixture_glb(path: Path, size: Tuple[float, float, float], color: Tuple[int, int, int]) -> None:
    sx, sy, sz = size
    mesh = trimesh.creation.box(extents=(sx, sy, sz))
    mesh.visual.vertex_colors = np.tile(np.array([[color[0], color[1], color[2], 255]]), (mesh.vertices.shape[0], 1))
    scene = trimesh.Scene(mesh)
    export = scene.export(file_type='glb')
    path.write_bytes(export)


def write_style(override: bool) -> None:
    manifest_path = STYLES_DIR / STYLE_MANIFEST['slug'] / 'manifest.json'
    if not override and manifest_path.exists():
        return
    ensure_dir(manifest_path.parent)
    manifest_path.write_text(json.dumps(STYLE_MANIFEST, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate demo catalog assets')
    parser.add_argument('--override', action='store_true', help='Regenerate assets even if present')
    args = parser.parse_args()

    ensure_dir(ASSETS_ROOT)
    ensure_dir(MATERIALS_DIR)
    ensure_dir(FIXTURES_DIR)
    ensure_dir(STYLES_DIR)

    for material in MATERIAL_SPECS:
        create_material(material, override=args.override)

    for fixture in FIXTURE_SPECS:
        create_fixture(fixture, override=args.override)

    write_style(args.override)
    print('Demo assets generated under public/assets/')


if __name__ == '__main__':
    main()
