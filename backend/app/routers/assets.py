import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence
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
from ..services.pairing import sync_project_pairs
from ..services.annotations import write_annotations_for_assets
from ..services.metadata_states import ensure_state_for_link
from ..services.links import link_asset_to_project


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


def _basename_from_filename(name: str | None) -> str | None:
    if not name:
        return None
    stem = Path(name).stem
    return stem.strip() or None


def _color_label_to_schema(value: models.ColorLabel | str | None) -> schemas.ColorLabel:
    if isinstance(value, models.ColorLabel):
        return schemas.ColorLabel(value.value)
    if isinstance(value, str):
        try:
            return schemas.ColorLabel(value)
        except ValueError:
            return schemas.ColorLabel.NONE
    return schemas.ColorLabel.NONE


def _serialize_asset_item(
    asset: models.Asset,
    project_asset: models.ProjectAsset,
    pair: models.ProjectAssetPair | None,
    storage: PosixStorage,
    metadata: models.MetadataState | None,
) -> schemas.AssetListItem:
    thumb_url = _thumb_url(asset, storage)
    preview_url = _preview_url(asset, storage)
    pair_role: schemas.ImgType | None = None
    paired_asset_id: UUID | None = None
    paired_asset_type: schemas.ImgType | None = None
    basename = pair.basename if pair else _basename_from_filename(asset.original_filename)
    stack_primary_id = pair.raw_asset_id if pair else asset.id
    if pair:
        if asset.id == pair.jpeg_asset_id:
            pair_role = schemas.ImgType.JPEG
            paired_asset_id = pair.raw_asset_id
            paired_asset_type = schemas.ImgType.RAW
        elif asset.id == pair.raw_asset_id:
            pair_role = schemas.ImgType.RAW
            paired_asset_id = pair.jpeg_asset_id
            paired_asset_type = schemas.ImgType.JPEG
    rating = int(metadata.rating) if metadata else 0
    color_label = _color_label_to_schema(metadata.color_label if metadata else None)
    picked = bool(metadata.picked) if metadata else False
    rejected = bool(metadata.rejected) if metadata else False
    metadata_state_id = metadata.id if metadata else None
    metadata_source_project_id = metadata.source_project_id if metadata else None

    return schemas.AssetListItem(
        id=asset.id,
        link_id=project_asset.id,
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
        is_preview=bool(project_asset.is_preview),
        preview_order=project_asset.preview_order,
        basename=basename,
        pair_id=pair.id if pair else None,
        pair_role=pair_role,
        paired_asset_id=paired_asset_id,
        paired_asset_type=paired_asset_type,
        stack_primary_asset_id=stack_primary_id,
        rating=rating,
        color_label=color_label,
        picked=picked,
        rejected=rejected,
        metadata_state_id=metadata_state_id,
        metadata_source_project_id=metadata_source_project_id,
    )


async def _load_asset_items(
    db: AsyncSession,
    project_id: UUID,
    asset_ids: Sequence[UUID] | None = None,
) -> list[schemas.AssetListItem]:
    query = (
        select(models.Asset, models.ProjectAsset, models.ProjectAssetPair, models.MetadataState)
        .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
        .outerjoin(models.ProjectAssetPair, models.ProjectAssetPair.id == models.ProjectAsset.pair_id)
        .outerjoin(models.MetadataState, models.MetadataState.link_id == models.ProjectAsset.id)
        .where(models.ProjectAsset.project_id == project_id)
        .order_by(desc(models.ProjectAsset.added_at))
    )
    if asset_ids:
        query = query.where(models.ProjectAsset.asset_id.in_(asset_ids))
    rows = (await db.execute(query)).all()
    storage = PosixStorage.from_env()
    items = [_serialize_asset_item(asset, project_asset, pair, storage, metadata) for asset, project_asset, pair, metadata in rows]
    if asset_ids:
        order_map = {asset_id: idx for idx, asset_id in enumerate(asset_ids)}
        items.sort(key=lambda item: order_map.get(item.id, len(order_map)))
    return items


async def _load_metadata_template(
    db: AsyncSession,
    *,
    asset_id: UUID,
    project_id: UUID,
) -> models.MetadataState | None:
    return (
        await db.execute(
            select(models.MetadataState)
            .join(models.ProjectAsset, models.ProjectAsset.id == models.MetadataState.link_id)
            .where(
                models.ProjectAsset.project_id == project_id,
                models.ProjectAsset.asset_id == asset_id,
            )
            .order_by(models.MetadataState.updated_at.desc())
        )
    ).scalar_one_or_none()

async def _asset_detail(
    asset: models.Asset,
    db: AsyncSession,
    storage: PosixStorage,
    link: models.ProjectAsset | None = None,
    metadata: models.MetadataState | None = None,
) -> schemas.AssetDetail:
    thumb_url = _thumb_url(asset, storage)
    preview_url = _preview_url(asset, storage)
    derivatives = await _collect_derivatives(asset, db)
    rating = int(metadata.rating) if metadata else 0
    color_label = _color_label_to_schema(metadata.color_label if metadata else None)
    picked = bool(metadata.picked) if metadata else False
    rejected = bool(metadata.rejected) if metadata else False

    metadata_state_out: schemas.MetadataStateOut | None = None
    if metadata and link:
        metadata_state_out = schemas.MetadataStateOut(
            id=metadata.id,
            link_id=link.id,
            project_id=link.project_id,
            rating=rating,
            color_label=color_label,
            picked=picked,
            rejected=rejected,
            edits=metadata.edits,
            source_project_id=metadata.source_project_id,
            created_at=metadata.created_at,
            updated_at=metadata.updated_at,
        )
    return schemas.AssetDetail(
        id=asset.id,
        status=schemas.AssetStatus(asset.status.value),
        original_filename=asset.original_filename,
        mime=asset.mime,
        size_bytes=asset.size_bytes,
        width=asset.width,
        height=asset.height,
        taken_at=asset.taken_at,
        storage_uri=asset.storage_uri,
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
        rating=rating,
        color_label=color_label,
        picked=picked,
        rejected=rejected,
        metadata_state=metadata_state_out,
        format=asset.format,
        pixel_format=asset.pixel_format,
        pixel_hash=asset.pixel_hash,
    )


def _metadata_cache_path(storage: PosixStorage, asset: models.Asset, *, ensure: bool = False) -> Path | None:
    key = asset.sha256 or (str(asset.id) if asset.id else None)
    if not key:
        return None
    root = storage.derivatives / key
    if ensure:
        root.mkdir(parents=True, exist_ok=True)
    return root / "metadata.json"


def _load_metadata_cache(storage: PosixStorage, asset: models.Asset) -> dict[str, Any] | None:
    path = _metadata_cache_path(storage, asset)
    if not path or not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if isinstance(payload, dict):
            return payload
    except Exception:  # pragma: no cover - cache best-effort
        path.unlink(missing_ok=True)
    return None


def _write_metadata_cache(storage: PosixStorage, asset: models.Asset, payload: dict[str, Any]) -> None:
    path = _metadata_cache_path(storage, asset, ensure=True)
    if not path:
        return
    try:
        serialized = json.dumps(payload, ensure_ascii=False)
        path.write_text(serialized, encoding="utf-8")
    except Exception:  # pragma: no cover - cache best-effort
        logging.getLogger("arciva.assets").warning("metadata_cache_write_failed asset=%s", asset.id, exc_info=True)


async def _ensure_asset_metadata_populated(
    asset: models.Asset,
    db: AsyncSession,
    storage: PosixStorage,
) -> None:
    cache_payload = _load_metadata_cache(storage, asset)
    cache_taken_at: datetime | None = None
    if cache_payload:
        taken_str = cache_payload.get("taken_at")
        if isinstance(taken_str, str):
            try:
                cache_taken_at = datetime.fromisoformat(taken_str)
            except ValueError:
                cache_taken_at = None
    changed = False
    if cache_payload:
        cached_metadata = cache_payload.get("metadata")
        if cached_metadata and not asset.metadata_json:
            asset.metadata_json = cached_metadata
            changed = True
        if cache_taken_at and not asset.taken_at:
            asset.taken_at = cache_taken_at
            changed = True
        cached_width = cache_payload.get("width")
        cached_height = cache_payload.get("height")
        if isinstance(cached_width, int) and not asset.width:
            asset.width = cached_width
            changed = True
        if isinstance(cached_height, int) and not asset.height:
            asset.height = cached_height
            changed = True
        cached_warnings = cache_payload.get("warnings")
        if isinstance(cached_warnings, list) and not asset.metadata_warnings:
            asset.metadata_warnings = "\n".join(str(w) for w in cached_warnings if w)
            changed = True
    if changed:
        await db.commit()
        await db.refresh(asset)

    if asset.metadata_json and asset.taken_at and asset.width and asset.height:
        if not cache_payload:
            _write_metadata_cache(
                storage,
                asset,
                {
                    "metadata": asset.metadata_json,
                    "taken_at": asset.taken_at.isoformat() if asset.taken_at else None,
                    "width": asset.width,
                    "height": asset.height,
                    "warnings": _warnings_from_text(asset.metadata_warnings),
                },
            )
        return

    source_path: Path | None = None
    if asset.storage_uri:
        candidate = Path(asset.storage_uri)
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
        _write_metadata_cache(
            storage,
            asset,
            {
                "metadata": asset.metadata_json,
                "taken_at": asset.taken_at.isoformat() if asset.taken_at else None,
                "width": asset.width,
                "height": asset.height,
                "warnings": combined,
            },
        )

router = APIRouter(prefix="/v1", tags=["assets"])
logger = logging.getLogger("arciva.assets")

@router.get("/projects/{project_id}/assets", response_model=list[schemas.AssetListItem])
async def list_assets(project_id: UUID, limit: int = 1000, db: AsyncSession = Depends(get_db)):
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    await sync_project_pairs(db, project_id)
    q = (
        select(models.Asset, models.ProjectAsset, models.ProjectAssetPair, models.MetadataState)
        .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
        .outerjoin(models.ProjectAssetPair, models.ProjectAssetPair.id == models.ProjectAsset.pair_id)
        .outerjoin(models.MetadataState, models.MetadataState.link_id == models.ProjectAsset.id)
        .where(models.ProjectAsset.project_id == project_id)
        .order_by(desc(models.ProjectAsset.added_at))
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    storage = PosixStorage.from_env()
    return [_serialize_asset_item(asset, project_asset, pair, storage, metadata) for asset, project_asset, pair, metadata in rows]

@router.get("/assets/{asset_id}", response_model=schemas.AssetDetail)
async def get_asset(asset_id: UUID, project_id: UUID | None = None, db: AsyncSession = Depends(get_db)):
    await ensure_asset_metadata_column(db)
    asset = (
        await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")
    link = None
    metadata = None
    if project_id:
        link = (
            await db.execute(
                select(models.ProjectAsset)
                .where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.asset_id == asset.id,
                )
            )
        ).scalar_one_or_none()
        if not link:
            raise HTTPException(404, "asset not linked to project")
        metadata = (
            await db.execute(
                select(models.MetadataState).where(models.MetadataState.link_id == link.id)
            )
        ).scalar_one_or_none()
        if metadata is None:
            metadata = await ensure_state_for_link(db, link)
    storage = PosixStorage.from_env()
    await _ensure_asset_metadata_populated(asset, db, storage)
    return await _asset_detail(asset, db, storage, link=link, metadata=metadata)


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
    inherit_map = body.inheritance or {}

    for a in assets:
        inherit_source = inherit_map.get(a.id)
        template = None
        if inherit_source:
            template = await _load_metadata_template(db, asset_id=a.id, project_id=inherit_source)
            if not template:
                logger.warning(
                    "link_existing_assets: inheritance template missing asset=%s source_project=%s",
                    a.id,
                    inherit_source,
                )
        link, created = await link_asset_to_project(
            db,
            project_id=project_id,
            asset=a,
            metadata_template=template,
            source_project_id=inherit_source,
        )
        if not created:
            duplicates += 1
            logger.info(
                "link_existing_assets: project=%s asset=%s already linked", project_id, a.id
            )
            continue
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

    await sync_project_pairs(db, project_id)
    ordered_items = await _load_asset_items(db, project_id, want_ids)
    logger.info(
        "link_existing_assets: project=%s response_items=%s",
        project_id,
        [item.id for item in ordered_items],
    )
    return schemas.ProjectAssetsLinkOut(linked=linked, duplicates=duplicates, items=ordered_items)


@router.post("/projects/{project_id}/assets/interactions:apply", response_model=schemas.AssetInteractionUpdateOut)
async def apply_asset_interactions(
    project_id: UUID,
    body: schemas.AssetInteractionUpdate,
    db: AsyncSession = Depends(get_db),
):
    if not body.asset_ids:
        raise HTTPException(400, "asset_ids required")

    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    await sync_project_pairs(db, project_id)

    base_ids = list(dict.fromkeys(body.asset_ids))
    query = (
        select(models.Asset, models.ProjectAsset, models.ProjectAssetPair, models.MetadataState)
        .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
        .outerjoin(models.ProjectAssetPair, models.ProjectAssetPair.id == models.ProjectAsset.pair_id)
        .outerjoin(models.MetadataState, models.MetadataState.link_id == models.ProjectAsset.id)
        .where(
            models.ProjectAsset.project_id == project_id,
            models.ProjectAsset.asset_id.in_(base_ids),
        )
    )
    rows = (await db.execute(query)).all()
    found_ids = {asset.id for asset, _, _, _ in rows}
    missing = [str(aid) for aid in base_ids if aid not in found_ids]
    if missing:
        raise HTTPException(404, f"assets not linked to project: {missing}")

    assets_map: dict[UUID, tuple[models.Asset, models.ProjectAsset, models.ProjectAssetPair | None, models.MetadataState | None]] = {
        asset.id: (asset, project_asset, pair, metadata) for asset, project_asset, pair, metadata in rows
    }
    for asset, _, pair, _ in rows:
        if pair:
            counterpart_id = pair.raw_asset_id if asset.id == pair.jpeg_asset_id else pair.jpeg_asset_id
            assets_map.setdefault(counterpart_id, tuple())

    missing_pairs = [aid for aid, data in assets_map.items() if not data]
    if missing_pairs:
        extra_rows = (
            await db.execute(
                select(models.Asset, models.ProjectAsset, models.ProjectAssetPair, models.MetadataState)
                .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
                .outerjoin(models.ProjectAssetPair, models.ProjectAssetPair.id == models.ProjectAsset.pair_id)
                .outerjoin(models.MetadataState, models.MetadataState.link_id == models.ProjectAsset.id)
                .where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.asset_id.in_(missing_pairs),
                )
            )
        ).all()
        for asset, project_asset, pair, metadata in extra_rows:
            assets_map[asset.id] = (asset, project_asset, pair, metadata)

    rating_value = None if body.rating is None else max(0, min(body.rating, 5))
    color_value = None
    if body.color_label is not None:
        color_value = models.ColorLabel(body.color_label.value if isinstance(body.color_label, schemas.ColorLabel) else body.color_label)
    picked_value = body.picked
    rejected_value = body.rejected
    if rejected_value:
        picked_value = False
    elif picked_value:
        rejected_value = False

    if rating_value is None and color_value is None and picked_value is None and rejected_value is None:
        return schemas.AssetInteractionUpdateOut(items=[])

    touched_pairs: list[tuple[models.Asset, models.MetadataState]] = []
    for asset_id, data in assets_map.items():
        if not data:
            continue
        asset, link, _, metadata = data
        state = metadata or await ensure_state_for_link(db, link)
        if rating_value is not None:
            state.rating = rating_value
        if color_value is not None:
            state.color_label = color_value
        if picked_value is not None:
            state.picked = bool(picked_value)
        if rejected_value is not None:
            state.rejected = bool(rejected_value)
        touched_pairs.append((asset, state))

    await db.commit()
    try:
        await write_annotations_for_assets(touched_pairs)
    except Exception:  # pragma: no cover - best effort metadata write
        logger.exception(
            "apply_asset_interactions: metadata write failed project=%s assets=%s",
            project_id,
            [a.id for a, _ in touched_pairs],
        )

    ordered_ids: list[UUID] = []
    seen: set[UUID] = set()
    for aid in base_ids:
        if aid in assets_map and aid not in seen:
            ordered_ids.append(aid)
            seen.add(aid)
    for aid in assets_map.keys():
        if aid not in seen:
            ordered_ids.append(aid)
            seen.add(aid)

    items = await _load_asset_items(db, project_id, ordered_ids)
    return schemas.AssetInteractionUpdateOut(items=items)


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

    pair = None
    if link.pair_id:
        pair = (
            await db.execute(
                select(models.ProjectAssetPair).where(models.ProjectAssetPair.id == link.pair_id)
            )
        ).scalar_one_or_none()

    storage = PosixStorage.from_env()
    return _serialize_asset_item(asset, link, pair, storage)
