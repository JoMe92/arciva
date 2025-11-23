# Backend: Image Export Service – Specification

This document describes how the backend must implement the photo export service so that a web-based frontend can create and download export bundles from a remote server. It assumes the current architecture (FastAPI app, SQLAlchemy with a SQLite catalog, POSIX storage, ARQ worker backed by Redis) and should be detailed enough for implementation without constraining library-level choices.

---

## 1. Objectives & Scope
- Enable users to export a selected subset of project photos with configurable format, size, quality, logical folder structure, and optional contact sheet.
- Provide a REST API that lets the frontend create an export job, poll its status/progress, download the finished artifact, and optionally cancel a running job.
- Ensure the server can operate both as a hosted web backend (browser downloads the archive) and as a self-hosted/desktop backend (server writes to a configured folder in addition to exposing downloads).
- Keep the backend in charge of processing and packaging; the browser decides where the downloaded file lands on the user’s machine (standard download prompts or File System Access API).
- Prepare the architecture so work can move into a background queue (ARQ) without changing HTTP contracts.

Out of scope: frontend UI, client-side filesystem APIs, advanced auth beyond project ownership, implementing low-level imaging algorithms.

---

## 2. Architecture Overview
1. **FastAPI router** exposes `/api/export-jobs` endpoints.
2. **Export service layer** encapsulates validation, job creation, storage orchestration, and progress persistence.
3. **Worker/ARQ task** performs the heavy lifting: reads source assets, renders conversions, generates optional contact sheet, builds output directory, packages ZIP, and updates the ExportJob record throughout the lifecycle.
4. **Storage layout**: `${APP_MEDIA_ROOT}/exports` contains per-job working directories and generated archives. Working data should not pollute originals/derivatives folders.
5. **Cleanup task**: scheduled job removes artifacts older than a retention window, keeping metadata while unlinking binary files to avoid unbounded storage growth.

---

## 3. ExportJob Data Model
Add a new table/model `export_jobs` with at least the following fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID (pk) | Exposed to API consumers |
| `user_id` | UUID (fk users) | Owner/requesting user |
| `project_id` | UUID (fk projects) | Access control and filtering |
| `photo_ids` | JSONB array | Photo/asset identifiers included in export (stored as UUID strings) |
| `settings` | JSONB | Verbose object captured verbatim from frontend (validated structure below) |
| `status` | Enum | `queued`, `running`, `completed`, `failed`, `cancelled` |
| `progress` | SmallInt (0–100) | Optional but required in API responses |
| `artifact_uri` | Text | Path or URI to resulting ZIP/ directory |
| `artifact_size_bytes` | BigInt | Optional, filled at completion |
| `error_message` | Text | Human-friendly failure summary |
| `requested_at` | timestamptz | Creation timestamp |
| `started_at` | timestamptz | Worker picked up timestamp |
| `finished_at` | timestamptz | Set on completion/failure |
| `expires_at` | timestamptz | When cleanup can delete the artifact |
| `logical_export_path` | Text | Derived validated version of the requested logical path |

### 3.1 Settings Schema
The `settings` JSON should follow this canonical structure (validation occurs before job creation):
```json
{
  "output_format": "jpeg" | "tiff" | "png",
  "raw_strategy": "use_raw_original" | "use_developed_jpeg",
  "resize": {
    "mode": "original" | "long_edge",
    "long_edge_px": 2048
  },
  "jpeg_quality": 92,
  "contact_sheet": {
    "enabled": true,
    "format": "jpeg" | "tiff" | "pdf"
  },
  "logical_location": "Client_A/Delivery/May_2025",
  "self_hosted_target": null | "/srv/exports/client_a"
}
```
Validation must enforce supported formats, pixel bounds, and sanitize `logical_location` to a safe relative path (strip attempts to escape with `..`, reject absolute paths). `self_hosted_target` is optional and only honored when the server is configured to allow writing completed exports to arbitrary directories.

### 3.2 Status Lifecycle
1. `queued`: record persisted, waiting for worker.
2. `running`: worker started; `progress` > 0.
3. `completed`: archive ready, `progress = 100`.
4. `failed`: irrecoverable error during processing; `error_message` populated.
5. `cancelled`: user cancelled before completion.

Transition rules must prevent regression (e.g., no moving from completed back to running).

---

## 4. REST API

### 4.1 Create Export Job – `POST /api/export-jobs`
- **Body**:
```json
{
  "project_id": "uuid",
  "photo_ids": ["uuid", "..."],
  "settings": { ... }  // as defined above
}
```
- **Processing**:
  - Authenticate user.
  - Verify project visibility for user.
  - Ensure every `photo_id` belongs to the project (via `project_assets` links).
  - Validate `settings`.
  - Persist ExportJob with `status=queued`, `progress=0`.
  - Submit async task to ARQ (pass job id) or call service synchronously when worker queue is unavailable (design should allow easy switching).
- **Response**: ExportJob DTO containing `id`, `status`, `progress`, timestamps, `project_id`, `photo_ids`, `settings`, `download_url` (null initially).

### 4.2 Get Export Job – `GET /api/export-jobs/{job_id}`
- Ensures the job belongs to the requesting user.
- Returns latest DTO:
  - `status`, `progress`, `error_message`, `download_url` (present when completed), `expires_at`.
  - When `status=completed`, include `artifact_size_bytes` and `logical_location` to help frontend show metadata.

### 4.3 Download Artifact – `GET /api/export-jobs/{job_id}/download`
- Preconditions: job owner, `status=completed`, artifact still present.
- Implementation:
  - Look up artifact path/URI, ensure file exists.
  - Stream as `application/zip` (or the stored MIME if we later add TAR, PDF-only, etc.).
  - `Content-Disposition: attachment; filename="ProjectName_JobShortId.zip"`.
  - Consider range streaming for large files (FastAPI `FileResponse` or custom streaming generator).
- Errors: 404 if artifact missing or expired, 409 if job not completed, 403 if ownership mismatch.

### 4.4 Cancel Job – `POST /api/export-jobs/{job_id}/cancel` (optional)
- Allowed only for `queued` or `running` jobs.
- Marks `status=cancelled`, signals worker through shared flag (e.g., row-level check each step).
- Worker must respect cancellation checks between major processing phases (e.g., between files).
- Respond with updated DTO.

### 4.5 List Jobs – `GET /api/export-jobs?project_id=...` (optional)
- Convenience endpoint so frontend can show recent exports per project.

---

## 5. Processing Pipeline

### Step 1: Validation & Preparation
1. Lock job row (`SELECT FOR UPDATE`) to avoid double processing.
2. Re-validate that assets still exist and user still has access (in case they were removed after queueing).
3. Create per-job working directory: `${APP_MEDIA_ROOT}/exports/{job_id}/work`.
4. Create output directory inside work dir honoring `logical_location` (e.g., `work/Client_A/Delivery/...`). Ensure directories are created within the job sandbox only.

### Step 2: Source Resolution
- For each `photo_id`, resolve:
  - `asset_id` of RAW and/or processed JPEG from `project_asset_pairs` or derivatives tables.
  - The actual POSIX path via storage adapter (reuse existing `storage.py` or build helper).
- Decide which source to use per settings (`raw_strategy`). If RAW is missing but requested, fall back to developed JPEG and log warning inside job metadata.

### Step 3: Image Rendering
- For each asset:
  - Load image via imaging module (existing `backend/app/imaging.py` or an adapter around `wand`, `pillow`, etc.).
  - Convert format to requested `output_format`.
  - Resize according to `settings.resize`:
    - `original`: keep source dimensions.
    - `long_edge`: compute scale factor to set max(width, height) = `long_edge_px`.
  - Apply JPEG quality when `output_format=jpeg`.
  - Write output file to `<job_work_dir>/<logical_path>/<basename>.<ext>`.
- Track per-file progress increments (e.g., `progress = floor(processed_photos / total_photos * 80)` leaving headroom for contact sheet + packaging).

### Step 4: Contact Sheet (optional)
- When `contact_sheet.enabled`:
  - Build thumbnails (reuse existing derivative generator if possible) into an in-memory list or intermediate files.
  - Assemble grid (fixed columns/rows or dynamic based on count) and overlay filenames.
  - Export to requested format in the same logical folder (e.g., `ContactSheet.{jpg|tif|pdf}`).
  - Update progress chunk (e.g., +10%).

### Step 5: Packaging
- Hosted/default mode: zip the entire logical export directory.
  - Use Python `zipfile` with `ZIP_DEFLATED`.
  - Archive path: `${APP_MEDIA_ROOT}/exports/{job_id}/export.zip`.
  - Store absolute path/URI in `artifact_uri`.
  - Remove intermediate files only after zipping succeeds, or keep them until cleanup if needed for debugging.
- Self-hosted optional mode:
  - If `settings.self_hosted_target` is set and configured as allowed, copy/rsync the logical directory there (mirroring folder structure) and record that path in metadata while still producing the ZIP for download (unless config opts out).

### Step 6: Finalize
- Update job row with:
  - `status=completed`, `progress=100`, `artifact_uri`, `artifact_size_bytes`, `finished_at`, `expires_at = now + retention`.
- On failure:
  - Catch exceptions, set `status=failed`, `progress` to the percentage reached, `error_message` trimmed to ~1 KB, `finished_at=now`.
  - Delete partial artifacts if safe; otherwise flag worker logs for manual cleanup.

### Step 7: Cleanup Hook
- After finishing, schedule asynchronous deletion of job work directory if not needed.
- The periodic cleanup job queries for `finished_at < now - retention` and deletes:
  - ZIP/archive file.
  - Working directory.
  - Nulls `artifact_uri` to avoid future download attempts (download endpoint should return 410 Gone once file is removed).

---

## 6. Progress Tracking & Concurrency
- Progress should be monotonic 0–100. Suggested breakdown:
  - 0–5%: validation + setup.
  - 5–85%: per-photo processing (evenly distributed).
  - 85–95%: contact sheet (if enabled) or reserved buffer.
  - 95–100%: packaging + finalization.
- Worker updates progress after each batch (e.g., commit DB transaction or use `UPDATE ... WHERE id`).
- Use optimistic locking (compares `status` before update) or row-level locks to avoid overlapping workers.
- Add indexes on `export_jobs (user_id)` and `(project_id)` for filtering, plus `status` to support cleanup queries.

---

## 7. Security & Validation
- Every endpoint checks authenticated user id.
- Export job rows include `user_id`; queries always filter by it to prevent ID enumeration.
- `photo_ids` validation ensures:
  - All belong to same project id in request.
  - User has rights to that project.
  - Duplicates removed.
- Input sanitization:
  - Reject empty photo list.
  - Clamp `jpeg_quality` (e.g., 10–100).
  - Enforce `long_edge_px` sensible limits (e.g., 512–20000).
  - Clean `logical_location` with `pathlib.PurePosixPath` and allow only one level of nested directories (configurable).
- Download endpoint must not follow symlinks when streaming to avoid path traversal.

---

## 8. Configuration & Deployment Considerations
- New environment variables:
  - `APP_MEDIA_ROOT` already provides `${APP_MEDIA_ROOT}/exports` for job artifacts—ensure the directory is writable.
  - `EXPORT_ARTIFACT_RETENTION_HOURS` – TTL for download artifacts (mirrors `export_retention_hours` in settings).
  - `EXPORT_MAX_PARALLEL_JOBS` – limit worker concurrency (enforced via ARQ or semaphore).
  - `EXPORT_QUEUE_NAME` – ARQ queue; default `exports`.
  - `EXPORT_ALLOW_SELF_HOSTED_TARGETS` – flag to honor `self_hosted_target`.
- Logging:
  - Tag each log with `export_job_id`.
  - Emit structured logs on status transitions for observability.
- Metrics (optional):
  - Count jobs per status, durations, bytes exported.

---

## 9. Cleanup Strategy
- Implement a scheduled task (ARQ cron or FastAPI background task) that runs hourly:
  1. Find `export_jobs` where `finished_at < now - retention` and `artifact_uri` is not null.
  2. Delete artifact file(s) safely.
  3. Update row to null out `artifact_uri` and set `status` to `expired` (optional) or leave as completed but with `download_url=null`.
  4. Log summary counts.
- Optional: remove rows entirely after a much longer archival period (e.g., 30 days) if storage is a concern, but keep at least metadata for audit.

---

## 10. Future Enhancements
- Replace ZIP packaging with streaming tarball for very large exports (supported by HTTP range requests).
- Integrate checksum manifest (e.g., `manifest.json` inside ZIP) to help clients verify integrity.
- Allow per-job notification hooks (websocket or email) when export completes.
- Add fine-grained progress for contact sheet rendering.
- Support multi-part downloads (split archives) for >4 GB exports.

---

Implementing the service per this specification will provide a robust backend foundation for project exports, works across hosted and self-hosted deployments, and leaves room for future worker scalability and richer client integrations without altering the API surface.
