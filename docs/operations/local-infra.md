# Local infrastructure (no Compose)

Run Arciva locally on Linux without Docker/Compose using the Pixi-managed toolchain.

## Prerequisites
- Linux with Python 3.11+, Node 20+
- Redis running locally; Postgres optional (SQLite works out of the box)
- Pixi installed: `curl -fsSL https://pixi.sh/install.sh | bash`
- Absolute paths for DB/media (e.g. `$HOME/arciva-data/db/app.db` and `$HOME/arciva-data/media`)

## 1) Install dependencies
```bash
pixi install   # sets up Python, pnpm, exiftool, all deps
```

## 2) Configure env + data
```bash
cp backend/.env.example .env
cp frontend/.env.example frontend/.env.local
pixi run setup   # creates DB schema + media folders under .dev/app-data by default
```
Key vars in `.env`:
- `APP_DB_PATH`, `APP_MEDIA_ROOT` — must be absolute and writable
- `REDIS_URL` — defaults to `redis://127.0.0.1:6379/0`
- `DATABASE_URL` — set to Postgres DSN if you want Postgres instead of SQLite
- `ALLOWED_ORIGINS__*` — CORS; keep `ALLOW_LAN_FRONTEND_ORIGINS=true` for LAN devices

## 3) Start services
Use your local Redis/Postgres instead of containers:
```bash
USE_DOCKER=false pixi run dev-stack
# or start pieces:
pixi run dev-backend
PYTHONPATH=. pixi run python -m arq backend.worker.worker.WorkerSettings
pixi run dev-frontend
```

## 4) Verify
- API: http://localhost:8000/docs
- Frontend: http://localhost:5173
- Data/logs: `.dev/app-data` and `.dev/logs` (or your custom paths)

## 5) Backup/cleanup
- SQLite DB: copy the file at `APP_DB_PATH`
- Media: archive `APP_MEDIA_ROOT` (uploads/originals/derivatives/exports)
- Logs: `.dev/logs`
- Stop everything: `pixi run down`
