from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from fastapi.responses import FileResponse
from ..db import get_db
from .. import models, schemas
from ..storage import PosixStorage

router = APIRouter(prefix="/v1", tags=["assets"])

@router.get("/projects/{project_id}/assets", response_model=list[schemas.AssetListItem])
async def list_assets(project_id: UUID, limit: int = 50, db: AsyncSession = Depends(get_db)):
    # list latest by added_at
    q = (
        select(models.Asset, models.ProjectAsset.added_at)
        .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
        .where(models.ProjectAsset.project_id == project_id)
        .order_by(desc(models.ProjectAsset.added_at))
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    items: list[schemas.AssetListItem] = []
    storage = PosixStorage.from_env()
    for asset, _ in rows:
        thumb = None
        if asset.sha256:
            p = storage.derivative_path(asset.sha256, "thumb_256", "jpg")
            if p.exists():
                thumb = f"/v1/assets/{asset.id}/thumbs/256"
        items.append(
            schemas.AssetListItem(
                id=asset.id, status=schemas.AssetStatus(asset.status.value),
                taken_at=asset.taken_at, thumb_url=thumb
            )
        )
    return items

@router.get("/assets/{asset_id}/thumbs/256")
async def get_thumb(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    a = (await db.execute(select(models.Asset).where(models.Asset.id==asset_id))).scalar_one_or_none()
    if not a or not a.sha256:
        raise HTTPException(404, "asset not ready")
    storage = PosixStorage.from_env()
    p = storage.derivative_path(a.sha256, "thumb_256", "jpg")
    if not p.exists():
        raise HTTPException(404, "thumb not found")
    return FileResponse(path=str(p), media_type="image/jpeg")
