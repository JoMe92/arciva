from __future__ import annotations

import uuid
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models


def _coerce_color_label(value: models.ColorLabel | str | None) -> models.ColorLabel:
    if isinstance(value, models.ColorLabel):
        return value
    if isinstance(value, str):
        try:
            return models.ColorLabel(value)
        except ValueError:
            return models.ColorLabel.NONE
    return models.ColorLabel.NONE


def _clamp_rating(value: int | None) -> int:
    if value is None:
        return 0
    return max(0, min(int(value), 5))


async def get_state_for_link(db: AsyncSession, link_id: uuid.UUID) -> models.MetadataState | None:
    return (
        await db.execute(
            select(models.MetadataState).where(models.MetadataState.link_id == link_id)
        )
    ).scalar_one_or_none()


async def ensure_state_for_link(
    db: AsyncSession,
    link: models.ProjectAsset,
    *,
    template: models.MetadataState | None = None,
    source_project_id: uuid.UUID | None = None,
) -> models.MetadataState:
    existing = await get_state_for_link(db, link.id)
    if existing:
        return existing

    color_label = _coerce_color_label(template.color_label if template else None)
    rating = _clamp_rating(getattr(template, "rating", None))
    picked = bool(getattr(template, "picked", False)) if template else False
    rejected = bool(getattr(template, "rejected", False)) if template else False
    edits = getattr(template, "edits", None) if template else None
    inherit_source = source_project_id or getattr(template, "source_project_id", None)

    state = models.MetadataState(
        link_id=link.id,
        rating=rating,
        color_label=color_label,
        picked=picked,
        rejected=rejected,
        edits=edits,
        source_project_id=inherit_source,
    )
    db.add(state)
    await db.flush()
    return state


async def ensure_states_for_links(
    db: AsyncSession,
    links: Iterable[models.ProjectAsset],
) -> dict[uuid.UUID, models.MetadataState]:
    link_ids = [link.id for link in links]
    if not link_ids:
        return {}
    rows = (
        await db.execute(
            select(models.MetadataState).where(models.MetadataState.link_id.in_(link_ids))
        )
    ).scalars().all()
    by_id = {row.link_id: row for row in rows}
    missing = [link for link in links if link.id not in by_id]
    for link in missing:
        state = models.MetadataState(link_id=link.id)
        db.add(state)
        await db.flush()
        by_id[link.id] = state
    return by_id
