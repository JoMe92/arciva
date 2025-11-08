# ADR-0007 — Pluggable Storage Adapter (MinIO/S3 and POSIX Filesystem)

**Context**: No Docker now; some environments may lack MinIO.

**Decision**: Define a storage adapter interface; implement S3/MinIO and POSIX backends. Switch by configuration.

**Alternatives**: Hard-code one backend.

**Consequences**: Slight abstraction overhead; easy migration from POSIX → S3 later.
