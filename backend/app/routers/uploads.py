from datetime import datetime, timezone
import logging
import secrets
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from arq import create_pool
from arq.connections import RedisSettings

from .. import models, schemas
from ..db import get_db
from ..deps import get_settings
from ..storage import PosixStorage
from ..schema_utils import ensure_preview_columns

logger = logging.getLogger("nivio.uploads")

router = APIRouter(prefix="/v1", tags=["uploads"])

# naive in-memory token store for MVP (process lifetime)
UPLOAD_TOKENS: dict[str, str] = {}

@router.post("/projects/{project_id}/uploads/init", response_model=schemas.UploadInitOut, status_code=201)
async def upload_init(project_id: UUID, body: schemas.UploadInitIn, db: AsyncSession = Depends(get_db)):
    # Ensure project exists
    proj = (await db.execute(select(models.Project).where(models.Project.id==project_id))).scalar_one_or_none()
    if not proj:
        raise HTTPException(404, "Project not found")

    asset = models.Asset(
        original_filename=body.filename,
        mime=body.mime,
        size_bytes=body.size_bytes,
        status=models.AssetStatus.UPLOADING
    )
    db.add(asset)
    await db.flush()  # get asset.id

    # Link to project now
    await ensure_preview_columns(db)
    link = models.ProjectAsset(project_id=proj.id, asset_id=asset.id)
    db.add(link)
    await db.flush()
    await db.commit()

    logger.info(
        "upload_init: project=%s asset=%s filename=%s size=%s mime=%s",
        project_id,
        asset.id,
        body.filename,
        body.size_bytes,
        body.mime,
    )

    token = secrets.token_urlsafe(24)
    UPLOAD_TOKENS[str(asset.id)] = token
    return schemas.UploadInitOut(asset_id=asset.id, upload_token=token, max_bytes=body.size_bytes)

@router.put("/uploads/{asset_id}")
async def upload_file(asset_id: UUID, request: Request, x_upload_token: str = Header(...)):
    # validate token
    sid = str(asset_id)
    tok = UPLOAD_TOKENS.get(sid)
    if not tok or tok != x_upload_token:
        raise HTTPException(401, "invalid upload token")

    storage = PosixStorage.from_env()
    temp_path: Path = storage.temp_path_for(sid)

    # stream to temp file with a conservative size guard
    s = get_settings()
    max_bytes = s.max_upload_mb * 1024 * 1024
    total = 0
    with temp_path.open("wb") as f:
        async for chunk in request.stream():
            total += len(chunk)
            if total > max_bytes:
                temp_path.unlink(missing_ok=True)
                raise HTTPException(413, "file too large")
            f.write(chunk)

    logger.info(
        "upload_file: asset=%s wrote_bytes=%s temp_path=%s",
        sid,
        total,
        temp_path,
    )

    return {"ok": True, "bytes": total}

@router.post("/uploads/complete")
async def upload_complete(body: schemas.UploadCompleteIn, db: AsyncSession = Depends(get_db)):
    sid = str(body.asset_id)
    token = UPLOAD_TOKENS.pop(sid, None)
    if not token:
        raise HTTPException(400, "no upload in progress")

    asset = (await db.execute(select(models.Asset).where(models.Asset.id==body.asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")

    now = datetime.now(timezone.utc)
    logger.info(
        "upload_complete: asset=%s status=%s -> QUEUED",
        asset.id,
        asset.status,
    )
    asset.status = models.AssetStatus.QUEUED
    asset.queued_at = now
    asset.processing_started_at = None
    asset.completed_at = None
    asset.last_error = None
    await db.commit()

    # enqueue ARQ job
    settings = get_settings()
    redis = None
    try:
        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await redis.enqueue_job("ingest_asset", str(asset.id))
    except Exception as exc:
        asset.status = models.AssetStatus.ERROR
        asset.last_error = f"enqueue_failed: {exc!r}"
        await db.commit()
        logger.exception("upload_complete: enqueue failed asset=%s", asset.id)
        raise HTTPException(503, "failed to enqueue ingest job")
    finally:
        if redis is not None:
            await redis.close()

    logger.info("upload_complete: enqueue success asset=%s", asset.id)
    return {"status": models.AssetStatus.QUEUED.value}
