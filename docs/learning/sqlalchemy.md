# Learning: Database & SQLAlchemy

Arciva uses **SQLAlchemy 2.0** as its Object Relational Mapper (ORM). It allows us to interact with the database using Python objects instead of raw SQL.

## Core Concepts

### 1. Async Engine & Session

Since FastAPI is async, we use the `asyncio` extension of SQLAlchemy.

* **Engine**: The connection pool to the database.
* **Session**: A temporary workspace for your objects.

**Usage (`backend/app/db.py`):**

```python
async with SessionLocal() as session:
    result = await session.execute(select(User).where(User.id == 1))
    user = result.scalar_one_or_none()
```

### 2. Models (`backend/app/models.py`)

Models are Python classes that map to database tables. We use the declarative style.

```python
class Project(Base):
    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
```

### 3. Migrations (Alembic)

We use **Alembic** to manage database schema changes. When you modify a model in `models.py`, you must generate a migration script to apply that change to the database.

**Workflow:**

1. Modify `models.py`.
2. Generate migration:

    ```bash
    alembic revision --autogenerate -m "Add description column"
    ```

3. Apply migration:

    ```bash
    alembic upgrade head
    ```

    *(Note: In development, `dev.sh` often handles this automatically or via `pixi run setup`)*.

### 4. Hybrid Support (Postgres & SQLite)

Arciva supports both:

* **PostgreSQL**: For production and multi-user setups (via Docker).
* **SQLite**: For single-user local development (no Docker required).

The code is agnostic to the underlying DB, thanks to SQLAlchemy's abstraction.
