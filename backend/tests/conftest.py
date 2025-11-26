import asyncio
import os
from pathlib import Path
import tempfile
import sys
from pathlib import Path as _P

# Ensure repository root is on sys.path so 'backend' package resolves
_REPO_ROOT = str(_P(__file__).resolve().parents[2])
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

_DEFAULT_DB_PATH = Path(tempfile.gettempdir()) / "film_cabinet_test.db"
_DEFAULT_MEDIA_ROOT = Path(tempfile.gettempdir()) / "film_cabinet_test_media"
os.environ.setdefault("APP_DB_PATH", str(_DEFAULT_DB_PATH))
os.environ.setdefault("APP_MEDIA_ROOT", str(_DEFAULT_MEDIA_ROOT))

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

"""Pytest fixtures for backend tests with isolated settings and DB."""


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def temp_fs_root(tmp_path_factory):
    root = tmp_path_factory.mktemp("filestore")
    (root / "uploads").mkdir()
    (root / "originals").mkdir()
    (root / "derivatives").mkdir()
    (root / "exports").mkdir()
    return root


@pytest.fixture(scope="session")
def test_settings(temp_fs_root):
    # Point the app to an on-disk sqlite database for tests
    db_path = Path(tempfile.gettempdir()) / "film_cabinet_test.db"
    if db_path.exists():
        db_path.unlink()
    db_url = f"sqlite+aiosqlite:///{db_path}"

    class _S:
        # minimal attributes used by the app
        app_env = "test"
        secret_key = "test"
        allowed_origins = ["*"]
        app_db_path = str(db_path)
        app_media_root = str(temp_fs_root)
        database_url = db_url
        redis_url = "redis://127.0.0.1:6379/0"
        fs_root = str(temp_fs_root)
        fs_uploads_dir = str(temp_fs_root / "uploads")
        fs_originals_dir = str(temp_fs_root / "originals")
        fs_derivatives_dir = str(temp_fs_root / "derivatives")
        fs_exports_dir = str(temp_fs_root / "exports")
        thumb_sizes = [256]
        max_upload_mb = 5
        worker_concurrency = 1
        logs_dir = str(temp_fs_root / "logs")
        export_retention_hours = 24

    # Ensure env var points to test DB before importing app modules
    os.environ["APP_DB_PATH"] = _S.app_db_path
    os.environ["APP_MEDIA_ROOT"] = _S.app_media_root
    return _S()


@pytest_asyncio.fixture(scope="session")
async def test_engine(test_settings):
    engine = create_async_engine(test_settings.database_url, echo=False, pool_pre_ping=True)
    # create schema (ensure models are imported so metadata is populated)
    from backend.app.db import Base
    import backend.app.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def TestSessionLocal(test_engine):
    return async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def mock_user(TestSessionLocal):
    import uuid
    from backend.app import models
    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        user = await session.get(models.User, user_id)
        if not user:
            user = models.User(id=user_id, email="test@example.com", password_hash="mock")
            session.add(user)
            await session.commit()


@pytest.fixture(scope="session")
def app(test_settings, TestSessionLocal):
    # Monkeypatch get_settings and get_db before creating the app
    from backend.app import deps as deps_module
    from backend.app import db as db_module

    # override settings cache by replacing function to return our object
    def _get_settings_override():
        return test_settings

    deps_module.get_settings.cache_clear()  # type: ignore[attr-defined]
    deps_module.get_settings = _get_settings_override  # type: ignore[assignment]

    # override DB dependency to use the test session
    async def _get_db_override() -> AsyncSession:
        async with TestSessionLocal() as session:
            yield session

    db_module.get_db = _get_db_override  # type: ignore[assignment]

    # override get_current_user
    from backend.app import security
    from backend.app import models
    import uuid

    async def _get_current_user_override():
        # Return the same user created by mock_user fixture
        return models.User(id=uuid.UUID("12345678-1234-5678-1234-567812345678"), email="test@example.com", password_hash="mock")

    security.get_current_user = _get_current_user_override

    # Import here after overrides so modules see test settings
    from backend.app.main import create_app
    application = create_app()
    return application


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
