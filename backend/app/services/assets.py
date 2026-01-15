import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..storage import PosixStorage
from ..imaging import read_exif

logger = logging.getLogger("arciva.assets")


def warnings_from_text(data: str | None) -> list[str]:
    if not data:
        return []
    return [entry for entry in data.split("\n") if entry]


def thumb_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.find_derivative(asset.sha256, "thumb_256", "jpg")
    if path:
        return f"/v1/assets/{asset.id}/thumbs/256"
    return None


def preview_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.find_derivative(asset.sha256, "preview_raw", "jpg")
    if path:
        return f"/v1/assets/{asset.id}/preview"
    return None


async def collect_derivatives(
    asset: models.Asset,
    db: AsyncSession,
) -> list[schemas.AssetDerivativeOut]:
    rows = (
        (
            await db.execute(
                select(models.Derivative).where(models.Derivative.asset_id == asset.id)
            )
        )
        .scalars()
        .all()
    )
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


def basename_from_filename(name: str | None) -> str | None:
    if not name:
        return None
    stem = Path(name).stem
    return stem.strip() or None


def color_label_to_schema(
    value: models.ColorLabel | str | None,
) -> schemas.ColorLabel:
    if isinstance(value, models.ColorLabel):
        return schemas.ColorLabel(value.value)
    if isinstance(value, str):
        try:
            return schemas.ColorLabel(value)
        except ValueError:
            return schemas.ColorLabel.NONE
    return schemas.ColorLabel.NONE


def serialize_asset_item(
    asset: models.Asset,
    project_asset: models.ProjectAsset,
    pair: models.ProjectAssetPair | None,
    storage: PosixStorage,
    metadata: models.MetadataState | None,
) -> schemas.AssetListItem:
    t_url = thumb_url(asset, storage)
    p_url = preview_url(asset, storage)
    pair_role: schemas.ImgType | None = None
    paired_asset_id: UUID | None = None
    paired_asset_type: schemas.ImgType | None = None
    basename = (
        pair.basename if pair else basename_from_filename(asset.original_filename)
    )
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
    color_label = color_label_to_schema(metadata.color_label if metadata else None)
    picked = bool(metadata.picked) if metadata else False
    rejected = bool(metadata.rejected) if metadata else False
    metadata_state_id = metadata.id if metadata else None
    metadata_source_project_id = metadata.source_project_id if metadata else None

    metadata_state_out = None
    if metadata and project_asset:
        metadata_state_out = schemas.MetadataStateOut(
            id=metadata.id,
            link_id=project_asset.id,
            project_id=project_asset.project_id,
            rating=rating,
            color_label=color_label,
            picked=picked,
            rejected=rejected,
            edits=metadata.edits,
            source_project_id=metadata.source_project_id,
            created_at=metadata.created_at,
            updated_at=metadata.updated_at,
        )

    return schemas.AssetListItem(
        id=asset.id,
        link_id=project_asset.id,
        status=schemas.AssetStatus(asset.status.value),
        taken_at=asset.taken_at,
        thumb_url=t_url,
        preview_url=p_url,
        original_filename=asset.original_filename,
        size_bytes=asset.size_bytes,
        last_error=asset.last_error,
        metadata_warnings=warnings_from_text(asset.metadata_warnings),
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
        metadata_state=metadata_state_out,
    )


async def load_asset_items(
    db: AsyncSession,
    project_id: UUID,
    asset_ids: Sequence[UUID] | None = None,
    *,
    user_id: UUID,
) -> list[schemas.AssetListItem]:
    query = (
        select(
            models.Asset,
            models.ProjectAsset,
            models.ProjectAssetPair,
            models.MetadataState,
        )
        .join(
            models.ProjectAsset,
            models.ProjectAsset.asset_id == models.Asset.id,
        )
        .outerjoin(
            models.ProjectAssetPair,
            models.ProjectAssetPair.id == models.ProjectAsset.pair_id,
        )
        .outerjoin(
            models.MetadataState,
            models.MetadataState.link_id == models.ProjectAsset.id,
        )
        .where(
            models.ProjectAsset.project_id == project_id,
            models.ProjectAsset.user_id == user_id,
        )
        .order_by(desc(models.ProjectAsset.added_at))
    )
    if asset_ids:
        query = query.where(models.ProjectAsset.asset_id.in_(asset_ids))
    rows = (await db.execute(query)).all()
    storage = PosixStorage.from_env()
    items = [
        serialize_asset_item(asset, project_asset, pair, storage, metadata)
        for asset, project_asset, pair, metadata in rows
    ]
    if asset_ids:
        order_map = {asset_id: idx for idx, asset_id in enumerate(asset_ids)}
        items.sort(key=lambda item: order_map.get(item.id, len(order_map)))
    return items


async def load_metadata_template(
    db: AsyncSession,
    *,
    asset_id: UUID,
    project_id: UUID,
    user_id: UUID,
) -> models.MetadataState | None:
    return (
        await db.execute(
            select(models.MetadataState)
            .join(
                models.ProjectAsset,
                models.ProjectAsset.id == models.MetadataState.link_id,
            )
            .where(
                models.ProjectAsset.project_id == project_id,
                models.ProjectAsset.user_id == user_id,
                models.ProjectAsset.asset_id == asset_id,
            )
            .order_by(models.MetadataState.updated_at.desc())
        )
    ).scalar_one_or_none()


async def asset_detail(
    asset: models.Asset,
    db: AsyncSession,
    storage: PosixStorage,
    link: models.ProjectAsset | None = None,
    metadata: models.MetadataState | None = None,
) -> schemas.AssetDetail:
    t_url = thumb_url(asset, storage)
    p_url = preview_url(asset, storage)
    derivatives = await collect_derivatives(asset, db)
    rating = int(metadata.rating) if metadata else 0
    color_label = color_label_to_schema(metadata.color_label if metadata else None)
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
        metadata_warnings=warnings_from_text(asset.metadata_warnings),
        thumb_url=t_url,
        preview_url=p_url,
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


def metadata_cache_path(
    storage: PosixStorage, asset: models.Asset, *, ensure: bool = False
) -> Path | None:
    key = asset.sha256 or (str(asset.id) if asset.id else None)
    if not key:
        return None
    root = storage.derivatives / key
    if ensure:
        root.mkdir(parents=True, exist_ok=True)
    return root / "metadata.json"


def load_metadata_cache(
    storage: PosixStorage, asset: models.Asset
) -> dict[str, Any] | None:
    path = metadata_cache_path(storage, asset)
    if not path or not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if isinstance(payload, dict):
            return payload
    except Exception:
        path.unlink(missing_ok=True)
    return None


def write_metadata_cache(
    storage: PosixStorage, asset: models.Asset, payload: dict[str, Any]
) -> None:
    path = metadata_cache_path(storage, asset, ensure=True)
    if not path:
        return
    try:
        serialized = json.dumps(payload, ensure_ascii=False)
        path.write_text(serialized, encoding="utf-8")
    except Exception:
        logger.warning("metadata_cache_write_failed asset=%s", asset.id, exc_info=True)


async def ensure_asset_metadata_populated(
    asset: models.Asset,
    db: AsyncSession,
    storage: PosixStorage,
) -> None:
    cache_payload = load_metadata_cache(storage, asset)
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
            write_metadata_cache(
                storage,
                asset,
                {
                    "metadata": asset.metadata_json,
                    "taken_at": (
                        asset.taken_at.isoformat() if asset.taken_at else None
                    ),
                    "width": asset.width,
                    "height": asset.height,
                    "warnings": warnings_from_text(asset.metadata_warnings),
                },
            )
        return

    source_path: Path | None = None
    if asset.storage_uri:
        try:
            candidate = storage.path_from_key(asset.storage_uri)
        except ValueError:
            candidate = None
        if candidate and candidate.exists():
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
        taken_at, (width, height), metadata, warnings = await asyncio.to_thread(
            read_exif, source_path
        )
    except Exception:
        logger.exception(
            "ensure_asset_metadata_populated: read_exif failed asset=%s",
            asset.id,
        )
        return

    changed = False
    existing = warnings_from_text(asset.metadata_warnings)

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
        existing = [
            w for w in existing if w not in {"EXIFTOOL_NOT_INSTALLED", "EXIF_ERROR"}
        ]

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
        write_metadata_cache(
            storage,
            asset,
            {
                "metadata": asset.metadata_json,
                "taken_at": (asset.taken_at.isoformat() if asset.taken_at else None),
                "width": asset.width,
                "height": asset.height,
                "warnings": combined,
            },
        )
