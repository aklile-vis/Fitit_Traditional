#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d "backend/.venv" ]; then
  echo "[start] Python virtualenv not found at backend/.venv" >&2
  echo "[start] Create it with: python3 -m venv backend/.venv && source backend/.venv/bin/activate && pip install -r backend/requirements.txt" >&2
  exit 1
fi

cleanup() {
  if kill -0 "${BACKEND_PID:-0}" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if kill -0 "${FRONTEND_PID:-0}" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

(
  source backend/.venv/bin/activate
  npm run backend:dev
) &
BACKEND_PID=$!

echo "[start] Backend running (PID $BACKEND_PID)"

echo "[start] Starting Next.js frontend"
npm run dev &
FRONTEND_PID=$!

echo "[start] Frontend running (PID $FRONTEND_PID)"

echo "[start] Both services launched. Press Ctrl+C to stop."

wait "$FRONTEND_PID"
