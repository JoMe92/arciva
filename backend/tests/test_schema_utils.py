import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from backend.app.schema_utils import ensure_base_schema


@pytest.mark.asyncio
async def test_ensure_base_schema_creates_tables(tmp_path):
    db_path = tmp_path / "db" / "app.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    try:
        await ensure_base_schema(engine)
        async with engine.begin() as conn:
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
            )
            assert result.first() is not None
    finally:
        await engine.dispose()
