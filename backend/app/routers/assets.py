import asyncio
from datetime import datetime, timezone
from pathlib import Path
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from uuid import UUID
from fastapi.responses import FileResponse
from ..db import get_db
from .. import models, schemas
from ..storage import PosixStorage
from ..imaging import read_exif
from ..deps import get_settings
from ..schema_utils import ensure_preview_columns, ensure_asset_metadata_column


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


def _preview_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.derivative_path(asset.sha256, "preview_raw", "jpg")
    if path.exists():
        return f"/v1/assets/{asset.id}/preview"
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
    preview_url = _preview_url(asset, storage)
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
        preview_url=preview_url,
        derivatives=derivatives,
        metadata=getattr(asset, "metadata_json", None),
    )


async def _ensure_asset_metadata_populated(
    asset: models.Asset,
    db: AsyncSession,
    storage: PosixStorage,
) -> None:
    source_path: Path | None = None
    if asset.storage_key:
        candidate = Path(asset.storage_key)
        if candidate.exists():
            source_path = candidate

    if source_path is None and asset.sha256:
        ext = Path(asset.original_filename or "").suffix
        if not ext and asset.mime:
            if asset.mime == "image/jpeg":
                ext = ".jpg"
            elif asset.mime == "image/png":
                ext = ".png"
            elif asset.mime == "image/heic":
                ext = ".heic"
            else:
                ext = ""
        if ext and not ext.startswith("."):
            ext = f".{ext}"
        if asset.sha256:
            candidate = storage.originals / f"{asset.sha256}{ext or ''}"
            if candidate.exists():
                source_path = candidate

    if source_path is None or not source_path.exists():
        return

    try:
        taken_at, (width, height), metadata, warnings = await asyncio.to_thread(read_exif, source_path)
    except Exception:  # pragma: no cover - best effort
        logger.exception("ensure_asset_metadata_populated: read_exif failed asset=%s", asset.id)
        return

    changed = False
    existing = _warnings_from_text(asset.metadata_warnings)

    if metadata and metadata != getattr(asset, "metadata_json", None):
        asset.metadata_json = metadata
        changed = True

    if taken_at and not asset.taken_at:
        asset.taken_at = taken_at
        changed = True

    if width and not asset.width:
        asset.width = width
        changed = True
    if height and not asset.height:
        asset.height = height
        changed = True

    if metadata:
        existing = [w for w in existing if w not in {"EXIFTOOL_NOT_INSTALLED", "EXIF_ERROR"}]

    combined = list(existing)
    for warning in warnings:
        if warning and warning not in combined:
            combined.append(warning)

    combined_text = "\n".join(combined) if combined else None
    if (asset.metadata_warnings or None) != combined_text:
        asset.metadata_warnings = combined_text
        changed = True

    if changed:
        await db.commit()
        await db.refresh(asset)

router = APIRouter(prefix="/v1", tags=["assets"])
logger = logging.getLogger("arciva.assets")

@router.get("/projects/{project_id}/assets", response_model=list[schemas.AssetListItem])
async def list_assets(project_id: UUID, limit: int = 1000, db: AsyncSession = Depends(get_db)):
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    # list latest by added_at
    q = (
        select(models.Asset, models.ProjectAsset)
        .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
        .where(models.ProjectAsset.project_id == project_id)
        .order_by(desc(models.ProjectAsset.added_at))
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    storage = PosixStorage.from_env()
    items: list[schemas.AssetListItem] = []
    for asset, project_asset in rows:
        thumb = _thumb_url(asset, storage)
        preview = _preview_url(asset, storage)
        items.append(
            schemas.AssetListItem(
                id=asset.id,
                status=schemas.AssetStatus(asset.status.value),
                taken_at=asset.taken_at,
                thumb_url=thumb,
                preview_url=preview,
                original_filename=asset.original_filename,
                size_bytes=asset.size_bytes,
                last_error=asset.last_error,
                metadata_warnings=_warnings_from_text(asset.metadata_warnings),
                queued_at=asset.queued_at,
                processing_started_at=asset.processing_started_at,
                completed_at=asset.completed_at,
                width=asset.width,
                height=asset.height,
                is_preview=bool(project_asset.is_preview),
                preview_order=project_asset.preview_order,
            )
        )
    return items

@router.get("/assets/{asset_id}", response_model=schemas.AssetDetail)
async def get_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    await ensure_asset_metadata_column(db)
    asset = (
        await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")
    storage = PosixStorage.from_env()
    await _ensure_asset_metadata_populated(asset, db, storage)
    return await _asset_detail(asset, db, storage)


@router.post("/assets/{asset_id}/reprocess", response_model=schemas.AssetDetail)
async def reprocess_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    await ensure_asset_metadata_column(db)
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
        redis_settings = RedisSettings.from_dsn(settings.redis_url)
        redis = None
        try:
            redis = await ArqRedis.create(redis_settings)  # type: ignore[attr-defined]
        except AttributeError:
            from arq.connections import create_pool  # type: ignore
            redis = await create_pool(redis_settings)
        await redis.enqueue_job("ingest_asset", str(asset.id))
    except Exception as exc:  # pragma: no cover
        asset.status = models.AssetStatus.ERROR
        asset.last_error = f"enqueue_failed: {exc!r}"
        await db.commit()
        raise HTTPException(503, "failed to enqueue ingest job")
    finally:
        if "redis" in locals():
            try:
                await redis.close(close_connection_pool=True)
            except TypeError:
                await redis.close()

    storage = PosixStorage.from_env()
    return await _asset_detail(asset, db, storage)


@router.get("/assets/{asset_id}/thumbs/256")
async def get_thumb(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    return await get_derivative(asset_id, "thumb_256", db)


@router.get("/assets/{asset_id}/preview")
async def get_preview(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    return await get_derivative(asset_id, "preview_raw", db)


@router.get("/assets/{asset_id}/derivatives/{variant}")
async def get_derivative(asset_id: UUID, variant: str, db: AsyncSession = Depends(get_db)):
    await ensure_asset_metadata_column(db)
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


@router.post("/projects/{project_id}/assets:link", response_model=schemas.ProjectAssetsLinkOut)
async def link_existing_assets(
    project_id: UUID,
    body: schemas.ProjectAssetsLinkIn,
    db: AsyncSession = Depends(get_db),
):
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    # validate project
    proj = (
        await db.execute(select(models.Project).where(models.Project.id == project_id))
    ).scalar_one_or_none()
    if not proj:
        raise HTTPException(404, "project not found")

    # dedupe ids
    want_ids: list[UUID] = list(dict.fromkeys(body.asset_ids))
    if not want_ids:
        return schemas.ProjectAssetsLinkOut(linked=0, duplicates=0, items=[])

    logger.info(
        "link_existing_assets: project=%s requested=%s",
        project_id,
        want_ids,
    )

    # fetch existing assets
    assets = (
        await db.execute(select(models.Asset).where(models.Asset.id.in_(want_ids)))
    ).scalars().all()
    found_ids = {a.id for a in assets}
    missing = [aid for aid in want_ids if aid not in found_ids]
    if missing:
        logger.warning(
            "link_existing_assets: project=%s missing_assets=%s",
            project_id,
            missing,
        )
        raise HTTPException(404, f"assets not found: {missing}")

    # link, ignoring duplicates
    linked = 0
    duplicates = 0
    for a in assets:
        exists = (
            await db.execute(
                select(models.ProjectAsset).where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.asset_id == a.id,
                )
            )
        ).scalar_one_or_none()
        if exists:
            duplicates += 1
            logger.info(
                "link_existing_assets: project=%s asset=%s already linked", project_id, a.id
            )
            continue
        db.add(models.ProjectAsset(project_id=project_id, asset_id=a.id))
        linked += 1
        logger.info(
            "link_existing_assets: project=%s linked asset=%s", project_id, a.id
        )
    await db.commit()

    logger.info(
        "link_existing_assets: project=%s linked=%s duplicates=%s",
        project_id,
        linked,
        duplicates,
    )

    # update reference counts for linked assets
    if linked:
        for a in assets:
            count = (
                await db.execute(
                    select(func.count()).select_from(models.ProjectAsset).where(
                        models.ProjectAsset.asset_id == a.id
                    )
                )
            ).scalar_one()
            a.reference_count = max(int(count), 1)
        await db.commit()

    # return items for provided order
    storage = PosixStorage.from_env()
    items_map = {}
    for a in assets:
        items_map[a.id] = schemas.AssetListItem(
            id=a.id,
            status=schemas.AssetStatus(a.status.value),
            taken_at=a.taken_at,
            thumb_url=_thumb_url(a, storage),
            preview_url=_preview_url(a, storage),
            original_filename=a.original_filename,
            size_bytes=a.size_bytes,
            last_error=a.last_error,
            metadata_warnings=_warnings_from_text(a.metadata_warnings),
            queued_at=a.queued_at,
            processing_started_at=a.processing_started_at,
            completed_at=a.completed_at,
            width=a.width,
            height=a.height,
            is_preview=False,
            preview_order=None,
        )

    ordered_items = [items_map[aid] for aid in want_ids if aid in items_map]
    logger.info(
        "link_existing_assets: project=%s response_items=%s",
        project_id,
        [item.id for item in ordered_items],
    )
    return schemas.ProjectAssetsLinkOut(linked=linked, duplicates=duplicates, items=ordered_items)


@router.put("/projects/{project_id}/assets/{asset_id}/preview", response_model=schemas.AssetListItem)
async def update_preview_flag(
    project_id: UUID,
    asset_id: UUID,
    body: schemas.ProjectAssetPreviewUpdate,
    db: AsyncSession = Depends(get_db),
):
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    link = (
        await db.execute(
            select(models.ProjectAsset)
            .where(
                models.ProjectAsset.project_id == project_id,
                models.ProjectAsset.asset_id == asset_id,
            )
        )
    ).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "asset not linked to project")

    asset = (
        await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")

    preview_rows = (
        await db.execute(
            select(models.ProjectAsset)
            .where(
                models.ProjectAsset.project_id == project_id,
                models.ProjectAsset.is_preview.is_(True),
            )
            .order_by(
                models.ProjectAsset.preview_order.asc().nulls_last(),
                models.ProjectAsset.added_at.desc(),
            )
        )
    ).scalars().all()

    # normalise current ordering
    preview_ordered: list[models.ProjectAsset] = []
    for row in preview_rows:
        if row.asset_id == asset_id:
            continue
        preview_ordered.append(row)

    max_previews = 36

    if body.is_preview:
        if link not in preview_rows:
            if len(preview_ordered) >= max_previews:
                raise HTTPException(400, f"preview limit ({max_previews}) reached")
            preview_ordered.append(link)
        elif body.make_primary:
            preview_ordered.insert(0, link)
        else:
            # re-insert at original position
            index = next(
                (i for i, row in enumerate(preview_rows) if row.asset_id == asset_id),
                None,
            )
            if index is not None:
                preview_ordered.insert(min(index, len(preview_ordered)), link)
        if body.make_primary and link in preview_ordered:
            preview_ordered = [link] + [row for row in preview_ordered if row is not link]
        link.is_preview = True
    else:
        link.is_preview = False
        link.preview_order = None

    # Deduplicate while preserving order
    seen_assets: set[UUID] = set()
    deduped: list[models.ProjectAsset] = []
    for row in preview_ordered:
        if row.asset_id in seen_assets:
            continue
        if row is link and not body.is_preview:
            continue
        seen_assets.add(row.asset_id)
        deduped.append(row)

    if body.is_preview and link not in deduped:
        if body.make_primary:
            deduped = [link] + deduped
        else:
            deduped.append(link)

    for index, row in enumerate(deduped):
        row.is_preview = True
        row.preview_order = index

    if not body.is_preview:
        link.is_preview = False
        link.preview_order = None

    await db.commit()

    storage = PosixStorage.from_env()
    thumb_url = _thumb_url(asset, storage)
    preview_url = _preview_url(asset, storage)

    return schemas.AssetListItem(
        id=asset.id,
        status=schemas.AssetStatus(asset.status.value),
        taken_at=asset.taken_at,
        thumb_url=thumb_url,
        preview_url=preview_url,
        original_filename=asset.original_filename,
        size_bytes=asset.size_bytes,
        last_error=asset.last_error,
        metadata_warnings=_warnings_from_text(asset.metadata_warnings),
        queued_at=asset.queued_at,
        processing_started_at=asset.processing_started_at,
        completed_at=asset.completed_at,
        width=asset.width,
        height=asset.height,
        is_preview=link.is_preview,
        preview_order=link.preview_order,
    )
