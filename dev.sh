#!/usr/bin/env bash
# dev.sh — one-command dev runner + logs (FastAPI + React + Postgres + Redis [+ Worker])
# Usage:
#   ./dev.sh up         # start infra + backend + frontend (+ worker if present)
#   ./dev.sh down       # stop everything
#   ./dev.sh logs       # tail logs (backend/frontend/worker + docker)
#   ./dev.sh ps         # show status
#   ./dev.sh doctor     # quick diagnostics
#   ./dev.sh dump-logs  # tar.gz of .dev/logs for sharing
#
# Assumptions (override via .env):
# - Backend in ./backend, FastAPI app at app.main:app, dev server on :8000
# - React frontend in ./frontend, dev server on :5173
# - Postgres + Redis via Docker (auto-skipped if local services are running when USE_DOCKER=auto)

set -Eeuo pipefail
shopt -s nullglob
ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
STATE_DIR="${ROOT_DIR}/.dev"
COMPOSE_FILE="${STATE_DIR}/compose.yml"
LOG_DIR="${STATE_DIR}/logs"
ARCHIVE_DIR="${STATE_DIR}/archives"
VENV_DIR="${BACKEND_DIR}/.venv"

mkdir -p "${STATE_DIR}" "${LOG_DIR}" "${ARCHIVE_DIR}"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
info() { printf "[dev] %s\n" "$*"; }
warn() { printf "\033[33m[dev] %s\033[0m\n" "$*"; }
fail() { printf "\033[31m[dev] %s\033[0m\n" "$*"; exit 1; }

ensure_env() {
  if [[ ! -f "${ROOT_DIR}/.env" ]]; then
    info "Creating .env with sane defaults"
    cat > "${ROOT_DIR}/.env" <<'ENV'
APP_ENV=dev
# FastAPI CORS for Vite dev server (use exploded keys to avoid JSON parsing issues)
# ALLOWED_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
ALLOWED_ORIGINS__0=http://localhost:5173
ALLOWED_ORIGINS__1=http://127.0.0.1:5173

# Async SQLAlchemy URL for Postgres (local defaults)
DATABASE_URL=postgresql+asyncpg://arciva:1234@127.0.0.1:5432/arciva_dev
# Redis URL for tasks/caching (local default)
REDIS_URL=redis://127.0.0.1:6379/0
# App secret (dev only!)
SECRET_KEY=dev-secret-change-me
# Conda environment name
CONDA_ENV=arciva
# Infra control: auto | true | false
# auto → if local Postgres/Redis are already running on 5432/6379, skip Docker
USE_DOCKER=auto
ENV
  fi
  # Export .env so pydantic can read via EnvSettingsSource
  set -a; source "${ROOT_DIR}/.env"; set +a
}

ensure_exiftool_path() {
  if [[ -n "${EXIFTOOL_PATH:-}" && -x "${EXIFTOOL_PATH}" ]]; then
    info "EXIFTOOL_PATH already set to ${EXIFTOOL_PATH}"
    local env_root
    env_root=$(dirname "$(dirname "${EXIFTOOL_PATH}")")
    case ":${PATH}:" in
      *":${env_root}/bin:"*) ;;
      *) export PATH="${env_root}/bin:${PATH}" ;;
    esac
    configure_perl_libs "${env_root}"
    return
  fi

  if command -v exiftool >/dev/null 2>&1; then
    local sys_tool
    sys_tool=$(command -v exiftool)
    export EXIFTOOL_PATH="${sys_tool}"
    info "Detected system exiftool at ${EXIFTOOL_PATH}"
    local env_root
    env_root=$(dirname "$(dirname "${EXIFTOOL_PATH}")")
    case ":${PATH}:" in
      *":${env_root}/bin:"*) ;;
      *) export PATH="${env_root}/bin:${PATH}" ;;
    esac
    configure_perl_libs "${env_root}"
    return
  fi

  if command -v pixi >/dev/null 2>&1; then
    local pixi_path
    if pixi_path=$(pixi run which exiftool 2>/dev/null); then
      pixi_path=$(echo "${pixi_path}" | head -n 1)
      if [[ -n "${pixi_path}" && -x "${pixi_path}" ]]; then
        export EXIFTOOL_PATH="${pixi_path}"
        info "Using pixi exiftool at ${EXIFTOOL_PATH}"
        local env_root
        env_root=$(dirname "$(dirname "${EXIFTOOL_PATH}")")
        case ":${PATH}:" in
          *":${env_root}/bin:"*) ;;
          *) export PATH="${env_root}/bin:${PATH}" ;;
        esac
        configure_perl_libs "${env_root}"
        return
      fi
    fi
  fi

  warn "exiftool not found; metadata extraction may fail. Install exiftool or set EXIFTOOL_PATH."
}

configure_perl_libs() {
  local env_root=$1
  [[ -d "${env_root}/lib/perl5" ]] || return

  local paths=()
  local base="${env_root}/lib/perl5"

  for dir in "${base}/site_perl" "${base}/vendor_perl" "${base}/core_perl"; do
    [[ -d "${dir}" ]] && paths+=("${dir}")
  done

  for dir in "${base}"/5.*/site_perl "${base}"/5.*/vendor_perl "${base}"/5.*/core_perl; do
    [[ -d "${dir}" ]] && paths+=("${dir}")
  done

  if ((${#paths[@]} == 0)); then
    return
  fi

  local joined
  joined=$(IFS=:; echo "${paths[*]}")
  if [[ -n "${PERL5LIB:-}" ]]; then
    export PERL5LIB="${joined}:${PERL5LIB}"
  else
    export PERL5LIB="${joined}"
  fi
  info "Configured PERL5LIB for exiftool"
}

write_compose() {
  cat > "${COMPOSE_FILE}" <<'YAML'
services:
  db:
    image: postgres:16-alpine
    container_name: dev-db-1
    environment:
      POSTGRES_DB: arciva
      POSTGRES_USER: arciva
      POSTGRES_PASSWORD: arciva
    ports: ["${HOST_DB_PORT:-5432}:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 3s
      timeout: 2s
      retries: 20
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    container_name: dev-redis-1
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    ports: ["${HOST_REDIS_PORT:-6379}:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 2s
      retries: 20
volumes:
  pgdata:
YAML
}

compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }

is_port_open() { # host port
  (echo >"/dev/tcp/$1/$2") >/dev/null 2>&1
}

ensure_compose_up() {
  case "${USE_DOCKER:-auto}" in
    false|False|FALSE|no|NO)
      info "USE_DOCKER=false → Reusing local Postgres/Redis"
      return ;;
    auto|Auto|AUTO)
      if is_port_open 127.0.0.1 5432 || is_port_open 127.0.0.1 6379; then
        info "Local services detected on 5432/6379 → skipping Docker"
        return
      fi ;;
  esac

  command -v docker >/dev/null 2>&1 || fail "Docker is required (set USE_DOCKER=false to skip)."

  HOST_DB_PORT=5432; HOST_REDIS_PORT=6379
  is_port_open 127.0.0.1 5432 && HOST_DB_PORT=5433
  is_port_open 127.0.0.1 6379 && HOST_REDIS_PORT=6380
  export HOST_DB_PORT HOST_REDIS_PORT

  export NEW_DATABASE_URL="postgresql+asyncpg://arciva:arciva@127.0.0.1:${HOST_DB_PORT}/arciva"
  export NEW_REDIS_URL="redis://127.0.0.1:${HOST_REDIS_PORT}/0"

  write_compose
  info "Starting infra (Postgres:${HOST_DB_PORT}, Redis:${HOST_REDIS_PORT})"
  compose up -d
  info "Waiting for infra to be healthy"
  compose wait || true
}

wait_tcp() { # host port timeout_seconds
  local host=$1 port=$2 timeout=${3:-30}
  local start
  start=$(date +%s)
  until (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1; do
    sleep 1
    if (( $(date +%s) - start > timeout )); then return 1; fi
  done
}

conda_activate() {
  if [[ -n "${PIXI_IN_SHELL:-}" ]]; then
    info "Pixi environment detected; skipping conda activation"
    return
  fi
  if command -v conda >/dev/null 2>&1; then
    # shellcheck disable=SC1091
    source "$(conda info --base)/etc/profile.d/conda.sh"
    conda activate "${CONDA_ENV:-arciva}" || warn "Failed to activate conda env ${CONDA_ENV:-arciva}; falling back"
  elif [[ -n "${MAMBA_EXE:-}" ]] || command -v micromamba >/dev/null 2>&1; then
    eval "$(micromamba shell hook --shell=bash)" || true
    micromamba activate "${CONDA_ENV:-arciva}" || warn "Failed to activate micromamba env ${CONDA_ENV:-arciva}; falling back"
  else
    warn "Conda not found; will use virtualenv as fallback"
  fi
}

start_backend() {
  [[ -d "${BACKEND_DIR}" ]] || fail "Backend directory not found at ${BACKEND_DIR}"
  pushd "${BACKEND_DIR}" >/dev/null

  # Prevent stray JSON-style ALLOWED_ORIGINS from overriding exploded keys
  unset ALLOWED_ORIGINS || true

  info "Env check → ALLOWED_ORIGINS='${ALLOWED_ORIGINS-}' ALLOWED_ORIGINS__0='${ALLOWED_ORIGINS__0-}' ALLOWED_ORIGINS__1='${ALLOWED_ORIGINS__1-}'"
  info "Starting FastAPI dev server"

  if command -v conda >/dev/null 2>&1 || command -v micromamba >/dev/null 2>&1; then
    conda_activate
    info "Conda env: ${CONDA_ENV:-arciva}"
    DATABASE_URL="${NEW_DATABASE_URL:-$DATABASE_URL}" \
      REDIS_URL="${NEW_REDIS_URL:-$REDIS_URL}" \
      python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
      >>"${LOG_DIR}/backend.out.log" 2>>"${LOG_DIR}/backend.err.log" &
  elif [[ -f "pyproject.toml" && -f "poetry.lock" && $(command -v poetry) ]]; then
    info "Using poetry env"
    poetry install --no-interaction >>"${LOG_DIR}/backend.install.log" 2>&1 || true
    DATABASE_URL="${NEW_DATABASE_URL:-$DATABASE_URL}" \
      REDIS_URL="${NEW_REDIS_URL:-$REDIS_URL}" \
      poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
      >>"${LOG_DIR}/backend.out.log" 2>>"${LOG_DIR}/backend.err.log" &
  else
    if [[ ! -d "${VENV_DIR}" ]]; then
      python3 -m venv "${VENV_DIR}"
      "${VENV_DIR}/bin/pip" install --upgrade pip >/dev/null
      if [[ -f requirements.txt ]]; then "${VENV_DIR}/bin/pip" install -r requirements.txt; fi
      "${VENV_DIR}/bin/pip" install 'uvicorn[standard]' fastapi 'sqlalchemy[asyncio]' asyncpg pydantic pydantic-settings pillow >/dev/null || true
    fi
    info "Starting FastAPI dev server (venv)"
    DATABASE_URL="${NEW_DATABASE_URL:-$DATABASE_URL}" \
      REDIS_URL="${NEW_REDIS_URL:-$REDIS_URL}" \
      "${VENV_DIR}/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 --reload \
      >>"${LOG_DIR}/backend.out.log" 2>>"${LOG_DIR}/backend.err.log" &
  fi
  BACKEND_PID=$!
  popd >/dev/null
}

pkg_manager() {
  if [[ -f "${FRONTEND_DIR}/pnpm-lock.yaml" ]] && command -v pnpm >/dev/null; then echo pnpm; return; fi
  if [[ -f "${FRONTEND_DIR}/yarn.lock" ]] && command -v yarn >/dev/null; then echo yarn; return; fi
  echo npm
}

start_frontend() {
  [[ -d "${FRONTEND_DIR}" ]] || { warn "Frontend directory not found at ${FRONTEND_DIR}; skipping."; return; }
  pushd "${FRONTEND_DIR}" >/dev/null
  local pm; pm=$(pkg_manager)
  info "Using frontend package manager: ${pm}"
  case "$pm" in
    pnpm)
      [[ -d node_modules ]] || pnpm install >>"${LOG_DIR}/frontend.install.log" 2>&1
      pnpm run dev -- --host 0.0.0.0 >>"${LOG_DIR}/frontend.out.log" 2>>"${LOG_DIR}/frontend.err.log" &
      ;;
    yarn)
      [[ -d node_modules ]] || yarn install >>"${LOG_DIR}/frontend.install.log" 2>&1
      yarn dev --host 0.0.0.0 >>"${LOG_DIR}/frontend.out.log" 2>>"${LOG_DIR}/frontend.err.log" &
      ;;
    npm)
      [[ -d node_modules ]] || npm ci >>"${LOG_DIR}/frontend.install.log" 2>&1 || npm install >>"${LOG_DIR}/frontend.install.log" 2>&1
      npm run dev -- --host 0.0.0.0 >>"${LOG_DIR}/frontend.out.log" 2>>"${LOG_DIR}/frontend.err.log" &
      ;;
  esac
  FRONTEND_PID=$!
  popd >/dev/null
}

start_worker() {
  if [[ -f "${BACKEND_DIR}/worker/worker.py" ]]; then
    pushd "${ROOT_DIR}" >/dev/null
    if command -v conda >/dev/null 2>&1 || command -v micromamba >/dev/null 2>&1; then
      conda_activate
    fi
    info "Starting worker"
    PYTHONPATH="${ROOT_DIR}" \
      DATABASE_URL="${NEW_DATABASE_URL:-$DATABASE_URL}" \
      REDIS_URL="${NEW_REDIS_URL:-$REDIS_URL}" \
      python -m arq backend.worker.worker.WorkerSettings \
      >>"${LOG_DIR}/worker.out.log" 2>>"${LOG_DIR}/worker.err.log" &
    if ! python - <<'PY' >/dev/null 2>&1
from importlib.util import find_spec
import sys
sys.exit(0 if find_spec("rawpy") else 1)
PY
    then
      warn "rawpy not found in the active Python environment; RAW previews will stay as placeholders. Install rawpy via 'pixi install' or add it to your env."
    fi
    WORKER_PID=$!
    popd >/dev/null
  else
    warn "No worker at backend/worker/worker.py; skipping."
  fi
}

print_endpoints() {
  bold "
Dev environment is up!"
  echo "Backend API     → http://localhost:8000 (OpenAPI at /docs)"
  echo "Frontend (Vite) → http://localhost:5173"
  echo "Postgres        → ${NEW_DATABASE_URL:-$DATABASE_URL}"
  echo "Redis           → ${NEW_REDIS_URL:-$REDIS_URL}"
  echo "Logs            → ${LOG_DIR} (backend.*, frontend.*, worker.*)"
}

cmd_up() {
  ensure_env
  ensure_exiftool_path
  ensure_compose_up
  DB_PORT="${HOST_DB_PORT:-5432}"; REDIS_PORT="${HOST_REDIS_PORT:-6379}"
  wait_tcp localhost "$DB_PORT" 60 || fail "Postgres did not become ready on $DB_PORT"
  wait_tcp localhost "$REDIS_PORT" 60 || fail "Redis did not become ready on $REDIS_PORT"
  start_backend
  wait_tcp localhost 8000 60 || warn "Backend port 8000 not reachable yet"
  start_worker || true
  start_frontend || true
  trap cmd_down INT TERM
  print_endpoints
  wait || true
}

cmd_down() {
  info "Stopping apps"
  [[ -n "${BACKEND_PID:-}" ]] && kill "${BACKEND_PID}" 2>/dev/null || true
  [[ -n "${WORKER_PID:-}" ]] && kill "${WORKER_PID}" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "${FRONTEND_PID}" 2>/dev/null || true
  info "Stopping infra (if any)"
  if [[ -f "${COMPOSE_FILE}" ]]; then compose down -v --remove-orphans || true; fi
}

cmd_logs() {
  info "Tailing logs (Ctrl-C to stop)"
  touch \
    "${LOG_DIR}/backend.out.log" "${LOG_DIR}/backend.err.log" \
    "${LOG_DIR}/frontend.out.log" "${LOG_DIR}/frontend.err.log" \
    "${LOG_DIR}/worker.out.log" "${LOG_DIR}/worker.err.log"
  tail -n+1 -f \
    "${LOG_DIR}/backend.out.log" \
    "${LOG_DIR}/backend.err.log" \
    "${LOG_DIR}/frontend.out.log" \
    "${LOG_DIR}/frontend.err.log" \
    "${LOG_DIR}/worker.out.log" \
    "${LOG_DIR}/worker.err.log" &
  TAIL_PID=$!
  if [[ -f "${COMPOSE_FILE}" ]]; then compose logs -f & fi
  trap 'kill ${TAIL_PID} 2>/dev/null || true' INT TERM
  wait || true
}

cmd_ps() {
  if [[ -f "${COMPOSE_FILE}" ]]; then
    compose ps || true
  else
    warn "Infra is not started via Docker."
  fi
  pgrep -f "uvicorn app\.main:app" >/dev/null && echo "backend: running" || echo "backend: stopped"
  pgrep -f "worker\.worker" >/dev/null && echo "worker: running" || echo "worker: stopped"
  pgrep -f "vite" >/dev/null && echo "frontend: running" || echo "frontend: stopped"
}

doctor() {
  bold "Running diagnostics"
  echo "== System =="; echo "uname: $(uname -a)"
  echo "docker: $(docker --version 2>/dev/null || echo 'not installed')"
  echo "conda: $(conda --version 2>/dev/null || echo 'not installed')"
  echo "python: $(python --version 2>/dev/null || echo 'not found')"
  echo "node: $(node --version 2>/dev/null || echo 'not found')"
  echo "npm: $(npm --version 2>/dev/null || echo 'not found')"
  echo; echo "== Ports =="; for p in 5432 5433 6379 6380 8000 5173; do (echo >/dev/tcp/127.0.0.1/$p) >/dev/null 2>&1 && echo "port $p: open" || echo "port $p: closed"; done
  echo; echo "== HTTP health =="; curl -fsS http://localhost:8000/health || echo "health endpoint failed"
  echo; [[ -f "${COMPOSE_FILE}" ]] && compose ps || true
}

dump_logs() {
  ts=$(date +%Y%m%d_%H%M%S)
  out="${ARCHIVE_DIR}/logs_${ts}.tar.gz"
  tar -czf "$out" -C "${LOG_DIR}" .
  echo "Created archive: $out"
}

main() {
  case "${1:-up}" in
    up) cmd_up ;;
    down) cmd_down ;;
    logs) cmd_logs ;;
    ps) cmd_ps ;;
    doctor) doctor ;;
    dump-logs) dump_logs ;;
    *) echo "Unknown command: $1"; echo "Usage: $0 {up|down|logs|ps|doctor|dump-logs}"; exit 1 ;;
  esac
}

main "$@"
