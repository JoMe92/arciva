# ADR-0001 — Metadata in PostgreSQL, Binaries in Object Storage

**Context**: Need reliable queries on projects/assets and durable storage for large image files.

**Decision**: Store metadata in PostgreSQL; store image bytes in Object Storage (MinIO/S3). Keep only keys/paths in DB.

**Alternatives**: Filesystem only (simple, limited scalability), DB BLOBs (backup bloat, performance issues).

**Consequences**: Requires storage service and presigned upload flow; clean scalability and backups.
