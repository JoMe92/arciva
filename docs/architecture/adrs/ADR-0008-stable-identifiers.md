# ADR-0008 — Stable Identifiers (UUIDv4 for public IDs)

**Context**: Avoid leaking counts, enable offline generation, safe merges.

**Decision**: Use UUIDv4 for `project_id` and `asset_id`.

**Alternatives**: Auto-increment ints.

**Consequences**: Larger keys; globally unique and stable.
