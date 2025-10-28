# backend/app/routers/projects.py
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import get_db

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
    )
    logger.info("create_project: success id=%s", p.id)
    return result


@router.get("", response_model=list[schemas.ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
):
    logger.info("list_projects: fetching projects")
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

    response = [
        schemas.ProjectOut(
            id=proj.id,
            title=proj.title,
            client=proj.client,
            note=proj.note,
            created_at=proj.created_at,
            updated_at=proj.updated_at,
            asset_count=asset_count,
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

    result = schemas.ProjectOut(
        id=proj.id,
        title=proj.title,
        client=proj.client,
        note=proj.note,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
        asset_count=count,
    )
    logger.info("get_project: id=%s asset_count=%s", proj.id, count)
    return result
