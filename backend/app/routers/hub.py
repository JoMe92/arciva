from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..db import get_db
from ..security import get_current_user
from ..storage import PosixStorage

logger = logging.getLogger("arciva.image_hub")

router = APIRouter(prefix="/v1/image-hub", tags=["image-hub"])


def _color_label_to_schema(
    value: models.ColorLabel | str | None,
) -> schemas.ColorLabel:
    if isinstance(value, models.ColorLabel):
        return schemas.ColorLabel(value.value)
    if isinstance(value, str):
        try:
            return schemas.ColorLabel(value)
        except ValueError:
            return schemas.ColorLabel.NONE
    return schemas.ColorLabel.NONE


def _thumb_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.find_derivative(asset.sha256, "thumb_256", "jpg")
    if path:
        return f"/v1/assets/{asset.id}/thumbs/256"
    return None


def _preview_url(asset: models.Asset, storage: PosixStorage) -> str | None:
    if not asset.sha256:
        return None
    path = storage.find_derivative(asset.sha256, "preview_raw", "jpg")
    if path:
        return f"/v1/assets/{asset.id}/preview"
    return None


@router.get("/assets", response_model=schemas.ImageHubAssetsResponse)
async def list_hub_assets(
    limit: int = Query(240, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.ImageHubAssetsResponse:
    asset_ids = (
        (
            await db.execute(
                select(models.Asset.id)
                .where(
                    models.Asset.status == models.AssetStatus.READY,
                    models.Asset.user_id == current_user.id,
                )
                .order_by(models.Asset.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )

    if not asset_ids:
        return schemas.ImageHubAssetsResponse(assets=[], projects=[], dates=[])

    rows = (
        await db.execute(
            select(
                models.Asset,
                models.ProjectAsset,
                models.Project,
                models.MetadataState,
            )
            .join(
                models.ProjectAsset,
                models.ProjectAsset.asset_id == models.Asset.id,
            )
            .join(
                models.Project,
                models.Project.id == models.ProjectAsset.project_id,
            )
            .outerjoin(
                models.MetadataState,
                models.MetadataState.link_id == models.ProjectAsset.id,
            )
            .where(
                models.Asset.id.in_(asset_ids),
                models.ProjectAsset.user_id == current_user.id,
                models.Project.user_id == current_user.id,
            )
        )
    ).all()

    project_ids = {project.id for _, _, project, _ in rows}
    pair_map: dict[UUID, UUID] = {}
    if project_ids:
        pair_rows = (
            (
                await db.execute(
                    select(models.ProjectAssetPair).where(
                        models.ProjectAssetPair.project_id.in_(project_ids)
                    )
                )
            )
            .scalars()
            .all()
        )
        for pair in pair_rows:
            pair_map[pair.jpeg_asset_id] = pair.raw_asset_id
            pair_map[pair.raw_asset_id] = pair.jpeg_asset_id

    storage = PosixStorage.from_env()
    assets_map: dict[UUID, dict] = {}
    project_summary: dict[UUID, dict] = {}
    date_summary: dict[str, int] = {}

    for asset, link, project, metadata in rows:
        info = assets_map.setdefault(asset.id, {"asset": asset, "projects": []})
        info["projects"].append((project, link, metadata))

        summary = project_summary.setdefault(
            project.id, {"project": project, "count": 0, "last_linked": None}
        )
        summary["count"] += 1
        if summary["last_linked"] is None or (
            link.added_at and link.added_at > summary["last_linked"]
        ):
            summary["last_linked"] = link.added_at

        date_ref = (
            asset.taken_at or asset.created_at or link.added_at or datetime.utcnow()
        )
        date_key = date_ref.date().isoformat()
        date_summary[date_key] = date_summary.get(date_key, 0) + 1

    if not assets_map:
        return schemas.ImageHubAssetsResponse(assets=[], projects=[], dates=[])

    ordered_assets: list[schemas.HubAsset] = []
    order_map = {aid: idx for idx, aid in enumerate(asset_ids)}
    for asset_id, payload in sorted(
        assets_map.items(),
        key=lambda item: order_map.get(item[0], len(order_map)),
    ):
        asset: models.Asset = payload["asset"]
        proj_entries = []
        for project, link, metadata in payload["projects"]:
            metadata_out = None
            if metadata:
                metadata_out = schemas.MetadataStateOut(
                    id=metadata.id,
                    link_id=link.id,
                    project_id=project.id,
                    rating=int(metadata.rating or 0),
                    color_label=_color_label_to_schema(metadata.color_label),
                    picked=bool(metadata.picked),
                    rejected=bool(metadata.rejected),
                    edits=metadata.edits,
                    source_project_id=metadata.source_project_id,
                    created_at=metadata.created_at,
                    updated_at=metadata.updated_at,
                )
            proj_entries.append(
                schemas.HubAssetProjectRef(
                    project_id=project.id,
                    title=project.title,
                    linked_at=link.added_at,
                    metadata_state=metadata_out,
                )
            )

        ordered_assets.append(
            schemas.HubAsset(
                asset_id=asset.id,
                format=asset.format,
                mime=asset.mime,
                width=asset.width,
                height=asset.height,
                original_filename=asset.original_filename,
                taken_at=asset.taken_at,
                created_at=asset.created_at,
                thumb_url=_thumb_url(asset, storage),
                preview_url=_preview_url(asset, storage),
                projects=proj_entries,
                pair_asset_id=pair_map.get(asset.id),
            )
        )

    project_list = [
        schemas.HubProjectSummary(
            project_id=proj_id,
            title=data["project"].title,
            asset_count=data["count"],
            last_linked_at=data["last_linked"],
        )
        for proj_id, data in project_summary.items()
    ]
    project_list.sort(key=lambda item: item.asset_count, reverse=True)

    date_list = [
        schemas.HubDateSummary(date=key, asset_count=count)
        for key, count in sorted(date_summary.items(), reverse=True)
    ]

    return schemas.ImageHubAssetsResponse(
        assets=ordered_assets,
        projects=project_list,
        dates=date_list,
    )
