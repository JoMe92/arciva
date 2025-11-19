from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

TABLE_DELETE_ORDER = [
    "bulk_image_exports",
    "export_jobs",
    "derivatives",
    "asset_metadata_states",
    "project_asset_pairs",
    "project_assets",
    "assets",
    "projects",
]


async def wipe_application_data(db: AsyncSession) -> None:
    for table in TABLE_DELETE_ORDER:
        await db.execute(text(f"DELETE FROM {table}"))
