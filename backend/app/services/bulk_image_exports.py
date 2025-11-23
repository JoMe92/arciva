from __future__ import annotations

import asyncio
import logging
import re
import shutil
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import AsyncIterator, Iterable
from uuid import UUID

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import SessionLocal
from ..deps import get_settings
from ..storage import PosixStorage

logger = logging.getLogger("arciva.bulk_image_exports")

# Images are grouped by capture date (`Asset.taken_at`) and fall back to import timestamp when missing.
DATE_BASIS_LABEL = "capture-date"
FOLDER_TEMPLATE = "year/month/day"
ARCHIVE_PREFIX = "arciva-images"
CHUNK_SIZE = 64
COMMIT_INTERVAL = 25


def _bulk_export_conditions(user_id: UUID):
    return (
        models.Asset.status == models.AssetStatus.READY,
        models.Asset.storage_uri.is_not(None),
        models.Asset.user_id == user_id,
        exists().where(
            models.ProjectAsset.asset_id == models.Asset.id,
            models.ProjectAsset.user_id == user_id,
        ),
    )


async def collect_bulk_export_asset_ids(db: AsyncSession, user_id: UUID) -> list[UUID]:
    rows = (
        await db.execute(
            select(models.Asset.id)
                .where(*_bulk_export_conditions(user_id))
                .order_by(
                    models.Asset.taken_at.is_(None),
                    models.Asset.taken_at.asc(),
                    models.Asset.created_at.asc(),
                )
        )
    ).scalars().all()
    return rows


async def estimate_bulk_image_export(db: AsyncSession, user_id: UUID) -> tuple[int, int]:
    total_files, total_bytes = (
        await db.execute(
            select(
                func.count(models.Asset.id),
                func.coalesce(func.sum(models.Asset.size_bytes), 0),
            ).where(*_bulk_export_conditions(user_id))
        )
    ).one()
    return int(total_files or 0), int(total_bytes or 0)


def _pick_reference_date(asset: models.Asset) -> datetime:
    if asset.taken_at:
        return asset.taken_at
    if asset.created_at:
        return asset.created_at
    return datetime.now(timezone.utc)


def _guess_extension(asset: models.Asset) -> str:
    if asset.original_filename:
        suffix = Path(asset.original_filename).suffix
        if suffix:
            return suffix
    mime = (asset.mime or "").lower()
    if "jpeg" in mime:
        return ".jpg"
    if "png" in mime:
        return ".png"
    if "tiff" in mime:
        return ".tiff"
    if "gif" in mime:
        return ".gif"
    return ".img"


def _safe_filename(asset: models.Asset) -> str:
    base = (asset.original_filename or "").strip()
    if not base:
        base = asset.id.hex
    base = Path(base).name or asset.id.hex
    sanitized = re.sub(r"[\\/]+", "-", base).strip() or asset.id.hex
    if "." not in sanitized:
        sanitized = f"{sanitized}{_guess_extension(asset)}"
    return sanitized


def _build_member_path(asset: models.Asset, used: set[str]) -> Path:
    ref = _pick_reference_date(asset)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)
    else:
        ref = ref.astimezone(timezone.utc)
    year = f"{ref.year:04d}"
    month = f"{ref.month:02d}"
    day = f"{ref.day:02d}"
    filename = _safe_filename(asset)
    rel = Path(year) / month / day / filename
    candidate = rel
    counter = 1
    while str(candidate) in used:
        candidate = rel.with_name(f"{rel.stem}-{counter}{rel.suffix}")
        counter += 1
    used.add(str(candidate))
    return candidate


async def _iter_assets(db: AsyncSession, asset_ids: Iterable[UUID], user_id: UUID) -> AsyncIterator[models.Asset]:
    batch = []
    for asset_id in asset_ids:
        batch.append(asset_id)
        if len(batch) >= CHUNK_SIZE:
            rows = (
                await db.execute(
                    select(models.Asset).where(
                        models.Asset.id.in_(batch),
                        models.Asset.user_id == user_id,
                    )
                )
            ).scalars().all()
            mapping = {asset.id: asset for asset in rows}
            for item in batch:
                asset = mapping.get(item)
                if not asset:
                    raise RuntimeError(f"Asset {item} missing for bulk export")
                yield asset
            batch = []
    if batch:
        rows = (
            await db.execute(
                select(models.Asset).where(
                    models.Asset.id.in_(batch),
                    models.Asset.user_id == user_id,
                )
            )
        ).scalars().all()
        mapping = {asset.id: asset for asset in rows}
        for item in batch:
            asset = mapping.get(item)
            if not asset:
                raise RuntimeError(f"Asset {item} missing for bulk export")
            yield asset


async def process_bulk_image_export(job_id: UUID) -> None:
    settings = get_settings()
    storage = PosixStorage.from_env()
    async with SessionLocal() as db:
        job = await db.get(models.BulkImageExport, job_id)
        if not job:
            logger.warning("process_bulk_image_export: job=%s missing", job_id)
            return
        if job.status not in {models.ExportJobStatus.QUEUED, models.ExportJobStatus.RUNNING}:
            logger.info("process_bulk_image_export: job=%s already handled status=%s", job_id, job.status)
            return

        asset_ids = [UUID(value) for value in job.asset_ids]
        if not asset_ids:
            job.status = models.ExportJobStatus.FAILED
            job.error_message = "No project-linked images available."
            job.finished_at = datetime.now(timezone.utc)
            await db.commit()
            return

        job.status = models.ExportJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        job.progress = 0
        job.processed_files = 0
        job.total_files = len(asset_ids)
        job.error_message = None
        job.date_basis = DATE_BASIS_LABEL
        await db.commit()

        job_dir = Path(settings.fs_exports_dir) / job.id.hex
        shutil.rmtree(job_dir, ignore_errors=True)
        job_dir.mkdir(parents=True, exist_ok=True)
        archive_name = f"{ARCHIVE_PREFIX}-{job.id.hex[:8]}.zip"
        archive_path = job_dir / archive_name

        processed = 0
        used_paths: set[str] = set()

        try:
            with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
                async for asset in _iter_assets(db, asset_ids, job.user_id):
                    if not asset.storage_uri:
                        raise RuntimeError(f"Asset {asset.id} missing storage path")
                    try:
                        source_path = storage.path_from_key(asset.storage_uri)
                    except ValueError as exc:
                        raise RuntimeError(f"Invalid storage key for asset {asset.id}: {exc}") from exc
                    if not source_path.exists():
                        raise RuntimeError(f"Asset source missing: {source_path}")
                    member_path = _build_member_path(asset, used_paths)
                    await asyncio.to_thread(zf.write, str(source_path), str(member_path))
                    processed += 1
                    job.processed_files = processed
                    job.progress = min(95, int((processed / max(job.total_files, 1)) * 95))
                    if processed % COMMIT_INTERVAL == 0:
                        await db.commit()

            try:
                job.artifact_path = storage.storage_key_for(archive_path)
            except ValueError:
                job.artifact_path = str(archive_path)
            job.artifact_filename = archive_name
            job.artifact_size = archive_path.stat().st_size if archive_path.exists() else None
            job.status = models.ExportJobStatus.COMPLETED
            job.progress = 100
            job.finished_at = datetime.now(timezone.utc)
            job.expires_at = job.finished_at + timedelta(hours=settings.export_retention_hours)
            await db.commit()
            logger.info("process_bulk_image_export: job=%s finished count=%d", job.id, processed)
        except Exception as exc:  # pragma: no cover - best effort
            logger.exception("process_bulk_image_export: job=%s failed", job.id)
            job.status = models.ExportJobStatus.FAILED
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            job.progress = min(job.progress, 95)
            await db.commit()
            shutil.rmtree(job_dir, ignore_errors=True)


async def cleanup_bulk_image_exports() -> None:
    settings = get_settings()
    storage = PosixStorage.from_env()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.export_retention_hours)
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(models.BulkImageExport).where(
                    models.BulkImageExport.finished_at.is_not(None),
                    models.BulkImageExport.finished_at < cutoff,
                    models.BulkImageExport.artifact_path.is_not(None),
                )
            )
        ).scalars().all()
        cleaned: list[UUID] = []
        for job in rows:
            path: Path | None = None
            if job.artifact_path:
                try:
                    path = storage.path_from_key(job.artifact_path)
                except ValueError:
                    path = None
                    logger.warning("cleanup_bulk_image_exports: invalid artifact path job=%s", job.id)
            if path and path.exists():
                try:
                    if path.is_file():
                        path.unlink(missing_ok=True)
                    else:
                        shutil.rmtree(path, ignore_errors=True)
                    parent = path.parent
                    if parent.name == job.id.hex:
                        shutil.rmtree(parent, ignore_errors=True)
                except Exception as exc:  # pragma: no cover
                    logger.warning("cleanup_bulk_image_exports: failed to remove %s (%s)", path, exc)
            job.artifact_path = None
            job.artifact_filename = None
            job.artifact_size = None
            job.expires_at = datetime.now(timezone.utc)
            cleaned.append(job.id)
        if cleaned:
            await db.commit()
            logger.info("cleanup_bulk_image_exports: removed %d expired jobs", len(cleaned))
