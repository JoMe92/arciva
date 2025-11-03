# Nivio

[![Status](https://img.shields.io/badge/status-MVP%20%7C%20local%20setup-blue)](#)
[![Architecture Docs](https://img.shields.io/badge/docs-arc42%20%2B%20ADRs-informational)](docs/arc42-and-adrs.md)
[![Install Guide](https://img.shields.io/badge/infra-local%20install%20guide-brightgreen)](infra/local/INSTALL.md)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)
[![Stars](https://img.shields.io/github/stars/OWNER/REPO?style=social)](#)

Nivio is a modern, project‑based web workspace for visual assets. Create projects, ingest at speed, and browse crisp thumbnails immediately. Originals remain immutable; your library stays clean.

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
- Project‑first organization (client, shoot, concept)
- Clean separation: metadata in PostgreSQL; binaries in object storage (MinIO/S3) or POSIX via adapter
- Content‑addressed originals (SHA‑256) and versioned derivatives
- Async ingest pipeline (hash → EXIF → thumbnails) backed by Redis workers

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

Planned next: ratings/flags, quick filters, shareable previews, multi‑user auth.

---

## Quick Start (Step-by-step)
1. **Clone the repository**  
   ```bash
   git clone https://github.com/<your-org>/FilmCabinetFrontend.git
   cd FilmCabinetFrontend
   ```
2. **Install Pixi (manages Python + Node toolchains) and Docker (for Postgres/Redis helpers)**  
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
6. **Start the full developer stack** (FastAPI + worker + Vite + Postgres/Redis helpers)  
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
   - `dev.sh` (wrapped by `pixi run dev-stack`) brings up Postgres/Redis in Docker automatically; the backend performs migrations on startup.

Details with Linux commands: [infra/local/INSTALL.md](infra/local/INSTALL.md)

---

## Configuration
Environment lives in `.env` (template: `.env.example`). Each entry below includes what it controls, whether the bundled default is fine, and how to change it:

- **`APP_ENV`**: tells the backend which profile to load (`dev`, `staging`, `prod`). Leave as `dev` for local work; ops teams can override per deployment.
- **`SECRET_KEY`**: signing key for sessions and JWTs. The template ships with `changeme` so development works instantly. For any shared or public environment, replace it via `openssl rand -hex 32` (or `python -c 'import secrets; print(secrets.token_hex(32))'`) and keep it private.
- **`ALLOWED_ORIGINS__0/1/...`**: FastAPI reads these exploded keys and builds the CORS whitelist. Defaults grant requests from `http://localhost:5173` (the Vite dev server). Add more lines (increment the suffix) for any additional domains you serve the frontend from.
- **`DATABASE_URL`**: SQLAlchemy connection string. When you run `pixi run dev-stack`, Docker spins up Postgres with credentials `nivio:nivio` on port `5432` (or `5433` if already occupied). The template points at that instance. If you host Postgres elsewhere, swap in the appropriate URL (format: `postgresql+asyncpg://user:password@host:port/dbname`).
- **`REDIS_URL`**: URL for the task queue. The dev stack starts Redis on `localhost:6379`, matching the sample value. Override if you use a different Redis server.
- **`FS_ROOT`, `FS_UPLOADS_DIR`, `FS_ORIGINALS_DIR`, `FS_DERIVATIVES_DIR`**: local filesystem storage (POSIX adapter). Choose an absolute base path (e.g. `$HOME/photo-store`), use it consistently for all four variables, and create the directories with `mkdir -p <path>/{uploads,originals,derivatives}`.
- **`THUMB_SIZES`**: comma-separated list inside square brackets that defines which thumbnail widths (in pixels) the worker generates. `[512]` keeps processing light; add more sizes like `[256,512,1024]` when you need multiple renditions.
- **`MAX_UPLOAD_MB`**: maximum upload size FastAPI accepts. Set it to a safe upper bound for your workloads (defaults to `1000` MB).
- **`WORKER_CONCURRENCY`**: number of concurrent jobs the ARQ worker runs. Increase if you have spare CPU and need faster ingest.

Frontend-specific variables (notably `VITE_API_BASE_URL`) live in `frontend/.env.local`; copy or create that file with the API URL you expose (default: `http://localhost:8000`).

### Sample `.env` for local development
```env
APP_ENV=dev
SECRET_KEY=changeme
ALLOWED_ORIGINS__0=http://localhost:5173
ALLOWED_ORIGINS__1=http://127.0.0.1:5173

DATABASE_URL=postgresql+asyncpg://nivio:1234@127.0.0.1:5432/nivio_dev
REDIS_URL=redis://127.0.0.1:6379/0

FS_ROOT=/absolute/path/to/photo-store
FS_UPLOADS_DIR=/absolute/path/to/photo-store/uploads
FS_ORIGINALS_DIR=/absolute/path/to/photo-store/originals
FS_DERIVATIVES_DIR=/absolute/path/to/photo-store/derivatives

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
   These lines list every URL allowed to call the API from a browser. Keep the two localhost entries so the Vite dev server works. To expose the API to another site (e.g. `https://demo.example.com`), add a new line with the next index:  
   ```
   ALLOWED_ORIGINS__2=https://demo.example.com
   ```
5. **Point `DATABASE_URL` at PostgreSQL**  
   - If you run `pixi run dev-stack`, Docker launches Postgres with credentials `nivio`/`nivio` and database `nivio` on port `5432` (or `5433` if 5432 is in use). The template already matches this; only change it if you manage Postgres yourself.  
   - Custom setup? Follow the format `postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME`.
6. **Point `REDIS_URL` at Redis**  
   `dev-stack` starts Redis on `redis://127.0.0.1:6379/0`. Keep that value unless you connect to another Redis instance; in that case update the host/port and optional database number at the end.
7. **Prepare storage directories (`FS_*` variables)**  
   Decide where you want originals/derivatives stored (e.g. `$HOME/photo-store`), reflect that path in `FS_ROOT` and the derived variables, then create the folders:  
   ```bash
   mkdir -p /absolute/path/to/photo-store/{uploads,originals,derivatives}
   ```  
   If you prefer S3/MinIO, comment out the POSIX section and fill in the `S3_*` variables from `.env.example`.
8. **Optional tuning**  
   - `THUMB_SIZES`: list the thumbnail widths you need (e.g. `[256,512,1024]`).  
   - `MAX_UPLOAD_MB`: cap incoming uploads.  
   - `WORKER_CONCURRENCY`: bump up if you want the worker to process more files simultaneously.

---

## Architecture
- API (FastAPI): project/asset endpoints; presigned uploads when using object storage
- Worker (ARQ/RQ): ingest pipeline; retries & metrics
- PostgreSQL: projects, assets, `project_assets`, derivatives
- Storage: `uploads/`, `originals/`, `derivatives/` (MinIO/S3 or POSIX via adapter)

Full write‑up: [docs/arc42-and-adrs.md](docs/arc42-and-adrs.md)

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
