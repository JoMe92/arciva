from datetime import datetime, timezone
import hashlib
import logging
import secrets
from pathlib import Path
from uuid import UUID
from typing import TypedDict

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from arq import create_pool
from arq.connections import RedisSettings

from .. import models, schemas
from ..db import get_db
from ..security import get_current_user
from ..deps import get_settings
from ..storage import PosixStorage
from ..schema_utils import ensure_preview_columns
from ..services.metadata_states import ensure_state_for_link
from ..services.dedup import adopt_duplicate_asset
from ..utils.assets import detect_asset_format
from ..utils.projects import ensure_project_access

logger = logging.getLogger("arciva.uploads")

router = APIRouter(prefix="/v1", tags=["uploads"])


# naive in-memory token store for MVP (process lifetime)
class UploadSession(TypedDict, total=False):
    token: str
    sha256: str | None
    bytes: int
    duplicate_asset_id: str | None
    temp_removed: bool


UPLOAD_TOKENS: dict[str, UploadSession] = {}


@router.post(
    "/projects/{project_id}/uploads/init",
    response_model=schemas.UploadInitOut,
    status_code=201,
)
async def upload_init(
    project_id: UUID,
    body: schemas.UploadInitIn,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_project_access(
        db, project_id=project_id, user_id=current_user.id
    )

    asset_format = detect_asset_format(body.filename, body.mime)
    asset = models.Asset(
        user_id=current_user.id,
        original_filename=body.filename,
        mime=body.mime,
        size_bytes=body.size_bytes,
        status=models.AssetStatus.UPLOADING,
        format=asset_format or "UNKNOWN",
    )
    db.add(asset)
    await db.flush()  # get asset.id

    # Link to project now
    await ensure_preview_columns(db)
    link = models.ProjectAsset(
        project_id=project_id, asset_id=asset.id, user_id=current_user.id
    )
    db.add(link)
    await db.flush()
    await ensure_state_for_link(db, link)
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
    UPLOAD_TOKENS[str(asset.id)] = {
        "token": token,
        "sha256": None,
        "bytes": 0,
        "duplicate_asset_id": None,
        "temp_removed": False,
    }
    return schemas.UploadInitOut(
        asset_id=asset.id, upload_token=token, max_bytes=body.size_bytes
    )


@router.put("/uploads/{asset_id}")
async def upload_file(
    asset_id: UUID,
    request: Request,
    x_upload_token: str = Header(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sid = str(asset_id)
    session = UPLOAD_TOKENS.get(sid)
    token = session.get("token") if session else None
    if not token or token != x_upload_token:
        raise HTTPException(401, "invalid upload token")

    asset = (
        await db.execute(
            select(models.Asset).where(
                models.Asset.id == asset_id,
                models.Asset.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")

    storage = PosixStorage.from_env()
    temp_path: Path = storage.temp_path_for(sid)

    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    total = 0
    hasher = hashlib.sha256()
    with temp_path.open("wb") as f:
        async for chunk in request.stream():
            total += len(chunk)
            if total > max_bytes:
                temp_path.unlink(missing_ok=True)
                raise HTTPException(413, "file too large")
            hasher.update(chunk)
            f.write(chunk)

    sha = hasher.hexdigest()
    session["sha256"] = sha
    session["bytes"] = total
    session["duplicate_asset_id"] = None
    session["temp_removed"] = False

    duplicate = (
        await db.execute(
            select(models.Asset).where(
                models.Asset.sha256 == sha,
                models.Asset.id != asset_id,
                models.Asset.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if duplicate:
        session["duplicate_asset_id"] = str(duplicate.id)
        storage.remove_temp(asset_id)
        session["temp_removed"] = True
        logger.info(
            "upload_file: dedupe hit asset=%s existing=%s",
            asset_id,
            duplicate.id,
        )
        return {"ok": True, "bytes": total, "sha256": sha, "duplicate": True}

    asset.sha256 = sha
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        duplicate = (
            await db.execute(
                select(models.Asset).where(
                    models.Asset.sha256 == sha,
                    models.Asset.id != asset_id,
                    models.Asset.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        if duplicate:
            session["duplicate_asset_id"] = str(duplicate.id)
            storage.remove_temp(asset_id)
            session["temp_removed"] = True
            logger.info(
                "upload_file: dedupe hit via constraint asset=%s existing=%s",
                asset_id,
                duplicate.id,
            )
            return {
                "ok": True,
                "bytes": total,
                "sha256": sha,
                "duplicate": True,
            }
        raise

    logger.info(
        "upload_file: asset=%s wrote_bytes=%s sha=%s temp_path=%s",
        sid,
        total,
        sha,
        temp_path,
    )

    return {"ok": True, "bytes": total, "sha256": sha, "duplicate": False}


@router.post("/uploads/complete")
async def upload_complete(
    body: schemas.UploadCompleteIn,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sid = str(body.asset_id)
    session = UPLOAD_TOKENS.pop(sid, None)
    if not session:
        raise HTTPException(400, "no upload in progress")

    asset = (
        await db.execute(
            select(models.Asset).where(models.Asset.id == body.asset_id)
        )
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "asset not found")
    if asset.user_id != current_user.id:
        raise HTTPException(404, "asset not found")

    storage = PosixStorage.from_env()
    temp_path = storage.temp_path_for(sid)
    duplicate_id = session.get("duplicate_asset_id")
    if duplicate_id:
        existing = (
            await db.execute(
                select(models.Asset).where(
                    models.Asset.id == UUID(duplicate_id),
                    models.Asset.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        if not existing:
            raise HTTPException(404, "duplicate asset missing")
        await adopt_duplicate_asset(
            db,
            duplicate_asset=asset,
            existing_asset=existing,
            storage=storage,
            temp_path=None if session.get("temp_removed") else temp_path,
            cleanup_temp=not session.get("temp_removed"),
        )
        logger.info(
            "upload_complete: dedupe linked asset=%s existing=%s",
            asset.id,
            existing.id,
        )
        return {
            "status": models.AssetStatus.DUPLICATE.value,
            "asset_id": existing.id,
        }

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
