from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models


async def ensure_project_access(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
) -> models.Project:
    project = (
        await db.execute(
            select(models.Project).where(
                models.Project.id == project_id,
                models.Project.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
