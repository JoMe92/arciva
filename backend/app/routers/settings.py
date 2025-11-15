from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services.app_settings import get_app_setting, set_app_setting

router = APIRouter(prefix="/v1/settings", tags=["settings"])

_IMAGE_HUB_SETTINGS_KEY = "image_hub"


def _coerce_mode(value: str | None) -> schemas.MetadataInheritanceMode:
    if not value:
        return schemas.MetadataInheritanceMode.ASK
    try:
        return schemas.MetadataInheritanceMode(value)
    except ValueError:
        return schemas.MetadataInheritanceMode.ASK


@router.get("/image-hub", response_model=schemas.ImageHubSettings)
async def get_image_hub_settings(db: AsyncSession = Depends(get_db)) -> schemas.ImageHubSettings:
    record = await get_app_setting(
        db,
        _IMAGE_HUB_SETTINGS_KEY,
        {"metadata_inheritance": schemas.MetadataInheritanceMode.ASK.value},
    )
    mode = _coerce_mode(record.get("metadata_inheritance") if isinstance(record, dict) else None)
    return schemas.ImageHubSettings(metadata_inheritance=mode)


@router.put("/image-hub", response_model=schemas.ImageHubSettings)
async def update_image_hub_settings(
    body: schemas.ImageHubSettings,
    db: AsyncSession = Depends(get_db),
) -> schemas.ImageHubSettings:
    await set_app_setting(
        db,
        _IMAGE_HUB_SETTINGS_KEY,
        {"metadata_inheritance": body.metadata_inheritance.value},
    )
    await db.commit()
    return body
