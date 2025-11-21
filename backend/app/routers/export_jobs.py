from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import get_db
from ..security import get_current_user
from ..services.export_jobs import process_export_job, cleanup_export_jobs
from ..storage import PosixStorage
from ..utils.projects import ensure_project_access

logger = logging.getLogger("arciva.export_jobs")

router = APIRouter(prefix="/v1/export-jobs", tags=["exports"])


def _download_url(job: models.ExportJob) -> Optional[str]:
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
    return f"/v1/export-jobs/{job.id}/download"


def _serialize_job(job: models.ExportJob) -> schemas.ExportJobOut:
    settings = schemas.ExportJobSettings(**job.settings)
    status = schemas.ExportJobStatus(job.status.value)
    return schemas.ExportJobOut(
        id=job.id,
        project_id=job.project_id,
        status=status,
        progress=job.progress,
        total_photos=job.total_photos,
        exported_files=job.exported_files,
        download_url=_download_url(job),
        artifact_filename=job.artifact_filename,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        settings=settings,
    )


@router.post("", response_model=schemas.ExportJobOut, status_code=201)
async def start_export_job(
    body: schemas.ExportJobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_project_access(db, project_id=body.project_id, user_id=current_user.id)
    photo_ids = list(dict.fromkeys(body.photo_ids))
    rows = (
        await db.execute(
            select(models.ProjectAsset.asset_id)
            .where(
                models.ProjectAsset.project_id == body.project_id,
                models.ProjectAsset.asset_id.in_(photo_ids),
                models.ProjectAsset.user_id == current_user.id,
            )
        )
    ).scalars().all()
    found = set(rows)
    missing = [str(pid) for pid in photo_ids if pid not in found]
    if missing:
        raise HTTPException(status_code=400, detail=f"Photo(s) not part of project: {missing}")
    job = models.ExportJob(
        user_id=current_user.id,
        project_id=body.project_id,
        photo_ids=[str(pid) for pid in body.photo_ids],
        settings=body.settings.model_dump(),
        status=models.ExportJobStatus.QUEUED,
        progress=0,
        total_photos=len(body.photo_ids),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(process_export_job, job.id)
    background_tasks.add_task(cleanup_export_jobs)
    logger.info("start_export_job: job=%s project=%s photos=%d", job.id, job.project_id, len(body.photo_ids))
    return _serialize_job(job)


@router.get("", response_model=List[schemas.ExportJobOut])
async def list_export_jobs(
    project_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    stmt = (
        select(models.ExportJob)
        .where(models.ExportJob.user_id == current_user.id)
        .order_by(models.ExportJob.created_at.desc())
        .limit(200)
    )
    if project_id:
        await ensure_project_access(db, project_id=project_id, user_id=current_user.id)
        stmt = stmt.where(models.ExportJob.project_id == project_id)
    rows = (await db.execute(stmt)).scalars().all()
    return [_serialize_job(job) for job in rows]


@router.get("/{job_id}", response_model=schemas.ExportJobOut)
async def get_export_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    job = (
        await db.execute(
            select(models.ExportJob).where(
                models.ExportJob.id == job_id,
                models.ExportJob.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    return _serialize_job(job)


@router.get("/{job_id}/download")
async def download_export_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    job = (
        await db.execute(
            select(models.ExportJob).where(
                models.ExportJob.id == job_id,
                models.ExportJob.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    if job.status != models.ExportJobStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Export job not completed")
    if not job.artifact_path:
        raise HTTPException(status_code=410, detail="Export artifact unavailable")
    storage = PosixStorage.from_env()
    try:
        path = storage.path_from_key(job.artifact_path)
    except ValueError:
        raise HTTPException(status_code=410, detail="Export artifact unavailable")
    if not path.is_file():
        raise HTTPException(status_code=410, detail="Export artifact missing")
    filename = job.artifact_filename or f"arciva-export-{job.id.hex[:8]}.zip"
    return FileResponse(
        path,
        media_type="application/zip",
        filename=filename,
    )
