from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable, List, Optional, Tuple
from uuid import UUID

from arq.connections import RedisSettings
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app import models
from backend.app.deps import get_settings
from backend.app.db import SessionLocal
from backend.app.imaging import make_thumb, read_exif, sha256_file
from backend.app.logging_utils import setup_logging
from backend.app.storage import PosixStorage
from backend.app.schema_utils import ensure_asset_metadata_column
from backend.app.services.raw_reader import RawReadResult, RawReaderService

SETTINGS = get_settings()
setup_logging(SETTINGS.logs_dir)

logger = logging.getLogger("nivio.worker.ingest")
logger.info("worker process started")

DERIVATIVE_PRESETS: list[Tuple[str, int]] = [
    ("thumb_256", 256),
    ("thumb_1024", 1024),
]

RAW_READER = RawReaderService()


async def _sha256_async(path: Path) -> str:
    return await asyncio.to_thread(sha256_file, path)


async def _read_exif_async(path: Path) -> tuple[Optional[datetime], Tuple[Optional[int], Optional[int]], Optional[dict[str, Any]], list[str]]:
    return await asyncio.to_thread(read_exif, path)


async def _make_derivative_async(path: Optional[Path], size: int, *, image_bytes: bytes | None = None):
    return await asyncio.to_thread(make_thumb, path, size, image_bytes=image_bytes)


def _warnings_to_text(warnings: Iterable[str]) -> str | None:
    filtered = [w for w in warnings if w]
    return "\n".join(filtered) if filtered else None


def _warnings_from_text(data: str | None) -> List[str]:
    if not data:
        return []
    return [entry for entry in data.split("\n") if entry]


def _merge_metadata(
    existing: dict[str, Any] | None, addition: dict[str, Any]
) -> dict[str, Any]:
    """
    Merge ``addition`` into ``existing`` while preserving nested dictionaries.

    Parameters
    ----------
    existing : dict[str, Any] | None
        Previously collected metadata payload.
    addition : dict[str, Any]
        Metadata gathered from supplemental sources.

    Returns
    -------
    dict[str, Any]
        Combined metadata dictionary.
    """

    merged: dict[str, Any] = {}
    if isinstance(existing, dict):
        merged.update(existing)
    elif existing is not None:
        merged["legacy_metadata"] = existing

    for key, value in addition.items():
        if (
            key in merged
            and isinstance(merged[key], dict)
            and isinstance(value, dict)
        ):
            nested = dict(merged[key])
            nested.update(value)
            merged[key] = nested
        else:
            merged[key] = value
    return merged


async def ingest_asset(ctx, asset_id: str):
    storage = PosixStorage.from_env()
    now = datetime.now(timezone.utc)
    asset_uuid = UUID(asset_id)

    async with SessionLocal() as db:  # type: AsyncSession
        asset = (
            await db.execute(
                select(models.Asset).where(models.Asset.id == asset_uuid)
            )
        ).scalar_one_or_none()
        if not asset:
            logger.warning("ingest_asset: asset=%s not found", asset_id)
            return {"error": "asset not found"}

        logger.info(
            "ingest_asset: start asset=%s status=%s size=%s filename=%s",
            asset_id,
            asset.status,
            asset.size_bytes,
            asset.original_filename,
        )

        await ensure_asset_metadata_column(db)

        temp_path = storage.temp_path_for(asset_id)
        temp_exists = temp_path.exists()
        original_path: Path | None = Path(asset.storage_key) if asset.storage_key else None
        if original_path and not original_path.exists():
            original_path = None

        if temp_exists:
            source_path = temp_path
        elif original_path and original_path.exists():
            source_path = original_path
        else:
            logger.error(
                "ingest_asset: missing source asset=%s temp=%s original=%s",
                asset_id,
                temp_path,
                original_path,
            )
            asset.status = models.AssetStatus.MISSING_SOURCE
            asset.completed_at = now
            asset.last_error = "missing_source"
            asset.metadata_warnings = _warnings_to_text(["MISSING_ORIGINAL"])
            await db.commit()
            return {"error": "missing source"}

        if asset.status != models.AssetStatus.PROCESSING:
            asset.status = models.AssetStatus.PROCESSING
        asset.processing_started_at = now
        asset.last_error = None
        await db.commit()

        try:
            sha = await _sha256_async(source_path)
            logger.info("ingest_asset: asset=%s sha256=%s source=%s", asset_id, sha, source_path)

            if temp_exists:
                duplicate = (
                    await db.execute(
                        select(models.Asset).where(
                            models.Asset.sha256 == sha,
                            models.Asset.id != asset.id,
                        )
                    )
                ).scalar_one_or_none()
                if duplicate:
                    logger.info(
                        "ingest_asset: asset=%s duplicate_of=%s", asset_id, duplicate.id
                    )
                    await _handle_duplicate(db, asset, duplicate, storage, temp_path, now)
                    return {"duplicate_of": str(duplicate.id)}

            ext = Path(asset.original_filename).suffix.lower()
            if not ext:
                if original_path:
                    ext = original_path.suffix.lower()
                if not ext:
                    ext = ".bin"

            if temp_exists:
                dest = storage.move_to_originals(temp_path, sha, ext)
                source_path = dest
            else:
                if not original_path:
                    dest = storage.original_path_for(sha, ext)
                else:
                    dest = original_path

            taken_at = asset.taken_at
            width = asset.width
            height = asset.height
            metadata_payload = getattr(asset, "metadata_json", None)
            warnings: List[str] = []
            raw_result: RawReadResult | None = None
            raw_metadata: dict[str, Any] | None = None
            raw_preview_bytes: bytes | None = None

            is_raw_candidate = RAW_READER.supports(Path(asset.original_filename)) or RAW_READER.supports(source_path)
            if is_raw_candidate:
                try:
                    raw_result = await asyncio.to_thread(RAW_READER.read, source_path)
                except Exception:  # pragma: no cover - best effort protection
                    logger.exception("ingest_asset: raw reader failed asset=%s", asset_id)
                    warnings.append("RAW_PREVIEW_ERROR")
                else:
                    if raw_result.warnings:
                        warnings.extend(raw_result.warnings)
                    raw_metadata = raw_result.metadata or None
                    raw_preview_bytes = raw_result.preview_bytes
                    if width is None and raw_result.preview_width is not None:
                        width = raw_result.preview_width
                    if height is None and raw_result.preview_height is not None:
                        height = raw_result.preview_height
                    if raw_preview_bytes:
                        logger.info(
                            "ingest_asset: raw preview extracted asset=%s thumb_size=%sx%s",
                            asset_id,
                            raw_result.preview_width,
                            raw_result.preview_height,
                        )

            try:
                exif_taken_at, dims, exif_metadata, exif_warnings = await _read_exif_async(source_path)
                if exif_taken_at:
                    taken_at = exif_taken_at
                dw, dh = dims
                if dw is not None:
                    width = dw
                if dh is not None:
                    height = dh
                if exif_metadata:
                    metadata_payload = exif_metadata
                if exif_warnings:
                    warnings.extend(exif_warnings)
            except Exception as exc:  # pragma: no cover - best effort
                logger.exception("ingest_asset: read_exif failed asset=%s", asset_id)
                warnings.append("EXIF_ERROR")

            if taken_at is None:
                warnings.append("EXIF_UNAVAILABLE")

            if raw_metadata:
                base_metadata = metadata_payload if isinstance(metadata_payload, dict) else None
                metadata_payload = _merge_metadata(base_metadata, raw_metadata)

            if (width is None or height is None) and raw_preview_bytes:
                try:
                    from PIL import Image, ImageOps

                    def _preview_size() -> tuple[int, int]:
                        with Image.open(BytesIO(raw_preview_bytes)) as im:
                            im = ImageOps.exif_transpose(im)
                            return im.size

                    width, height = await asyncio.to_thread(_preview_size)
                except Exception:  # pragma: no cover - best effort
                    logger.exception("ingest_asset: raw preview size failed asset=%s", asset_id)

            if (width is None or height is None) and source_path.exists():
                try:
                    from PIL import Image, ImageOps

                    def _size() -> tuple[int, int]:
                        with Image.open(source_path) as im:
                            im = ImageOps.exif_transpose(im)
                            return im.size

                    width, height = await asyncio.to_thread(_size)
                except Exception:  # pragma: no cover - best effort
                    logger.exception("ingest_asset: fallback image size failed asset=%s", asset_id)

            derivative_failures: List[str] = []
            for variant, size in DERIVATIVE_PRESETS:
                try:
                    blob, dims = await _make_derivative_async(
                        None if raw_preview_bytes is not None else source_path,
                        size,
                        image_bytes=raw_preview_bytes,
                    )
                except Exception as exc:  # pragma: no cover
                    if raw_preview_bytes is not None:
                        logger.warning(
                            "ingest_asset: derivative %s preview path failed asset=%s error=%s, falling back to source",
                            variant,
                            asset_id,
                            exc,
                        )
                        try:
                            blob, dims = await _make_derivative_async(source_path, size)
                        except Exception:
                            logger.exception(
                                "ingest_asset: derivative %s failed after fallback asset=%s",
                                variant,
                                asset_id,
                            )
                            derivative_failures.append(f"DERIVATIVE_{variant.upper()}_FAILED")
                            continue
                    else:
                        logger.exception(
                            "ingest_asset: derivative %s failed asset=%s",
                            variant,
                            asset_id,
                        )
                        derivative_failures.append(f"DERIVATIVE_{variant.upper()}_FAILED")
                        continue

                tpath = storage.derivative_path(sha, variant, "jpg")
                tpath.write_bytes(blob)

                derivative = (
                    await db.execute(
                        select(models.Derivative).where(
                            models.Derivative.asset_id == asset.id,
                            models.Derivative.variant == variant,
                        )
                    )
                ).scalar_one_or_none()
                if derivative:
                    derivative.width, derivative.height = dims
                    derivative.format = "jpg"
                    derivative.storage_key = str(tpath)
                else:
                    db.add(
                        models.Derivative(
                            asset_id=asset.id,
                            variant=variant,
                            format="jpg",
                            width=dims[0],
                            height=dims[1],
                            storage_key=str(tpath),
                        )
                    )

            warnings.extend(derivative_failures)

            if raw_preview_bytes:
                preview_variant = "preview_raw"
                preview_path = storage.derivative_path(sha, preview_variant, "jpg")
                preview_path.write_bytes(raw_preview_bytes)

                preview_dims: tuple[int, int] | None = None
                if raw_result and raw_result.preview_width and raw_result.preview_height:
                    preview_dims = (int(raw_result.preview_width), int(raw_result.preview_height))
                else:
                    try:
                        from PIL import Image, ImageOps

                        def _preview_size() -> tuple[int, int]:
                            with Image.open(BytesIO(raw_preview_bytes)) as im:
                                im = ImageOps.exif_transpose(im)
                                return im.size

                        preview_dims = await asyncio.to_thread(_preview_size)
                    except Exception:  # pragma: no cover - best effort
                        logger.exception("ingest_asset: preview dims fallback failed asset=%s", asset_id)

                if preview_dims is None:
                    fallback_w = int(width or (raw_result.preview_width if raw_result else 0) or 0)
                    fallback_h = int(height or (raw_result.preview_height if raw_result else 0) or 0)
                    preview_dims = (fallback_w, fallback_h)

                preview_derivative = (
                    await db.execute(
                        select(models.Derivative).where(
                            models.Derivative.asset_id == asset.id,
                            models.Derivative.variant == preview_variant,
                        )
                    )
                ).scalar_one_or_none()
                px, py = preview_dims
                if px <= 0 or py <= 0:
                    px = int(width or (raw_result.preview_width if raw_result else 0) or 1)
                    py = int(height or (raw_result.preview_height if raw_result else 0) or 1)
                if preview_derivative:
                    preview_derivative.width = px
                    preview_derivative.height = py
                    preview_derivative.format = "jpg"
                    preview_derivative.storage_key = str(preview_path)
                else:
                    db.add(
                        models.Derivative(
                            asset_id=asset.id,
                            variant=preview_variant,
                            format="jpg",
                            width=px,
                            height=py,
                            storage_key=str(preview_path),
                        )
                    )

            asset.sha256 = sha
            asset.storage_key = str(source_path.resolve())
            asset.width = width
            asset.height = height
            asset.taken_at = taken_at
            asset.status = models.AssetStatus.READY
            asset.completed_at = datetime.now(timezone.utc)
            asset.metadata_warnings = _warnings_to_text(warnings)
            if hasattr(asset, "metadata_json"):
                asset.metadata_json = metadata_payload
            asset.reference_count = max(asset.reference_count or 1, 1)
            await db.commit()
            logger.info(
                "ingest_asset: complete asset=%s sha=%s width=%s height=%s warnings=%s",
                asset_id,
                sha,
                width,
                height,
                warnings,
            )
            return {"ok": True, "sha256": sha}

        except Exception as exc:  # pragma: no cover - protection
            logger.exception("ingest_asset: asset=%s failed", asset_id)
            asset.status = models.AssetStatus.ERROR
            asset.last_error = f"{exc.__class__.__name__}: {exc}"
            asset.completed_at = datetime.now(timezone.utc)
            await db.commit()
            return {"error": str(exc)}


async def _handle_duplicate(
    db: AsyncSession,
    new_asset: models.Asset,
    existing_asset: models.Asset,
    storage: PosixStorage,
    temp_path: Path,
    now: datetime,
) -> None:
    project_ids = (
        await db.execute(
            select(models.ProjectAsset.project_id).where(
                models.ProjectAsset.asset_id == new_asset.id
            )
        )
    ).scalars().all()

    linked = 0
    for project_id in project_ids:
        already_linked = (
            await db.execute(
                select(models.ProjectAsset).where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.asset_id == existing_asset.id,
                )
            )
        ).scalar_one_or_none()
        if already_linked:
            continue
        db.add(models.ProjectAsset(project_id=project_id, asset_id=existing_asset.id))
        linked += 1

    await db.execute(
        delete(models.ProjectAsset).where(models.ProjectAsset.asset_id == new_asset.id)
    )
    await db.execute(delete(models.Asset).where(models.Asset.id == new_asset.id))

    count = (
        await db.execute(
            select(func.count()).select_from(models.ProjectAsset).where(
                models.ProjectAsset.asset_id == existing_asset.id
            )
        )
    ).scalar_one()
    existing_asset.reference_count = max(int(count), 1)
    existing_asset.completed_at = existing_asset.completed_at or now
    existing_asset.status = models.AssetStatus.READY

    storage.remove_temp(new_asset.id)
    await db.commit()
    logger.info(
        "ingest_asset: duplicate asset=%s linked_to=%s new_links=%s total_refs=%s",
        new_asset.id,
        existing_asset.id,
        linked,
        existing_asset.reference_count,
    )


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(SETTINGS.redis_url)
    functions = [ingest_asset]
    max_jobs = SETTINGS.worker_concurrency
