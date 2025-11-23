# ADR-0006 — Queue Library: ARQ (Async) or RQ (Simple) on Redis

**Context**: FastAPI async stack; need simple, reliable job execution with retries.

**Decision**: Start with ARQ (async-native) on Redis. Allow RQ as fallback if the team prefers sync workers.

**Alternatives**: Celery (feature-rich but heavier), systemd timers (too limited).

**Consequences**: Lean ops, good fit for async; smaller ecosystem than Celery.
