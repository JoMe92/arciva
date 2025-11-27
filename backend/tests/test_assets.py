import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from backend.app import models
from backend.app.storage import PosixStorage


async def _seed_asset(
    session, project_id: uuid.UUID, filename: str, mime: str
) -> uuid.UUID:
    storage = PosixStorage.from_env()
    sha = uuid.uuid4().hex
    ext = Path(filename).suffix or ".bin"
    original_path = storage.original_path_for(sha, ext)
    original_path.write_bytes(b"data")

    asset = models.Asset(
        user_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
        original_filename=filename,
        mime=mime,
        size_bytes=123,
        status=models.AssetStatus.READY,
        storage_uri=storage.storage_key_for(original_path),
        sha256=sha,
        reference_count=1,
    )
    session.add(asset)
    await session.flush()
    link = models.ProjectAsset(
        user_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
        project_id=project_id,
        asset_id=asset.id,
    )
    session.add(link)
    await session.flush()
    session.add(models.MetadataState(link_id=link.id))
    await session.commit()
    return asset.id


@pytest.mark.asyncio
async def test_pair_detection_and_listing(client, TestSessionLocal):
    payload = {"title": "Pairs", "client": "ACME", "note": "pair test"}
    r = await client.post("/v1/projects", json=payload)
    assert r.status_code == 201
    proj_id = uuid.UUID(r.json()["id"])

    async with TestSessionLocal() as session:
        jpeg_id = await _seed_asset(session, proj_id, "DSCF0001.JPG", "image/jpeg")
        raw_id = await _seed_asset(session, proj_id, "DSCF0001.RAF", "image/x-raf")

    r = await client.get(f"/v1/projects/{proj_id}/assets")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    by_id = {item["id"]: item for item in data}
    assert str(jpeg_id) in by_id and str(raw_id) in by_id
    jpeg_item = by_id[str(jpeg_id)]
    raw_item = by_id[str(raw_id)]
    assert jpeg_item["pair_id"] == raw_item["pair_id"]
    assert jpeg_item["pair_role"] == "JPEG"
    assert raw_item["pair_role"] == "RAW"
    assert jpeg_item["paired_asset_id"] == str(raw_id)
    assert raw_item["paired_asset_id"] == str(jpeg_id)
    assert raw_item["stack_primary_asset_id"] == str(raw_id)


@pytest.mark.asyncio
async def test_interactions_mirror_pair(client, TestSessionLocal):
    payload = {"title": "Interactions", "client": "ACME", "note": "sync"}
    r = await client.post("/v1/projects", json=payload)
    assert r.status_code == 201
    proj_id = uuid.UUID(r.json()["id"])

    async with TestSessionLocal() as session:
        jpeg_id = await _seed_asset(session, proj_id, "FILE0002.JPG", "image/jpeg")
        raw_id = await _seed_asset(session, proj_id, "FILE0002.RAF", "image/x-raf")

    body = {
        "asset_ids": [str(jpeg_id)],
        "rating": 4,
        "color_label": "Red",
        "picked": True,
        "rejected": False,
    }
    r = await client.post(
        f"/v1/projects/{proj_id}/assets/interactions:apply", json=body
    )
    assert r.status_code == 200
    payload = r.json()
    assert "items" in payload
    items = payload["items"]
    assert len(items) == 2
    for item in items:
        assert item["rating"] == 4
        assert item["color_label"] == "Red"
        assert item["picked"] is True
        assert item["rejected"] is False

    async with TestSessionLocal() as session:
        rows = (
            (
                await session.execute(
                    select(models.MetadataState)
                    .join(
                        models.ProjectAsset,
                        models.ProjectAsset.id == models.MetadataState.link_id,
                    )
                    .where(models.ProjectAsset.asset_id.in_([jpeg_id, raw_id]))
                )
            )
            .scalars()
            .all()
        )
        assert len(rows) == 2
        for row in rows:
            assert row.rating == 4
            assert row.color_label == models.ColorLabel.RED
            assert row.picked is True
            assert row.rejected is False
