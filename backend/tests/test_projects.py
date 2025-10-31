import sys
import types
import uuid

import pytest
from sqlalchemy import select


class _FakeRedis:
    async def enqueue_job(self, *_args, **_kwargs):
        return None

    async def close(self):
        return None


async def _fake_create_pool(*_args, **_kwargs):
    return _FakeRedis()


class _FakeRedisSettings:
    @classmethod
    def from_dsn(cls, _dsn):
        return cls()


sys.modules.setdefault("arq", types.SimpleNamespace(create_pool=_fake_create_pool))
sys.modules.setdefault("arq.connections", types.SimpleNamespace(RedisSettings=_FakeRedisSettings))


@pytest.mark.asyncio
async def test_create_and_fetch_project(client):
    # Create
    payload = {"title": "Demo Project", "client": "ACME", "note": "test note"}
    r = await client.post("/v1/projects", json=payload)
    assert r.status_code == 201
    created = r.json()
    assert created["title"] == payload["title"]
    assert created["client"] == payload["client"]
    assert created["note"] == payload["note"]
    assert created["asset_count"] == 0

    proj_id = created["id"]

    # List
    r = await client.get("/v1/projects")
    assert r.status_code == 200
    lst = r.json()
    assert any(p["id"] == proj_id for p in lst)

    # Get by id
    r = await client.get(f"/v1/projects/{proj_id}")
    assert r.status_code == 200
    got = r.json()
    assert got["id"] == proj_id
    assert got["asset_count"] == 0


@pytest.mark.asyncio
async def test_delete_project_requires_confirmation(client):
    payload = {"title": "Delete Me", "client": "ACME", "note": "test note"}
    r = await client.post("/v1/projects", json=payload)
    assert r.status_code == 201
    proj_id = r.json()["id"]

    r = await client.request("DELETE", f"/v1/projects/{proj_id}", json={"confirm_title": "wrong name", "delete_assets": False})
    assert r.status_code == 400

    # project still exists
    r = await client.get(f"/v1/projects/{proj_id}")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_delete_project_keep_assets(client, TestSessionLocal):
    from backend.app import models
    from backend.app.storage import PosixStorage

    payload = {"title": "Keep Assets", "client": "ACME", "note": "d"}
    r = await client.post("/v1/projects", json=payload)
    assert r.status_code == 201
    proj = r.json()
    proj_id = proj["id"]

    storage = PosixStorage.from_env()
    sha = uuid.uuid4().hex
    original_path = storage.original_path_for(sha, ".jpg")
    original_path.write_bytes(b"mock-data")
    thumb_path = storage.derivative_path(sha, "thumb_256", "jpg")
    thumb_path.write_bytes(b"thumb")

    async with TestSessionLocal() as session:
        asset = models.Asset(
            original_filename="keep.jpg",
            mime="image/jpeg",
            size_bytes=123,
            status=models.AssetStatus.READY,
            storage_key=str(original_path),
            sha256=sha,
            reference_count=1,
        )
        session.add(asset)
        await session.flush()
        session.add(models.ProjectAsset(project_id=uuid.UUID(proj_id), asset_id=asset.id, is_preview=True, preview_order=0))
        await session.commit()
        asset_id = asset.id

    r = await client.request(
        "DELETE",
        f"/v1/projects/{proj_id}",
        json={"confirm_title": payload["title"], "delete_assets": False},
    )
    assert r.status_code == 204

    # project gone
    r = await client.get(f"/v1/projects/{proj_id}")
    assert r.status_code == 404

    async with TestSessionLocal() as session:
        result = await session.execute(select(models.Asset).where(models.Asset.id == asset_id))
        asset_row = result.scalar_one_or_none()
        assert asset_row is not None
        assert asset_row.reference_count == 0

    # files remain on disk
    assert original_path.exists()
    assert thumb_path.exists()


@pytest.mark.asyncio
async def test_delete_project_remove_assets(client, TestSessionLocal):
    from backend.app import models
    from backend.app.storage import PosixStorage

    payload = {"title": "Remove Assets", "client": "ACME", "note": "d"}
    r = await client.post("/v1/projects", json=payload)
    assert r.status_code == 201
    proj = r.json()
    proj_id = proj["id"]

    storage = PosixStorage.from_env()
    sha = uuid.uuid4().hex
    original_path = storage.original_path_for(sha, ".jpg")
    original_path.write_bytes(b"mock-data")
    thumb_path = storage.derivative_path(sha, "thumb_256", "jpg")
    thumb_path.write_bytes(b"thumb")

    async with TestSessionLocal() as session:
        asset = models.Asset(
            original_filename="remove.jpg",
            mime="image/jpeg",
            size_bytes=321,
            status=models.AssetStatus.READY,
            storage_key=str(original_path),
            sha256=sha,
            reference_count=1,
        )
        session.add(asset)
        await session.flush()
        session.add(models.ProjectAsset(project_id=uuid.UUID(proj_id), asset_id=asset.id, is_preview=False, preview_order=None))
        await session.commit()
        asset_id = asset.id

    r = await client.request(
        "DELETE",
        f"/v1/projects/{proj_id}",
        json={"confirm_title": payload["title"], "delete_assets": True},
    )
    assert r.status_code == 204

    async with TestSessionLocal() as session:
        result = await session.execute(select(models.Asset).where(models.Asset.id == asset_id))
        assert result.scalar_one_or_none() is None

    assert not original_path.exists()
    assert not thumb_path.exists()
