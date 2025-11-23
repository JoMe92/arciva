#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"
APP_DB_PATH="${APP_DB_PATH:-/data/db/app.db}"
APP_MEDIA_ROOT="${APP_MEDIA_ROOT:-/data/media}"
LOGS_DIR="${LOGS_DIR:-/data/logs}"

mkdir -p "$(dirname "$APP_DB_PATH")" "$APP_MEDIA_ROOT" "$LOGS_DIR"

case "${1:-api}" in
  api)
    exec uvicorn backend.app.main:app --host 0.0.0.0 --port "$PORT"
    ;;
  worker)
    exec arq backend.worker.worker.WorkerSettings
    ;;
  *)
    exec "$@"
    ;;
esac
