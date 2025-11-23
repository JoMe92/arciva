# Arciva — Architecture (arc42-lite)

> Scope: Alpha release that ships a FastAPI API + ingest worker, React SPA, PostgreSQL, Redis/ARQ, and POSIX media storage (volumes). Default packaging is Docker/Compose; the API also serves the built SPA.

---

## 1. Introduction & Goals
**Business goals**
- Project-based photo management (create projects, import photos, browse).
- Clean separation of **metadata** (DB) and **binaries** (object storage).
- Cross-project reuse (import from existing assets without re-upload).

**Quality goals**
- Durable originals, fast browsing (thumbnails), stable identifiers, traceable states.

**Stakeholders**
- Product/engineering (you), end users/photographers, future ops.

---

## 2. Constraints
- Linux-first and containerised: Docker/Compose for deploys; Pixi + Docker for local dev.
- Backend: FastAPI (async), Python 3.11+. DB: PostgreSQL (SQLite supported for dev/single-node). Queue: Redis (ARQ worker). Storage: POSIX path/volume by default; S3/MinIO adapter on the roadmap.
- Small team; auth is basic email/password with session cookies.

---

## 3. Context & Scope
**External actors**: React SPA (browser), Object Storage (MinIO/S3 or POSIX FS), Redis, PostgreSQL.

**System boundary**: REST API exposes project/asset CRUD, presigned upload (when using object storage), and asset browsing.

---

## 4. Solution Strategy
- **Metadata in PostgreSQL**, **binaries in object storage**. Optional POSIX via pluggable adapter.
- **Content-addressed** global asset store (SHA-256) + **project links**.
- **Immutable originals**; **derived variants** (thumbnails/previews) are versioned.
- **Async ingest** (worker via Redis queue) for hashing, EXIF, thumbnails.
- **UUIDv4** for public IDs; DB handles relationships and uniqueness.

---

## 5. Building Block View (C4: Context/Containers/Key Components)
**Containers**
- API service (FastAPI): routing, auth, presigned URLs, metadata CRUD.
- Worker (ARQ/RQ): ingest pipeline (hash → EXIF → thumbs → DB update).
- PostgreSQL: projects, assets, project_assets, derivatives.
- Object Storage: `uploads/`, `originals/`, `derivatives/`. (Or POSIX directories.)

**Key Components**
- ProjectController, AssetController, ImportController.
- StorageAdapter (S3/MinIO or POSIX).
- IngestPipeline services (Hasher, ExifReader, DerivativeGenerator).

---

## 6. Runtime View (Main Scenarios)
**Create Project** → API inserts project → returns JSON.

**Upload** → `uploads/init` → browser uploads to storage → `uploads/complete` → worker processes → asset READY with derivatives.

**Import From Other Project** → API creates links in `project_assets` (no binary copy).

**Delete (per project)** → unlink; GC removes binary when refcount == 0 after grace period.

---

## 7. Deployment View (Docker/Compose)
- Compose brings up `app` (API + bundled SPA), `worker`, `postgres`, and `redis`. Media/logs/db live on named volumes. For dev, Pixi scripts can start the same topology or run services directly on the host (SQLite + POSIX storage by default).

---

## 8. Cross-cutting Concepts
- Identifiers: `project_id`, `asset_id` (UUIDv4), `sha256` for dedupe.
- Derivatives: normalized to sRGB JPEG/WebP; sizes 128/256/512 (configurable).
- Observability: structured logs; metrics for ingest duration, queue depth, errors.
- Security: presigned uploads (if S3/MinIO), size/mime limits, least-privilege storage keys.
- Data protection: client/notes may be PII → export/delete capabilities later.

---

## 9. Architecture Decisions (see ADRs for details)
- DB vs object storage; content-addressing; async ingest; immutable originals; mono-repo; queue selection; storage adapter abstraction.

---

## 10. Quality Requirements
- Latency: p95 `GET /projects` < 200 ms; grid page < 400 ms with cached thumbs.
- Durability: originals protected by storage versioning (when available) + backups.

---

## 11. Risks & Mitigations
- Large RAWs → streaming uploads, max size, thumbnails async.
- Eventual consistency → clear asset states and UI placeholders.
- GC safety → refcounts + grace period + idempotent deletes.

---

## 12. Glossary
- **Original**: uploaded source file (immutable).
- **Derivative**: computed variant (thumbnail/preview).
- **Content-addressed**: storage key derived from file hash.

---

## Appendix — Parking Lot
- Multi-tenancy model (single DB with tenant_id vs. DB-per-tenant).
- AuthN/AuthZ (OIDC vs. local JWT) and roles/permissions.
- Full-text/semantic search (pg_trgm, pgvector) and sync strategy.
- Derivative formats (WebP/AVIF) and color management profiles.
- Backup/restore RPO/RTO targets and runbooks.
