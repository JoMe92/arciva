# Learning: Architecture Concepts

This document explains the high-level architectural patterns used in Arciva and *why* we chose them.

## 1. The Decoupled Monolith

Arciva is designed as a **monorepo** containing both the backend and frontend.

* **Why?** It simplifies development and deployment. You can run the entire stack with a single command (`pixi run dev-stack`) or deploy it as a single Docker container.
* **Decoupled**: Even though they live together, the Backend (FastAPI) and Frontend (React) communicate *only* via the HTTP API. This means you could theoretically swap out the frontend for a mobile app without changing the backend.

## 2. The Worker Pattern (Asynchronous Processing)

We separate **Request Handling** (API) from **Heavy Processing** (Worker).

* **The Problem**: Image processing (resizing, hashing) is CPU-intensive. If the API did this directly, the server would freeze for other users.
* **The Solution**:
    1. **API**: Accepts the upload, saves it to a temp file, and puts a "job" in a Queue (Redis). It returns immediately.
    2. **Worker**: A background process watches the queue, picks up the job, and does the heavy lifting.
* **Benefit**: The API remains lightning fast, even under load.

## 3. Storage Abstraction

The code rarely interacts with the filesystem directly using `open()`. Instead, we use a `PosixStorage` class (see `backend/app/storage.py`).

* **Why?**
  * **Testability**: We can easily mock the storage in tests.
  * **Flexibility**: If we want to support Amazon S3 or Google Cloud Storage in the future, we just create an `S3Storage` class that implements the same interface. The rest of the code won't need to change.

## 4. Feature-Based Frontend Architecture

In the frontend (`frontend/src/features/`), we organize code by **Domain Feature** (e.g., `auth`, `projects`, `workspace`) rather than by technical type (e.g., `components`, `hooks`).

* **Why?**
  * **Scalability**: As the app grows, a flat `components/` folder becomes unmanageable.
  * **Cohesion**: Everything related to "Projects" (the API calls, the UI components, the types) is in one place.

## 5. Hybrid Database Support

The backend is designed to run on both **PostgreSQL** (for production/multi-user) and **SQLite** (for simple local use).

* **How?** We use **SQLAlchemy**, which abstracts the SQL differences away.
* **Benefit**: Developers can get started instantly with SQLite (no Docker needed), while production deployments get the robustness of Postgres.
