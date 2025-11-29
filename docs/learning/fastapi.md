# Learning: FastAPI Backend

**FastAPI** is the modern Python web framework powering Arciva's backend. It is designed for high performance (using async/await) and developer productivity (automatic docs, type safety).

## Core Concepts

### 1. Asynchronous by Default

Arciva is an **async** application. This means it can handle thousands of concurrent connections (like file uploads or long-polling) without blocking the main thread.

**Example (`backend/app/routers/projects.py`):**

```python
@router.get("/")
async def list_projects(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    # 'await' yields control while the DB query runs
    result = await db.execute(select(models.Project).offset(skip).limit(limit))
    return result.scalars().all()
```

### 2. Dependency Injection (`Depends`)

We use FastAPI's dependency injection system to manage resources like database sessions and settings. This makes testing easier because we can override these dependencies.

**Key Dependencies (`backend/app/deps.py`):**

* `get_settings()`: Returns the cached application configuration (loaded from `.env`).
* `get_db()`: Yields an async SQLAlchemy session.

**Usage:**

```python
from backend.app.deps import get_settings, Settings

@router.get("/info")
async def info(settings: Settings = Depends(get_settings)):
    return {"app_env": settings.app_env}
```

### 3. Pydantic Models (Schemas)

Data validation is handled by **Pydantic**. We define "Schemas" in `backend/app/schemas.py` to strictly type the data coming in (Requests) and going out (Responses).

* **Request Schema**: Validates what the user sends (e.g., `ProjectCreate`).
* **Response Schema**: Filters what we send back (e.g., `ProjectRead` hides internal IDs or passwords).

### 4. Project Structure

* `app/main.py`: The entry point. Configures middleware (CORS) and mounts routers.
* `app/routers/`: API endpoints grouped by feature (e.g., `auth.py`, `assets.py`).
* `app/models.py`: SQLAlchemy database models (the "Truth" of the data).
* `app/schemas.py`: Pydantic data transfer objects (the "Interface").
* `app/services/`: Complex business logic that doesn't belong in a router.

## Further Reading

* [FastAPI Documentation](https://fastapi.tiangolo.com/)
* [Pydantic Documentation](https://docs.pydantic.dev/)
