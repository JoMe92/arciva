# Arciva

[![Status](https://img.shields.io/badge/status-MVP%20%7C%20local%20setup-blue)](#)
[![Architecture Docs](https://img.shields.io/badge/docs-arc42%20%2B%20ADRs-informational)](docs/architecture/arc42.md)
[![Install Guide](https://img.shields.io/badge/infra-local%20install%20guide-brightgreen)](docs/operations/local-infra.md)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)
[![Stars](https://img.shields.io/github/stars/OWNER/REPO?style=social)](#)

Arciva — Organize once. Find forever.
Project-first photo management with smart cards, fast search, and reliable archiving with zero fuss.

Workflows that stick: From intake to export—one flow, no context switching.

Arciva turns projects into smart cards—so your people shots, letters, and assets stay organized and instantly findable.
Arciva is a project-centric photo archive with indexed metadata, fast retrieval, and predictable structure.
Arciva keeps every project on file and at your fingertips—organized once, found forever.

> Status: MVP in active development (local setup without Docker). Containers will follow later.

---

## Table of Contents
- [Overview](#overview)
- [Screenshots](#screenshots)
- [Features](#features)
- [Quick Start (Linux, no Docker)](#quick-start-linux-no-docker)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview
- Project cards, not folders: every people shoot, letter, or brief lives on a single scannable card with people, files, notes, and status.
- Templates and scoped collections enforce consistent fields, statuses, and storage rules across Case / People / Admin workflows.
- Smart indexing (EXIF, faces, tags, OCR text, filenames) lets you find any asset instantly—scoped to a project or across the whole archive.
- Rules & retention, permissions, and immutable audit trails keep large teams and administrations governance-ready.

---

## Screenshots
Add your UI screenshots here. Example:

![Project Overview](docs/Bildschirmfoto%20vom%202025-10-25%2012-21-14.png)
![Grid View](docs/Bildschirmfoto%20vom%202025-10-25%2012-22-32.png)

> Paths use spaces; they are URL‑encoded in Markdown as `%20`.

---

## Features
- Create/edit projects (title, client, notes)
- High-speed ingest with background processing
- Global library & cross-project import (no re-upload)
- Thumbnails/previews (sRGB) in multiple sizes
- RAW ingest support (embedded thumbnails + metadata via rawpy)
- Stable IDs (UUID) and reliable timestamps

Planned next: ratings/flags, quick filters, shareable previews, multi-user auth.

---

## Documentation Map
- [Docs index](docs/README.md) for quick navigation
- [Architecture overview](docs/architecture/arc42.md) and [ADRs](docs/architecture/adrs/README.md)
- [Backend dev guide](docs/backend/dev-guide.md) and [frontend setup](docs/frontend/setup.md)
- [Local infrastructure install](docs/operations/local-infra.md)
- [Conventions & workflow](docs/contributing/conventions.md) plus [Agents](Agents.md) for automation guardrails

---

## Quick Start (Step-by-step)
1. **Clone the repository**  
   ```bash
   git clone https://github.com/<your-org>/FilmCabinetFrontend.git
   cd FilmCabinetFrontend
   ```
2. **Install Pixi (manages Python + Node toolchains) and Docker (for Redis helper services)**  
   ```bash
   curl -fsSL https://pixi.sh/install.sh | bash
   echo 'export PATH="$HOME/.pixi/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```
3. **Bootstrap dependencies** (creates the Pixi environment, installs Python packages, pnpm, etc.)  
   ```bash
   pixi install
   ```
4. **Create your environment files**  
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   ```
   Follow the [`.env` step-by-step guide](#step-by-step-fill-in-env) to set required values. Update `frontend/.env.local` with the API URL (default `http://localhost:8000`).
5. **(POSIX storage) Create local asset directories**  
   ```bash
   export PHOTO_STORE_DIR="$HOME/photo-store"
   mkdir -p "${PHOTO_STORE_DIR}"/{uploads,originals,derivatives}
   ```
   Replace `$HOME/photo-store` with any absolute path you prefer and use the same path later in `.env`.
6. **Start the full developer stack** (FastAPI + worker + Vite + Redis helper)  
   ```bash
   pixi run dev-stack
   ```
   - Backend only: `pixi run dev-backend`
   - Frontend only: `pixi run dev-frontend`
   - Tests: `pixi run test-backend`, `pixi run lint-frontend`
7. **Verify the setup**  
   - API docs: http://localhost:8000/docs  
   - Frontend: http://localhost:5173  
   - Logs: `.dev/logs/` (created automatically)
8. **Shut everything down when done**  
   ```bash
   pixi run down
   ```
   - `dev.sh` (wrapped by `pixi run dev-stack`) brings up Redis (and an optional Postgres container) in Docker automatically; the backend performs migrations on startup.

Details with Linux commands: [docs/operations/local-infra.md](docs/operations/local-infra.md)

## Docker Compose (one-image stack)
1. Copy the template and set secrets:
   ```bash
   cp deploy/.env.arciva.example deploy/.env.arciva
   # edit deploy/.env.arciva (SECRET_KEY, DATABASE_URL, media paths, etc.)
   ```
2. Build or pull the single Arciva image (set `ARCIVA_IMAGE` to a pulled tag if you prefer GHCR):
   ```bash
   docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva up --build
   ```
   - API + static frontend live on http://localhost:8000 (configurable via `APP_PORT`).
   - The worker runs from the same image (`command: worker`).
3. Data lives in named volumes: `arciva_postgres` (DB), `arciva_media` (uploads/derivatives/exports), plus `arciva_logs` and `arciva_sqlite` for optional local DB/log retention.

---

## Configuration
Environment lives in `.env` (template: `.env.example`). Each entry below includes what it controls, whether the bundled default is fine, and how to change it:

- **`APP_ENV`**: tells the backend which profile to load (`dev`, `staging`, `prod`). Leave as `dev` for local work; ops teams can override per deployment.
- **`SECRET_KEY`**: signing key for sessions and JWTs. The template ships with `changeme` so development works instantly. For any shared or public environment, replace it via `openssl rand -hex 32` (or `python -c 'import secrets; print(secrets.token_hex(32))'`) and keep it private.
- **`ALLOWED_ORIGINS__0/1/...`**: FastAPI reads these exploded keys and builds the CORS whitelist. Defaults grant requests from `http://localhost:5173` (the Vite dev server). Add more lines (increment the suffix) for any additional domains you serve the frontend from. When `ALLOW_LAN_FRONTEND_ORIGINS=true`, the backend automatically adds every local IPv4 address (e.g. `http://192.168.1.42:5173`) so phones or tablets on your Wi‑Fi can reach the API without editing `.env`.
- **`ALLOW_LAN_FRONTEND_ORIGINS` / `DEV_FRONTEND_PORT`**: Toggle the automatic LAN origin feature described above and pick the port the Vite dev server exposes (defaults: `true` / `5173`).
- **`APP_DB_PATH`**: absolute path to the SQLite database file (must end with `.db`). Point it at your dedicated data directory, e.g. `/app-data/db/app.db` or `$HOME/arciva-data/db/app.db`. The backend creates parent folders as needed and fails fast if it cannot read/write the file.
- **`REDIS_URL`**: URL for the task queue. The dev stack starts Redis on `localhost:6379`, matching the sample value. Override if you use a different Redis server.
- **`APP_MEDIA_ROOT`**: absolute path to the media root (e.g. `/app-data/media`). All uploads/originals/derivatives/exports live under this directory. Moving the entire data directory now boils down to copying this folder to a new disk/server and updating the environment variable.
- **`THUMB_SIZES`**: comma-separated list inside square brackets that defines which thumbnail widths (in pixels) the worker generates. `[512]` keeps processing light; add more sizes like `[256,512,1024]` when you need multiple renditions.
- **`MAX_UPLOAD_MB`**: maximum upload size FastAPI accepts. Set it to a safe upper bound for your workloads (defaults to `1000` MB).
- **`WORKER_CONCURRENCY`**: number of concurrent jobs the ARQ worker runs. Increase if you have spare CPU and need faster ingest.

Frontend-specific variables (notably `VITE_API_BASE_URL`) live in `frontend/.env.local`. The SPA now infers the backend URL from the machine that served it (protocol + hostname + port `8000`), so you only need to set `VITE_API_BASE_URL` when the API lives elsewhere (e.g. remote staging).

### Sample `.env` for local development
```env
APP_ENV=dev
SECRET_KEY=changeme
ALLOWED_ORIGINS__0=http://localhost:5173
ALLOWED_ORIGINS__1=http://127.0.0.1:5173
ALLOW_LAN_FRONTEND_ORIGINS=true
DEV_FRONTEND_PORT=5173

APP_DB_PATH=$HOME/arciva-data/db/app.db
APP_MEDIA_ROOT=$HOME/arciva-data/media
REDIS_URL=redis://127.0.0.1:6379/0

THUMB_SIZES=[512]
MAX_UPLOAD_MB=1000
WORKER_CONCURRENCY=2
```

### Step-by-step: fill in `.env`
1. **Copy the template**  
   ```bash
   cp .env.example .env
   ```
   Work inside `.env`; keep `.env.example` untouched so newcomers always have a reference.
2. **Set `APP_ENV`**  
   Leave it as `dev` for local development. When you deploy to staging or production, change the value there (e.g. `staging`, `prod`) so logs and feature flags adapt automatically.
3. **Generate a `SECRET_KEY`**  
   For local work you can stick with the provided `changeme`, but it is safer (and required for shared environments) to replace it:  
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```  
   Paste the output into `SECRET_KEY=...` and keep it private.
4. **Configure `ALLOWED_ORIGINS__*` (CORS)**  
   These lines list every URL allowed to call the API from a browser. Keep the two localhost entries so the Vite dev server works. When you leave `ALLOW_LAN_FRONTEND_ORIGINS=true`, the backend adds every LAN IP:port combo automatically, so devices on the same Wi‑Fi can talk to the API immediately. To expose the API to another site (e.g. `https://demo.example.com`), add a new line with the next index:  
   ```
   ALLOWED_ORIGINS__2=https://demo.example.com
   ```
5. **Select a data root (`APP_DB_PATH`, `APP_MEDIA_ROOT`)**  
   - Decide on a directory reserved for runtime data (e.g. `/app-data`).  
   - Place the database under `/app-data/db/app.db` (or similar) and set `APP_DB_PATH` accordingly.  
   - Point `APP_MEDIA_ROOT` at `/app-data/media`. The backend will create `uploads/`, `originals/`, `derivatives/`, and `exports/` inside this directory on startup.
6. **Point `REDIS_URL` at Redis**  
   `dev-stack` starts Redis on `redis://127.0.0.1:6379/0`. Keep that value unless you connect to another Redis instance; in that case update the host/port and optional database number at the end.
7. **(Optional) tune media handling**  
   If you rely on object storage or external volumes you can still plug in custom adapters, but the default POSIX storage now keeps everything inside `APP_MEDIA_ROOT`. Ensure the process has read/write access before starting the API.
8. **Optional tuning**  
   - `THUMB_SIZES`: list the thumbnail widths you need (e.g. `[256,512,1024]`).  
   - `MAX_UPLOAD_MB`: cap incoming uploads.  
   - `WORKER_CONCURRENCY`: bump up if you want the worker to process more files simultaneously.

### Startup validation & troubleshooting
- The backend validates `APP_DB_PATH` and `APP_MEDIA_ROOT` before binding the HTTP port. Both paths must be absolute, writable, and the database path must end with `.db`. Parent directories are created automatically; if creation fails you will see an `arciva.config` error and the server will refuse to start.
- Successful startup logs look like this (also mirrored to `backend/logs/backend.log`):  
  `INFO | arciva.startup | Using database: /media/jome/data/test/db/app.db`  
  `INFO | arciva.startup | Using media root: /media/jome/data/test/media`  
  `INFO | arciva.startup | CORS allow_origins: http://localhost:5173, http://127.0.0.1:5173`
- When the configured database file is empty or missing tables the API now bootstraps the entire schema on startup. Look for `arciva.schema | ensure_base_schema` in the logs; if it fails, the process aborts with a clear error instead of serving broken endpoints.
- When a path is misconfigured you will see a descriptive error such as `APP_DB_PATH must point to a .db file` or `Unable to create media subdirectory 'uploads'`. Fix the offending environment variable and restart; the API process will not run in a half-configured state.
- HTTP 5xx responses now include a JSON body (`{"detail": "Internal server error. See logs."}`) and still carry `Access-Control-Allow-Origin` headers, so browser console errors will reference the real failure instead of a CORS violation. Check the API log for the underlying stack trace and the validated path values mentioned above.

### Migrating existing installs
Older deployments stored absolute filesystem paths inside the database. After setting `APP_MEDIA_ROOT`, run the helper script to convert those entries into relative keys so you can move `/app-data` freely:

```bash
python backend/tools/migrate_media_paths.py --db "$APP_DB_PATH" --media-root "$APP_MEDIA_ROOT"
```

Add `--dry-run` to preview the changes without writing to the database. The script also accepts `--prefix /old/location/media` when your historical media lived somewhere else and the new root differs.

---

## Architecture
- API (FastAPI): project/asset endpoints; presigned uploads when using object storage
- Worker (ARQ/RQ): ingest pipeline; retries & metrics
- SQLite catalog (`APP_DB_PATH`): projects, assets, `project_assets`, derivatives
- Storage: `uploads/`, `originals/`, `derivatives/` (MinIO/S3 or POSIX via adapter)

Full write-up: [docs/architecture/arc42.md](docs/architecture/arc42.md)

---

## Roadmap
1. MVP (local): projects, ingest, thumbnails, cross‑project import
2. Cloud build (optional Docker), staging demo
3. Advanced search & ratings; share links; multi‑user
4. Performance & polish: virtualized grids, hotkeys, bulk actions

Track progress in Issues/Projects.

---

## Contributing
- Open issues for bugs/ideas with clear steps and context
- Follow ADRs for architectural changes
- Use Conventional Commits (feat, fix, chore, docs, refactor, perf, test, build, ci)

---

## License
MIT (subject to change before 1.0).
