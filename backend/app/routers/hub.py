from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, or_
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


@router.get("/assets", response_model=schemas.ImageHubAssetsPage)
async def list_hub_assets(
    mode: str = Query("project"),  # 'project' or 'date'
    project_id: UUID | None = Query(None),
    year: int | None = Query(None),
    month: int | None = Query(None),
    day: int | None = Query(None),
    filters: str | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(100, ge=0, le=500),
    view: str = Query("grid"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.ImageHubAssetsPage:
    import json

    # Parse filters
    filter_data = {}
    if filters:
        try:
            filter_data = json.loads(filters)
        except json.JSONDecodeError:
            pass

    # Base query for assets joined with projects
    # We need to filter based on ProjectAsset linkage
    query = (
        select(
            models.Asset,
            models.ProjectAsset,
            models.Project,
            models.MetadataState,
        )
        .join(
            models.ProjectAsset,
            models.ProjectAsset.asset_id == models.Asset.id
        )
        .join(
            models.Project,
            models.Project.id == models.ProjectAsset.project_id
        )
        .outerjoin(
            models.MetadataState,
            models.MetadataState.link_id == models.ProjectAsset.id
        )
        .where(
            models.Asset.status == models.AssetStatus.READY,
            models.ProjectAsset.user_id == current_user.id,
        )
    )

    # Apply filters
    if project_id:
        query = query.where(models.ProjectAsset.project_id == project_id)

    # Date filtering
    # Use taken_at, falling back to created_at
    date_col = func.coalesce(models.Asset.taken_at, models.Asset.created_at)

    if year:
        query = query.where(func.extract('year', date_col) == year)
    if month:
        query = query.where(func.extract('month', date_col) == month)
    if day:
        query = query.where(func.extract('day', date_col) == day)

    # Additional filters from JSON
    if search_term := filter_data.get("search"):
        term = f"%{search_term}%"
        query = query.where(models.Asset.original_filename.ilike(term))

        query = query.where(models.Asset.original_filename.ilike(term))
        # Map 'JPEG'/'RAW' to file extensions or formats if needed
        # Assuming format column stores extension or similar
        # For now, let's assume strict mapping isn't fully defined in schema,
        # but if types means ['RAW'], we check for raw extension?
        # Re-using logic: format "RAW" vs others.
        pass  # To be refined if schema supports 'type' column directly

    if ratings := filter_data.get("ratings"):
        min_rating = ratings[0]
        query = query.where(
            func.coalesce(models.MetadataState.rating, 0) >= min_rating
        )

    if labels := filter_data.get("labels"):
        if "None" in labels:
            query = query.where(or_(
                models.MetadataState.color_label.in_(labels),
                models.MetadataState.color_label.is_(None)
            ))
        else:
            query = query.where(models.MetadataState.color_label.in_(labels))

    if date_from := filter_data.get("dateFrom"):
        query = query.where(date_col >= datetime.fromisoformat(date_from))
    if date_to := filter_data.get("dateTo"):
        query = query.where(date_col <= datetime.fromisoformat(date_to))

    # Pagination
    # For simplicity, using OFFSET based on integer cursor
    offset = 0
    if cursor and cursor.isdigit():
        offset = int(cursor)

    # Sorting
    if mode == 'date':
        query = query.order_by(date_col.desc())
    else:
        # Sort by link time for project view
        query = query.order_by(models.ProjectAsset.added_at.desc())

    # Execution
    # Only fetch total if needed?

    # Allow fetching one more to check for next page
    result = await db.execute(query.limit(limit + 1).offset(offset))
    rows = result.all()

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
        next_cursor = str(offset + limit)
    else:
        next_cursor = None

    # Process results
    # We need to group by Asset ID because one asset can be in multiple
    # projects requested?
    # If project_id is set, it's unique.
    # If not, an asset might appear multiple times.
    # The frontend expects a list of assets.
    # If mode is 'date', we want unique assets.

    seen_assets = set()
    output_assets = []

    storage = PosixStorage.from_env()

    # Need a separate query for pairs if we want to show pair info
    # For now, simplistic approach:

    for asset, link, project, metadata in rows:
        if asset.id in seen_assets:
            continue
        seen_assets.add(asset.id)

        # We need "Primary" project ref if we are in date mode,
        # or the specific one in project mode
        proj_ref = schemas.HubAssetProjectRef(
            project_id=project.id,
            title=project.title,
            linked_at=link.added_at,
            metadata_state=schemas.MetadataStateOut(
                id=metadata.id,
                link_id=link.id,
                rating=int(metadata.rating or 0) if metadata else 0,
                color_label=_color_label_to_schema(
                    metadata.color_label if metadata else None
                ),
                project_id=project.id,
                picked=bool(metadata.picked) if metadata else False,
                rejected=bool(metadata.rejected) if metadata else False,
                edits=metadata.edits if metadata else None,
                source_project_id=(
                    metadata.source_project_id if metadata else None
                ),
                created_at=metadata.created_at if metadata else None,
                updated_at=metadata.updated_at if metadata else None,
            ) if metadata else None
        )

        output_assets.append(
            schemas.HubAsset(
                asset_id=asset.id,
                original_filename=asset.original_filename,
                type=(
                    "RAW" if (asset.format or "").upper() == "RAW" else "JPEG"
                ),
                width=asset.width,
                height=asset.height,
                created_at=asset.created_at,
                thumb_url=_thumb_url(asset, storage),
                preview_url=_preview_url(asset, storage),
                is_paired=False,  # TODO: Resolve pairs
                pair_id=None,
                rating=(
                    proj_ref.metadata_state.rating
                    if proj_ref.metadata_state
                    else 0
                ),
                label=(
                    proj_ref.metadata_state.color_label
                    if proj_ref.metadata_state
                    else schemas.ColorLabel.NONE
                ),
                projects=[proj_ref]
            )
        )

    # Date Buckets (only if requesting a drilldown level)
    buckets = []
    if mode == 'date' and (
        not year or (year and not month) or (year and month and not day)
    ):
        # Determine strictness of drilldown
        # Level 1: Key = Year
        # Level 2: Key = Year-Month
        # Level 3: Key = Year-Month-Day

        # Base bucket query matches the main filtering query but validation
        # of group by
        bucket_query = (
            select(func.count())
            .select_from(models.Asset)
            .join(
                models.ProjectAsset,
                models.ProjectAsset.asset_id == models.Asset.id
            )
            .where(
                models.Asset.status == models.AssetStatus.READY,
                models.ProjectAsset.user_id == current_user.id
            )
        )

        # Re-apply filters to bucket query (code duplication here is minimal
        # trade-off for clarity)
        # Note: We should ideally refactor filter application if it grows.

        if search_term := filter_data.get("search"):
            bucket_query = bucket_query.where(
                models.Asset.original_filename.ilike(f"%{search_term}%")
            )

        # ... Other filters ...
        # For brevity/safety, let's assume filters apply same way.
        # Ideally we'd extract the "filter application" to a function
        # that takes a query and returns modified query.

        # Simplified for MVP: Buckets currently ignore some complex filters
        # in legacy code logic too, but let's try to be correct.

        b_date_col = func.coalesce(
            models.Asset.taken_at, models.Asset.created_at
        )

        if not year:
            # Group by Year
            b_year = func.extract('year', b_date_col).label('year')
            rows = await db.execute(
                bucket_query.add_columns(b_year)
                .group_by(b_year)
                .order_by(b_year.desc())
            )
            for count, y_val in rows:
                y_int = int(y_val)
                buckets.append(schemas.ImageHubDateBucket(
                    key=str(y_int),
                    year=y_int,
                    label=str(y_int),
                    asset_count=count
                ))

        elif year and not month:
            # Group by Month
            bucket_query = bucket_query.where(
                func.extract('year', b_date_col) == year
            )
            b_month = func.extract('month', b_date_col).label('month')
            rows = await db.execute(
                bucket_query.add_columns(b_month)
                .group_by(b_month)
                .order_by(b_month.desc())
            )

            import calendar
            for count, m_val in rows:
                m_int = int(m_val)
                buckets.append(schemas.ImageHubDateBucket(
                    key=f"{year}-{m_int:02d}",
                    year=year,
                    month=m_int,
                    label=f"{calendar.month_name[m_int]} {year}",
                    asset_count=count
                ))

        elif year and month and not day:
            # Group by Day
            bucket_query = bucket_query.where(
                func.extract('year', b_date_col) == year,
                func.extract('month', b_date_col) == month
            )
            b_day = func.extract('day', b_date_col).label('day')
            rows = await db.execute(
                bucket_query.add_columns(b_day)
                .group_by(b_day)
                .order_by(b_day.desc())
            )

            for count, d_val in rows:
                d_int = int(d_val)
                dt = datetime(year, month, d_int)
                buckets.append(schemas.ImageHubDateBucket(
                    key=f"{year}-{month:02d}-{d_int:02d}",
                    year=year,
                    month=month,
                    day=d_int,
                    label=dt.strftime("%b %d, %Y"),
                    asset_count=count
                ))

    return schemas.ImageHubAssetsPage(
        assets=output_assets,
        next_cursor=next_cursor,
        buckets=buckets
    )


@router.get("/asset-status", response_model=schemas.ImageHubAssetStatus)
async def get_asset_status(
    asset_id: UUID,
    current_project_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.ImageHubAssetStatus:
    # Check which projects contain this asset
    result = await db.execute(
        select(models.ProjectAsset.project_id)
        .join(models.Asset, models.Asset.id == models.ProjectAsset.asset_id)
        .where(
            models.Asset.id == asset_id,
            models.ProjectAsset.user_id == current_user.id
        )
    )
    project_ids = result.scalars().all()
    project_ids_str = [str(pid) for pid in project_ids]

    already_linked = (
        str(current_project_id) in project_ids_str
        if current_project_id
        else False
    )
    other = [pid for pid in project_ids_str if pid != str(current_project_id)]

    return schemas.ImageHubAssetStatus(
        already_linked=already_linked,
        other_projects=other
    )
