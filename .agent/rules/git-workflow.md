---
description: Strict rules for GitHub Issues, Branching, Commits, and Pull Requests.
globs: ["**/*"]
alwaysApply: true
---

# GitHub & Git Workflow

## 1. Issues & Planning

- **Pre-requisite:** No code is written without an assigned GitHub Issue.
- **Creation:** If no issue exists, create one. Fill out:
  - **Labels:** Meaningful classifications.
  - **Project Board:** Set Status (Backlog -> In Progress -> Done) and Size (XS, S, M, L, XL).
- **Sub-Issues:** If a task is too large, create Sub-Issues. However, **all sub-issues share the Parent Issue's branch**.

## 2. Branching Strategy

- **Main:** Releases only.
- **Develop:** Integration branch (staging).
- **Feature Branches:** Created from `develop`.
- **Naming Convention:** `type/issue-id-short-description` (e.g., `feat/12-image-upload`).

## 3. Commits

- **Granularity:** Logical units (no micro-commits, no massive dumps).
- **Format:** Conventional Commits (`feat: ...`, `fix: ...`).
- **Referencing:** **MUST** include the Issue ID in the footer or body (e.g., `Closes #12` or `Refs #12`). If it's a sub-issue, reference the Parent Issue ID as well.

## 4. Pull Requests (PR)

- Target: `develop`.
- **Prerequisites:**
  1. Local Linting passed (e.g., Flake8, Black, ESLint).
  2. All Tests passed.
  3. CI Pipelines checked. If CI fails, fix it immediately.
- **Merging:** explicit user approval required.
