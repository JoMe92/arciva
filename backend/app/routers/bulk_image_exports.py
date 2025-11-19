from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import get_db
from ..services import bulk_image_exports
from ..storage import PosixStorage

logger = logging.getLogger("arciva.bulk_image_exports.api")

router = APIRouter(prefix="/v1/bulk-image-exports", tags=["bulk-exports"])


def _download_url(job: models.BulkImageExport) -> Optional[str]:
    if job.status != models.ExportJobStatus.COMPLETED:
        return None
    if not job.artifact_path:
        return None
    storage = PosixStorage.from_env()
    try:
        path = storage.path_from_key(job.artifact_path)
    except ValueError:
        return None
    if not path.is_file():
        return None
    return f"/v1/bulk-image-exports/{job.id}/download"


def _serialize_job(job: models.BulkImageExport) -> schemas.BulkImageExportOut:
    status = schemas.ExportJobStatus(job.status.value)
    return schemas.BulkImageExportOut(
        id=job.id,
        status=status,
        progress=job.progress,
        processed_files=job.processed_files,
        total_files=job.total_files,
        download_url=_download_url(job),
        artifact_filename=job.artifact_filename,
        artifact_size=job.artifact_size,
        date_basis=job.date_basis,
        folder_template=bulk_image_exports.FOLDER_TEMPLATE,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


@router.get("/estimate", response_model=schemas.BulkImageExportEstimate)
async def estimate_bulk_image_export(
    db: AsyncSession = Depends(get_db),
):
    total_files, total_bytes = await bulk_image_exports.estimate_bulk_image_export(db)
    if total_files == 0:
        raise HTTPException(status_code=400, detail="No project images available to export.")
    return schemas.BulkImageExportEstimate(
        total_files=total_files,
        total_bytes=total_bytes,
        date_basis=bulk_image_exports.DATE_BASIS_LABEL,
        folder_template=bulk_image_exports.FOLDER_TEMPLATE,
    )


@router.post("", response_model=schemas.BulkImageExportOut, status_code=201)
async def start_bulk_image_export(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    asset_ids = await bulk_image_exports.collect_bulk_export_asset_ids(db)
    if not asset_ids:
        raise HTTPException(status_code=400, detail="No project images available to export.")
    job = models.BulkImageExport(
        asset_ids=[str(asset_id) for asset_id in asset_ids],
        status=models.ExportJobStatus.QUEUED,
        progress=0,
        processed_files=0,
        total_files=len(asset_ids),
        date_basis=bulk_image_exports.DATE_BASIS_LABEL,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(bulk_image_exports.process_bulk_image_export, job.id)
    background_tasks.add_task(bulk_image_exports.cleanup_bulk_image_exports)
    logger.info("start_bulk_image_export: job=%s assets=%d", job.id, len(asset_ids))
    return _serialize_job(job)


@router.get("/{job_id}", response_model=schemas.BulkImageExportOut)
async def get_bulk_image_export(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(models.BulkImageExport, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Bulk image export not found")
    return _serialize_job(job)


@router.get("/{job_id}/download")
async def download_bulk_image_export(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(models.BulkImageExport, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Bulk image export not found")
    if job.status != models.ExportJobStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Export is not ready")
    if not job.artifact_path:
        raise HTTPException(status_code=410, detail="Export artifact unavailable")
    storage = PosixStorage.from_env()
    try:
        path = storage.path_from_key(job.artifact_path)
    except ValueError:
        raise HTTPException(status_code=410, detail="Export artifact unavailable")
    if not path.is_file():
        raise HTTPException(status_code=410, detail="Export artifact missing")
    filename = job.artifact_filename or f"arciva-images-{job.id.hex[:8]}.zip"
    return FileResponse(
        path,
        media_type="application/zip",
        filename=filename,
    )
