import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

CATALOG_ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets'


@dataclass
class MaterialRecord:
    slug: str
    name: str
    path: Path
    description: Optional[str] = None
    textures: Dict[str, str] = field(default_factory=dict)
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FixtureRecord:
    slug: str
    name: str
    path: Path
    model_path: Optional[str] = None
    thumbnail: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RoomStyleRecord:
    slug: str
    name: str
    path: Path
    description: Optional[str] = None
    materials: List[Dict[str, Any]] = field(default_factory=list)
    fixtures: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class AssetCatalog:
    """Loads material/fixture manifests from `public/assets` for runtime use."""

    def __init__(self, root: Optional[Path] = None) -> None:
        self.root = Path(root) if root else CATALOG_ROOT
        self.materials: Dict[str, MaterialRecord] = {}
        self.fixtures: Dict[str, FixtureRecord] = {}
        self.room_styles: Dict[str, RoomStyleRecord] = {}
        self._loaded = False
        self._material_cache: Dict[str, MaterialRecord] = {}
        self._fixture_cache: Dict[str, FixtureRecord] = {}
        self._style_cache: Dict[str, RoomStyleRecord] = {}

    def load(self, force: bool = False) -> None:
        if self._loaded and not force:
            return
        self.materials = self._material_cache = self._load_materials()
        self.fixtures = self._fixture_cache = self._load_fixtures()
        self.room_styles = self._style_cache = self._load_room_styles()
        self._loaded = True
        logger.info(
            "Asset catalog loaded: %s materials, %s fixtures, %s room styles",
            len(self.materials),
            len(self.fixtures),
            len(self.room_styles),
        )

    # ------------------------------------------------------------------
    # Internal helpers

    def _load_materials(self) -> Dict[str, MaterialRecord]:
        materials: Dict[str, MaterialRecord] = {}
        materials_dir = self.root / 'materials'
        if not materials_dir.exists():
            logger.debug('Material directory not found at %s', materials_dir)
            return materials
        for entry in materials_dir.iterdir():
            if not entry.is_dir():
                continue
            manifest = entry / 'material.json'
            if not manifest.exists():
                logger.debug('Skipping material without manifest: %s', entry)
                continue
            try:
                data = json.loads(manifest.read_text())
                slug = data.get('slug') or entry.name
                record = MaterialRecord(
                    slug=slug,
                    name=data.get('name', slug.replace('_', ' ').title()),
                    path=entry,
                    description=data.get('description'),
                    textures=data.get('textures', {}),
                    properties=data.get('properties', {}),
                )
                materials[slug] = record
            except Exception as exc:  # pragma: no cover - diagnostics
                logger.warning('Failed to load material manifest %s: %s', manifest, exc)
        return materials

    def _load_fixtures(self) -> Dict[str, FixtureRecord]:
        fixtures: Dict[str, FixtureRecord] = {}
        fixtures_dir = self.root / 'fixtures'
        if not fixtures_dir.exists():
            logger.debug('Fixture directory not found at %s', fixtures_dir)
            return fixtures
        for entry in fixtures_dir.iterdir():
            if not entry.is_dir():
                continue
            manifest = entry / 'metadata.json'
            if not manifest.exists():
                logger.debug('Skipping fixture without metadata: %s', entry)
                continue
            try:
                data = json.loads(manifest.read_text())
                slug = data.get('slug') or entry.name
                record = FixtureRecord(
                    slug=slug,
                    name=data.get('name', slug.replace('_', ' ').title()),
                    path=entry,
                    model_path=data.get('modelPath'),
                    thumbnail=data.get('thumbnail'),
                    metadata=data.get('metadata', {}),
                )
                fixtures[slug] = record
            except Exception as exc:  # pragma: no cover
                logger.warning('Failed to load fixture metadata %s: %s', manifest, exc)
        return fixtures

    def _load_room_styles(self) -> Dict[str, RoomStyleRecord]:
        presets: Dict[str, RoomStyleRecord] = {}
        styles_dir = self.root / 'styles'
        if not styles_dir.exists():
            logger.debug('Room style directory not found at %s', styles_dir)
            return presets
        for entry in styles_dir.iterdir():
            if not entry.is_dir():
                continue
            manifest = entry / 'manifest.json'
            if not manifest.exists():
                logger.debug('Skipping room style without manifest: %s', entry)
                continue
            try:
                data = json.loads(manifest.read_text())
                slug = data.get('slug') or entry.name
                record = RoomStyleRecord(
                    slug=slug,
                    name=data.get('name', slug.replace('_', ' ').title()),
                    path=entry,
                    description=data.get('description'),
                    materials=data.get('materials', []),
                    fixtures=data.get('fixtures', []),
                    metadata=data.get('metadata', {}),
                )
                presets[slug] = record
            except Exception as exc:  # pragma: no cover
                logger.warning('Failed to load room style manifest %s: %s', manifest, exc)
        return presets

    # ------------------------------------------------------------------
    # Query helpers

    def get_material(self, slug: str) -> Optional[MaterialRecord]:
        self.load()
        return self.materials.get(slug)

    def get_fixture(self, slug: str) -> Optional[FixtureRecord]:
        self.load()
        return self.fixtures.get(slug)

    def get_room_style(self, slug: str) -> Optional[RoomStyleRecord]:
        self.load()
        return self.room_styles.get(slug)

    def list_materials(self) -> Dict[str, MaterialRecord]:
        self.load()
        return dict(self.materials)

    def list_fixtures(self) -> Dict[str, FixtureRecord]:
        self.load()
        return dict(self.fixtures)

    def refresh(self) -> None:
        self._loaded = False
        self.load(force=True)


catalog = AssetCatalog()
