#!/usr/bin/env python3
"""Lightweight 3D ingestion smoke test.

Steps executed:
1. Ensure backend health endpoint responds with `healthy`.
2. Call `/process-cad` with the OBJ fixture under `fixtures/3d/test_cube.obj`.
3. Confirm the backend returns a GLB artifact path and that the file exists.
4. Verify the vendored IFC viewer bundle is still present (keeps buyer viewer working offline).

Run with `python3 scripts/smoke_test.py` or `make cli-test`.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE = REPO_ROOT / "fixtures" / "3d" / "test_cube.obj"
VIEWER_ROOT = REPO_ROOT / "public" / "libs" / "web-ifc-viewer"
VIEWER_WASM_DIR = REPO_ROOT / "public" / "wasm"
PROCESS_URL = os.getenv("SMOKE_PROCESS_URL", "http://localhost:8000/process-cad")
HEALTH_URL = os.getenv("SMOKE_BACKEND_URL", "http://localhost:8000/health")


def log(message: str) -> None:
    print(f"[smoke] {message}")


def ensure_fixture() -> None:
    if not FIXTURE.exists():
        raise SystemExit(f"3D smoke fixture missing: {FIXTURE}")


def ping_backend() -> None:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=3) as response:
            status = response.status
            body = response.read(256).decode("utf-8", "ignore")
    except urllib.error.URLError as exc:
        raise SystemExit(f"Backend health check failed: {exc}") from exc

    if status != 200 or "healthy" not in body:
        raise SystemExit(f"Unexpected health response: {status} {body}")
    log("Backend health OK")


def process_fixture() -> dict:
    payload = json.dumps({
        "filePath": str(FIXTURE),
        "userId": "smoke-test",
    }).encode("utf-8")

    request = urllib.request.Request(
        PROCESS_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8", "ignore")
    except urllib.error.URLError as exc:
        raise SystemExit(f"Processing request failed: {exc}") from exc

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Backend did not return JSON: {exc}\nBody: {body}") from exc

    if not data.get("success"):
        raise SystemExit(f"Backend reported failure: {data}")

    return data


def ensure_artifact(path_str: Optional[str], label: str) -> Path:
    if not path_str:
        raise SystemExit(f"{label} missing from backend response")
    path = Path(path_str)
    if not path.is_absolute():
        path = REPO_ROOT / path
    if not path.exists():
        raise SystemExit(f"{label} not found at {path}")
    return path


def verify_viewer_bundle() -> None:
    expected = [
        VIEWER_ROOT / "ifc-viewer-api.js",
        VIEWER_ROOT / "index.js",
        VIEWER_WASM_DIR / "web-ifc.wasm",
    ]
    missing = [str(path) for path in expected if not path.exists()]
    if missing:
        raise SystemExit(
            "Vendored IFC viewer assets missing: " + ", ".join(missing)
        )


def main() -> None:
    ensure_fixture()
    ping_backend()

    result = process_fixture()
    glb_path = ensure_artifact(result.get("glbPath"), "GLB artifact")
    log(f"GLB artifact written to {glb_path}")

    ifc_path = result.get("ifcPath")
    if ifc_path:
        ensure_artifact(ifc_path, "IFC artifact (optional)")

    verify_viewer_bundle()
    log("IFC viewer bundle present")
    log("3D ingestion smoke test completed successfully")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        if exc.code:
            raise
    except Exception as exc:  # pragma: no cover
        raise SystemExit(f"Unexpected smoke test failure: {exc}") from exc
