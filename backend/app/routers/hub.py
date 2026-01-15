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

    # Helper to apply standard filters to any Asset-based query
    def apply_filters(base_query, for_buckets=False):
        q = base_query

        # Project filter (always applied if present)
        if project_id:
            # If filtering by project, we must join/filter ProjectAsset
            # Note: base_query might already be joined
            # For bucket query, ensuring we check project linkage
            q = q.where(models.ProjectAsset.project_id == project_id)

        # Date filtering
        date_col = func.coalesce(models.Asset.taken_at, models.Asset.created_at)
        if year:
            q = q.where(func.extract("year", date_col) == year)
        if month:
            q = q.where(func.extract("month", date_col) == month)
        if day:
            q = q.where(func.extract("day", date_col) == day)

        # Additional filters
        if search_term := filter_data.get("search"):
            term = f"%{search_term}%"
            q = q.where(models.Asset.original_filename.ilike(term))

        # Types filter (placeholder logic)
        if filter_data.get("types"):
            # logic for types would go here based on asset.format/extension
            pass

        # Ratings filter
        if ratings := filter_data.get("ratings"):
            min_rating = ratings[0]
            # Requires join with MetadataState.
            # If for buckets, we need to ensure MetadataState is part of query or join it.
        # Assuming base query has the joins setup correctly.
            q = q.where(
                func.coalesce(models.MetadataState.rating, 0) >= min_rating
            )

        # Labels filter
        if labels := filter_data.get("labels"):
            if "None" in labels:
                q = q.where(
                    or_(
                        models.MetadataState.color_label.in_(labels),
                        models.MetadataState.color_label.is_(None),
                    )
                )
            else:
                q = q.where(models.MetadataState.color_label.in_(labels))

        # Date range filter
        if date_from := filter_data.get("dateFrom"):
            q = q.where(date_col >= datetime.fromisoformat(date_from))
        if date_to := filter_data.get("dateTo"):
            q = q.where(date_col <= datetime.fromisoformat(date_to))

        return q

    # Common Joins
    # We join Asset -> ProjectAsset -> Project -> Metadata
    # This structure is needed for most filters.
    # Note: For strict 'Asset' listing (date mode), duplication due to ProjectAsset
    # is the issue.

    # --- Step 1: Paginate on Distinct IDs ---

    # We want a list of Asset.id that match the criteria.
    # Because one asset can have multiple ProjectAssets (and thus multiple rows),
    # we group by Asset.id (or select distinct).

    base_asset_query = (
        select(models.Asset.id)
        .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
        .outerjoin(
            models.MetadataState,
            models.MetadataState.link_id == models.ProjectAsset.id
        )
        .where(
            models.Asset.status == models.AssetStatus.READY,
            models.ProjectAsset.user_id == current_user.id,
        )
    )

    # Apply filters to ID Selection
    id_query = apply_filters(base_asset_query)

    # Sorting/Pagination on IDs
    # Sorting is tricky with distinct.
    # If mode='date', sort by taken_at.
    # If mode='project', sorting by 'added_at' is ambiguous if multiple links exist.
    # We will grab the MAX/MIN added_at or just distinct IDs?

    date_col = func.coalesce(models.Asset.taken_at, models.Asset.created_at)

    if mode == "date":
        # Sort by date. Use group_by to ensure unique asset IDs
        id_query = id_query.group_by(models.Asset.id).order_by(
            func.max(date_col).desc()
        )
    else:
        # Project mode: Sort by recently added.
        # Because we join ProjectAsset, we use max(ProjectAsset.added_at) per asset
        id_query = id_query.group_by(models.Asset.id).order_by(
            func.max(models.ProjectAsset.added_at).desc()
        )

    # Apply Pagination
    offset = 0
    if cursor and cursor.isdigit():
        offset = int(cursor)

    paged_id_query = id_query.limit(limit + 1).offset(offset)

    id_result = await db.execute(paged_id_query)
    target_ids = id_result.scalars().all()

    has_more = len(target_ids) > limit
    if has_more:
        target_ids = target_ids[:limit]
        next_cursor = str(offset + limit)
    else:
        next_cursor = None

    # --- Step 2: Fetch Details for Selected IDs ---
    output_assets = []

    if target_ids:
        # Fetch full data for these IDs.
        # We need the Asset data + Project/Metadata info.
        # This will return multiple rows per asset if it is in multiple projects.
        # But we only requested specific Assets, so the set is bounded.

        detail_query = (
            select(
                models.Asset,
                models.ProjectAsset,
                models.Project,
                models.MetadataState,
            )
            .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
            .join(models.Project, models.Project.id == models.ProjectAsset.project_id)
            .outerjoin(
                models.MetadataState,
                models.MetadataState.link_id == models.ProjectAsset.id,
            )
            .where(models.Asset.id.in_(target_ids))
        )

        # We might want to re-apply project_id filter here just to narrow the *links* shown?
        # If I am in "All Projects" mode, I want to see all links for the asset.
        # If I am in "Project A" mode, I only want to see the link to Project A?
        # The Step 1 query filtered IDs. Step 2 fetches details.

        # If project_id is set, Step 1 only picked assets in Project A.
        # But Step 2 without filter would show links to Project B too?
        # Usually, if I filter by Project A, I expect to see the asset in context of Project A.
        # Let's optionally filter details if strict context is needed.
        # For Hub, seeing all contexts is nice, but 'project_id' usually implies specific view.
        # Let's apply project_id to detail query if present.

        if project_id:
            detail_query = detail_query.where(
                models.ProjectAsset.project_id == project_id
            )

        # Ensure consistent order in output list (matching the ID order)?
        # SQL IN(...) does not guarantee order. We should sort result in python or query.

        details_result = await db.execute(detail_query)
        details_rows = details_result.all()

        # Group rows by Asset
        assets_map = {}  # ID -> { asset_obj, links: [] }

        storage = PosixStorage.from_env()

        for asset, link, project, metadata in details_rows:
            if asset.id not in assets_map:
                assets_map[asset.id] = {"asset": asset, "links": []}

            # Construct ProjectRef
            proj_ref = schemas.HubAssetProjectRef(
                project_id=project.id,
                title=project.title,
                linked_at=link.added_at,
                metadata_state=(
                    schemas.MetadataStateOut(
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
                    )
                    if metadata
                    else None
                ),
            )
            assets_map[asset.id]["links"].append(proj_ref)

        # Build Output List matching target_ids order
        for aid in target_ids:
            if aid not in assets_map:
                continue  # Should not happen if data consistency holds

            data = assets_map[aid]
            asset = data["asset"]
            links = data["links"]

            # Pick a "primary" link for top-level rating/label?
            # Logic: If filtering by project, use that link. Else, use most recent?
            # For now, just use the first one found (or max rated?)
            # Let's use the first one as 'primary' for display

            primary_ref = links[0] if links else None

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
                    is_paired=False,
                    pair_id=None,
                    rating=(
                        primary_ref.metadata_state.rating
                        if primary_ref and primary_ref.metadata_state
                        else 0
                    ),
                    label=(
                        primary_ref.metadata_state.color_label
                        if primary_ref and primary_ref.metadata_state
                        else schemas.ColorLabel.NONE
                    ),
                    projects=links,
                )
            )

    # --- Step 3: Date Buckets ---
    buckets = []
    if mode == "date" and (
        not year or (year and not month) or (year and month and not day)
    ):

        # Base bucket query matches the main filtering query using same logic
        # Count distinct assets!

        # Using a subquery approach for distinct IDs might be safest for counting
        # if filters involve joins.
        # But for 'count(*)', we usually want count of ASSETS.

        # Start with base join structure again
        bucket_base = (
            select(
                models.Asset.id
            )  # We will group by date vals + count(distinct asset.id)
            .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
            .outerjoin(
                models.MetadataState,
                models.MetadataState.link_id == models.ProjectAsset.id,
            )
            .where(
                models.Asset.status == models.AssetStatus.READY,
                models.ProjectAsset.user_id == current_user.id,
            )
        )

        # Apply filters (Consolidated logic!)
        bucket_base = apply_filters(bucket_base, for_buckets=True)

        # Now we need to aggregate this.
        # We can turn bucket_base into a subquery or CTE, then group by date.

        # However, we need to extract date from the asset in the row.
        b_date_col = func.coalesce(models.Asset.taken_at, models.Asset.created_at)

        # SQLAlchemy Group By on Joined query with Distinct Count

        # Construct the aggregation query directly on the joined set
        agg_val = func.count(models.Asset.id.distinct())

        # We reuse the same query structure but select different columns
        bucket_query = (
            select(agg_val)
            .join(models.ProjectAsset, models.ProjectAsset.asset_id == models.Asset.id)
            .outerjoin(
                models.MetadataState,
                models.MetadataState.link_id == models.ProjectAsset.id,
            )
            .where(
                models.Asset.status == models.AssetStatus.READY,
                models.ProjectAsset.user_id == current_user.id,
            )
        )

        bucket_query = apply_filters(bucket_query, for_buckets=True)

        if not year:
            # Group by Year
            b_year = func.extract("year", b_date_col).label("year")
            rows = await db.execute(
                bucket_query.add_columns(b_year)
                .group_by(b_year)
                .order_by(b_year.desc())
            )
            for count, y_val in rows:
                y_int = int(y_val)
                buckets.append(
                    schemas.ImageHubDateBucket(
                        key=str(y_int), year=y_int, label=str(y_int), asset_count=count
                    )
                )

        elif year and not month:
            # Group by Month
            bucket_query = bucket_query.where(func.extract("year", b_date_col) == year)
            b_month = func.extract("month", b_date_col).label("month")
            rows = await db.execute(
                bucket_query.add_columns(b_month)
                .group_by(b_month)
                .order_by(b_month.desc())
            )
            import calendar

            for count, m_val in rows:
                m_int = int(m_val)
                buckets.append(
                    schemas.ImageHubDateBucket(
                        key=f"{year}-{m_int:02d}",
                        year=year,
                        month=m_int,
                        label=f"{calendar.month_name[m_int]} {year}",
                        asset_count=count,
                    )
                )

        elif year and month and not day:
            # Group by Day
            bucket_query = bucket_query.where(
                func.extract("year", b_date_col) == year,
                func.extract("month", b_date_col) == month,
            )
            b_day = func.extract("day", b_date_col).label("day")
            rows = await db.execute(
                bucket_query.add_columns(b_day).group_by(b_day).order_by(b_day.desc())
            )
            for count, d_val in rows:
                d_int = int(d_val)
                dt = datetime(year, month, d_int)
                buckets.append(
                    schemas.ImageHubDateBucket(
                        key=f"{year}-{month:02d}-{d_int:02d}",
                        year=year,
                        month=month,
                        day=d_int,
                        label=dt.strftime("%b %d, %Y"),
                        asset_count=count,
                    )
                )

    return schemas.ImageHubAssetsPage(
        assets=output_assets, next_cursor=next_cursor, buckets=buckets
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
            models.Asset.id == asset_id, models.ProjectAsset.user_id == current_user.id
        )
    )
    project_ids = result.scalars().all()
    project_ids_str = [str(pid) for pid in project_ids]

    already_linked = (
        str(current_project_id) in project_ids_str if current_project_id else False
    )
    other = [pid for pid in project_ids_str if pid != str(current_project_id)]

    return schemas.ImageHubAssetStatus(
        already_linked=already_linked, other_projects=other
    )
