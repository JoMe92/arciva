from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..storage import PosixStorage
from .links import link_asset_to_project

logger = logging.getLogger("arciva.dedup")


async def adopt_duplicate_asset(
    db: AsyncSession,
    *,
    duplicate_asset: models.Asset,
    existing_asset: models.Asset,
    storage: PosixStorage,
    temp_path: Path | None = None,
    cleanup_temp: bool = True,
    timestamp: datetime | None = None,
) -> None:
    """
    Merge a duplicate asset into an existing Asset entry while preserving
    per-project state.
    """

    if existing_asset.user_id != duplicate_asset.user_id:
        logger.warning(
            "dedup: skipping merge for asset=%s existing=%s due to " "mismatched users",
            duplicate_asset.id,
            existing_asset.id,
        )
        return

    ts = timestamp or datetime.now(timezone.utc)
    link_rows = (
        await db.execute(
            select(models.ProjectAsset, models.MetadataState)
            .outerjoin(
                models.MetadataState,
                models.MetadataState.link_id == models.ProjectAsset.id,
            )
            .where(
                models.ProjectAsset.asset_id == duplicate_asset.id,
                models.ProjectAsset.user_id == duplicate_asset.user_id,
            )
        )
    ).all()

    linked = 0
    for link, metadata in link_rows:
        _, created = await link_asset_to_project(
            db,
            project_id=link.project_id,
            asset=existing_asset,
            user_id=existing_asset.user_id,
            metadata_template=metadata,
        )
        if created:
            linked += 1

    await db.execute(
        delete(models.ProjectAsset).where(
            models.ProjectAsset.asset_id == duplicate_asset.id
        )
    )
    await db.execute(delete(models.Asset).where(models.Asset.id == duplicate_asset.id))

    count = (
        await db.execute(
            select(func.count())
            .select_from(models.ProjectAsset)
            .where(
                models.ProjectAsset.asset_id == existing_asset.id,
                models.ProjectAsset.user_id == existing_asset.user_id,
            )
        )
    ).scalar_one()
    existing_asset.reference_count = max(int(count), 1)
    existing_asset.completed_at = existing_asset.completed_at or ts
    existing_asset.status = models.AssetStatus.READY

    if cleanup_temp and temp_path is not None:
        storage.remove_temp(duplicate_asset.id)
    if duplicate_asset.storage_uri:
        storage.remove_original(duplicate_asset.storage_uri)
    if duplicate_asset.sha256:
        storage.remove_derivatives(duplicate_asset.sha256)

    await db.commit()
    logger.info(
        "dedup: merged asset=%s into existing=%s new_links=%s " "total_refs=%s",
        duplicate_asset.id,
        existing_asset.id,
        linked,
        existing_asset.reference_count,
    )
