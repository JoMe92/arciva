# ADR-0003 — Immutable Originals; Derivatives are Versioned

**Context**: Trust and reproducibility for users; CDN/cache friendliness.

**Decision**: Originals are never modified after ingest. All edits produce new derivative objects under `derivatives/{sha256}/...`.

**Alternatives**: In-place edits (risk of data loss).

**Consequences**: More storage for derivatives; straightforward auditing and re-rendering.
