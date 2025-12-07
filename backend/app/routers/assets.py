import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from uuid import UUID
from fastapi.responses import FileResponse
from ..db import get_db
from .. import models, schemas
from ..security import get_current_user
from ..storage import PosixStorage
from ..deps import get_settings
from ..schema_utils import ensure_preview_columns, ensure_asset_metadata_column
from ..services.pairing import sync_project_pairs
from ..services.annotations import write_annotations_for_assets
from ..services.metadata_states import ensure_state_for_link
from ..services.links import link_asset_to_project
from ..services import assets as assets_service
from ..utils.projects import ensure_project_access

router = APIRouter(prefix="/v1", tags=["assets"])
logger = logging.getLogger("arciva.assets")


@router.get("/projects/{project_id}/assets", response_model=list[schemas.AssetListItem])
async def list_assets(
    project_id: UUID,
    limit: int = 1000,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_project_access(db, project_id=project_id, user_id=current_user.id)
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    await sync_project_pairs(db, project_id)
    q = (
        select(
            models.Asset,
            models.ProjectAsset,
            models.ProjectAssetPair,
            models.MetadataState,
        )
        .join(
            models.ProjectAsset,
            models.ProjectAsset.asset_id == models.Asset.id,
        )
        .outerjoin(
            models.ProjectAssetPair,
            models.ProjectAssetPair.id == models.ProjectAsset.pair_id,
        )
        .outerjoin(
            models.MetadataState,
            models.MetadataState.link_id == models.ProjectAsset.id,
        )
        .where(
            models.ProjectAsset.project_id == project_id,
            models.ProjectAsset.user_id == current_user.id,
        )
        .order_by(desc(models.ProjectAsset.added_at))
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    storage = PosixStorage.from_env()
    return [
        assets_service.serialize_asset_item(
            asset, project_asset, pair, storage, metadata
        )
        for asset, project_asset, pair, metadata in rows
    ]


@router.get("/assets/{asset_id}", response_model=schemas.AssetDetail)
async def get_asset(
    asset_id: UUID,
    project_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_asset_metadata_column(db)
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
    link = None
    metadata = None
    if project_id:
        link = (
            await db.execute(
                select(models.ProjectAsset).where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.asset_id == asset.id,
                    models.ProjectAsset.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        if not link:
            raise HTTPException(404, "asset not linked to project")
        metadata = (
            await db.execute(
                select(models.MetadataState).where(
                    models.MetadataState.link_id == link.id
                )
            )
        ).scalar_one_or_none()
        if metadata is None:
            metadata = await ensure_state_for_link(db, link)
    storage = PosixStorage.from_env()
    await assets_service.ensure_asset_metadata_populated(asset, db, storage)
    return await assets_service.asset_detail(
        asset, db, storage, link=link, metadata=metadata
    )


@router.get(
    "/assets/{asset_id}/projects",
    response_model=list[schemas.AssetProjectUsage],
)
async def asset_project_usage(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    asset = await db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="asset not found")
    if asset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="asset not found")

    rows = (
        await db.execute(
            select(models.Project, models.ProjectAsset.updated_at)
            .join(
                models.ProjectAsset,
                models.ProjectAsset.project_id == models.Project.id,
            )
            .where(
                models.ProjectAsset.asset_id == asset_id,
                models.ProjectAsset.user_id == current_user.id,
                models.Project.user_id == current_user.id,
            )
            .order_by(models.ProjectAsset.updated_at.desc())
        )
    ).all()

    usages: list[schemas.AssetProjectUsage] = []
    for project, updated_at in rows:
        last_modified = updated_at or project.updated_at
        usages.append(
            schemas.AssetProjectUsage(
                project_id=project.id,
                name=project.title,
                cover_thumb=None,
                last_modified=(last_modified.isoformat() if last_modified else None),
            )
        )
    return usages


@router.post("/assets/{asset_id}/reprocess", response_model=schemas.AssetDetail)
async def reprocess_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_asset_metadata_column(db)
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

    now = datetime.now(timezone.utc)
    asset.status = models.AssetStatus.QUEUED
    asset.queued_at = now
    asset.processing_started_at = None
    asset.completed_at = None
    asset.last_error = None
    await db.commit()

    settings = get_settings()
    try:
        from arq.connections import (
            RedisSettings,
            ArqRedis,
        )  # local import for optional dependency

        redis_settings = RedisSettings.from_dsn(settings.redis_url)
        redis = None
        try:
            redis = await ArqRedis.create(redis_settings)  # type: ignore[attr-defined]
        except AttributeError:
            from arq.connections import create_pool  # type: ignore

            redis = await create_pool(redis_settings)
        await redis.enqueue_job("ingest_asset", str(asset.id))
    except Exception as exc:  # pragma: no cover
        asset.status = models.AssetStatus.ERROR
        asset.last_error = f"enqueue_failed: {exc!r}"
        await db.commit()
        raise HTTPException(503, "failed to enqueue ingest job")
    finally:
        if "redis" in locals():
            try:
                await redis.close(close_connection_pool=True)
            except TypeError:
                await redis.close()

    storage = PosixStorage.from_env()
    return await assets_service.asset_detail(asset, db, storage)


@router.get("/assets/{asset_id}/thumbs/256")
async def get_thumb(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return await get_derivative(asset_id, "thumb_256", db, current_user)


@router.get("/assets/{asset_id}/preview")
async def get_preview(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return await get_derivative(asset_id, "preview_raw", db, current_user)


@router.get("/assets/{asset_id}/derivatives/{variant}")
async def get_derivative(
    asset_id: UUID,
    variant: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_asset_metadata_column(db)
    asset = (
        await db.execute(
            select(models.Asset).where(
                models.Asset.id == asset_id,
                models.Asset.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not asset or not asset.sha256:
        raise HTTPException(404, "asset not ready")
    storage = PosixStorage.from_env()
    path = storage.find_derivative(asset.sha256, variant, "jpg")
    if not path:
        raise HTTPException(404, "derivative not found")
    return FileResponse(path=str(path), media_type="image/jpeg")


@router.post(
    "/projects/{project_id}/assets:link",
    response_model=schemas.ProjectAssetsLinkOut,
)
async def link_existing_assets(
    project_id: UUID,
    body: schemas.ProjectAssetsLinkIn,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_project_access(db, project_id=project_id, user_id=current_user.id)
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)

    # dedupe ids
    want_ids: list[UUID] = list(dict.fromkeys(body.asset_ids))
    if not want_ids:
        return schemas.ProjectAssetsLinkOut(linked=0, duplicates=0, items=[])

    logger.info(
        "link_existing_assets: project=%s requested=%s",
        project_id,
        want_ids,
    )

    # fetch existing assets
    assets = (
        (
            await db.execute(
                select(models.Asset).where(
                    models.Asset.id.in_(want_ids),
                    models.Asset.user_id == current_user.id,
                )
            )
        )
        .scalars()
        .all()
    )
    found_ids = {a.id for a in assets}
    missing = [aid for aid in want_ids if aid not in found_ids]
    if missing:
        logger.warning(
            "link_existing_assets: project=%s missing_assets=%s",
            project_id,
            missing,
        )
        raise HTTPException(404, f"assets not found: {missing}")

    # link, ignoring duplicates
    linked = 0
    duplicates = 0
    inherit_map = body.inheritance or {}

    for a in assets:
        inherit_source = inherit_map.get(a.id)
        template = None
        if inherit_source:
            await ensure_project_access(
                db, project_id=inherit_source, user_id=current_user.id
            )
            template = await assets_service.load_metadata_template(
                db,
                asset_id=a.id,
                project_id=inherit_source,
                user_id=current_user.id,
            )
            if not template:
                logger.warning(
                    "link_existing_assets: inheritance template missing "
                    "asset=%s source_project=%s",
                    a.id,
                    inherit_source,
                )
        link, created = await link_asset_to_project(
            db,
            project_id=project_id,
            asset=a,
            user_id=current_user.id,
            metadata_template=template,
            source_project_id=inherit_source,
        )
        if not created:
            duplicates += 1
            logger.info(
                "link_existing_assets: project=%s asset=%s already linked",
                project_id,
                a.id,
            )
            continue
        linked += 1
        logger.info(
            "link_existing_assets: project=%s linked asset=%s",
            project_id,
            a.id,
        )
    await db.commit()

    logger.info(
        "link_existing_assets: project=%s linked=%s duplicates=%s",
        project_id,
        linked,
        duplicates,
    )

    # update reference counts for linked assets
    if linked:
        for a in assets:
            count = (
                await db.execute(
                    select(func.count())
                    .select_from(models.ProjectAsset)
                    .where(
                        models.ProjectAsset.asset_id == a.id,
                        models.ProjectAsset.user_id == current_user.id,
                    )
                )
            ).scalar_one()
            a.reference_count = max(int(count), 1)
        await db.commit()

    await sync_project_pairs(db, project_id)
    ordered_items = await assets_service.load_asset_items(
        db, project_id, want_ids, user_id=current_user.id
    )
    logger.info(
        "link_existing_assets: project=%s response_items=%s",
        project_id,
        [item.id for item in ordered_items],
    )
    return schemas.ProjectAssetsLinkOut(
        linked=linked, duplicates=duplicates, items=ordered_items
    )


@router.post(
    "/projects/{project_id}/assets/interactions:apply",
    response_model=schemas.AssetInteractionUpdateOut,
)
async def apply_asset_interactions(
    project_id: UUID,
    body: schemas.AssetInteractionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not body.asset_ids:
        raise HTTPException(400, "asset_ids required")

    await ensure_project_access(db, project_id=project_id, user_id=current_user.id)
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    await sync_project_pairs(db, project_id)

    base_ids = list(dict.fromkeys(body.asset_ids))
    query = (
        select(
            models.Asset,
            models.ProjectAsset,
            models.ProjectAssetPair,
            models.MetadataState,
        )
        .join(
            models.ProjectAsset,
            models.ProjectAsset.asset_id == models.Asset.id,
        )
        .outerjoin(
            models.ProjectAssetPair,
            models.ProjectAssetPair.id == models.ProjectAsset.pair_id,
        )
        .outerjoin(
            models.MetadataState,
            models.MetadataState.link_id == models.ProjectAsset.id,
        )
        .where(
            models.ProjectAsset.project_id == project_id,
            models.ProjectAsset.asset_id.in_(base_ids),
            models.ProjectAsset.user_id == current_user.id,
        )
    )
    rows = (await db.execute(query)).all()
    found_ids = {asset.id for asset, _, _, _ in rows}
    missing = [str(aid) for aid in base_ids if aid not in found_ids]
    if missing:
        raise HTTPException(404, f"assets not linked to project: {missing}")

    assets_map: dict[
        UUID,
        tuple[
            models.Asset,
            models.ProjectAsset,
            models.ProjectAssetPair | None,
            models.MetadataState | None,
        ],
    ] = {
        asset.id: (asset, project_asset, pair, metadata)
        for asset, project_asset, pair, metadata in rows
    }
    for asset, _, pair, _ in rows:
        if pair:
            counterpart_id = (
                pair.raw_asset_id
                if asset.id == pair.jpeg_asset_id
                else pair.jpeg_asset_id
            )
            assets_map.setdefault(counterpart_id, tuple())

    missing_pairs = [aid for aid, data in assets_map.items() if not data]
    if missing_pairs:
        extra_rows = (
            await db.execute(
                select(
                    models.Asset,
                    models.ProjectAsset,
                    models.ProjectAssetPair,
                    models.MetadataState,
                )
                .join(
                    models.ProjectAsset,
                    models.ProjectAsset.asset_id == models.Asset.id,
                )
                .outerjoin(
                    models.ProjectAssetPair,
                    models.ProjectAssetPair.id == models.ProjectAsset.pair_id,
                )
                .outerjoin(
                    models.MetadataState,
                    models.MetadataState.link_id == models.ProjectAsset.id,
                )
                .where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.asset_id.in_(missing_pairs),
                    models.ProjectAsset.user_id == current_user.id,
                )
            )
        ).all()
        for asset, project_asset, pair, metadata in extra_rows:
            assets_map[asset.id] = (asset, project_asset, pair, metadata)

    rating_value = None if body.rating is None else max(0, min(body.rating, 5))
    color_value = None
    if body.color_label is not None:
        color_value = models.ColorLabel(
            body.color_label.value
            if isinstance(body.color_label, schemas.ColorLabel)
            else body.color_label
        )
    picked_value = body.picked
    rejected_value = body.rejected
    if rejected_value:
        picked_value = False
    elif picked_value:
        rejected_value = False

    if (
        rating_value is None
        and color_value is None
        and picked_value is None
        and rejected_value is None
    ):
        return schemas.AssetInteractionUpdateOut(items=[])

    touched_pairs: list[tuple[models.Asset, models.MetadataState]] = []
    for asset_id, data in assets_map.items():
        if not data:
            continue
        asset, link, _, metadata = data
        state = metadata or await ensure_state_for_link(db, link)
        if rating_value is not None:
            state.rating = rating_value
        if color_value is not None:
            state.color_label = color_value
        if picked_value is not None:
            state.picked = bool(picked_value)
        if rejected_value is not None:
            state.rejected = bool(rejected_value)
        touched_pairs.append((asset, state))

    await db.commit()
    try:
        await write_annotations_for_assets(touched_pairs)
    except Exception:  # pragma: no cover - best effort metadata write
        logger.exception(
            "apply_asset_interactions: metadata write failed project=%s " "assets=%s",
            project_id,
            [a.id for a, _ in touched_pairs],
        )

    ordered_ids: list[UUID] = []
    seen: set[UUID] = set()
    for aid in base_ids:
        if aid in assets_map and aid not in seen:
            ordered_ids.append(aid)
            seen.add(aid)
    for aid in assets_map.keys():
        if aid not in seen:
            ordered_ids.append(aid)
            seen.add(aid)

    items = await assets_service.load_asset_items(
        db, project_id, ordered_ids, user_id=current_user.id
    )
    return schemas.AssetInteractionUpdateOut(items=items)


@router.put(
    "/projects/{project_id}/assets/{asset_id}/preview",
    response_model=schemas.AssetListItem,
)
async def update_preview_flag(
    project_id: UUID,
    asset_id: UUID,
    body: schemas.ProjectAssetPreviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_project_access(db, project_id=project_id, user_id=current_user.id)
    await ensure_asset_metadata_column(db)
    await ensure_preview_columns(db)
    link = (
        await db.execute(
            select(models.ProjectAsset).where(
                models.ProjectAsset.project_id == project_id,
                models.ProjectAsset.asset_id == asset_id,
                models.ProjectAsset.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "asset not linked to project")

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

    preview_rows = (
        (
            await db.execute(
                select(models.ProjectAsset)
                .where(
                    models.ProjectAsset.project_id == project_id,
                    models.ProjectAsset.is_preview.is_(True),
                    models.ProjectAsset.user_id == current_user.id,
                )
                .order_by(
                    models.ProjectAsset.preview_order.asc().nulls_last(),
                    models.ProjectAsset.added_at.desc(),
                )
            )
        )
        .scalars()
        .all()
    )

    # normalise current ordering
    preview_ordered: list[models.ProjectAsset] = []
    for row in preview_rows:
        if row.asset_id == asset_id:
            continue
        preview_ordered.append(row)

    max_previews = 36

    if body.is_preview:
        if link not in preview_rows:
            if len(preview_ordered) >= max_previews:
                raise HTTPException(400, f"preview limit ({max_previews}) reached")
            preview_ordered.append(link)
        elif body.make_primary:
            preview_ordered.insert(0, link)
        else:
            # re-insert at original position
            index = next(
                (i for i, row in enumerate(preview_rows) if row.asset_id == asset_id),
                None,
            )
            if index is not None:
                preview_ordered.insert(min(index, len(preview_ordered)), link)
        if body.make_primary and link in preview_ordered:
            preview_ordered = [link] + [
                row for row in preview_ordered if row is not link
            ]
        link.is_preview = True
    else:
        link.is_preview = False
        link.preview_order = None

    # Deduplicate while preserving order
    seen_assets: set[UUID] = set()
    deduped: list[models.ProjectAsset] = []
    for row in preview_ordered:
        if row.asset_id in seen_assets:
            continue
        if row is link and not body.is_preview:
            continue
        seen_assets.add(row.asset_id)
        deduped.append(row)

    if body.is_preview and link not in deduped:
        if body.make_primary:
            deduped = [link] + deduped
        else:
            deduped.append(link)

    for index, row in enumerate(deduped):
        row.is_preview = True
        row.preview_order = index

    if not body.is_preview:
        link.is_preview = False
        link.preview_order = None

    await db.commit()

    pair = None
    if link.pair_id:
        pair = (
            await db.execute(
                select(models.ProjectAssetPair).where(
                    models.ProjectAssetPair.id == link.pair_id
                )
            )
        ).scalar_one_or_none()

    metadata = (
        await db.execute(
            select(models.MetadataState).where(models.MetadataState.link_id == link.id)
        )
    ).scalar_one_or_none()
    if metadata is None:
        metadata = await ensure_state_for_link(db, link)
    storage = PosixStorage.from_env()
    return assets_service.serialize_asset_item(asset, link, pair, storage, metadata)


@router.post("/assets/{asset_id}/quick-fix/preview")
async def quick_fix_preview(
    asset_id: UUID,
    body: schemas.QuickFixAdjustments,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # For preview, we want speed. Use the "preview_raw" or "thumb_256" if available.
    # Ideally "preview_raw" which is usually a decent sized JPEG.

    # FIXME: Deactivated for client-side transition (QuickFix Renderer)
    raise HTTPException(
        503, "QuickFix backend rendering is disabled. Use client-side rendering."
    )

    # await ensure_asset_metadata_column(db)
    # asset = (
    #     await db.execute(
    #         select(models.Asset).where(
    #             models.Asset.id == asset_id,
    #             models.Asset.user_id == current_user.id,
    #         )
    #     )
    # ).scalar_one_or_none()

    # if not asset or not asset.sha256:
    #     raise HTTPException(404, "asset not ready")

    # storage = PosixStorage.from_env()

    # # Try to find a source image to work on
    # # 1. Preview (best balance)
    # # 2. Original (if JPEG and small enough? No, might be huge RAW)
    # # 3. Thumbnail (too small?)

    # path = storage.find_derivative(asset.sha256, "preview_raw", "jpg")

    # def _is_jpeg(asset_obj: models.Asset) -> bool:
    #     fmt = (asset_obj.format or "").upper()
    #     mime = (asset_obj.mime or "").lower()
    #     return fmt in {"JPEG", "JPG"} or mime in {"image/jpeg", "image/jpg"}

    # if (path is None or not path.exists()) and asset.storage_uri and _is_jpeg(asset):
    #     try:
    #         original_path = storage.path_from_key(asset.storage_uri)
    #     except ValueError:
    #         original_path = None
    #     if original_path and original_path.exists():
    #         path = original_path

    # if path is None or not path.exists():
    #     fallback = storage.find_derivative(asset.sha256, "thumb_256", "jpg")
    #     if fallback and fallback.exists():
    #         path = fallback

    # if not path or not path.exists():
    #     raise HTTPException(404, "source image for preview not found")

    # try:
    #     with Image.open(path) as img:
    #         # Apply adjustments
    #         result_img = adjustments_service.apply_adjustments(img, body)

    #         # Save to buffer
    #         buf = BytesIO()
    #         result_img.save(buf, format="JPEG", quality=80)
    #         buf.seek(0)
    #         return Response(content=buf.getvalue(), media_type="image/jpeg")
    # except Exception as e:
    #     logger.exception("quick_fix_preview failed")
    #     raise HTTPException(500, f"preview generation failed: {e}")


@router.patch(
    "/projects/{project_id}/assets/{asset_id}/quick-fix",
    response_model=schemas.AssetDetail,
)
async def save_quick_fix(
    project_id: UUID,
    asset_id: UUID,
    body: schemas.QuickFixAdjustments,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await ensure_project_access(db, project_id=project_id, user_id=current_user.id)
    await ensure_asset_metadata_column(db)

    # Find the link
    link = (
        await db.execute(
            select(models.ProjectAsset).where(
                models.ProjectAsset.project_id == project_id,
                models.ProjectAsset.asset_id == asset_id,
                models.ProjectAsset.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if not link:
        raise HTTPException(404, "asset not linked to project")

    # Get or create metadata state
    metadata = (
        await db.execute(
            select(models.MetadataState).where(models.MetadataState.link_id == link.id)
        )
    ).scalar_one_or_none()

    if metadata is None:
        metadata = await ensure_state_for_link(db, link)

    try:
        current_edits = dict(metadata.edits or {})
        quick_fix_payload = body.model_dump(exclude_none=True)
        if quick_fix_payload:
            current_edits["quick_fix"] = quick_fix_payload
        else:
            current_edits.pop("quick_fix", None)

        metadata.edits = current_edits or None
        await db.commit()
        await db.refresh(metadata)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "save_quick_fix failed: project=%s asset=%s user=%s",
            project_id,
            asset_id,
            current_user.id,
        )
        await db.rollback()
        raise HTTPException(500, "failed to save quick fix adjustments")

    asset = await db.get(models.Asset, asset_id)
    if not asset or asset.user_id != current_user.id:
        raise HTTPException(404, "asset not found")
    storage = PosixStorage.from_env()
    return await assets_service.asset_detail(
        asset, db, storage, link=link, metadata=metadata
    )


@router.post(
    "/projects/{project_id}/assets/quick-fix:apply",
    response_model=schemas.AssetInteractionUpdateOut,
)
async def apply_quick_fix_batch(
    project_id: UUID,
    body: schemas.QuickFixBatchApply,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not body.asset_ids:
        raise HTTPException(400, "asset_ids required")

    await ensure_project_access(db, project_id=project_id, user_id=current_user.id)
    await ensure_asset_metadata_column(db)

    # Fetch assets and links
    base_ids = list(dict.fromkeys(body.asset_ids))
    query = (
        select(
            models.Asset,
            models.ProjectAsset,
            models.MetadataState,
        )
        .join(
            models.ProjectAsset,
            models.ProjectAsset.asset_id == models.Asset.id,
        )
        .outerjoin(
            models.MetadataState,
            models.MetadataState.link_id == models.ProjectAsset.id,
        )
        .where(
            models.ProjectAsset.project_id == project_id,
            models.ProjectAsset.asset_id.in_(base_ids),
            models.ProjectAsset.user_id == current_user.id,
        )
    )
    rows = (await db.execute(query)).all()

    # Map for easy access
    assets_map = {asset.id: (asset, link, metadata) for asset, link, metadata in rows}

    touched_pairs: list[tuple[models.Asset, models.MetadataState]] = []

    for asset_id in base_ids:
        if asset_id not in assets_map:
            continue

        asset, link, metadata = assets_map[asset_id]
        state = metadata or await ensure_state_for_link(db, link)

        current_edits = dict(state.edits or {})
        quick_fix = current_edits.get("quick_fix", {})

        # Apply auto adjustments
        # Note: In a real implementation, this would analyze the image.
        # For now, we apply safe defaults/heuristics.

        if body.auto_exposure:
            # Heuristic: Slight contrast boost and brightness
            exposure = quick_fix.get("exposure", {})
            exposure["exposure"] = 0.2
            exposure["contrast"] = 1.1
            quick_fix["exposure"] = exposure

        if body.auto_white_balance:
            # Heuristic: Warm it up slightly
            color = quick_fix.get("color", {})
            color["temperature"] = 0.1
            quick_fix["color"] = color

        if body.auto_crop:
            # Heuristic: Reset rotation, maybe set 1:1 if we were bold
            crop = quick_fix.get("crop", {})
            crop["rotation"] = 0.0
            quick_fix["crop"] = crop

        current_edits["quick_fix"] = quick_fix
        state.edits = current_edits
        touched_pairs.append((asset, state))

    await db.commit()

    # Return updated items
    items = await assets_service.load_asset_items(
        db, project_id, base_ids, user_id=current_user.id
    )
    return schemas.AssetInteractionUpdateOut(items=items)
