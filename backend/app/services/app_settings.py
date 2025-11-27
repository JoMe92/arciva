from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models


async def get_app_setting(
    db: AsyncSession, key: str, default: Any = None
) -> Any:
    record = (
        await db.execute(
            select(models.AppSetting).where(models.AppSetting.key == key)
        )
    ).scalar_one_or_none()
    if not record:
        return default
    return record.value


async def set_app_setting(
    db: AsyncSession, key: str, value: Any
) -> models.AppSetting:
    record = (
        await db.execute(
            select(models.AppSetting).where(models.AppSetting.key == key)
        )
    ).scalar_one_or_none()
    if record:
        record.value = value
    else:
        record = models.AppSetting(key=key, value=value)
        db.add(record)
    await db.flush()
    return record
