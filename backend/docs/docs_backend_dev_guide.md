# Backend Dev Guide (FastAPI + ARQ + POSIX)

This guide explains how to **develop**, **run**, and **test** the Nivio backend locally, including the worker (Terminal B) and the frontend integration.

---

## 1) Goals
- Implement the MVP flow: Create project → upload file → async ingest → thumbnail visible.
- Provide a repeatable dev loop with clear commands for API (Terminal A), Worker (Terminal B), and Frontend.

---

## 2) Prerequisites
- Linux, Python 3.11 (Conda/venv), Node LTS + pnpm
- PostgreSQL running with database/user
- Redis running (for ARQ)
- POSIX storage folders exist
- Repo root contains a **`.env`** (see `infra/local/INSTALL.md`)

---

## 3) Environment variables (recap)
Key variables in `.env` (repo root):
```
DATABASE_URL=postgresql+asyncpg://nivio:1234@127.0.0.1:5432/nivio_dev
REDIS_URL=redis://127.0.0.1:6379/0
ALLOWED_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
FS_ROOT=/home/<you>/photo-store
FS_UPLOADS_DIR=/home/<you>/photo-store/uploads
FS_ORIGINALS_DIR=/home/<you>/photo-store/originals
FS_DERIVATIVES_DIR=/home/<you>/photo-store/derivatives
THUMB_SIZES=[256]
```

---

## 4) One-time: Create tables
From the repo root:
```bash
conda activate nivio
python - <<'PY'
import asyncio
from backend.app.db import engine, Base
async def go():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(go())
PY
```

> For schema changes later, add Alembic migrations instead of re-running `create_all`.

---

## 5) Run services
### Terminal A — API
```bash
cd ~/dev/FilmCabinetFrontend
conda activate nivio
uvicorn backend.app.main:app --reload --port 8000
```
- Health: `http://127.0.0.1:8000/health` → `{ "ok": true }`

### Terminal B — Worker (ARQ)
```bash
cd ~/dev/FilmCabinetFrontend
conda activate nivio
arq backend.worker.worker.WorkerSettings
```
- Needs Redis reachable on `REDIS_URL`.

### Terminal C — Frontend (Vite)
```bash
cd ~/dev/FilmCabinetFrontend/frontend
pnpm install
pnpm dev
```
- Open `http://localhost:5173`.
- Ensure the frontend uses `VITE_API_BASE_URL=http://127.0.0.1:8000`.

---

## 6) Test the MVP flow (Terminal C or use Insomnia/Postman)
Assumes you have an image, e.g. `/home/<you>/Pictures/demo.jpg`.

```bash
API="http://127.0.0.1:8000"
FILE="/home/jome/dev/FilmCabinetFrontend/img/img_lev.jpg"
SIZE=$(stat -c%s "$FILE")
MIME=$(file --mime-type -b "$FILE")

# 1) Project create
curl -s -X POST "$API/v1/projects" \
  -H 'Content-Type: application/json' \
  -d '{ "title": "First Shoot", "client": "Acme", "note": "MVP demo" }'

# copy the returned "id" → PROJECT

# 2) Upload init
curl -s -X POST "$API/v1/projects/$PROJECT/uploads/init" \
  -H 'Content-Type: application/json' \
  -d "{ \"filename\": \"$(basename \"$FILE\")\", \"size_bytes\": $SIZE, \"mime\": \"$MIME\" }"

# copy "asset_id" → ASSET and "upload_token" → TOKEN

# 3) Upload file
curl -s -X PUT "$API/v1/uploads/$ASSET" \
  -H "X-Upload-Token: $TOKEN" \
  --data-binary @"$FILE"

# 4) Complete
curl -s -X POST "$API/v1/uploads/complete" \
  -H 'Content-Type: application/json' \
  -d "{ \"asset_id\": \"$ASSET\" }"

# 5) List assets
curl -s "$API/v1/projects/$PROJECT/assets"

# 6) Open thumb in browser
# http://127.0.0.1:8000/v1/assets/$ASSET/thumbs/256
```

> Tip: Use Insomnia/Postman and save a collection. Keep a sample image in the repo (e.g. `samples/demo.jpg`) for repeatable tests.

---

## 7) Developer workflow (tight loop)
1. Edit backend code in `backend/app/...` or worker in `backend/worker/...`.
2. API auto-reloads (`--reload`), worker needs manual restart if you change worker code.
3. Re-run the curl/Insomnia scripts. Watch terminal logs for errors.
4. For schema changes: create an Alembic migration (see “Migrations” below) and apply, then rerun tests.

---

## 8) Common tasks
- **Change allowed origins**: edit `ALLOWED_ORIGINS` in `.env` (JSON array or CSV).
- **Increase upload limits**: `MAX_UPLOAD_MB` in `.env`.
- **Add a new thumb size**: set `THUMB_SIZES=[128,256,512]` (worker must generate additional variants; code change needed in `imaging.py` and worker).
- **Switch storage**: later replace POSIX with MinIO adapter; endpoints remain the same.

---

## 9) Migrations (later)
Add Alembic for schema evolution:
- Init Alembic in `backend/migrations/`
- Generate migration: `alembic revision --autogenerate -m "add foo"`
- Apply: `alembic upgrade head`

Keep production data safe: no destructive autogenerates without review.

---

## 10) Debugging & troubleshooting
- **Internal Server Error on POST /v1/projects**: ensure `await db.refresh(p)` after `flush()` in `create_project`.
- **Worker cannot connect to Redis**: start Redis (`systemctl enable --now redis-server`), verify `redis-cli ping`.
- **Thumb 404**: worker logs; check that `FS_*` paths exist & are writable; Pillow installed.
- **CORS in browser**: `ALLOWED_ORIGINS` includes your frontend URL.
- **Bad UUID in upload**: ensure you pass the real `asset_id` from the init step.

---

## 11) Frontend integration notes
- Use `VITE_API_BASE_URL` from `.env` to point the SPA to the backend.
- For the upload: call `uploads/init` → then PUT file bytes with `X-Upload-Token` → then `uploads/complete` → poll assets.
- Show placeholders while `status` is `PROCESSING`; swap to thumb when `READY`.

---

## 12) Quality checks (MVP)
- Unit: small tests for `imaging.sha256_file`, `make_thumb`.
- Integration: upload flow E2E using a sample file; verify DB rows + files written.
- Logs: include `asset_id` in worker logs.

---

## 13) Commit & branching
- Branch naming: `feat/backend-mvp-projects-upload`
- Conventional Commits (e.g., `feat(backend): add uploads init/complete endpoints`).
- Keep ADRs updated when making architectural changes.

---

## 14) Next steps
- Add deduplication at API level (reuse asset by sha256 if exists).
- Implement multiple derivative sizes and lazy generation.
- Switch to MinIO presigned uploads for parity with cloud.
- Introduce Alembic and first real migration.

