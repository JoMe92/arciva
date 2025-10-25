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
- High‑speed ingest with background processing
- Global library & cross‑project import (no re‑upload)
- Thumbnails/previews (sRGB) in multiple sizes
- Stable IDs (UUID) and reliable timestamps

Planned next: ratings/flags, quick filters, shareable previews, multi‑user auth.

---

## Quick Start (Linux, no Docker)
1. Install prerequisites: Python 3.11 (Conda or venv), Node LTS + pnpm, libvips + ExifTool, PostgreSQL, Redis, MinIO (or POSIX dirs).
2. Copy `.env.example` → `.env` at repo root and fill DB/Redis/Storage/App values.
3. Start services: PostgreSQL, Redis, and MinIO (or ensure POSIX directories exist).
4. Run backend API and worker (two terminals). Run the frontend from `frontend/`.
5. Smoke test: create a project, upload an image, see a thumbnail.

Details with Linux commands: [infra/local/INSTALL.md](infra/local/INSTALL.md)

---

## Configuration
Environment lives in `.env` (template: `.env.example`).

- Database: `POSTGRES_HOST/PORT/DB/USER/PASSWORD` or `DATABASE_URL`
- Redis: `REDIS_URL`
- Storage (choose one)
  - MinIO/S3: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_*`, `S3_USE_SSL`
  - POSIX FS: `FS_ROOT`, `FS_UPLOADS_DIR`, `FS_ORIGINALS_DIR`, `FS_DERIVATIVES_DIR`
- App: `APP_ENV`, `SECRET_KEY`, `JWT_SIGNING_KEY`, `ALLOWED_ORIGINS`, `THUMB_SIZES`, `MAX_UPLOAD_MB`, `WORKER_CONCURRENCY`
- Frontend: `VITE_API_BASE_URL`

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

