# CI/CD Workflows

- `codeql.yml` ensures CodeQL runs on every PR targeting `main` and on pushes to `main`, surfacing a `CodeQL Analysis` check that fails if new high/critical findings are introduced.
- `docker-build-publish.yml` builds the front-end container from the `frontend` folder, scans the `:sha-` image with Trivy, and pushes `:sha`, `:latest`, and `:v*` tags to GHCR (as `arciva-frontend`) when the workflow runs on `main` or a release tag.
- `release.yml` fires on `v*` tags, bundles the built `frontend/dist`, generates an SBOM via Syft, and publishes a GitHub Release with attached artifacts plus commit-range-based notes.
- `deploy-staging.yml` runs after a successful `Docker Build & Publish` on `main` (or via `workflow_dispatch`), targets the `staging` environment, executes smoke tests against `STAGING_URL`, and reports the `arciva-frontend` image SHA plus staging URL in the deployment summary.
- `deploy-prod.yml` is a manual `workflow_dispatch` rollout that targets the `production` environment, exercises a canary+promotion pattern with smoke checks, and records rollback guidance along with the deployed `arciva-frontend` image reference.
- `e2e.yml` runs the `Happy path UI tests` job on PRs (against the preview URL) and nightly on staging, requiring the happy-path HTTP check to succeed and uploading diagnostics when it fails.

## Environment secrets & branch protection

- Configure the `staging` environment to provide `STAGING_URL` (used by `deploy-staging.yml` and the nightly E2E run) and the `production` environment to provide `PROD_URL` (used by `deploy-prod.yml`).
- Provide `PREVIEW_URL` or `PREVIEW_URL_TEMPLATE` (with `{{PR_NUMBER}}`/`{{BRANCH}}` placeholders) as repository secrets so PR-based previews can be exercised by the E2E workflow.
- Protect `main` by requiring the existing `Frontend CI`/`Backend CI` checks plus the new `CodeQL Analysis`, `Docker Build & Publish`, and `E2E Suite / Happy path UI tests` statuses before allowing merges.
