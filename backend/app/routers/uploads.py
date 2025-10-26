from fastapi import APIRouter, Depends, HTTPException, UploadFile, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import secrets
from pathlib import Path

from ..db import get_db
from .. import models, schemas
from ..deps import get_settings
from ..storage import PosixStorage

router = APIRouter(prefix="/v1", tags=["uploads"])

# naive in-memory token store for MVP (process lifetime)
UPLOAD_TOKENS: dict[str, str] = {}

@router.post("/projects/{project_id}/uploads/init", response_model=schemas.UploadInitOut, status_code=201)
async def upload_init(project_id: UUID, body: schemas.UploadInitIn, db: AsyncSession = Depends(get_db)):
    # Ensure project exists
    from sqlalchemy import select
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
    link = models.ProjectAsset(project_id=proj.id, asset_id=asset.id)
    db.add(link)
    await db.flush()
    await db.commit()

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
    from ..deps import get_settings
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

    return {"ok": True, "bytes": total}

@router.post("/uploads/complete")
async def upload_complete(body: schemas.UploadCompleteIn, db: AsyncSession = Depends(get_db)):
    sid = str(body.asset_id)
    token = UPLOAD_TOKENS.get(sid)
    if not token:
        raise HTTPException(400, "no upload in progress")

    # check asset exists
    from sqlalchemy import select
    asset = (await db.execute(select(models.Asset).where(models.Asset.id==body.asset_id))).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")

    # enqueue ARQ job
    from arq.connections import RedisSettings, ArqRedis
    from ..deps import get_settings
    settings = get_settings()
    redis = await ArqRedis.create(RedisSettings.from_dsn(settings.redis_url))
    await redis.enqueue_job("ingest_asset", str(asset.id))
    await redis.close(close_connection_pool=True)

    return {"status": "QUEUED"}
