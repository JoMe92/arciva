# backend/app/routers/projects.py
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import get_db
from ..security import get_current_user
from ..storage import PosixStorage
from ..schema_utils import ensure_preview_columns

MAX_PREVIEW_IMAGES = 36


def _thumb_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.find_derivative(asset.sha256, "thumb_256", "jpg")
    if path:
        return f"/v1/assets/{asset.id}/thumbs/256"
    return None


async def _load_preview_map(
    db: AsyncSession,
    project_ids: list[UUID],
    *,
    user_id: UUID,
) -> dict[UUID, list[schemas.ProjectPreviewImage]]:
    if not project_ids:
        return {}

    rows = (
        await db.execute(
            select(models.ProjectAsset, models.Asset)
            .join(
                models.Asset, models.Asset.id == models.ProjectAsset.asset_id
            )
            .where(
                models.ProjectAsset.project_id.in_(project_ids),
                models.ProjectAsset.user_id == user_id,
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
    preview_map: dict[
        UUID, list[tuple[int, UUID, str | None, int | None, int | None]]
    ] = {pid: [] for pid in project_ids}
    seen_assets: dict[UUID, set[UUID]] = {pid: set() for pid in project_ids}
    for project_asset, asset in rows:
        order = (
            project_asset.preview_order
            if project_asset.preview_order is not None
            else 10_000
        )
        project_id = project_asset.project_id
        preview_map.setdefault(project_id, []).append(
            (
                order,
                asset.id,
                _thumb_url(asset, storage),
                asset.width,
                asset.height,
            )
        )
        seen_assets.setdefault(project_id, set()).add(asset.id)

    max_order_by_project: dict[UUID, int] = {
        pid: max((entry[0] for entry in entries), default=-1)
        for pid, entries in preview_map.items()
    }
    slots_remaining: dict[UUID, int] = {
        pid: MAX_PREVIEW_IMAGES - len(preview_map.get(pid, []))
        for pid in project_ids
    }
    fallback_targets = [
        pid for pid in project_ids if slots_remaining.get(pid, 0) > 0
    ]

    if fallback_targets:
        fallback_rows = (
            await db.execute(
                select(models.ProjectAsset, models.Asset, models.MetadataState)
                .join(
                    models.Asset,
                    models.Asset.id == models.ProjectAsset.asset_id,
                )
                .join(
                    models.MetadataState,
                    models.MetadataState.link_id == models.ProjectAsset.id,
                )
                .where(
                    models.ProjectAsset.project_id.in_(fallback_targets),
                    models.ProjectAsset.user_id == user_id,
                    models.MetadataState.picked.is_(True),
                )
                .order_by(
                    models.ProjectAsset.project_id,
                    models.MetadataState.updated_at.desc(),
                    models.MetadataState.created_at.desc(),
                    models.ProjectAsset.added_at.desc(),
                )
            )
        ).all()
        for link, asset, _state in fallback_rows:
            project_id = link.project_id
            if project_id not in slots_remaining:
                continue
            if slots_remaining[project_id] <= 0:
                continue
            project_seen = seen_assets.setdefault(project_id, set())
            if asset.id in project_seen:
                continue
            next_order = max_order_by_project.get(project_id, -1) + 1
            max_order_by_project[project_id] = next_order
            preview_map.setdefault(project_id, []).append(
                (
                    next_order,
                    asset.id,
                    _thumb_url(asset, storage),
                    asset.width,
                    asset.height,
                )
            )
            project_seen.add(asset.id)
            slots_remaining[project_id] -= 1

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
            for index, (_, asset_id, thumb_url, width, height) in enumerate(
                entries
            )
        ]

    return normalized_map


logger = logging.getLogger("arciva.projects")

router = APIRouter(prefix="/v1/projects", tags=["projects"])


@router.post("", response_model=schemas.ProjectOut, status_code=201)
async def create_project(
    body: schemas.ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logger.info("create_project: title=%r client=%r", body.title, body.client)
    # insert
    p = models.Project(
        user_id=current_user.id,
        title=body.title,
        client=body.client,
        note=body.note,
        stack_pairs_enabled=body.stack_pairs_enabled,
    )
    db.add(p)
    await db.flush()

    # load server defaults (created_at/updated_at)
    await db.refresh(p)

    # commit (session uses expire_on_commit=False so `p` remains populated)
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
        stack_pairs_enabled=p.stack_pairs_enabled,
    )
    logger.info("create_project: success id=%s", p.id)
    return result


@router.get("", response_model=list[schemas.ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logger.info("list_projects: fetching projects")
    await ensure_preview_columns(db)
    rows = (
        await db.execute(
            select(
                models.Project,
                func.count(models.ProjectAsset.project_id).label(
                    "asset_count"
                ),
            )
            .outerjoin(
                models.ProjectAsset,
                and_(
                    models.ProjectAsset.project_id == models.Project.id,
                    models.ProjectAsset.user_id == current_user.id,
                ),
            )
            .where(models.Project.user_id == current_user.id)
            .group_by(models.Project.id)
            .order_by(models.Project.created_at.desc())
        )
    ).all()

    project_ids = [proj.id for proj, _ in rows]
    preview_map = await _load_preview_map(
        db, project_ids, user_id=current_user.id
    )

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
            stack_pairs_enabled=proj.stack_pairs_enabled,
        )
        for proj, asset_count in rows
    ]
    logger.info("list_projects: returned %d projects", len(response))
    return response


@router.get("/{project_id}", response_model=schemas.ProjectOut)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logger.info("get_project: id=%s", project_id)
    await ensure_preview_columns(db)
    proj = (
        await db.execute(
            select(models.Project).where(
                models.Project.id == project_id,
                models.Project.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not proj:
        logger.warning("get_project: id=%s not found", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    count = (
        await db.execute(
            select(func.count())
            .select_from(models.ProjectAsset)
            .where(
                models.ProjectAsset.project_id == proj.id,
                models.ProjectAsset.user_id == current_user.id,
            )
        )
    ).scalar_one()

    preview_map = await _load_preview_map(
        db, [proj.id], user_id=current_user.id
    )

    result = schemas.ProjectOut(
        id=proj.id,
        title=proj.title,
        client=proj.client,
        note=proj.note,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
        asset_count=count,
        preview_images=preview_map.get(proj.id, []),
        stack_pairs_enabled=proj.stack_pairs_enabled,
    )
    logger.info("get_project: id=%s asset_count=%s", proj.id, count)
    return result


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
async def update_project(
    project_id: UUID,
    body: schemas.ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logger.info("update_project: id=%s", project_id)
    await ensure_preview_columns(db)
    proj = (
        await db.execute(
            select(models.Project).where(
                models.Project.id == project_id,
                models.Project.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not proj:
        logger.warning("update_project: id=%s not found", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    updated = False
    if body.title is not None:
        proj.title = body.title.strip() or proj.title
        updated = True
    if body.client is not None:
        proj.client = body.client.strip() or None
        updated = True
    if body.note is not None:
        proj.note = body.note.strip() or None
        updated = True
    if body.stack_pairs_enabled is not None:
        proj.stack_pairs_enabled = body.stack_pairs_enabled
        updated = True

    if updated:
        await db.flush()
        await db.commit()
        await db.refresh(proj)
    else:
        await db.flush()

    count = (
        await db.execute(
            select(func.count())
            .select_from(models.ProjectAsset)
            .where(
                models.ProjectAsset.project_id == proj.id,
                models.ProjectAsset.user_id == current_user.id,
            )
        )
    ).scalar_one()

    preview_map = await _load_preview_map(
        db, [proj.id], user_id=current_user.id
    )

    result = schemas.ProjectOut(
        id=proj.id,
        title=proj.title,
        client=proj.client,
        note=proj.note,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
        asset_count=count,
        preview_images=preview_map.get(proj.id, []),
        stack_pairs_enabled=proj.stack_pairs_enabled,
    )
    logger.info("update_project: id=%s success", project_id)
    return result


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    body: schemas.ProjectDelete,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logger.info(
        "delete_project: id=%s delete_assets=%s",
        project_id,
        body.delete_assets,
    )
    proj = (
        await db.execute(
            select(models.Project).where(
                models.Project.id == project_id,
                models.Project.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not proj:
        logger.warning("delete_project: id=%s not found", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    confirmed = body.confirm_title.strip()
    if confirmed != proj.title.strip():
        logger.warning(
            "delete_project: id=%s confirmation mismatch provided=%r "
            "expected=%r",
            project_id,
            confirmed,
            proj.title,
        )
        raise HTTPException(
            status_code=400, detail="Project title confirmation mismatch"
        )

    asset_ids = (
        (
            await db.execute(
                select(models.ProjectAsset.asset_id).where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.user_id == current_user.id,
                )
            )
        )
        .scalars()
        .all()
    )

    assets: list[models.Asset] = []
    if asset_ids:
        assets = (
            (
                await db.execute(
                    select(models.Asset).where(
                        models.Asset.id.in_(asset_ids),
                        models.Asset.user_id == current_user.id,
                    )
                )
            )
            .scalars()
            .all()
        )

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
                    models.ProjectAsset.user_id == current_user.id,
                )
                .group_by(models.ProjectAsset.asset_id)
            )
        ).all()
        remaining_counts = {
            asset_id: int(count) for asset_id, count in other_rows
        }

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
                                models.Asset.user_id == current_user.id,
                            )
                        )
                    ).scalar_one()
                )
            if duplicates == 0:
                storage.remove_original(asset.storage_uri)
                storage.remove_derivatives(asset.sha256)
            await db.delete(asset)
            removed_assets += 1
        else:
            asset.reference_count = max(remaining, 0)

    await db.commit()

    logger.info(
        "delete_project: id=%s success removed_assets=%s "
        "remaining_assets=%s",
        project_id,
        removed_assets,
        len(assets) - removed_assets,
    )
    return None
