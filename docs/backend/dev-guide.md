# Backend Dev Guide (FastAPI + worker)

Up-to-date instructions for hacking on the backend with the Pixi toolchain and the dev helper script (`dev.sh`).

## Prerequisites
- Pixi installed (`curl -fsSL https://pixi.sh/install.sh | bash`)
- Docker (optional) — `pixi run dev-stack` will spin up Postgres/Redis containers when needed
- Media + DB paths in `.env` must be absolute

## 1) Setup
```bash
pixi install                              # Python, Node, pnpm, deps
cp backend/.env.example .env             # backend settings
cp frontend/.env.example frontend/.env.local
pixi run setup                            # create DB schema + media folders in .dev/app-data
```
Key env vars (see backend/.env.example):
- `APP_DB_PATH`, `APP_MEDIA_ROOT`: absolute paths; defaults live under `.dev/app-data`
- `REDIS_URL`: defaults to local Redis (dev stack injects `redis://127.0.0.1:<port>/0`)
- `ALLOWED_ORIGINS__*`: CORS for Vite (`5173`) plus optional LAN auto-detection

## 2) Run
- Full stack (API + worker + Vite + Redis/Postgres if missing):
  ```bash
  pixi run dev-stack   # Ctrl+C to stop, pixi run down to clean up
  ```
- Backend only:
  ```bash
  pixi run dev-backend
  ```
- Worker only:
  ```bash
  PYTHONPATH=. pixi run python -m arq backend.worker.worker.WorkerSettings
  ```
- Tests: `pixi run test-backend`

API: http://localhost:8000 (OpenAPI at `/docs`)  
Media/logs: `.dev/app-data` and `.dev/logs`

## 3) Dev loop
1. Edit code under `backend/app` or worker under `backend/worker`.
2. `uvicorn --reload` auto-restarts; restart the worker after worker code changes.
3. Re-run the ingest flow: create project → `uploads/init` → PUT bytes with `X-Upload-Token` → `uploads/complete` → fetch thumb `/v1/assets/{id}/thumbs/256`.

## 4) Common tweaks
- Bigger uploads: `MAX_UPLOAD_MB=...`
- More thumbnails: `THUMB_SIZES=[256,1024]`
- Postgres instead of SQLite: set `DATABASE_URL` and keep `APP_MEDIA_ROOT` on a writable volume.
- LAN testing: keep `ALLOW_LAN_FRONTEND_ORIGINS=true` and use phones/tablets on the same network.

## 5) Troubleshooting
- Config aborts on startup → check absolute paths for `APP_DB_PATH`/`APP_MEDIA_ROOT` and permissions.
- Worker not processing → verify Redis (`redis-cli -u $REDIS_URL ping`) and check `.dev/logs/worker.err.log`.
- CORS in browser → add your frontend origin as `ALLOWED_ORIGINS__N=...`.
- Introduce Alembic and first real migration.
