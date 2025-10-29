from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from fastapi.responses import FileResponse
from ..db import get_db
from .. import models, schemas
from ..storage import PosixStorage
from ..deps import get_settings


def _warnings_from_text(data: str | None) -> list[str]:
    if not data:
        return []
    return [entry for entry in data.split("\n") if entry]


def _thumb_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.derivative_path(asset.sha256, "thumb_256", "jpg")
    if path.exists():
        return f"/v1/assets/{asset.id}/thumbs/256"
    return None


async def _collect_derivatives(
    asset: models.Asset,
    db: AsyncSession,
) -> list[schemas.AssetDerivativeOut]:
    rows = (
        await db.execute(
            select(models.Derivative).where(models.Derivative.asset_id == asset.id)
        )
    ).scalars().all()
    derivatives: list[schemas.AssetDerivativeOut] = []
    for row in rows:
        derivatives.append(
            schemas.AssetDerivativeOut(
                variant=row.variant,
                width=row.width,
                height=row.height,
                url=f"/v1/assets/{asset.id}/derivatives/{row.variant}",
            )
        )
    return derivatives


async def _asset_detail(
    asset: models.Asset,
    db: AsyncSession,
    storage: PosixStorage,
) -> schemas.AssetDetail:
    thumb_url = _thumb_url(asset, storage)
    derivatives = await _collect_derivatives(asset, db)
    return schemas.AssetDetail(
        id=asset.id,
        status=schemas.AssetStatus(asset.status.value),
        original_filename=asset.original_filename,
        mime=asset.mime,
        size_bytes=asset.size_bytes,
        width=asset.width,
        height=asset.height,
        taken_at=asset.taken_at,
        storage_key=asset.storage_key,
        sha256=asset.sha256,
        reference_count=asset.reference_count,
        queued_at=asset.queued_at,
        processing_started_at=asset.processing_started_at,
        completed_at=asset.completed_at,
        last_error=asset.last_error,
        metadata_warnings=_warnings_from_text(asset.metadata_warnings),
        thumb_url=thumb_url,
        derivatives=derivatives,
    )

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
    storage = PosixStorage.from_env()
    items: list[schemas.AssetListItem] = []
    for asset, _ in rows:
        thumb = _thumb_url(asset, storage)
        items.append(
            schemas.AssetListItem(
                id=asset.id,
                status=schemas.AssetStatus(asset.status.value),
                taken_at=asset.taken_at,
                thumb_url=thumb,
                original_filename=asset.original_filename,
                size_bytes=asset.size_bytes,
                last_error=asset.last_error,
                metadata_warnings=_warnings_from_text(asset.metadata_warnings),
                queued_at=asset.queued_at,
                processing_started_at=asset.processing_started_at,
                completed_at=asset.completed_at,
            )
        )
    return items

@router.get("/assets/{asset_id}", response_model=schemas.AssetDetail)
async def get_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    asset = (
        await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")
    storage = PosixStorage.from_env()
    return await _asset_detail(asset, db, storage)


@router.post("/assets/{asset_id}/reprocess", response_model=schemas.AssetDetail)
async def reprocess_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    asset = (
        await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")

    now = datetime.now(timezone.utc)
    asset.status = models.AssetStatus.QUEUED
    asset.queued_at = now
    asset.processing_started_at = None
    asset.completed_at = None
    asset.last_error = None
    await db.commit()

    settings = get_settings()
    try:
        from arq.connections import RedisSettings, ArqRedis  # local import for optional dependency
        redis = await ArqRedis.create(RedisSettings.from_dsn(settings.redis_url))
        await redis.enqueue_job("ingest_asset", str(asset.id))
    except Exception as exc:  # pragma: no cover
        asset.status = models.AssetStatus.ERROR
        asset.last_error = f"enqueue_failed: {exc!r}"
        await db.commit()
        raise HTTPException(503, "failed to enqueue ingest job")
    finally:
        if "redis" in locals():
            await redis.close(close_connection_pool=True)

    storage = PosixStorage.from_env()
    return await _asset_detail(asset, db, storage)


@router.get("/assets/{asset_id}/thumbs/256")
async def get_thumb(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    return await get_derivative(asset_id, "thumb_256", db)


@router.get("/assets/{asset_id}/derivatives/{variant}")
async def get_derivative(asset_id: UUID, variant: str, db: AsyncSession = Depends(get_db)):
    asset = (
        await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    ).scalar_one_or_none()
    if not asset or not asset.sha256:
        raise HTTPException(404, "asset not ready")
    storage = PosixStorage.from_env()
    path = storage.derivative_path(asset.sha256, variant, "jpg")
    if not path.exists():
        raise HTTPException(404, "derivative not found")
    return FileResponse(path=str(path), media_type="image/jpeg")
