import io
import uuid
import zipfile
from datetime import datetime, timezone

import pytest
from sqlalchemy import delete


@pytest.mark.asyncio
async def test_bulk_image_export_requires_assets(client, TestSessionLocal):
    from backend.app import models

    async with TestSessionLocal() as session:
        await session.execute(delete(models.ProjectAsset))
        await session.execute(delete(models.Asset))
        await session.commit()

    response = await client.post("/v1/bulk-image-exports")
    assert response.status_code == 400
    assert response.json()["detail"] == "No project images available to export."


@pytest.mark.asyncio
async def test_bulk_image_export_flow(client, TestSessionLocal):
    from backend.app import models
    from backend.app.services import bulk_image_exports
    from backend.app.storage import PosixStorage

    async with TestSessionLocal() as session:
        await session.execute(delete(models.ProjectAsset))
        await session.execute(delete(models.Asset))
        await session.commit()

    project_payload = {"title": "Bulk Export", "client": "ACME", "note": "all images"}
    project_res = await client.post("/v1/projects", json=project_payload)
    assert project_res.status_code == 201
    project_id = project_res.json()["id"]

    storage = PosixStorage.from_env()
    sha = uuid.uuid4().hex
    source_path = storage.original_path_for(sha, ".jpg")
    source_path.write_bytes(b"image-data")

    async with TestSessionLocal() as session:
        asset = models.Asset(
            original_filename="Final Shot.jpg",
            mime="image/jpeg",
            size_bytes=10,
            status=models.AssetStatus.READY,
            storage_uri=storage.storage_key_for(source_path),
            taken_at=datetime(2024, 3, 14, 12, 0, tzinfo=timezone.utc),
        )
        session.add(asset)
        await session.flush()
        session.add(models.ProjectAsset(project_id=uuid.UUID(project_id), asset_id=asset.id))
        await session.commit()

    estimate_res = await client.get("/v1/bulk-image-exports/estimate")
    assert estimate_res.status_code == 200
    estimate_payload = estimate_res.json()
    assert estimate_payload["total_files"] == 1
    assert estimate_payload["total_bytes"] == 10
    assert estimate_payload["folder_template"] == bulk_image_exports.FOLDER_TEMPLATE

    start_res = await client.post("/v1/bulk-image-exports")
    assert start_res.status_code == 201
    job_payload = start_res.json()
    assert job_payload["total_files"] == 1
    assert job_payload["date_basis"] == bulk_image_exports.DATE_BASIS_LABEL
    assert job_payload["folder_template"] == bulk_image_exports.FOLDER_TEMPLATE
    job_id = job_payload["id"]

    await bulk_image_exports.process_bulk_image_export(uuid.UUID(job_id))

    status_res = await client.get(f"/v1/bulk-image-exports/{job_id}")
    assert status_res.status_code == 200
    status_payload = status_res.json()
    assert status_payload["status"] == "completed"
    assert status_payload["processed_files"] == 1
    assert status_payload["download_url"] is not None

    download_res = await client.get(f"/v1/bulk-image-exports/{job_id}/download")
    assert download_res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(download_res.content)) as zf:
        names = zf.namelist()
        assert len(names) == 1
        assert names[0] == "2024/03/14/Final Shot.jpg"
        with zf.open(names[0]) as fh:
            assert fh.read() == b"image-data"
