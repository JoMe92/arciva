---
description: "Explicit permissions for autonomous browser interaction and script execution on localhost."
globs: ["**/*"]
alwaysApply: true
---

# Autonomous Execution Permissions

To accelerate the development workflow, the following permissions are explicitly granted to the Agent:

## 1. Browser Automation (Localhost)

- **NO CONFIRMATION REQUIRED:**
  - Executing JavaScript for DOM analysis (e.g., `document.querySelector`, `getComputedStyle`).
  - Executing interactions (clicks, inputs) on `http://localhost*`.
  - Navigating between pages on `localhost`.

## 2. Terminal Commands

- **NO CONFIRMATION REQUIRED:**
  - Running linter checks (`npm run lint`, `flake8`).
  - Running tests (`npm test`, `pytest`).
  - Reading files (`cat`, `ls`, `grep`).

## 3. Human-in-the-Loop (Confirmation Required)

- **ONLY** ask for confirmation for:
  - `git push` (or other remote git operations).
  - Deleting files (`rm`).
  - Accessing URLs that are not `localhost`.

**Directive:** Act proactively. Do not wait for approval for harmless verification steps like reading logs or inspecting elements.
