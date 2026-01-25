---
description: Project architecture, tech stack, and domain context for Acaiwa.
globs: ["**/*"]
alwaysApply: true
---

# Project Context: Acaiwa

**Acaiwa** is a browser-based photo management and editing application (similar to Lightroom/Capture One) designed for managing large photo libraries across networks.

## Architecture

- **Frontend:** React with TypeScript.
- **Backend:** FastAPI (Python).
- **Core Library:** Rust (compiled for performance/Chrome integration).
- **Infrastructure:** Docker containers.
- **Data:** Images are stored in a central "Image Hub". Projects reference images from the Hub.

## Domain Logic

- **Project-Based:** Users create Projects (e.g., "Holiday 2024") to organize work.
- **Image Hub:** Central repository for all imported images. Importing an image makes it available to all projects.
- **Editing:** Currently focused on JPEG (RAW support is strictly file management, no editing yet).
- **Features:** Grid view, label/tagging, quick-fix menu (exposure, alignment).

## E2E Testing Credentials & Data

When performing End-to-End (E2E) tests or Browser automation:

- **Login User:** `test@test.de`
- **Password:** `123456789`
- **Test Data:** Do not rely on external files. Generate dummy images programmatically for import/upload tests to verify functionality like "Image Import" or "Edit Processing".
