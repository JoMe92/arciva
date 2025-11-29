Backend-Tests: pixi run act -W .github/workflows/backend-ci.yml -j test
Frontend build/lint: pixi run act -W .github/workflows/frontend-ci.yml -j build
Docker build check: pixi run act -W .github/workflows/docker-check.yml -j build
Docker release: pixi run act -W .github/workflows/docker-release.yml -j publish --secret-file .env --actor JoMe92

Notes:
- `.env` must contain `GITHUB_TOKEN=<token>` (no quotes/exports) and must stay untracked.
- The token must allow GHCR push: for PAT, enable Packages read/write and repo access to this repo (and SSO if required).
