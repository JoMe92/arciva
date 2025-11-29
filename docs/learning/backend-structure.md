# Learning: Backend Structure Explained

This document breaks down the `backend/` directory, explaining what each folder does and why it's structured this way.

## Top-Level Structure

```text
backend/
├── app/                 # The main FastAPI application code
├── worker/              # The background worker code (Arq)
├── migrations/          # Database migration scripts (Alembic)
├── tests/               # Pytest test suite
├── requirements.txt     # Python dependencies
└── alembic.ini          # Alembic configuration
```

## 1. The `app/` Directory (The API)

This is where the REST API lives. It follows a standard FastAPI pattern.

```text
app/
├── main.py              # Entry point. Initializes FastAPI, CORS, and OTel.
├── deps.py              # Dependencies (Settings, Database Session).
├── models.py            # SQLAlchemy Database Models (The "Truth").
├── schemas.py           # Pydantic Schemas (The "Interface").
├── routers/             # API Endpoints grouped by feature.
│   ├── auth.py
│   ├── projects.py
│   └── ...
├── services/            # Complex business logic (e.g., RawReader).
└── utils/               # Helper functions.
```

### Key Files Explained

* **`main.py`**: The "brain" of the API. It ties everything together. If you want to add a new middleware or mount a new router, you do it here.
* **`deps.py`**: Contains `get_settings()` and `get_db()`. We use this file heavily in routers to inject configuration and database sessions.
* **`models.py`**: Defines the database tables. If you need to add a column to the `users` table, you edit this file (and then run a migration).
* **`schemas.py`**: Defines what the API accepts and returns. This separates our internal DB structure from what we expose to the world.

## 2. The `worker/` Directory (The Heavy Lifter)

This folder contains the code for the background worker process.

```text
worker/
├── worker.py            # The worker entry point and job functions.
└── ...
```

* **`worker.py`**: Defines the `WorkerSettings` class used by `arq`. It also contains the actual functions (like `ingest_asset`) that process jobs.

## 3. The `migrations/` Directory (Database History)

Managed by **Alembic**. This folder tracks every change made to the database schema over time.

```text
migrations/
├── versions/            # Individual migration scripts (e.g., "add_user_column.py")
└── env.py               # Alembic environment setup (connects to our DB).
```

* **Why?** This allows us to upgrade (or downgrade) the database schema reliably across different environments (dev, staging, prod).

## Common Workflows

### Adding a New API Endpoint

1. Define the **Schema** (Input/Output) in `app/schemas.py`.
2. Write the logic in a **Router** (e.g., `app/routers/projects.py`).
3. If it needs complex logic, put that in `app/services/`.

### Adding a New Database Table

1. Define the **Model** in `app/models.py`.
2. Run `alembic revision --autogenerate -m "create table"` to create a migration in `migrations/versions/`.
3. Run `alembic upgrade head` to apply it.
