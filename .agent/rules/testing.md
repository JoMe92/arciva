---
description: Standards for Unit, Integration, and E2E testing and Linting.
globs: ["**/*.py", "**/*.ts", "**/*.tsx", "**/*.rs"]
---

# Quality Assurance Standards

## Testing Hierarchy

1. **Unit Tests:** Mandatory for every functionality. Written *during* development (TDD).
2. **Integration Tests:** Required for logical building blocks or sub-issues.
3. **E2E Tests:** Required for UI changes or complex workflows involving the "Image Hub" or User Interface.

## Linting & Formatting

- **Python:** Use `flake8` and `black`.
- **Frontend:** Use project-specific ESLint/Prettier configs.
- **Rust:** Use `cargo fmt` and `clippy`.
- **Rule:** Run checks continuously, but **mandatorily** before finishing a task.

## Test Execution

- If tests fail, attempt to fix them. If they fail twice, stop and report to the user.
- Verify that CI pipelines in GitHub Actions match local test results.
