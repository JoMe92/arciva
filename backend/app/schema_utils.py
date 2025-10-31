from __future__ import annotations

import asyncio
import logging
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from .db import engine as async_engine

logger = logging.getLogger("nivio.schema")

_preview_columns_ready = False
_preview_columns_lock = asyncio.Lock()


def _build_statements(existing: Iterable[str]) -> list[str]:
    present = set(existing)
    statements: list[str] = []
    if "is_preview" not in present:
        statements.append("ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT FALSE")
    if "preview_order" not in present:
        statements.append("ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS preview_order INTEGER")
        statements.append("UPDATE project_assets SET preview_order = 0 WHERE is_preview = TRUE AND preview_order IS NULL")
    return statements


async def ensure_preview_columns(_: AsyncSession | None = None) -> None:
    """
    Lazily ensure the optional preview columns exist.

    The session argument is accepted for convenience so the helper can
    be awaited from request handlers without additional plumbing.
    """
    global _preview_columns_ready
    if _preview_columns_ready:
        return

    async with _preview_columns_lock:
        if _preview_columns_ready:
            return

        try:
            async with async_engine.begin() as conn:
                result = await conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'project_assets'
                          AND column_name IN ('is_preview', 'preview_order')
                        """
                    )
                )
                statements = _build_statements(row[0] for row in result)
                for stmt in statements:
                    logger.info("ensure_preview_columns: applying %s", stmt)
                    await conn.execute(text(stmt))
        except SQLAlchemyError:
            logger.exception("ensure_preview_columns: failed to apply schema patch")
            raise

        _preview_columns_ready = True
        logger.info("ensure_preview_columns: preview columns ready")
