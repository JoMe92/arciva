# CI/CD Workflows

- `frontend-ci.yml`: PR/push on `main`; Node 20 + pnpm; `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build`.
- `backend-ci.yml`: PR/push on `main`; Python 3.11; `pip install -r requirements.txt`, `pytest -q`.
- `docker-check.yml`: PR/push on `main`; builds the frontend Docker image with Buildx (no push) to ensure Dockerfile validity.
- `codeql.yml`: CodeQL analysis for JS + Python on PR/push to `main`.

## Branch protection

Require at least these checks on `main`: `Frontend CI`, `Backend CI`, `Docker Build Check` (plus `CodeQL Analysis` if you want static analysis enforced).***
