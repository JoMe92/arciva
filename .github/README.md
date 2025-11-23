# Arciva

Arciva keeps photo projects together: project cards with people, notes, and assets, plus background ingest and fast thumbs. **Status: alpha (v0.1.0)** — expect schema/API changes between releases.

## Features
- Project-first archive: projects, assets, notes, people metadata
- Async ingest with dedup, RAW/EXIF read, and thumbnail generation
- Bundled SPA + API in one container image; simple CORS + LAN origin helpers
- Works with Postgres (Compose) or SQLite (single-node / dev)

## Known limitations (alpha)
- No migrations guaranteed yet; backups required before upgrading
- Single-node file storage only (POSIX paths/volumes; no S3 adapter yet)
- Basic email/password auth (no SSO/RBAC); cookie sessions only
- UI/API may change without compatibility promises before 0.2.0

## Docker/Compose quickstart
```bash
# 0) Build or pull the image (choose one)
# Build from this checkout:
docker build -t arciva:local .
# OR pull a published tag:
# docker pull ghcr.io/<your-namespace>/arciva:0.1.0 && docker tag ghcr.io/<your-namespace>/arciva:0.1.0 arciva:local

# 1) Prepare env (run in repo root)
cp deploy/.env.arciva.example deploy/.env.arciva
python - <<'PY'
import secrets; print(secrets.token_hex(32))
PY
# paste into deploy/.env.arciva -> SECRET_KEY=...
# set ARCIVA_IMAGE=arciva:local (or your GHCR tag)
256
# 2) Start the stack (repo root)
docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva up --build
# add -d to detach

# 3) Open http://localhost:8000  (set APP_PORT in env to change host port)

# Stop
docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva down
```
More ops details: `docs/self-hosting.md`.

## Local development (Pixi + pnpm)
```bash
# One-time toolchain
curl -fsSL https://pixi.sh/install.sh | bash
pixi install

# Env files
cp backend/.env.example .env
cp frontend/.env.example frontend/.env.local

# Prepare data dirs + schema
pixi run setup

# Full stack (API + worker + Vite dev server + Redis/Postgres helper)
pixi run dev-stack
# Individual: pixi run dev-backend | pixi run dev-frontend | pixi run test-backend | pixi run lint-frontend
```
Defaults: API on `http://localhost:8000`, frontend on `http://localhost:5173`, media in `.dev/app-data`.

## Documentation
- docs/README.md — navigation hub
- docs/self-hosting.md — Compose/self-hosting notes
- docs/backend/dev-guide.md — backend dev loop
- docs/frontend/setup.md — frontend setup
- docs/architecture/arc42.md — architecture overview
- docs/contributing/conventions.md — workflow & conventions

## License
MIT (subject to change before 1.0)
