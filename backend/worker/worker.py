from arq import cron
from arq.connections import RedisSettings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID
from pathlib import Path
from datetime import datetime

from backend.app.deps import get_settings
from backend.app.db import SessionLocal
from backend.app.storage import PosixStorage
from backend.app.imaging import sha256_file, read_exif, make_thumb
from backend.app import models

async def ingest_asset(ctx, asset_id: str):
    s = get_settings()
    storage = PosixStorage.from_env()

    async with SessionLocal() as db:  # type: AsyncSession
        a = (await db.execute(select(models.Asset).where(models.Asset.id==UUID(asset_id)))).scalar_one_or_none()
        if not a:
            return {"error": "asset not found"}

        # move from temp -> originals by hash
        temp_path: Path = storage.temp_path_for(asset_id)
        if not temp_path.exists():
            await db.execute(update(models.Asset).where(models.Asset.id==a.id).values(status=models.AssetStatus.ERROR))
            await db.commit()
            return {"error": "temp not found"}

        # compute sha256 and extension
        sha = sha256_file(temp_path)
        # derive extension from original filename (fallback .bin)
        import os
        _, ext = os.path.splitext(a.original_filename)
        ext = ext.lower() if ext else ".bin"

        dest = storage.move_to_originals(temp_path, sha, ext)

        # read EXIF and dims
        taken_at, (w, h) = read_exif(dest)

        # generate thumb_256
        thumb_bytes, (tw, th) = make_thumb(dest, 256)
        tpath = storage.derivative_path(sha, "thumb_256", "jpg")
        tpath.write_bytes(thumb_bytes)

        # update DB
        a.sha256 = sha
        a.storage_key = str(dest)
        a.width = w
        a.height = h
        a.taken_at = taken_at
        a.status = models.AssetStatus.READY

        # add derivatives row (upsert behaviour: simple try/add)
        d = models.Derivative(asset_id=a.id, variant="thumb_256", format="jpg",
                              width=tw, height=th, storage_key=str(tpath))
        db.add(d)

        await db.flush()
        await db.commit()
        return {"ok": True, "sha256": sha}

class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    functions = [ingest_asset]
    max_jobs = get_settings().worker_concurrency
