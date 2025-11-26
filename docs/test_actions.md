Backend-Tests: pixi run act -W .github/workflows/backend-ci.yml -j test
Frontend build/lint: pixi run act -W .github/workflows/frontend-ci.yml -j build
Docker build check: pixi run act -W .github/workflows/docker-check.yml -j build
Docker release: pixi run act -W .github/workflows/docker-release.yml -j publish