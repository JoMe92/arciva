from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

ASSET_STATUS_VALUES = [
    "UPLOADING",
    "QUEUED",
    "PROCESSING",
    "READY",
    "DUPLICATE",
    "MISSING_SOURCE",
    "ERROR",
]


async def ensure_enum_values(db: AsyncSession) -> None:
    for value in ASSET_STATUS_VALUES:
        await db.execute(text(f"ALTER TYPE assetstatus ADD VALUE IF NOT EXISTS '{value}'"))
