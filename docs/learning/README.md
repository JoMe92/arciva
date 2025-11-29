# 🎓 Learning Hub

Welcome to the Arciva Learning Hub! This section contains educational tutorials designed to help you understand the technology stack and architectural patterns used in this repository.

## General

* **[Architecture Concepts](./architecture.md)**: The "Big Picture" patterns: Decoupled Monolith, Worker Pattern, and Storage Abstraction.

## Backend

* **[Folder Structure Explained](./backend-structure.md)**: A detailed breakdown of the `backend/` directory (`app`, `worker`, `migrations`).
* **[FastAPI Backend](./fastapi.md)**: Understand the async API framework, dependency injection, and Pydantic schemas.
* **[Async Workers & Background Jobs](./async-workers.md)**: Learn how we handle heavy tasks (like image processing) using Arq and Redis.
* **[Database & SQLAlchemy](./sqlalchemy.md)**: Dive into the async ORM, database models, and migrations.

## Frontend

* **[Folder Structure Explained](./frontend-structure.md)**: A detailed breakdown of the `frontend/` directory and Feature-Based Architecture.
* **[React & Vite Frontend](./react-vite.md)**: Explore the feature-based architecture, React Query for data fetching, and TailwindCSS styling.

## Observability

* **[Distributed Tracing with Jaeger](./jaeger.md)**: Learn how to visualize the full lifecycle of a request across the entire stack.
