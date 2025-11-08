# ADR-0002 — Content-Addressed Global Asset Store (SHA-256)

**Context**: Avoid duplicates, enable cross-project reuse.

**Decision**: Compute SHA-256 for each original; canonical key `originals/{sha256}.{ext}`; unique constraint on `assets.sha256`; projects reference assets via link table.

**Alternatives**: Per-project file trees; name-based de-duplication.

**Consequences**: Extra CPU for hashing; simpler import/linking; precise GC by refcount.
