# Self-Hosting Arciva (v0.1.0)

This guide covers running Arciva yourself with Docker Compose, keeping it updated, and backing up your data.

## Prerequisites
- Docker Engine + Docker Compose plugin
- At least 4 GB RAM and a few GB of disk for media/thumbs
- A domain/host where port 8000 is reachable (or change `APP_PORT`)

## 1) Create the environment file
```bash
cp deploy/.env.arciva.example deploy/.env.arciva
# Required edits: SECRET_KEY (random), ARCIVA_IMAGE (if you tag differently), APP_PORT (optional)
# For Postgres: DATABASE_URL, POSTGRES_* should match if you changed credentials.
```
Generate a strong secret:
```bash
python - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
```

## 2) Start the stack
```bash
docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva up --build
# Run with -d to detach
```
Services:
- `app`: FastAPI API + bundled React SPA (serves on `${APP_PORT:-8000}`)
- `worker`: background ingest and thumbnailer
- `postgres`, `redis`: databases/cache

Default volumes (safe to delete only if you want a clean slate):
- `arciva_media` (uploads, originals, derivatives, exports)
- `arciva_logs` (API/worker logs)
- `arciva_postgres` (database) and `arciva_sqlite` (if you switch to SQLite)

## 3) Update to a newer image
```bash
docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva pull
docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva up -d
```
If you build locally, change `ARCIVA_IMAGE` to your tag first.

## 4) Back up your data
- **Database**: `docker compose -f deploy/docker-compose.arciva.yml exec postgres pg_dump -U ${POSTGRES_USER:-arciva} ${POSTGRES_DB:-arciva} > arciva-postgres.sql`
- **Media**: archive the media volume: `docker run --rm -v arciva_media:/data busybox tar czf - /data > arciva-media.tar.gz`
- **Logs (optional)**: `docker run --rm -v arciva_logs:/data busybox tar czf - /data > arciva-logs.tar.gz`

Restore by recreating volumes and untarring the archives, or by `psql`-ing the dump back into Postgres.

## 5) Troubleshooting
- API not reachable: ensure `APP_PORT` is free and exposed; check `docker compose ... logs app`.
- Thumbs not generating: worker logs live in `arciva_logs`; verify `APP_MEDIA_ROOT` volume is writable.
- CORS errors: set `ALLOWED_ORIGINS__*` in the env file to match your frontend URL.
