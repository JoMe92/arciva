from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..constants import JPEG_EXTENSIONS, RAW_EXTENSIONS

logger = logging.getLogger("arciva.pairing")


def _normalize_basename(filename: str | None) -> str | None:
    if not filename:
        return None
    stem = Path(filename).stem
    return stem.strip() or None


def _extension_kind(filename: str | None) -> str | None:
    if not filename:
        return None
    ext = Path(filename).suffix.lower()
    if ext in JPEG_EXTENSIONS:
        return "jpeg"
    if ext in RAW_EXTENSIONS:
        return "raw"
    return None


async def sync_project_pairs(db: AsyncSession, project_id: UUID) -> None:
    rows = (
        await db.execute(
            select(models.ProjectAsset, models.Asset)
            .join(
                models.Asset, models.Asset.id == models.ProjectAsset.asset_id
            )
            .where(models.ProjectAsset.project_id == project_id)
        )
    ).all()

    buckets: Dict[
        str, Dict[str, List[Tuple[models.ProjectAsset, models.Asset]]]
    ] = {}
    display_names: Dict[str, str] = {}

    for link, asset in rows:
        kind = _extension_kind(asset.original_filename)
        if not kind:
            continue
        base = _normalize_basename(asset.original_filename)
        if not base:
            continue
        key = base.lower()
        bucket = buckets.setdefault(key, {"jpeg": [], "raw": []})
        bucket[kind].append((link, asset))
        display_names.setdefault(key, base)

    targets: Dict[
        str,
        Tuple[
            Tuple[models.ProjectAsset, models.Asset],
            Tuple[models.ProjectAsset, models.Asset],
        ],
    ] = {}
    for key, bucket in buckets.items():
        jpeg_items = bucket["jpeg"]
        raw_items = bucket["raw"]
        if len(jpeg_items) == 1 and len(raw_items) == 1:
            targets[key] = (jpeg_items[0], raw_items[0])
        elif len(jpeg_items) > 1 or len(raw_items) > 1:
            logger.warning(
                "pairing: skipped basename=%s project=%s jpeg_count=%s "
                "raw_count=%s",
                display_names.get(key, key),
                project_id,
                len(jpeg_items),
                len(raw_items),
            )

    if not targets:
        # Clear stale pair references if necessary.
        existing_pairs = (
            (
                await db.execute(
                    select(models.ProjectAssetPair).where(
                        models.ProjectAssetPair.project_id == project_id
                    )
                )
            )
            .scalars()
            .all()
        )
        if not existing_pairs:
            return
        for pair in existing_pairs:
            for link, _ in rows:
                if link.pair_id == pair.id:
                    link.pair_id = None
        for pair in existing_pairs:
            await db.delete(pair)
        await db.commit()
        return

    existing_pairs = (
        (
            await db.execute(
                select(models.ProjectAssetPair).where(
                    models.ProjectAssetPair.project_id == project_id
                )
            )
        )
        .scalars()
        .all()
    )
    existing_by_key = {pair.basename.lower(): pair for pair in existing_pairs}
    existing_by_asset: Dict[UUID, models.ProjectAssetPair] = {}
    for pair in existing_pairs:
        existing_by_asset[pair.jpeg_asset_id] = pair
        existing_by_asset[pair.raw_asset_id] = pair

    asset_pair_map: Dict[UUID, UUID] = {}
    seen_pair_ids: set[UUID] = set()
    changed = False

    for key, (
        (jpeg_link, jpeg_asset),
        (raw_link, raw_asset),
    ) in targets.items():
        pair = (
            existing_by_key.get(key)
            or existing_by_asset.get(jpeg_asset.id)
            or existing_by_asset.get(raw_asset.id)
        )
        if pair and key not in existing_by_key:
            existing_by_key[key] = pair
        basename = display_names.get(
            key,
            jpeg_asset.original_filename or raw_asset.original_filename or key,
        )
        if pair is None:
            pair = models.ProjectAssetPair(
                project_id=project_id,
                basename=basename,
                jpeg_asset_id=jpeg_asset.id,
                raw_asset_id=raw_asset.id,
            )
            db.add(pair)
            await db.flush()
            existing_by_key[key] = pair
            existing_by_asset[jpeg_asset.id] = pair
            existing_by_asset[raw_asset.id] = pair
            changed = True
        else:
            if pair.jpeg_asset_id != jpeg_asset.id:
                old_jpeg = pair.jpeg_asset_id
                pair.jpeg_asset_id = jpeg_asset.id
                if old_jpeg in existing_by_asset:
                    existing_by_asset.pop(old_jpeg, None)
                existing_by_asset[jpeg_asset.id] = pair
                changed = True
            if pair.raw_asset_id != raw_asset.id:
                old_raw = pair.raw_asset_id
                pair.raw_asset_id = raw_asset.id
                if old_raw in existing_by_asset:
                    existing_by_asset.pop(old_raw, None)
                existing_by_asset[raw_asset.id] = pair
                changed = True
            if pair.basename != basename:
                old_key = pair.basename.lower()
                pair.basename = basename
                existing_by_key.pop(old_key, None)
                existing_by_key[key] = pair
                changed = True
        asset_pair_map[jpeg_asset.id] = pair.id
        asset_pair_map[raw_asset.id] = pair.id
        seen_pair_ids.add(pair.id)

        if jpeg_link.pair_id != pair.id:
            jpeg_link.pair_id = pair.id
            changed = True
        if raw_link.pair_id != pair.id:
            raw_link.pair_id = pair.id
            changed = True

    for link, _ in rows:
        if link.asset_id not in asset_pair_map and link.pair_id is not None:
            link.pair_id = None
            changed = True

    for pair in existing_pairs:
        if pair.id not in seen_pair_ids:
            await db.delete(pair)
            changed = True

    if changed:
        await db.commit()
