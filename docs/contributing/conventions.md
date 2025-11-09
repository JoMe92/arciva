# Contributing & Workflow

This repo follows the guardrails in `Agents.md`. Use this guide as the human-friendly summary.

## Commit style
- Use [Conventional Commits](https://www.conventionalcommits.org/) such as `feat(api): add project upload endpoint`.
- Keep work on focused branches (e.g., `feat/backend-ingest`), then open PRs with context and testing notes.

## Coding expectations
- Backend: Python 3.11+, FastAPI services with type hints, docstrings, and layered architecture (`routers/`, `services/`, `models/`, `schemas/`).
- Frontend: React + TypeScript with modular components, TanStack Query for data flows, Tailwind for styling.
- Update or add documentation whenever APIs or UI flows change.

## Quality bar
1. Format & lint (`black`, `ruff`, `mypy` for backend, ESLint/Prettier for frontend).
2. Run targeted tests before pushing (unit + workflow scripts in readmes).
3. Document significant architecture decisions via ADRs.

## Automation guardrails
- `Agents.md` codifies requirements for AI assistants touching the repo. Reference it directly if you script or automate changes.

## Need more detail?
- Architecture background: [arc42 overview](../architecture/arc42.md)
- Dev environment runbooks: [Backend guide](../backend/dev-guide.md), [Local infra](../operations/local-infra.md)
