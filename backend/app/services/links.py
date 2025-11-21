from __future__ import annotations

import uuid
from typing import Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from .metadata_states import ensure_state_for_link


async def link_asset_to_project(
    db: AsyncSession,
    *,
    project_id: uuid.UUID,
    asset: models.Asset,
    user_id: uuid.UUID,
    metadata_template: models.MetadataState | None = None,
    source_project_id: uuid.UUID | None = None,
) -> Tuple[models.ProjectAsset, bool]:
    existing = (
        await db.execute(
            select(models.ProjectAsset).where(
                models.ProjectAsset.project_id == project_id,
                models.ProjectAsset.asset_id == asset.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing, False

    link = models.ProjectAsset(project_id=project_id, asset_id=asset.id, user_id=user_id)
    db.add(link)
    await db.flush()
    await ensure_state_for_link(db, link, template=metadata_template, source_project_id=source_project_id)
    return link, True
