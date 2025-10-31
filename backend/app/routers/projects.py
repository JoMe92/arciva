# backend/app/routers/projects.py
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import get_db
from ..storage import PosixStorage
from ..schema_utils import ensure_preview_columns


def _thumb_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.derivative_path(asset.sha256, "thumb_256", "jpg")
    if path.exists():
        return f"/v1/assets/{asset.id}/thumbs/256"
    return None


async def _load_preview_map(
    db: AsyncSession,
    project_ids: list[UUID],
) -> dict[UUID, list[schemas.ProjectPreviewImage]]:
    if not project_ids:
        return {}

    rows = (
        await db.execute(
            select(models.ProjectAsset, models.Asset)
            .join(models.Asset, models.Asset.id == models.ProjectAsset.asset_id)
            .where(
                models.ProjectAsset.project_id.in_(project_ids),
                models.ProjectAsset.is_preview.is_(True),
            )
            .order_by(
                models.ProjectAsset.project_id,
                models.ProjectAsset.preview_order.asc().nulls_last(),
                models.ProjectAsset.added_at.desc(),
            )
        )
    ).all()

    storage = PosixStorage.from_env()
    preview_map: dict[UUID, list[tuple[int, UUID, str | None, int | None, int | None]]] = {pid: [] for pid in project_ids}
    for project_asset, asset in rows:
        order = project_asset.preview_order if project_asset.preview_order is not None else 10_000
        preview_map.setdefault(project_asset.project_id, []).append(
            (order, asset.id, _thumb_url(asset, storage), asset.width, asset.height)
        )

    normalized_map: dict[UUID, list[schemas.ProjectPreviewImage]] = {}
    for project_id, entries in preview_map.items():
        entries.sort(key=lambda item: item[0])
        normalized_map[project_id] = [
            schemas.ProjectPreviewImage(
                asset_id=asset_id,
                thumb_url=thumb_url,
                order=index,
                width=width,
                height=height,
            )
            for index, (_, asset_id, thumb_url, width, height) in enumerate(entries)
        ]

    return normalized_map

logger = logging.getLogger("nivio.projects")

router = APIRouter(prefix="/v1/projects", tags=["projects"])


@router.post("", response_model=schemas.ProjectOut, status_code=201)
async def create_project(
    body: schemas.ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    logger.info("create_project: title=%r client=%r", body.title, body.client)
    # insert
    p = models.Project(title=body.title, client=body.client, note=body.note)
    db.add(p)
    await db.flush()

    # server defaults (created_at/updated_at) laden
    await db.refresh(p)

    # commit (Session ist expire_on_commit=False, daher p weiterhin befüllt)
    await db.commit()

    result = schemas.ProjectOut(
        id=p.id,
        title=p.title,
        client=p.client,
        note=p.note,
        created_at=p.created_at,
        updated_at=p.updated_at,
        asset_count=0,
        preview_images=[],
    )
    logger.info("create_project: success id=%s", p.id)
    return result


@router.get("", response_model=list[schemas.ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
):
    logger.info("list_projects: fetching projects")
    await ensure_preview_columns(db)
    rows = (
        await db.execute(
            select(
                models.Project,
                func.count(models.ProjectAsset.project_id).label("asset_count"),
            )
            .outerjoin(
                models.ProjectAsset,
                models.ProjectAsset.project_id == models.Project.id,
            )
            .group_by(models.Project.id)
            .order_by(models.Project.created_at.desc())
        )
    ).all()

    project_ids = [proj.id for proj, _ in rows]
    preview_map = await _load_preview_map(db, project_ids)

    response = [
        schemas.ProjectOut(
            id=proj.id,
            title=proj.title,
            client=proj.client,
            note=proj.note,
            created_at=proj.created_at,
            updated_at=proj.updated_at,
            asset_count=asset_count,
            preview_images=preview_map.get(proj.id, []),
        )
        for proj, asset_count in rows
    ]
    logger.info("list_projects: returned %d projects", len(response))
    return response


@router.get("/{project_id}", response_model=schemas.ProjectOut)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    logger.info("get_project: id=%s", project_id)
    await ensure_preview_columns(db)
    proj = (
        await db.execute(
            select(models.Project).where(models.Project.id == project_id)
        )
    ).scalar_one_or_none()
    if not proj:
        logger.warning("get_project: id=%s not found", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    count = (
        await db.execute(
            select(func.count())
            .select_from(models.ProjectAsset)
            .where(models.ProjectAsset.project_id == proj.id)
        )
    ).scalar_one()

    preview_map = await _load_preview_map(db, [proj.id])

    result = schemas.ProjectOut(
        id=proj.id,
        title=proj.title,
        client=proj.client,
        note=proj.note,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
        asset_count=count,
        preview_images=preview_map.get(proj.id, []),
    )
    logger.info("get_project: id=%s asset_count=%s", proj.id, count)
    return result


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    body: schemas.ProjectDelete,
    db: AsyncSession = Depends(get_db),
):
    logger.info("delete_project: id=%s delete_assets=%s", project_id, body.delete_assets)
    proj = (
        await db.execute(
            select(models.Project).where(models.Project.id == project_id)
        )
    ).scalar_one_or_none()
    if not proj:
        logger.warning("delete_project: id=%s not found", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    confirmed = body.confirm_title.strip()
    if confirmed != proj.title.strip():
        logger.warning(
            "delete_project: id=%s confirmation mismatch provided=%r expected=%r",
            project_id,
            confirmed,
            proj.title,
        )
        raise HTTPException(status_code=400, detail="Project title confirmation mismatch")

    asset_ids = (
        await db.execute(
            select(models.ProjectAsset.asset_id).where(
                models.ProjectAsset.project_id == project_id
            )
        )
    ).scalars().all()

    assets: list[models.Asset] = []
    if asset_ids:
        assets = (
            await db.execute(
                select(models.Asset).where(models.Asset.id.in_(asset_ids))
            )
        ).scalars().all()

    remaining_counts: dict[UUID, int] = {}
    if asset_ids:
        other_rows = (
            await db.execute(
                select(
                    models.ProjectAsset.asset_id,
                    func.count(models.ProjectAsset.project_id),
                )
                .where(
                    models.ProjectAsset.asset_id.in_(asset_ids),
                    models.ProjectAsset.project_id != project_id,
                )
                .group_by(models.ProjectAsset.asset_id)
            )
        ).all()
        remaining_counts = {asset_id: int(count) for asset_id, count in other_rows}

    await db.delete(proj)
    await db.flush()

    storage = PosixStorage.from_env()
    removed_assets = 0

    for asset in assets:
        remaining = int(remaining_counts.get(asset.id, 0))
        if body.delete_assets and remaining == 0:
            duplicates = 0
            if asset.sha256:
                duplicates = int(
                    (
                        await db.execute(
                            select(func.count())
                            .select_from(models.Asset)
                            .where(
                                models.Asset.sha256 == asset.sha256,
                                models.Asset.id != asset.id,
                            )
                        )
                    ).scalar_one()
                )
            if duplicates == 0:
                storage.remove_original(asset.storage_key)
                storage.remove_derivatives(asset.sha256)
            await db.delete(asset)
            removed_assets += 1
        else:
            asset.reference_count = max(remaining, 0)

    await db.commit()

    logger.info(
        "delete_project: id=%s success removed_assets=%s remaining_assets=%s",
        project_id,
        removed_assets,
        len(assets) - removed_assets,
    )
    return None
