from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
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

SETTINGS = get_settings()
setup_logging(SETTINGS.logs_dir)

logger = logging.getLogger("nivio.worker.ingest")
logger.info("worker process started")

DERIVATIVE_PRESETS: list[Tuple[str, int]] = [
    ("thumb_256", 256),
    ("thumb_1024", 1024),
]


async def _sha256_async(path: Path) -> str:
    return await asyncio.to_thread(sha256_file, path)


async def _read_exif_async(path: Path) -> tuple[Optional[datetime], Tuple[Optional[int], Optional[int]], Optional[dict[str, Any]], list[str]]:
    return await asyncio.to_thread(read_exif, path)


async def _make_derivative_async(path: Path, size: int):
    return await asyncio.to_thread(make_thumb, path, size)


def _warnings_to_text(warnings: Iterable[str]) -> str | None:
    filtered = [w for w in warnings if w]
    return "\n".join(filtered) if filtered else None


def _warnings_from_text(data: str | None) -> List[str]:
    if not data:
        return []
    return [entry for entry in data.split("\n") if entry]


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
                    blob, dims = await _make_derivative_async(source_path, size)
                except Exception as exc:  # pragma: no cover
                    logger.exception("ingest_asset: derivative %s failed asset=%s", variant, asset_id)
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
