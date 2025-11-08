# ADR-0004 — Asynchronous Post-Upload Processing

**Context**: Hashing, EXIF extraction, thumbnails can be slow.

**Decision**: Use Redis-backed worker (ARQ or RQ) to handle ingest pipeline; API responds quickly and updates DB asynchronously.

**Alternatives**: Inline processing (slow requests), OS cron jobs (poor feedback/observability).

**Consequences**: Eventual consistency; need job retries/metrics and an asset state machine.
