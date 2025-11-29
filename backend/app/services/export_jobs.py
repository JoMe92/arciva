from __future__ import annotations

import asyncio
import logging
import math
import re
import shutil
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import SessionLocal
from ..deps import get_settings
from ..storage import PosixStorage

logger = logging.getLogger("arciva.exports")


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return normalized or "export"


def _output_extension(fmt: schemas.ExportOutputFormat) -> str:
    if fmt == schemas.ExportOutputFormat.PNG:
        return ".png"
    if fmt == schemas.ExportOutputFormat.TIFF:
        return ".tiff"
    return ".jpg"


def _contact_sheet_extension(fmt: schemas.ExportContactSheetFormat) -> str:
    if fmt == schemas.ExportContactSheetFormat.TIFF:
        return ".tiff"
    if fmt == schemas.ExportContactSheetFormat.PDF:
        return ".pdf"
    return ".jpg"


def _generate_file_name(base: str, ext: str, used: set[str]) -> str:
    candidate = f"{base}{ext}"
    counter = 1
    while candidate in used:
        candidate = f"{base}-{counter}{ext}"
        counter += 1
    used.add(candidate)
    return candidate


def _render_image(
    source_path: Path,
    dest_path: Path,
    settings: schemas.ExportJobSettings,
) -> None:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(source_path) as im:
            im = ImageOps.exif_transpose(im)
            if settings.output_format == schemas.ExportOutputFormat.JPEG:
                im = im.convert("RGB")
            if (
                settings.size_mode == schemas.ExportSizeMode.RESIZE
                and settings.long_edge
            ):
                long_edge = settings.long_edge
                resampling = getattr(Image, "Resampling", Image)
                im.thumbnail((long_edge, long_edge), resampling.LANCZOS)
            save_kwargs: dict[str, object] = {}
            target_format = settings.output_format.value
            if settings.output_format == schemas.ExportOutputFormat.JPEG:
                save_kwargs["quality"] = settings.jpeg_quality or 90
                save_kwargs["optimize"] = True
                save_kwargs["subsampling"] = 0
            elif settings.output_format == schemas.ExportOutputFormat.TIFF:
                save_kwargs["compression"] = "tiff_deflate"
            im.save(dest_path, format=target_format, **save_kwargs)
    except Exception as exc:  # pragma: no cover - fallback to raw copy
        logger.warning(
            "Falling back to byte copy for %s -> %s (%s)",
            source_path,
            dest_path,
            exc,
        )
        shutil.copy2(source_path, dest_path)


def _build_contact_sheet(
    image_paths: list[Path],
    dest_path: Path,
    fmt: schemas.ExportContactSheetFormat,
) -> None:
    if not image_paths:
        return
    thumb_size = 320
    columns = min(5, max(1, len(image_paths)))
    rows = math.ceil(len(image_paths) / columns)
    tile_height = thumb_size + 48
    sheet_width = columns * (thumb_size + 20) + 20
    sheet_height = rows * tile_height + 40
    sheet = Image.new("RGB", (sheet_width, sheet_height), color="#F8F5F0")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, path in enumerate(image_paths):
        col = index % columns
        row = index // columns
        x = 20 + col * (thumb_size + 20)
        y = 20 + row * tile_height
        try:
            with Image.open(path) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((thumb_size, thumb_size))
                paste_x = x + (thumb_size - im.width) // 2
                paste_y = y
                sheet.paste(im, (paste_x, paste_y))
        except Exception as exc:  # pragma: no cover - best effort
            logger.warning("contact sheet: failed to load %s (%s)", path, exc)
        filename = path.name
        draw.text((x, y + thumb_size + 8), filename[:64], fill="#1F1E1B", font=font)

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == schemas.ExportContactSheetFormat.PDF:
        sheet_rgb = sheet.convert("RGB")
        sheet_rgb.save(dest_path, format="PDF")
    else:
        sheet.save(dest_path, format=fmt.value)


async def _load_assets_for_job(
    db: AsyncSession,
    job: models.ExportJob,
    settings: schemas.ExportJobSettings,
) -> tuple[dict[UUID, models.Asset], list[UUID]]:
    photo_ids = [UUID(value) for value in job.photo_ids]
    wanted_ids: set[UUID] = set(photo_ids)
    raw_to_jpeg: dict[UUID, UUID] = {}
    if settings.raw_handling == schemas.ExportRawStrategy.DEVELOPED and photo_ids:
        pair_rows = (
            (
                await db.execute(
                    select(models.ProjectAssetPair).where(
                        models.ProjectAssetPair.project_id == job.project_id,
                        models.ProjectAssetPair.raw_asset_id.in_(photo_ids),
                    )
                )
            )
            .scalars()
            .all()
        )
        for pair in pair_rows:
            raw_to_jpeg[pair.raw_asset_id] = pair.jpeg_asset_id
            wanted_ids.add(pair.jpeg_asset_id)

    rows = (
        (
            await db.execute(
                select(models.Asset)
                .join(
                    models.ProjectAsset,
                    models.ProjectAsset.asset_id == models.Asset.id,
                )
                .where(
                    models.ProjectAsset.project_id == job.project_id,
                    models.Asset.id.in_(wanted_ids),
                    models.ProjectAsset.user_id == job.user_id,
                    models.Asset.user_id == job.user_id,
                )
            )
        )
        .scalars()
        .all()
    )
    asset_map: dict[UUID, models.Asset] = {asset.id: asset for asset in rows}

    missing = [asset_id for asset_id in wanted_ids if asset_id not in asset_map]
    if missing:
        raise RuntimeError(f"Missing assets for export job {job.id}: {missing}")

    resolved_ids = [raw_to_jpeg.get(photo_id, photo_id) for photo_id in photo_ids]
    return asset_map, resolved_ids


async def process_export_job(job_id: UUID) -> None:
    settings_obj = get_settings()
    storage = PosixStorage.from_env()
    async with SessionLocal() as db:
        job = await db.get(models.ExportJob, job_id)
        if not job:
            logger.warning("process_export_job: job=%s not found", job_id)
            return
        if job.status not in {
            models.ExportJobStatus.QUEUED,
            models.ExportJobStatus.RUNNING,
        }:
            logger.info(
                "process_export_job: job=%s already processed status=%s",
                job_id,
                job.status,
            )
            return

        try:
            project = await db.get(models.Project, job.project_id)
            if not project or project.user_id != job.user_id:
                raise RuntimeError("Project not found for export job")
            settings = schemas.ExportJobSettings(**job.settings)
            asset_map, resolved_ids = await _load_assets_for_job(db, job, settings)
        except Exception as exc:
            job.status = models.ExportJobStatus.FAILED
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            await db.commit()
            logger.exception("process_export_job: failed to initialise job=%s", job_id)
            return

        job.status = models.ExportJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        job.error_message = None
        job.total_photos = len(resolved_ids)
        await db.commit()

        job_dir = Path(settings_obj.fs_exports_dir) / job.id.hex
        files_dir = job_dir / "files"
        shutil.rmtree(job_dir, ignore_errors=True)
        files_dir.mkdir(parents=True, exist_ok=True)

        exported_paths: list[Path] = []
        used_names: set[str] = set()
        total = len(resolved_ids)

        try:
            for index, asset_id in enumerate(resolved_ids, start=1):
                asset = asset_map.get(asset_id)
                if not asset or not asset.storage_uri:
                    raise RuntimeError(f"Asset {asset_id} missing storage path")
                try:
                    source_path = storage.path_from_key(asset.storage_uri)
                except ValueError as exc:
                    raise RuntimeError(
                        f"Invalid storage key for asset {asset_id}: {exc}"
                    ) from exc
                if not source_path.exists():
                    raise RuntimeError(f"Asset source missing on disk: {source_path}")

                base_name = (
                    Path(asset.original_filename or str(asset.id)).stem or asset.id.hex
                )
                safe_base = _slugify(base_name)
                dest_name = _generate_file_name(
                    safe_base,
                    _output_extension(settings.output_format),
                    used_names,
                )
                dest_path = files_dir / dest_name
                await asyncio.to_thread(_render_image, source_path, dest_path, settings)
                exported_paths.append(dest_path)

                job.exported_files = index
                job.progress = min(90, int((index / max(total, 1)) * 90))
                await db.commit()

            if settings.contact_sheet_enabled:
                sheet_ext = _contact_sheet_extension(settings.contact_sheet_format)
                sheet_name = _generate_file_name("contact-sheet", sheet_ext, used_names)
                sheet_path = files_dir / sheet_name
                await asyncio.to_thread(
                    _build_contact_sheet,
                    exported_paths,
                    sheet_path,
                    settings.contact_sheet_format,
                )
                if sheet_path.exists():
                    exported_paths.append(sheet_path)

            slug = _slugify(project.title or "project")
            archive_name = f"{slug}-{job.id.hex[:8]}.zip"
            archive_path = job_dir / archive_name
            await asyncio.to_thread(_make_zip_archive, files_dir, archive_path)
            shutil.rmtree(files_dir, ignore_errors=True)

            try:
                job.artifact_path = storage.storage_key_for(archive_path)
            except ValueError:
                job.artifact_path = str(archive_path)
            job.artifact_filename = archive_name
            job.artifact_size = (
                archive_path.stat().st_size if archive_path.exists() else None
            )
            job.status = models.ExportJobStatus.COMPLETED
            job.progress = 100
            job.finished_at = datetime.now(timezone.utc)
            job.expires_at = job.finished_at + timedelta(
                hours=settings_obj.export_retention_hours
            )
            await db.commit()
            logger.info("process_export_job: completed job=%s", job.id)
        except Exception as exc:  # pragma: no cover - best effort
            logger.exception("process_export_job: failed job=%s", job.id)
            job.status = models.ExportJobStatus.FAILED
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            job.progress = min(job.progress, 95)
            await db.commit()
            shutil.rmtree(job_dir, ignore_errors=True)


def _make_zip_archive(source_dir: Path, archive_path: Path) -> None:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in source_dir.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(source_dir))


async def cleanup_export_jobs() -> None:
    settings = get_settings()
    storage = PosixStorage.from_env()
    cutoff = datetime.now(timezone.utc) - timedelta(
        hours=settings.export_retention_hours
    )
    async with SessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(models.ExportJob).where(
                        models.ExportJob.finished_at.is_not(None),
                        models.ExportJob.finished_at < cutoff,
                        models.ExportJob.artifact_path.is_not(None),
                    )
                )
            )
            .scalars()
            .all()
        )

        removed: list[UUID] = []
        for job in rows:
            path: Path | None = None
            if job.artifact_path:
                try:
                    path = storage.path_from_key(job.artifact_path)
                except ValueError:
                    path = None
                    logger.warning(
                        "cleanup_export_jobs: invalid artifact path job=%s",
                        job.id,
                    )
            if path and path.exists():
                try:
                    if path.is_file():
                        path.unlink(missing_ok=True)
                    else:
                        shutil.rmtree(path, ignore_errors=True)
                    parent = path.parent
                    if parent.name == job.id.hex:
                        shutil.rmtree(parent, ignore_errors=True)
                except Exception as exc:  # pragma: no cover - best effort
                    logger.warning(
                        "cleanup_export_jobs: failed to remove %s (%s)",
                        path,
                        exc,
                    )
            job.artifact_path = None
            job.artifact_filename = None
            job.artifact_size = None
            job.expires_at = datetime.now(timezone.utc)
            removed.append(job.id)
        if removed:
            await db.commit()
            logger.info("cleanup_export_jobs: removed %d expired jobs", len(removed))
