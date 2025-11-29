# Arciva

Arciva is a project-first archive for photo projects. It keeps project cards with people, notes, and assets together, featuring background ingest, deduplication, RAW/EXIF reading, and fast thumbnail generation.

**Status: Alpha (v0.1.0)** — Expect schema/API changes between releases.

## Features

- **Project-Centric**: Organize assets, notes, and people metadata into projects.
- **Smart Ingest**: Async processing with deduplication and metadata extraction.
- **Modern Stack**: Bundled SPA + API in a single container.
- **Flexible Storage**: Works with Postgres (Compose) or SQLite (single-node/dev).

## Installation Guide (Linux)

### Prerequisites

- **Docker Engine** + **Docker Compose** plugin.
- **Hardware**: At least 4GB RAM recommended.

### Steps

1. **Clone the repository**:

    ```bash
    git clone https://github.com/yourusername/arciva.git
    cd arciva
    ```

2. **Prepare the environment**:

    ```bash
    cp deploy/.env.arciva.example deploy/.env.arciva
    ```

    Edit `deploy/.env.arciva` (see [Configuration](#configuration) below).

3. **Start the stack**:

    ```bash
    docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva up -d --build
    ```

4. **Access**: Open [http://localhost:8000](http://localhost:8000).

## Installation Guide (Windows)

### Prerequisites

- **Docker Desktop** (WSL2 backend recommended).
- **Hardware**: At least 4GB RAM.

### Steps

1. **Clone the repository**:
    Open a terminal (PowerShell or WSL2):

    ```bash
    git clone https://github.com/yourusername/arciva.git
    cd arciva
    ```

    *Note: If using WSL2, clone inside the WSL filesystem (e.g., `\\wsl$\Ubuntu\home\user\...`) for best performance.*

2. **Prepare the environment**:

    ```bash
    cp deploy/.env.arciva.example deploy/.env.arciva
    ```

    Edit `deploy/.env.arciva` (see [Configuration](#configuration) below).

3. **Start the stack**:

    ```bash
    docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva up -d --build
    ```

4. **Access**: Open [http://localhost:8000](http://localhost:8000).

### Troubleshooting (Windows)

- **Volume Permissions**: Ensure Docker Desktop has access to the drive.
- **Line Endings**: Clone with `git config core.autocrlf input` to avoid script errors.

## Configuration

### Environment Variables (`deploy/.env.arciva`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `APP_ENV` | `prod` | Runtime environment (`prod` or `dev`). |
| `SECRET_KEY` | `change-me` | **Required**. Security key for sessions/auth. |
| `APP_PORT` | `8000` | Host port for the application. |
| `DATABASE_URL` | `postgresql+asyncpg://...` | Connection string for the database. |
| `APP_DB_PATH` | `/data/db/app.db` | Path to SQLite DB (if used). |
| `APP_MEDIA_ROOT` | `/data/media` | Internal path for media storage. |
| `LOGS_DIR` | `/data/logs` | Internal path for logs. |
| `THUMB_SIZES` | `[256]` | JSON list of thumbnail sizes to generate. |
| `MAX_UPLOAD_MB` | `1000` | Max upload size in MB. |
| `WORKER_CONCURRENCY` | `2` | Number of concurrent worker tasks. |
| `EXPORT_RETENTION_HOURS` | `24` | How long to keep exports. |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string. |
| `ALLOWED_ORIGINS__0` | `http://localhost:8000` | CORS allowed origin. |
| `POSTGRES_USER` | `arciva` | Postgres username. |
| `POSTGRES_PASSWORD` | `arciva` | Postgres password. |
| `POSTGRES_DB` | `arciva` | Postgres database name. |
| `ARCIVA_IMAGE` | `ghcr.io/jome92/arciva:latest` | Docker image to use. |

### Changing Data Storage Paths

#### Media Files

To store media on a specific host directory instead of a Docker volume:

1. Open `deploy/docker-compose.arciva.yml`.
2. Update the `volumes` for `app` and `worker`:

    ```yaml
    - /your/host/path/media:/data/media
    ```

#### Database

**Postgres (Default)**:
To store Postgres data on a host directory:

1. Open `deploy/docker-compose.arciva.yml`.
2. Update the `volumes` for the `postgres` service:

    ```yaml
    - /your/host/path/postgres:/var/lib/postgresql/data
    ```

**SQLite**:
If you switch to SQLite (by unsetting `DATABASE_URL`):

1. Update `volumes` for `app` and `worker`:

    ```yaml
    - /your/host/path/db:/data/db
    ```

## Development Guide (Pixi)

We use [Pixi](https://pixi.sh/) for a reproducible development environment.

### Setup

1. **Install Pixi**:

    ```bash
    curl -fsSL https://pixi.sh/install.sh | bash
    ```

2. **Install Dependencies**:

    ```bash
    pixi install
    ```

3. **Setup Environment**:

    ```bash
    cp backend/.env.example .env
    cp frontend/.env.example frontend/.env.local
    pixi run setup
    ```

### Running the App

- **Full Stack (Recommended)**:

    ```bash
    pixi run dev-stack
    ```

    Starts API, Worker, Vite Dev Server, and database helpers.

- **Individual Services**:
  - Backend: `pixi run dev-backend`
  - Frontend: `pixi run dev-frontend`
  - Tests: `pixi run test-backend`

## Documentation

- [Documentation Index](docs/README.md)
- [Self-Hosting & Operations](docs/self-hosting.md)
- [Backend Guide](docs/backend/dev-guide.md)
- [Frontend Setup](docs/frontend/setup.md)
- [Architecture](docs/architecture/arc42.md)
- [Contributing](docs/contributing/conventions.md)
- [Agents & Automation](docs/Agents.md)

## License

MIT
